"""
Pydantic v2 schemas for all API request/response models
"""
from pydantic import BaseModel, EmailStr, Field, field_validator
from typing import Optional, List, Any, Dict
from uuid import UUID
from datetime import datetime
import re


# ─── Auth Schemas ──────────────────────────────────────────────────────────────

class OTPRequest(BaseModel):
    target: str = Field(..., description="Phone number or email address")
    type: str = Field("phone", pattern="^(phone|email)$")


class QuickLoginRequest(BaseModel):
    username: str = Field(..., min_length=3, max_length=50, pattern="^[a-zA-Z0-9_]+$")


class OTPVerify(BaseModel):
    target: str
    code: str = Field(..., min_length=6, max_length=6)
    username: Optional[str] = Field(None, min_length=3, max_length=50)


class LoginResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: "UserPublic"


class RegisterRequest(BaseModel):
    username: str = Field(..., min_length=3, max_length=50, pattern="^[a-zA-Z0-9_]+$")
    email: Optional[EmailStr] = None
    phone: Optional[str] = None
    password: Optional[str] = Field(None, min_length=8)

    @field_validator("username")
    @classmethod
    def username_no_spaces(cls, v):
        if " " in v:
            raise ValueError("Username cannot contain spaces")
        return v


# ─── User Schemas ──────────────────────────────────────────────────────────────

class UserPublic(BaseModel):
    id: UUID
    username: str
    coins: int
    total_games: int
    total_wins: int
    is_verified: bool
    is_admin: bool
    avatar_url: Optional[str] = None
    created_at: datetime

    model_config = {"from_attributes": True}


class UserProfile(UserPublic):
    email: Optional[str] = None
    phone: Optional[str] = None
    is_active: bool
    total_earnings: int


# ─── Card Schemas ──────────────────────────────────────────────────────────────

class CardSchema(BaseModel):
    id: int
    suit: str
    value: int
    display_value: str = Field(alias="displayValue")
    display: str

    model_config = {"populate_by_name": True}


# ─── Game Schemas ──────────────────────────────────────────────────────────────

class PlayerSetSchema(BaseModel):
    user_id: str
    username: Optional[str] = None
    sets: List[List[Dict[str, Any]]]  # 3 sets × 3 cards


class EvaluateRoundRequest(BaseModel):
    player_sets: List[PlayerSetSchema]
    options: Optional[Dict[str, Any]] = Field(default_factory=dict)


class HandResult(BaseModel):
    rank: int
    name: str
    tiebreakers: List[int]
    description: str


class SetResult(BaseModel):
    set_index: int
    rankings: List[Dict[str, Any]]
    winner: Optional[str]
    is_tie: bool


class EvaluateRoundResponse(BaseModel):
    set_results: List[SetResult]
    points_map: Dict[str, int]
    overall_winner: Optional[str]
    is_tie: bool


class ValidateSetsRequest(BaseModel):
    user_id: str
    sets: List[List[Dict[str, Any]]]
    dealt_cards: List[Dict[str, Any]]


class ValidateSetsResponse(BaseModel):
    valid: bool
    error: Optional[str] = None


# ─── Wallet Schemas ────────────────────────────────────────────────────────────

class TransactionRequest(BaseModel):
    user_id: str
    amount: int = Field(..., gt=0)
    type: str = Field(..., pattern="^(credit|debit|refund)$")
    match_id: Optional[str] = None
    description: Optional[str] = None


class TransactionResponse(BaseModel):
    id: UUID
    amount: int
    type: str
    balance_before: int
    balance_after: int
    created_at: datetime

    model_config = {"from_attributes": True}


class WalletBalance(BaseModel):
    user_id: str
    coins: int
    total_earnings: int


# ─── Match Schemas ─────────────────────────────────────────────────────────────

class PlayerResultSchema(BaseModel):
    user_id: str
    sets_won: int
    is_winner: bool


class CompleteMatchRequest(BaseModel):
    match_id: str
    room_id: str
    winner_id: Optional[str] = None
    player_results: List[PlayerResultSchema]
    total_pot: int


class MatchSummary(BaseModel):
    id: UUID
    room_id: str
    winner_id: Optional[UUID]
    total_pot: int
    is_tie: bool
    started_at: datetime
    completed_at: Optional[datetime]

    model_config = {"from_attributes": True}


# ─── Leaderboard Schemas ───────────────────────────────────────────────────────

class LeaderboardEntry(BaseModel):
    rank: int
    user_id: str
    username: str
    total_wins: int
    total_games: int
    win_rate: float
    total_earnings: int
    coins: int


class LeaderboardResponse(BaseModel):
    entries: List[LeaderboardEntry]
    total: int
    updated_at: datetime
