from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str = "postgresql+psycopg2://pollscale:pollscale@localhost:5432/pollscale"
    pollscale_env: str = "development"
    jwt_secret: str = "dev-only-change-me"
    jwt_expire_days: int = 30
    public_base_url: str = "http://localhost:8000"
    auto_seed: bool = True
    allow_dev_auth: bool = False

    apple_client_id: str = ""
    apple_team_id: str = ""
    apple_key_id: str = ""
    google_client_id: str = ""

    s3_endpoint: str = ""
    s3_access_key: str = ""
    s3_secret_key: str = ""
    s3_bucket: str = "pollscale"
    s3_region: str = "fsn1"
    s3_public_url: str = ""
    s3_use_ssl: bool = True

    media_dir: str = str(Path(__file__).resolve().parents[1] / "data" / "media")
    guest_vote_limit: int = 3

    openai_api_key: str = ""
    admin_bootstrap_email: str = ""
    admin_bootstrap_password: str = ""
    expo_access_token: str = ""

    @property
    def is_production(self) -> bool:
        return self.pollscale_env.lower() == "production"


@lru_cache
def get_settings() -> Settings:
    return Settings()
