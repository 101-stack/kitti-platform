"""
Authentication routes
POST /api/auth/request-otp   — Send OTP to phone/email
POST /api/auth/verify-otp    — Verify OTP and get JWT
POST /api/auth/register      — Classic register
POST /api/auth/login         — Classic login
GET  /api/auth/me            — Get current user
"""
from fastapi import APIRouter, Depends, HTTPException, status, Header
from sqlalchemy.ext.asyncio import AsyncSession
import logging

from app.database import get_db
from app.schemas.schemas import (
    OTPRequest, OTPVerify, QuickLoginRequest, LoginResponse, RegisterRequest,
    UserPublic, UserProfile
)
from app.services import auth_service
from app.models.models import User

logger = logging.getLogger(__name__)
router = APIRouter()


# ─── Dependency: Get current user from Bearer token ───────────────────────────

async def get_current_user(
    authorization: str = Header(...),
    db: AsyncSession = Depends(get_db),
) -> User:
    token = authorization.replace("Bearer ", "")
    payload = auth_service.decode_token(token)
    if not payload:
        raise HTTPException(status_code=401, detail="Invalid or expired token")

    user = await auth_service.get_user_by_id(db, payload.get("userId") or payload.get("sub"))
    if not user or not user.is_active:
        raise HTTPException(status_code=401, detail="User not found or inactive")
    return user


# ─── Quick Login (Skip Auth) ──────────────────────────────────────────────────

@router.post("/quick-login", response_model=LoginResponse)
async def quick_login(data: QuickLoginRequest, db: AsyncSession = Depends(get_db)):
    """Instant login with just a username — creates user if doesn't exist"""
    try:
        username = data.username.strip()
        logger.info(f"Quick login attempt: {username}")
        
        # Find user by username
        user = await auth_service.get_user_by_username(db, username)
        
        if (not user):
            # Create new guest user
            user = await auth_service.create_user(
                db,
                username=username,
                phone=None,
                email=None,
            )
            logger.info(f"New guest user created: {username}")
        else:
            logger.info(f"Returning user login: {username}")
        
        # Persist changes
        await db.commit()
        await db.refresh(user)

        token = auth_service.create_access_token(user)
        return LoginResponse(access_token=token, user=UserPublic.model_validate(user))
    except Exception as e:
        logger.error(f"Error in quick_login: {str(e)}", exc_info=True)
        await db.rollback()
        raise HTTPException(status_code=500, detail=str(e))


# ─── OTP Flow ─────────────────────────────────────────────────────────────────

@router.post("/request-otp", status_code=200)
async def request_otp(data: OTPRequest, db: AsyncSession = Depends(get_db)):
    """Send a 6-digit OTP via SMS or email"""
    otp_code = auth_service.generate_otp()
    await auth_service.save_otp(db, data.target, otp_code)

    # TODO: Integrate with Twilio/AWS SNS for real SMS
    # For development, return OTP in response (remove in production!)
    if True:  # Replace with: settings.NODE_ENV == "development"
        logger.info(f"[DEV] OTP for {data.target}: {otp_code}")
        return {"message": "OTP sent", "dev_otp": otp_code}

    return {"message": "OTP sent successfully"}


@router.post("/verify-otp", response_model=LoginResponse)
async def verify_otp(data: OTPVerify, db: AsyncSession = Depends(get_db)):
    """Verify OTP and return JWT — creates user if first time"""
    is_valid = await auth_service.verify_otp(db, data.target, data.code)
    if not is_valid:
        raise HTTPException(status_code=400, detail="Invalid or expired OTP")

    # Find or create user
    user = await auth_service.get_user_by_phone_or_email(db, data.target)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account not found. Registration is disabled."
        )

    token = auth_service.create_access_token(user)
    return LoginResponse(access_token=token, user=UserPublic.model_validate(user))


# ─── Classic Auth ─────────────────────────────────────────────────────────────

@router.post("/register", response_model=LoginResponse, status_code=201)
async def register(data: RegisterRequest, db: AsyncSession = Depends(get_db)):
    """Register a new user — DISABLED"""
    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="Registration is currently disabled."
    )


# ─── Profile ──────────────────────────────────────────────────────────────────

@router.get("/me", response_model=UserProfile)
async def get_me(current_user: User = Depends(get_current_user)):
    return UserProfile.model_validate(current_user)
