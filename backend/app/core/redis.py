from redis.asyncio import ConnectionPool, Redis
from redis.exceptions import ConnectionError as RedisConnectionError
from redis.exceptions import TimeoutError as RedisTimeoutError

from .config import settings


class RedisManager:
    def __init__(self) -> None:
        self.pool: ConnectionPool | None = None
        self.client: Redis | None = None

    async def initialize(self) -> Redis:
        if self.client is not None:
            return self.client

        pool = ConnectionPool(
            host=settings.REDIS_HOST,
            port=settings.REDIS_PORT,
            decode_responses=False,
            socket_connect_timeout=5,
            socket_timeout=5,
        )
        client = Redis(connection_pool=pool)
        try:
            await client.ping()
        except RedisTimeoutError as exc:
            await pool.aclose()
            raise TimeoutError("Timed out connecting to Redis") from exc
        except RedisConnectionError as exc:
            await pool.aclose()
            raise ConnectionError("Could not connect to Redis") from exc

        self.pool = pool
        self.client = client
        return client

    async def close(self) -> None:
        client, pool = self.client, self.pool
        self.client = None
        self.pool = None

        try:
            if client is not None:
                await client.aclose()
        finally:
            if pool is not None:
                await pool.aclose()

    async def append_audio_frame(self, session_id: str, frame_bytes: bytes) -> None:
        client = self._get_client()
        key = self._buffer_key(session_id)
        max_frames = max(
            1, settings.BUFFER_DURATION_MS // settings.FRAME_DURATION_MS
        )

        try:
            async with client.pipeline(transaction=True) as pipeline:
                await (
                    pipeline.rpush(key, frame_bytes)
                    .ltrim(key, -max_frames, -1)
                    .pexpire(key, settings.BUFFER_DURATION_MS)
                    .execute()
                )
        except RedisTimeoutError as exc:
            raise TimeoutError("Timed out appending an audio frame to Redis") from exc
        except RedisConnectionError as exc:
            raise ConnectionError(
                "Could not append an audio frame to Redis"
            ) from exc

    async def get_buffer_size(self, session_id: str) -> int:
        client = self._get_client()
        key = self._buffer_key(session_id)

        try:
            frames = await client.lrange(key, 0, -1)
        except RedisTimeoutError as exc:
            raise TimeoutError("Timed out checking the audio buffer size") from exc
        except RedisConnectionError as exc:
            raise ConnectionError("Could not check the audio buffer size") from exc

        return sum(len(frame) for frame in frames)

    async def get_and_purge_buffer(self, session_id: str) -> bytes:
        client = self._get_client()
        key = self._buffer_key(session_id)

        try:
            async with client.pipeline(transaction=True) as pipeline:
                result = await pipeline.lrange(key, 0, -1).delete(key).execute()
        except RedisTimeoutError as exc:
            raise TimeoutError(
                "Timed out retrieving the audio buffer from Redis"
            ) from exc
        except RedisConnectionError as exc:
            raise ConnectionError(
                "Could not retrieve the audio buffer from Redis"
            ) from exc

        frames = result[0]
        if not frames:
            return b""
        return b"".join(frames)

    def _get_client(self) -> Redis:
        if self.client is None:
            raise RuntimeError("RedisManager has not been initialized")
        return self.client

    @staticmethod
    def _buffer_key(session_id: str) -> str:
        if not session_id:
            raise ValueError("session_id must not be empty")
        return f"voxguard:session:{session_id}:buffer"


redis_manager = RedisManager()
