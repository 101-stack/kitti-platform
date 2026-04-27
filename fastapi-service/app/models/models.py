"""
SQLAlchemy ORM Models for Kitti Platform
"""
import uuid
from datetime import datetime
from sqlalchemy import (
    Column, String, Integer, Boolean,
    DateTime, ForeignKey, Enum, Text, JSON, Numeric, UUID
)
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import enum

from app.database import Base


# ─── Enums ─────────────────────────────────────────────────────────────────────

class RoomStatus(str, enum.Enum):
    waiting = "waiting"
    playing = "playing"
    finished = "finished"
    cancelled = "cancelled"


class MatchStatus(str, enum.Enum):
    in_progress = "in_progress"
    complete = "complete"
    cancelled = "cancelled"


class TransactionType(str, enum.Enum):
    credit = "credit"
    debit = "debit"
    refund = "refund"


# ─── Models ────────────────────────────────────────────────────────────────────

class User(Base):
    __tablename__ = "users"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    username = Column(String(50), nullable=False, unique=True, index=True)
    email = Column(String(255), unique=True, index=True, nullable=True)
    phone = Column(String(20), unique=True, index=True, nullable=True)
    password_hash = Column(String(255), nullable=True)  # nullable for OTP-only users
    coins = Column(Integer, nullable=False, default=1000)
    is_active = Column(Boolean, default=True, nullable=False)
    is_admin = Column(Boolean, default=False, nullable=False)
    is_verified = Column(Boolean, default=False, nullable=False)
    avatar_url = Column(String(500), nullable=True)

    # Stats (denormalized for performance)
    total_games = Column(Integer, default=0, nullable=False)
    total_wins = Column(Integer, default=0, nullable=False)
    total_earnings = Column(Integer, default=0, nullable=False)

    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    last_seen_at = Column(DateTime(timezone=True), nullable=True)

    # Relationships
    rooms_hosted = relationship("Room", back_populates="host", foreign_keys="Room.host_id")
    transactions = relationship("Transaction", back_populates="user")
    match_players = relationship("MatchPlayer", back_populates="user")


class Room(Base):
    __tablename__ = "rooms"

    id = Column(String(8), primary_key=True)  # Short room code e.g. "A3F9B2C1"
    host_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    status = Column(Enum(RoomStatus), default=RoomStatus.waiting, nullable=False)
    max_players = Column(Integer, default=2, nullable=False)
    entry_fee = Column(Integer, default=100, nullable=False)
    options = Column(JSON, default=dict, nullable=False)  # { enable235Rule: bool }

    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    closed_at = Column(DateTime(timezone=True), nullable=True)

    # Relationships
    host = relationship("User", back_populates="rooms_hosted", foreign_keys=[host_id])
    matches = relationship("Match", back_populates="room")


class Match(Base):
    __tablename__ = "matches"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    room_id = Column(String(8), ForeignKey("rooms.id"), nullable=False)
    winner_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)  # null = tie
    status = Column(Enum(MatchStatus), default=MatchStatus.in_progress, nullable=False)
    total_pot = Column(Integer, default=0, nullable=False)
    is_tie = Column(Boolean, default=False, nullable=False)
    result_data = Column(JSON, nullable=True)  # Full result snapshot

    started_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    completed_at = Column(DateTime(timezone=True), nullable=True)

    # Relationships
    room = relationship("Room", back_populates="matches")
    players = relationship("MatchPlayer", back_populates="match")


class MatchPlayer(Base):
    """Stores per-player match stats"""
    __tablename__ = "match_players"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    match_id = Column(UUID(as_uuid=True), ForeignKey("matches.id"), nullable=False)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    sets_won = Column(Integer, default=0, nullable=False)
    is_winner = Column(Boolean, default=False, nullable=False)
    coins_earned = Column(Integer, default=0, nullable=False)
    coins_lost = Column(Integer, default=0, nullable=False)

    # Relationships
    match = relationship("Match", back_populates="players")
    user = relationship("User", back_populates="match_players")


class Transaction(Base):
    __tablename__ = "transactions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    match_id = Column(UUID(as_uuid=True), ForeignKey("matches.id"), nullable=True)
    amount = Column(Integer, nullable=False)
    type = Column(Enum(TransactionType), nullable=False)
    description = Column(String(255), nullable=True)
    balance_before = Column(Integer, nullable=False)
    balance_after = Column(Integer, nullable=False)

    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    # Relationships
    user = relationship("User", back_populates="transactions")


class OTPCode(Base):
    """OTP codes for phone/email verification"""
    __tablename__ = "otp_codes"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    target = Column(String(255), nullable=False, index=True)  # phone or email
    code = Column(String(6), nullable=False)
    is_used = Column(Boolean, default=False)
    expires_at = Column(DateTime(timezone=True), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
