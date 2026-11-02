from datetime import datetime, timezone
import asyncio
import httpx
import logging

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from ...core.config import settings
from ...core.redis import redis_manager
from ...dsp.feature_extractor import AudioFeatureExtractor
from ...dsp.preprocessor import pcm_to_normalized_tensor
from ...models.model_loader import model_loader
from ...services.alert_dispatcher import alert_dispatcher
from ...services.diri_engine import diri_engine

router = APIRouter()
feature_extractor = AudioFeatureExtractor()

BYTES_PER_SAMPLE = 2
CHANNEL_COUNT = 1
BUFFER_SIZE_BYTES = (
    settings.AUDIO_SAMPLE_RATE
    * BYTES_PER_SAMPLE
    * CHANNEL_COUNT
    * settings.BUFFER_DURATION_MS
    // 1000
)

# You can adjust this URL if your Express route path is slightly different (e.g., /api/audits)
EXPRESS_AUDIT_URL = "http://127.0.0.1:5000/api/v1/alerts"

@router.websocket("/ws/ingest/{session_id}")
async def ingest_audio(websocket: WebSocket, session_id: str) -> None:
    await websocket.accept()
    
    # Initialize tracking variables to hold the highest or final scores of the session
    final_diri_score = 0.0
    final_raw_score = 0.0

    try:
        while True:
            frame_bytes = await websocket.receive_bytes()
            await redis_manager.append_audio_frame(session_id, frame_bytes)

            buffer_size = await redis_manager.get_buffer_size(session_id)
            if buffer_size >= BUFFER_SIZE_BYTES:
                audio_chunk = await redis_manager.get_and_purge_buffer(session_id)
                audio_tensor = await asyncio.to_thread(
                    pcm_to_normalized_tensor,
                    audio_chunk,
                    settings.AUDIO_SAMPLE_RATE,
                )
                feature_tensor = await asyncio.to_thread(
                    feature_extractor.extract_log_mel_spectrogram,
                    audio_tensor,
                )
                raw_score = await asyncio.to_thread(
                    model_loader.predict,
                    feature_tensor,
                )
                diri_score = diri_engine.update_and_compute_diri(
                    session_id, raw_score
                )
                
                # Continuously update the final scores while the session is active
                final_diri_score = diri_score
                final_raw_score = raw_score

                await alert_dispatcher.dispatch_alert_if_needed(
                    session_id, diri_score, raw_score
                )

                await websocket.send_json(
                    {
                        "session_id": session_id,
                        "status": "processed",
                        "diri_score": diri_score,
                        "raw_score": raw_score,
                    }
                )
    except WebSocketDisconnect:
        pass
    finally:
        # Trigger the database save only if audio was actually processed
        if final_diri_score > 0.0:
            # Map the numerical score to your Mongoose schema's strict Status Enum
            if final_diri_score >= 75.0:
                final_status = "CRITICAL_THREAT"
            elif final_diri_score >= 50.0:
                final_status = "WARNING"
            else:
                final_status = "NORMAL"

            try:
                async with httpx.AsyncClient() as client:
                    payload = {
                        "timestamp": datetime.now(timezone.utc).isoformat(),
                        "session_id": session_id,
                        "diri_score": float(final_diri_score),
                        "status": final_status,
                        "model_confidence": float(final_raw_score)
                    }
                    await client.post(EXPRESS_AUDIT_URL, json=payload, timeout=5.0)
            except Exception as e:
                logging.error(f"Failed to save audit log for {session_id} to Express server: {e}")

        # Standard memory cleanup
        diri_engine.cleanup_session(session_id)
        await redis_manager.get_and_purge_buffer(session_id)