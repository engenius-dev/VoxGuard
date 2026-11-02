from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(case_sensitive=False)

    PROJECT_NAME: str = "VoxGuard AI Core"
    REDIS_HOST: str = "localhost"
    REDIS_PORT: int = 6379
    AUDIO_SAMPLE_RATE: int = 16000
    FRAME_DURATION_MS: int = 20
    BUFFER_DURATION_MS: int = 500
    DIRI_THRESHOLD: float = 75.0
    ALERT_RELAY_URL: str = "http://localhost:5000/api/v1/alerts"


settings = Settings()
