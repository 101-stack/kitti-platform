"""
Leaderboard Route
GET /api/leaderboard  — Top players by wins, earnings
"""
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc
from datetime import datetime, timezone
import logging

from app.database import get_db
from app.models.models import User
from app.schemas.schemas import LeaderboardResponse, LeaderboardEntry

logger = logging.getLogger(__name__)
router = APIRouter()


@router.get("/leaderboard", response_model=LeaderboardResponse)
async def get_leaderboard(
    limit: int = Query(default=10, le=100),
    sort_by: str = Query(default="wins", pattern="^(wins|earnings|games)$"),
    db: AsyncSession = Depends(get_db),
):
    """
    Return top players ranked by wins, earnings, or games played.
    Publicly accessible.
    """
    order_col = {
        "wins": desc(User.total_wins),
        "earnings": desc(User.total_earnings),
        "games": desc(User.total_games),
    }.get(sort_by, desc(User.total_wins))

    result = await db.execute(
        select(User)
        .where(User.is_active == True, User.total_games > 0)
        .order_by(order_col)
        .limit(limit)
    )
    users = result.scalars().all()

    entries = []
    for rank, user in enumerate(users, start=1):
        win_rate = (user.total_wins / user.total_games * 100) if user.total_games > 0 else 0
        entries.append(LeaderboardEntry(
            rank=rank,
            user_id=str(user.id),
            username=user.username,
            total_wins=user.total_wins,
            total_games=user.total_games,
            win_rate=round(win_rate, 1),
            total_earnings=user.total_earnings,
            coins=user.coins,
        ))

    return LeaderboardResponse(
        entries=entries,
        total=len(entries),
        updated_at=datetime.now(timezone.utc),
    )
