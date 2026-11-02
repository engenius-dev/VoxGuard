import asyncio
import logging
from datetime import datetime, timezone
from typing import Any

import httpx

from ..core.config import settings


logger = logging.getLogger(__name__)


class AlertDispatcher:
    def __init__(self) -> None:
        self._client = httpx.AsyncClient(timeout=httpx.Timeout(2.0))
        self._tasks: set[asyncio.Task[None]] = set()

    async def dispatch_alert_if_needed(
        self, session_id: str, diri_score: float, model_confidence: float
    ) -> None:
        if diri_score < settings.DIRI_THRESHOLD:
            return

        payload: dict[str, Any] = {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "session_id": session_id,
            "diri_score": round(diri_score, 2),
            "status": "CRITICAL_THREAT",
            "model_confidence": round(model_confidence, 4),
        }
        task = asyncio.create_task(self._send_alert(payload))
        self._tasks.add(task)
        task.add_done_callback(self._tasks.discard)

    async def close(self) -> None:
        if self._tasks:
            await asyncio.gather(*tuple(self._tasks), return_exceptions=True)
        await self._client.aclose()

    async def _send_alert(self, payload: dict[str, Any]) -> None:
        try:
            response = await self._client.post(settings.ALERT_RELAY_URL, json=payload)
            response.raise_for_status()
            logger.info(
                "Delivered critical-threat alert for session %s",
                payload["session_id"],
            )
        except httpx.HTTPError:
            logger.exception(
                "Failed to deliver critical-threat alert for session %s",
                payload["session_id"],
            )


alert_dispatcher = AlertDispatcher()
