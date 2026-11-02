from contextlib import asynccontextmanager
from typing import AsyncIterator

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .api.websockets.ingest import router as ingest_router
from .core.config import settings
from .core.redis import redis_manager
from .services.alert_dispatcher import alert_dispatcher


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    app.state.redis = await redis_manager.initialize()

    try:
        yield
    finally:
        try:
            await redis_manager.close()
        finally:
            await alert_dispatcher.close()


app = FastAPI(title=settings.PROJECT_NAME, lifespan=lifespan)
app.include_router(ingest_router)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "online", "service": "VoxGuard Core Engine"}
