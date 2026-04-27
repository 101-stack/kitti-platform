from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, desc
from typing import List
import logging

from app.database import get_db
from app.routes.auth import get_current_user
from app.models.models import User, Transaction, Room, Match
from app.schemas.schemas import UserProfile, TransactionResponse
from pydantic import BaseModel

logger = logging.getLogger(__name__)
router = APIRouter()

# ─── Admin Dependency ──────────────────────────────────────────────────────────

async def get_current_admin(current_user: User = Depends(get_current_user)):
    if not current_user.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have administrative privileges."
        )
    return current_user

# ─── Schemas ───────────────────────────────────────────────────────────────────

class AdminStats(BaseModel):
    total_users: int
    total_coins_in_circ: int
    total_matches: int
    active_rooms: int

class UpdateCoinsRequest(BaseModel):
    amount: int
    reason: str

# ─── Routes ────────────────────────────────────────────────────────────────────

@router.get("/stats", response_model=AdminStats)
async def get_admin_stats(
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_current_admin)
):
    """Platform overview stats"""
    user_count = await db.scalar(select(func.count(User.id)))
    total_coins = await db.scalar(select(func.sum(User.coins)))
    match_count = await db.scalar(select(func.count(Match.id)))
    room_count = await db.scalar(select(func.count(Room.id)).where(Room.status == 'waiting'))
    
    return {
        "total_users": user_count or 0,
        "total_coins_in_circ": total_coins or 0,
        "total_matches": match_count or 0,
        "active_rooms": room_count or 0
    }

@router.get("/users", response_model=List[UserProfile])
async def list_users(
    skip: int = 0,
    limit: int = 100,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_current_admin)
):
    """List all users on the platform"""
    result = await db.execute(select(User).offset(skip).limit(limit).order_by(desc(User.created_at)))
    users = result.scalars().all()
    return users

@router.post("/users/{user_id}/coins")
async def update_user_coins(
    user_id: str,
    data: UpdateCoinsRequest,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_current_admin)
):
    """Admin manual coin adjustment"""
    from uuid import UUID
    user_uuid = UUID(user_id)
    
    result = await db.execute(select(User).where(User.id == user_uuid))
    user = result.scalar_one_or_none()
    
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
        
    balance_before = user.coins
    user.coins += data.amount
    balance_after = user.coins
    
    # Log transaction
    tx = Transaction(
        user_id=user.id,
        amount=data.amount,
        type="credit" if data.amount > 0 else "debit",
        description=f"Admin Adjustment: {data.reason}",
        balance_before=balance_before,
        balance_after=balance_after
    )
    db.add(tx)
    await db.commit()
    
    return {"success": True, "new_balance": user.coins}

@router.post("/users/{user_id}/toggle-active")
async def toggle_user_active(
    user_id: str,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_current_admin)
):
    """Block/unblock a user"""
    from uuid import UUID
    user_uuid = UUID(user_id)
    
    result = await db.execute(select(User).where(User.id == user_uuid))
    user = result.scalar_one_or_none()
    
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
        
    user.is_active = not user.is_active
    await db.commit()
    
    return {"success": True, "is_active": user.is_active}

@router.get("/transactions", response_model=List[TransactionResponse])
async def list_transactions(
    skip: int = 0,
    limit: int = 100,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_current_admin)
):
    """View all platform transactions"""
    result = await db.execute(
        select(Transaction)
        .offset(skip)
        .limit(limit)
        .order_by(desc(Transaction.created_at))
    )
    return result.scalars().all()
