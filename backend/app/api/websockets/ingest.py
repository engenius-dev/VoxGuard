import asyncio
import logging
from datetime import datetime, timezone

import httpx
import torch
from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from ...core.config import settings
from ...core.redis import redis_manager
from ...dsp.feature_extractor import AudioFeatureExtractor
from ...dsp.preprocessor import pcm_to_normalized_tensor
from ...models.model_loader import model_loader
from ...services.diri_engine import diri_engine

router = APIRouter()
feature_extractor = AudioFeatureExtractor()
logger = logging.getLogger(__name__)

BYTES_PER_SAMPLE = 2
CHANNEL_COUNT = 1
STRIDE_DURATION_MS = 500
STRIDE_SIZE_BYTES = (
    settings.AUDIO_SAMPLE_RATE
    * BYTES_PER_SAMPLE
    * CHANNEL_COUNT
    * STRIDE_DURATION_MS
    // 1000
)

EXPRESS_AUDIT_URL = "http://127.0.0.1:5000/api/v1/alerts"


async def _process_audio_windows(
    websocket: WebSocket,
    session_id: str,
    processing_event: asyncio.Event,
    processing_state: dict[str, float],
) -> None:
    is_processing = False

    while True:
        await processing_event.wait()
        processing_event.clear()

        if is_processing:
            continue

        is_processing = True
        try:
            audio_chunk = await redis_manager.get_sliding_window(session_id)
            if not audio_chunk:
                continue

            audio_tensor = await asyncio.to_thread(
                pcm_to_normalized_tensor,
                audio_chunk,
                settings.AUDIO_SAMPLE_RATE,
            )

            audio_stats = await asyncio.to_thread(
                lambda: {
                    "samples": audio_tensor.numel(),
                    "rms": torch.sqrt(torch.mean(audio_tensor**2)).item(),
                    "peak": audio_tensor.abs().max().item(),
                    "non_finite": not torch.isfinite(audio_tensor).all().item(),
                    "clipped_samples": (audio_tensor.abs() >= 0.999).sum().item(),
                }
            )
            logger.info(
                "Audio input diagnostics: samples=%d rms=%.6f peak=%.6f "
                "non_finite=%s clipped_samples=%d",
                audio_stats["samples"],
                audio_stats["rms"],
                audio_stats["peak"],
                audio_stats["non_finite"],
                audio_stats["clipped_samples"],
            )

            # Voice Activity Detection (VAD) Gate
            rms_energy = audio_stats["rms"]
            if rms_energy < 0.008:
                raw_score = 0.0
                diri_score = 0.0
            else:
                feature_tensor = await asyncio.to_thread(
                    feature_extractor.extract_raw_audio,
                    audio_tensor,
                )
                raw_score = await asyncio.to_thread(
                    model_loader.predict,
                    feature_tensor,
                )
                diri_score = diri_engine.update_and_compute_diri(session_id, raw_score)

            processing_state["diri_score"] = diri_score
            processing_state["raw_score"] = raw_score

            # Update peak scores whenever a voiced window hits a new maximum
            if diri_score > processing_state["peak_diri_score"]:
                processing_state["peak_diri_score"] = diri_score
                processing_state["peak_raw_score"] = raw_score

            await websocket.send_json(
                {
                    "session_id": session_id,
                    "status": "processed",
                    "diri_score": diri_score,
                    "raw_score": raw_score,
                }
            )
        except Exception as err:
            logger.error(f"Error during window processing for {session_id}: {err}")
        finally:
            is_processing = False


@router.websocket("/ws/ingest/{session_id}")
async def ingest_audio(websocket: WebSocket, session_id: str) -> None:
    await websocket.accept()

    accumulated_stride_bytes = 0
    processing_event = asyncio.Event()
    processing_state = {
        "diri_score": 0.0,
        "raw_score": 0.0,
        "peak_diri_score": 0.0,
        "peak_raw_score": 0.0,
    }

    processing_task = asyncio.create_task(
        _process_audio_windows(
            websocket, session_id, processing_event, processing_state
        )
    )
    receive_task = asyncio.create_task(websocket.receive_bytes())

    try:
        while True:
            done, _ = await asyncio.wait(
                (receive_task, processing_task),
                return_when=asyncio.FIRST_COMPLETED,
            )
            if processing_task in done:
                await processing_task
                raise RuntimeError("Audio processing task exited unexpectedly")

            frame_bytes = receive_task.result()
            await redis_manager.append_audio_frame(session_id, frame_bytes)
            accumulated_stride_bytes += len(frame_bytes)

            if accumulated_stride_bytes >= STRIDE_SIZE_BYTES:
                accumulated_stride_bytes %= STRIDE_SIZE_BYTES
                processing_event.set()

            receive_task = asyncio.create_task(websocket.receive_bytes())
    except WebSocketDisconnect:
        pass
    finally:
        for task in (receive_task, processing_task):
            if not task.done():
                task.cancel()
        await asyncio.gather(receive_task, processing_task, return_exceptions=True)

        # Always read the peak scores of the session for audit persistence
        final_diri_score = processing_state["peak_diri_score"]
        final_raw_score = processing_state["peak_raw_score"]

        if final_diri_score >= 75.0:
            final_status = "CRITICAL_THREAT"
        elif final_diri_score >= 50.0:
            final_status = "WARNING"
        else:
            final_status = "NORMAL"

        if final_diri_score > 0.0:
            try:
                async with httpx.AsyncClient() as client:
                    payload = {
                        "timestamp": datetime.now(timezone.utc).isoformat(),
                        "session_id": session_id,
                        "diri_score": float(final_diri_score),
                        "status": final_status,
                        "model_confidence": float(final_raw_score),
                    }
                    await client.post(EXPRESS_AUDIT_URL, json=payload, timeout=5.0)
            except Exception as e:
                logger.error(
                    f"Failed to save final audit log for session {session_id}: {e}"
                )

        diri_engine.cleanup_session(session_id)
        await redis_manager.get_and_purge_buffer(session_id)