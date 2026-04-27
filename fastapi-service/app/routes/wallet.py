"""
Wallet Routes — Internal + public wallet management
POST /api/wallet/transaction  — Debit/credit coins (internal)
GET  /api/wallet/balance      — Get user balance (public)
GET  /api/wallet/history      — Get transaction history (public)
"""
from fastapi import APIRouter, Depends, HTTPException, Header
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc
from uuid import UUID
import logging

from app.database import get_db
from app.schemas.schemas import (
    TransactionRequest, TransactionResponse, WalletBalance
)
from app.models.models import User, Transaction, TransactionType
from app.services.auth_service import get_user_by_id, decode_token

logger = logging.getLogger(__name__)
router = APIRouter()


async def _get_user_or_404(db: AsyncSession, user_id: str) -> User:
    user = await get_user_by_id(db, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user


# ─── Internal: Process Transaction ────────────────────────────────────────────

@router.post("/transaction", response_model=TransactionResponse)
async def process_transaction(
    data: TransactionRequest,
    db: AsyncSession = Depends(get_db),
):
    """
    Atomically update user coins and record transaction.
    Protected by internal API key middleware in main.py.
    """
    try:
        user = await _get_user_or_404(db, data.user_id)

        if data.type == "debit" and user.coins < data.amount:
            raise HTTPException(status_code=400, detail="Insufficient coins")

        balance_before = user.coins

        if data.type == "credit":
            user.coins += data.amount
            user.total_earnings += data.amount
        elif data.type in ("debit", "refund"):
            user.coins -= data.amount
            if data.type == "refund":
                user.coins += data.amount  # Refund adds back

        balance_after = user.coins

        tx = Transaction(
            user_id=user.id,
            match_id=UUID(data.match_id) if data.match_id else None,
            amount=data.amount,
            type=TransactionType(data.type),
            description=data.description or f"{data.type.title()} of {data.amount} coins",
            balance_before=balance_before,
            balance_after=balance_after,
        )
        db.add(tx)
        await db.flush()
        await db.refresh(tx)

        logger.info(f"Transaction: {data.type} {data.amount} coins for user {data.user_id}")
        return TransactionResponse.model_validate(tx)

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Transaction error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ─── Public: Balance ──────────────────────────────────────────────────────────

@router.get("/balance", response_model=WalletBalance)
async def get_balance(
    authorization: str = Header(...),
    db: AsyncSession = Depends(get_db),
):
    token = authorization.replace("Bearer ", "")
    payload = decode_token(token)
    if not payload:
        raise HTTPException(status_code=401, detail="Invalid token")

    user = await _get_user_or_404(db, payload.get("userId") or payload.get("sub"))
    return WalletBalance(
        user_id=str(user.id),
        coins=user.coins,
        total_earnings=user.total_earnings,
    )


# ─── Public: Transaction History ──────────────────────────────────────────────

@router.get("/history")
async def get_transaction_history(
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
        select(Transaction)
        .where(Transaction.user_id == user_id)
        .order_by(desc(Transaction.created_at))
        .limit(limit)
        .offset(offset)
    )
    transactions = result.scalars().all()

    return {
        "transactions": [TransactionResponse.model_validate(tx) for tx in transactions],
        "limit": limit,
        "offset": offset,
    }
