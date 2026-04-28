"""
Kitti Platform - FastAPI Service
Handles: game logic evaluation, user auth, wallet, leaderboard, match persistence
"""
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import logging

from app.database import engine, Base
from app.routes import auth, game, wallet, matches, leaderboard, admin
from app.config import settings

# ─── Logging ──────────────────────────────────────────────────────────────────
logging.basicConfig(
    level=settings.LOG_LEVEL,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)


def build_allowed_origins() -> list[str]:
    origins = {
        "http://localhost:3000",
        "http://localhost:3001",
        "http://127.0.0.1:3000",
        "http://127.0.0.1:3001",
    }

    for value in (settings.FRONTEND_URL, settings.NODE_SERVER_URL):
        if value:
            origins.add(value.rstrip("/"))

    return sorted(origins)

# ─── App Init ─────────────────────────────────────────────────────────────────
app = FastAPI(
    title="Kitti Platform API",
    description="Game logic, wallet, and data persistence for Kitti multiplayer platform",
    version="1.0.0",
    docs_url="/docs" if settings.NODE_ENV != "production" else None,
    redoc_url="/redoc" if settings.NODE_ENV != "production" else None,
)

# ─── CORS ─────────────────────────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=build_allowed_origins(),
    allow_origin_regex=r"https://.*\.up\.railway\.app",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─── Internal Key Middleware ───────────────────────────────────────────────────
@app.middleware("http")
async def internal_key_middleware(request: Request, call_next):
    """Protect internal routes from external access"""
    internal_routes = ["/api/evaluate-round", "/api/validate-sets", "/api/wallet/transaction", "/api/matches/complete"]
    path = request.url.path
    if any(path.startswith(r) for r in internal_routes):
        key = request.headers.get("x-internal-key")
        if key != settings.INTERNAL_API_KEY:
            logger.warning(f"Blocked internal route access: {path} from {request.client.host}")
            return JSONResponse(status_code=403, content={"detail": "Forbidden"})
    return await call_next(request)

# ─── Startup / Shutdown ────────────────────────────────────────────────────────
@app.on_event("startup")
async def startup():
    logger.info("Kitti FastAPI service starting up...")
    # Tables are created via Alembic migrations in production
    # For development, auto-create
    if settings.NODE_ENV == "development":
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
    logger.info("Database ready")

@app.on_event("shutdown")
async def shutdown():
    logger.info("Kitti FastAPI service shutting down...")
    await engine.dispose()

# ─── Health ────────────────────────────────────────────────────────────────────
@app.get("/health")
async def health():
    return {"status": "ok", "service": "kitti-fastapi", "version": "1.0.0"}

# ─── Routers ──────────────────────────────────────────────────────────────────
app.include_router(auth.router, prefix="/api/auth", tags=["Authentication"])
app.include_router(game.router, prefix="/api", tags=["Game Logic"])
app.include_router(wallet.router, prefix="/api/wallet", tags=["Wallet"])
app.include_router(matches.router, prefix="/api/matches", tags=["Matches"])
app.include_router(admin.router, prefix="/api/admin", tags=["Admin"])
app.include_router(leaderboard.router, prefix="/api", tags=["Leaderboard"])
