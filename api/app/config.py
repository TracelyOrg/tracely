from __future__ import annotations

from pydantic import model_validator
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    database_url: str = "postgresql+asyncpg://tracely:tracely@localhost:5432/tracely"
    clickhouse_url: str = "http://localhost:8123"
    redis_url: str = "redis://localhost:6379/0"
    jwt_secret: str = "change-me-in-production"
    cors_origins: list[str] = ["http://localhost:3000", "http://localhost:3010"]
    resend_api_key: str = ""
    resend_from_email: str = "noreply@tracely.sh"
    frontend_url: str = "http://localhost:3000"

    model_config = {
        # Support local runs (api/.env) and container runs (/app/.env).
        "env_file": (".env", "/app/.env"),
        "env_file_encoding": "utf-8",
    }

    @model_validator(mode="after")
    def _ensure_asyncpg_scheme(self) -> Settings:
        if self.database_url.startswith("postgresql://"):
            self.database_url = self.database_url.replace(
                "postgresql://", "postgresql+asyncpg://", 1
            )
        return self


settings = Settings()
