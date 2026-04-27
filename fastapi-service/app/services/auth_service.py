"""
Authentication service — OTP generation, JWT creation, user management
"""
import random
import string
from datetime import datetime, timedelta, timezone
from typing import Optional
from uuid import UUID

from jose import jwt, JWTError
from passlib.context import CryptContext
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_

from app.config import settings
from app.models.models import User, OTPCode

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


# ─── Password Helpers ──────────────────────────────────────────────────────────

def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)


# ─── JWT Helpers ───────────────────────────────────────────────────────────────

def create_access_token(user: User) -> str:
    expire = datetime.now(timezone.utc) + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    payload = {
        "sub": str(user.id),
        "userId": str(user.id),
        "username": user.username,
        "email": user.email,
        "coins": user.coins,
        "exp": expire,
        "iat": datetime.now(timezone.utc),
    }
    return jwt.encode(payload, settings.JWT_SECRET, algorithm=settings.JWT_ALGORITHM)


def decode_token(token: str) -> Optional[dict]:
    try:
        return jwt.decode(token, settings.JWT_SECRET, algorithms=[settings.JWT_ALGORITHM])
    except JWTError:
        return None


# ─── OTP Helpers ──────────────────────────────────────────────────────────────

def generate_otp() -> str:
    """Generate a 6-digit OTP"""
    return "".join(random.choices(string.digits, k=6))


async def save_otp(db: AsyncSession, target: str, code: str) -> OTPCode:
    """Save OTP to DB, invalidating previous ones"""
    # Invalidate previous unused OTPs for this target
    result = await db.execute(
        select(OTPCode).where(
            and_(OTPCode.target == target, OTPCode.is_used == False)
        )
    )
    old_otps = result.scalars().all()
    for otp in old_otps:
        otp.is_used = True

    expires_at = datetime.now(timezone.utc) + timedelta(minutes=settings.OTP_EXPIRE_MINUTES)
    new_otp = OTPCode(target=target, code=code, expires_at=expires_at)
    db.add(new_otp)
    await db.flush()
    return new_otp


async def verify_otp(db: AsyncSession, target: str, code: str) -> bool:
    """Verify OTP — marks as used on success"""
    now = datetime.now(timezone.utc)
    result = await db.execute(
        select(OTPCode).where(
            and_(
                OTPCode.target == target,
                OTPCode.code == code,
                OTPCode.is_used == False,
                OTPCode.expires_at > now,
            )
        )
    )
    otp = result.scalar_one_or_none()
    if otp:
        otp.is_used = True
        return True
    return False


# ─── User Helpers ──────────────────────────────────────────────────────────────

async def get_user_by_id(db: AsyncSession, user_id: str) -> Optional[User]:
    result = await db.execute(select(User).where(User.id == UUID(user_id)))
    return result.scalar_one_or_none()


async def get_user_by_username(db: AsyncSession, username: str) -> Optional[User]:
    result = await db.execute(select(User).where(User.username == username))
    return result.scalar_one_or_none()


async def get_user_by_phone_or_email(db: AsyncSession, target: str) -> Optional[User]:
    result = await db.execute(
        select(User).where(
            (User.phone == target) | (User.email == target)
        )
    )
    return result.scalar_one_or_none()


async def create_user(db: AsyncSession, username: str, phone: str = None, email: str = None) -> User:
    user = User(
        username=username,
        phone=phone,
        email=email,
        coins=settings.NEW_USER_COINS,
        is_verified=True,
    )
    db.add(user)
    await db.flush()
    await db.refresh(user)
    return user
