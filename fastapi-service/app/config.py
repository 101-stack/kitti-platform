from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    # Server
    NODE_ENV: str = "development"
    LOG_LEVEL: str = "INFO"

    # Database
    DATABASE_URL: str = "sqlite+aiosqlite:///./kitti.db"

    # Redis
    REDIS_URL: str = "redis://localhost:6379/0"

    # JWT
    JWT_SECRET: str = "change-me-to-a-very-long-random-secret"
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 1440  # 24 hours

    # Internal security
    INTERNAL_API_KEY: str = "change-me-internal-key"

    # CORS
    FRONTEND_URL: str = "http://localhost:3000"
    NODE_SERVER_URL: str = "http://localhost:4000"

    # OTP (configure with actual SMS provider)
    OTP_EXPIRE_MINUTES: int = 10
    TWILIO_ACCOUNT_SID: str = ""
    TWILIO_AUTH_TOKEN: str = ""
    TWILIO_PHONE: str = ""

    # Game
    GAME_ENTRY_FEE: int = 100
    NEW_USER_COINS: int = 1000  # Welcome bonus

    class Config:
        env_file = ".env"
        case_sensitive = True


@lru_cache()
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
