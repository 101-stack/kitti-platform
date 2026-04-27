-- ============================================================
-- Kitti Platform — PostgreSQL Schema
-- Run this to create all tables, indexes, and constraints
-- ============================================================

-- Enable extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ─── Enums ────────────────────────────────────────────────────────────────────

CREATE TYPE room_status AS ENUM ('waiting', 'playing', 'finished', 'cancelled');
CREATE TYPE match_status AS ENUM ('in_progress', 'complete', 'cancelled');
CREATE TYPE transaction_type AS ENUM ('credit', 'debit', 'refund');

-- ─── Users ────────────────────────────────────────────────────────────────────

CREATE TABLE users (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    username        VARCHAR(50)  NOT NULL UNIQUE,
    email           VARCHAR(255) UNIQUE,
    phone           VARCHAR(20)  UNIQUE,
    password_hash   VARCHAR(255),
    coins           BIGINT       NOT NULL DEFAULT 1000 CHECK (coins >= 0),
    is_active       BOOLEAN      NOT NULL DEFAULT TRUE,
    is_verified     BOOLEAN      NOT NULL DEFAULT FALSE,
    avatar_url      VARCHAR(500),

    -- Denormalized stats for fast leaderboard queries
    total_games     INTEGER      NOT NULL DEFAULT 0 CHECK (total_games >= 0),
    total_wins      INTEGER      NOT NULL DEFAULT 0 CHECK (total_wins >= 0),
    total_earnings  BIGINT       NOT NULL DEFAULT 0,

    created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ,
    last_seen_at    TIMESTAMPTZ,

    CONSTRAINT at_least_one_contact CHECK (email IS NOT NULL OR phone IS NOT NULL)
);

CREATE INDEX idx_users_username   ON users(username);
CREATE INDEX idx_users_phone      ON users(phone) WHERE phone IS NOT NULL;
CREATE INDEX idx_users_email      ON users(email) WHERE email IS NOT NULL;
CREATE INDEX idx_users_leaderboard ON users(total_wins DESC, total_earnings DESC)
    WHERE is_active = TRUE AND total_games > 0;

-- ─── Rooms ────────────────────────────────────────────────────────────────────

CREATE TABLE rooms (
    id          VARCHAR(8)   PRIMARY KEY,            -- Short room code
    host_id     UUID         NOT NULL REFERENCES users(id) ON DELETE SET NULL,
    status      room_status  NOT NULL DEFAULT 'waiting',
    max_players INTEGER      NOT NULL DEFAULT 2 CHECK (max_players BETWEEN 2 AND 5),
    entry_fee   INTEGER      NOT NULL DEFAULT 100 CHECK (entry_fee >= 0),
    options     JSONB        NOT NULL DEFAULT '{}',   -- { "enable235Rule": false }
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    closed_at   TIMESTAMPTZ
);

CREATE INDEX idx_rooms_status   ON rooms(status);
CREATE INDEX idx_rooms_host     ON rooms(host_id);

-- ─── Matches ──────────────────────────────────────────────────────────────────

CREATE TABLE matches (
    id           UUID         PRIMARY KEY DEFAULT uuid_generate_v4(),
    room_id      VARCHAR(8)   NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
    winner_id    UUID         REFERENCES users(id) ON DELETE SET NULL,  -- NULL = tie
    status       match_status NOT NULL DEFAULT 'in_progress',
    total_pot    INTEGER      NOT NULL DEFAULT 0 CHECK (total_pot >= 0),
    is_tie       BOOLEAN      NOT NULL DEFAULT FALSE,
    result_data  JSONB,  -- Full snapshot: set results, card hands, points map

    started_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ
);

CREATE INDEX idx_matches_room      ON matches(room_id);
CREATE INDEX idx_matches_winner    ON matches(winner_id) WHERE winner_id IS NOT NULL;
CREATE INDEX idx_matches_started   ON matches(started_at DESC);

-- ─── Match Players ────────────────────────────────────────────────────────────

CREATE TABLE match_players (
    id           UUID    PRIMARY KEY DEFAULT uuid_generate_v4(),
    match_id     UUID    NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
    user_id      UUID    NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    sets_won     INTEGER NOT NULL DEFAULT 0 CHECK (sets_won BETWEEN 0 AND 3),
    is_winner    BOOLEAN NOT NULL DEFAULT FALSE,
    coins_earned INTEGER NOT NULL DEFAULT 0 CHECK (coins_earned >= 0),
    coins_lost   INTEGER NOT NULL DEFAULT 0 CHECK (coins_lost >= 0),

    UNIQUE (match_id, user_id)
);

CREATE INDEX idx_match_players_user  ON match_players(user_id);
CREATE INDEX idx_match_players_match ON match_players(match_id);

-- ─── Transactions ─────────────────────────────────────────────────────────────

CREATE TABLE transactions (
    id             UUID             PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id        UUID             NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    match_id       UUID             REFERENCES matches(id) ON DELETE SET NULL,
    amount         INTEGER          NOT NULL CHECK (amount > 0),
    type           transaction_type NOT NULL,
    description    VARCHAR(255),
    balance_before BIGINT           NOT NULL,
    balance_after  BIGINT           NOT NULL,
    created_at     TIMESTAMPTZ      NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_transactions_user    ON transactions(user_id);
CREATE INDEX idx_transactions_match   ON transactions(match_id) WHERE match_id IS NOT NULL;
CREATE INDEX idx_transactions_created ON transactions(created_at DESC);

-- ─── OTP Codes ────────────────────────────────────────────────────────────────

CREATE TABLE otp_codes (
    id         UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
    target     VARCHAR(255) NOT NULL,   -- Phone or email
    code       VARCHAR(6)  NOT NULL,
    is_used    BOOLEAN     NOT NULL DEFAULT FALSE,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_otp_target ON otp_codes(target, is_used, expires_at);

-- ─── Auto-update updated_at trigger ──────────────────────────────────────────

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ─── Cleanup expired OTPs (run periodically via pg_cron or app) ───────────────

-- DELETE FROM otp_codes WHERE expires_at < NOW() - INTERVAL '1 day';

-- ─── Sample data (dev only) ───────────────────────────────────────────────────

-- INSERT INTO users (username, phone, coins, is_verified, total_games, total_wins)
-- VALUES
--   ('CardShark', '+977-9800000001', 5000, TRUE, 20, 12),
--   ('LuckyAce',  '+977-9800000002', 3200, TRUE, 15, 8),
--   ('KittiKing', '+977-9800000003', 8500, TRUE, 35, 22);
