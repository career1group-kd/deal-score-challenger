from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    HUBSPOT_API_KEY: str = ""
    DATABASE_URL: str = "sqlite+aiosqlite:///./deal_score.db"
    FRONTEND_URL: str = "http://localhost:3000"
    ALLOWED_ORIGINS: str = ""
    APP_ENV: str = "development"
    APP_PASSWORD: str = ""
    SECRET_KEY: str = "change-me-in-production"

    @property
    def sync_database_url(self) -> str:
        """Return a synchronous database URL for Alembic / sync operations."""
        if self.DATABASE_URL.startswith("sqlite+aiosqlite"):
            return self.DATABASE_URL.replace("sqlite+aiosqlite", "sqlite")
        if self.DATABASE_URL.startswith("postgresql+asyncpg"):
            return self.DATABASE_URL.replace("postgresql+asyncpg", "postgresql")
        return self.DATABASE_URL

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}


@lru_cache()
def get_settings() -> Settings:
    return Settings()
