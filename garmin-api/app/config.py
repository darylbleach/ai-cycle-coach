import os
from dotenv import load_dotenv
from pydantic import BaseSettings

# Load .env file if it exists
load_dotenv()

class Settings(BaseSettings):
    """Application settings"""
    # API Configuration
    API_KEY: str = os.getenv("API_KEY", "your_default_api_key")
    APP_NAME: str = "Garmin API Service"
    DEBUG: bool = os.getenv("DEBUG", "False").lower() == "true"
    
    # Garmin Configuration
    GARMIN_TOKEN_DIR: str = os.getenv("GARMIN_TOKEN_DIR", "./garmin-tokens")
    
    # CORS settings (domains that are allowed to make requests to this API)
    CORS_ORIGINS: list = [
        "http://localhost:3000",
        "https://ai-coach.vercel.app",
        "https://ai-coach-development.vercel.app"
    ]
    
    # Logging
    LOG_LEVEL: str = os.getenv("LOG_LEVEL", "INFO")
    
    class Config:
        env_file = ".env"

# Create settings instance
settings = Settings() 