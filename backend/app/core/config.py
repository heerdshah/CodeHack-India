from pydantic_settings import BaseSettings, SettingsConfigDict
from typing import Optional, List
from pathlib import Path

class Settings(BaseSettings):
    # App
    APP_NAME: str = "ResourcX API"
    ENVIRONMENT: str = "development"
    DEBUG: bool = True
    
    # Supabase
    SUPABASE_URL: str = ""
    SUPABASE_ANON_KEY: str = ""
    SUPABASE_SERVICE_KEY: str = ""
    DATABASE_URL: str = ""
    
    # Security & JWT
    JWT_SECRET: str = "resourcx_dev_jwt_secret_must_be_changed_in_prod_1234567890"
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 43200 # 30 days
    COOKIE_NAME: str = "resourcx_token"
    
    # Groq API
    GROQ_API_KEY: Optional[str] = None
    # Confirm models at: https://console.groq.com/docs/models
    GROQ_VISION_MODEL: str = "meta-llama/llama-4-scout-17b-16e-instruct"
    GROQ_TEXT_MODEL: str = "llama-3.3-70b-versatile"
    
    # CORS
    FRONTEND_ORIGIN: str = "http://localhost:3000"
    ALLOWED_ORIGINS: List[str] = ["http://localhost:3000", "http://127.0.0.1:3000"]

    # Email / Notifications
    SMTP_HOST: Optional[str] = None
    SMTP_PORT: int = 587
    SMTP_USER: Optional[str] = None
    SMTP_PASSWORD: Optional[str] = None
    SMTP_FROM: str = "no-reply@resourcx.edu"
    RESEND_API_KEY: Optional[str] = None

    model_config = SettingsConfigDict(
        env_file=(str(Path(__file__).parent.parent.parent / ".env"), str(Path(__file__).parent.parent.parent.parent / ".env")),
        env_file_encoding="utf-8",
        extra="ignore"
    )

settings = Settings()

