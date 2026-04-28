"""
Match Routes
POST /api/matches/complete   — Save completed match (internal)
GET  /api/matches/history    — User match history (public)
GET  /api/matches/{id}       — Match detail (public)
"""
from fastapi import APIRouter, Depends, HTTPException, Header
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc
from sqlalchemy.orm import selectinload
from uuid import UUID
from datetime import datetime, timezone
import logging

from app.database import get_db
from app.schemas.schemas import CompleteMatchRequest, MatchSummary
from app.models.models import Match, MatchPlayer, Room, User, RoomStatus, MatchStatus
from app.services.auth_service import decode_token, get_user_by_id

logger = logging.getLogger(__name__)
router = APIRouter()


# ─── Internal: Complete Match ─────────────────────────────────────────────────

@router.post("/complete")
async def complete_match(
    data: CompleteMatchRequest,
    db: AsyncSession = Depends(get_db),
):
    """
    Save match result to PostgreSQL and update player stats.
    Protected by internal API key middleware.
    """
    try:
        # Fetch or create room record
        room_result = await db.execute(select(Room).where(Room.id == data.room_id))
        room = room_result.scalar_one_or_none()
        if not room:
            logger.warning(f"Room {data.room_id} not in DB — skipping room update")

        # Create match record
        match = Match(
            id=UUID(data.match_id),
            room_id=data.room_id,
            winner_id=UUID(data.winner_id) if data.winner_id else None,
            status=MatchStatus.complete,
            total_pot=data.total_pot,
            is_tie=data.winner_id is None,
            completed_at=datetime.now(timezone.utc),
        )
        db.add(match)
        await db.flush()

        # Create match player records and update user stats
        for pr in data.player_results:
            match_player = MatchPlayer(
                match_id=match.id,
                user_id=UUID(pr.user_id),
                sets_won=pr.sets_won,
                is_winner=pr.is_winner,
                coins_earned=data.total_pot if pr.is_winner else 0,
                coins_lost=0 if pr.is_winner else room.entry_fee if room else 0,
            )
            db.add(match_player)

            # Update user aggregate stats
            user = await get_user_by_id(db, pr.user_id)
            if user:
                user.total_games += 1
                if pr.is_winner:
                    user.total_wins += 1

        # Update room status
        if room:
            room.status = RoomStatus.finished

        await db.flush()
        logger.info(f"Match {match.id} saved. Winner: {data.winner_id or 'TIE'}")

        return {"match_id": str(match.id), "status": "saved"}

    except Exception as e:
        logger.error(f"complete_match error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ─── Public: Match History ────────────────────────────────────────────────────

@router.get("/history")
async def match_history(
    limit: int = 20,
    offset: int = 0,
    authorization: str = Header(...),
    db: AsyncSession = Depends(get_db),
):
    token = authorization.replace("Bearer ", "")
    payload = decode_token(token)
    if not payload:
        raise HTTPException(status_code=401, detail="Invalid token")

    user_id = UUID(payload.get("userId") or payload.get("sub"))

    result = await db.execute(
        select(Match)
        .join(MatchPlayer, MatchPlayer.match_id == Match.id)
        .where(MatchPlayer.user_id == user_id)
        .order_by(desc(Match.started_at))
        .limit(limit)
        .offset(offset)
    )
    matches = result.scalars().all()

    return {
        "matches": [MatchSummary.model_validate(m) for m in matches],
        "limit": limit,
        "offset": offset,
    }


@router.get("/{match_id}")
async def get_match(
    match_id: str,
    authorization: str = Header(...),
    db: AsyncSession = Depends(get_db),
):
    token = authorization.replace("Bearer ", "")
    payload = decode_token(token)
    if not payload:
        raise HTTPException(status_code=401, detail="Invalid token")

    result = await db.execute(
        select(Match)
        .options(selectinload(Match.players))
        .where(Match.id == UUID(match_id))
    )
    match = result.scalar_one_or_none()
    if not match:
        raise HTTPException(status_code=404, detail="Match not found")

    return {
        "match": MatchSummary.model_validate(match),
        "players": [
            {
                "user_id": str(p.user_id),
                "sets_won": p.sets_won,
                "is_winner": p.is_winner,
                "coins_earned": p.coins_earned,
            }
            for p in match.players
        ],
    }
