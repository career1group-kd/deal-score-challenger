"""
FastAPI entry point for the Deal Score Simulator backend.
"""

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from config import get_settings
from database.db import init_db

# Import routers
from routers.deals import router as deals_router
from routers.scenarios import router as scenarios_router
from routers.scoring import router as scoring_router
from routers.analytics import router as analytics_router
from routers.hubspot import router as hubspot_router
from auth import router as auth_router, AuthMiddleware


settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: create tables
    await init_db()
    yield
    # Shutdown: nothing special needed


app = FastAPI(
    title="Deal Score Simulator",
    description="Backend for simulating, comparing, and backtesting deal scoring scenarios.",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS — build origins dynamically
origins = [settings.FRONTEND_URL, "http://localhost:3000", "http://localhost:5173"]
if settings.ALLOWED_ORIGINS:
    origins.extend([o.strip() for o in settings.ALLOWED_ORIGINS.split(",") if o.strip()])

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Auth middleware (runs after CORS, so OPTIONS preflight still works)
app.add_middleware(AuthMiddleware)

# Register routers
app.include_router(auth_router)
app.include_router(deals_router)
app.include_router(scenarios_router)
app.include_router(scoring_router)
app.include_router(analytics_router)
app.include_router(hubspot_router)


@app.get("/api/health")
async def health_check():
    return {
        "status": "healthy",
        "version": "1.0.0",
        "environment": settings.APP_ENV,
    }
