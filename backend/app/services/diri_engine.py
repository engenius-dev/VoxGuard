import math
import threading
from collections import deque


class DIRIEngine:
    def __init__(self, window_size: int = 10) -> None:
        if window_size <= 0:
            raise ValueError("window_size must be greater than zero")
        self._window_size = window_size
        self._session_scores: dict[str, deque[float]] = {}
        self._lock = threading.Lock()

    def update_and_compute_diri(self, session_id: str, raw_score: float) -> float:
        if not session_id:
            raise ValueError("session_id must not be empty")
        if not math.isfinite(raw_score) or not 0.0 <= raw_score <= 1.0:
            raise ValueError("raw_score must be a finite value between 0.0 and 1.0")

        with self._lock:
            scores = self._session_scores.setdefault(
                session_id, deque(maxlen=self._window_size)
            )
            scores.append(raw_score)
            return sum(scores) / len(scores) * 100.0

    def cleanup_session(self, session_id: str) -> None:
        with self._lock:
            self._session_scores.pop(session_id, None)


diri_engine = DIRIEngine()
