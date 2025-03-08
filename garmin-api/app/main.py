from fastapi import FastAPI, Depends, HTTPException, Header, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from typing import Optional
import logging
import json
from datetime import datetime
import asyncio

from .config import settings
from .garmin import auth, sync

# Setup logging
logging.basicConfig(level=getattr(logging, settings.LOG_LEVEL))
logger = logging.getLogger(__name__)

# Initialize FastAPI app
app = FastAPI(
    title=settings.APP_NAME,
    description="FastAPI service for Garmin Connect integration",
    version="1.0.0"
)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Models
class AuthRequest(BaseModel):
    username: str
    password: Optional[str] = None

class SyncRequest(BaseModel):
    username: str
    date: Optional[str] = None

# API key authentication
async def verify_api_key(x_api_key: str = Header(...)):
    if x_api_key != settings.API_KEY:
        logger.warning(f"Invalid API key attempt: {x_api_key[:5]}...")
        raise HTTPException(status_code=401, detail="Invalid API key")
    return x_api_key

# Health check endpoint
@app.get("/health")
async def health_check():
    return {
        "status": "healthy", 
        "timestamp": datetime.now().isoformat(),
        "version": "1.0.0",
        "service": settings.APP_NAME
    }

# Authentication endpoints
@app.post("/auth", dependencies=[Depends(verify_api_key)])
async def authenticate(request: AuthRequest):
    logger.info(f"Authentication request for user: {request.username}")
    result = await auth.authenticate(request.username, request.password)
    
    if result["status"] == "error":
        logger.error(f"Authentication failed for user {request.username}: {result['message']}")
        raise HTTPException(status_code=401, detail=result["message"])
    
    logger.info(f"Authentication successful for user: {request.username}")
    return result

# Data sync endpoints
@app.post("/sync", dependencies=[Depends(verify_api_key)])
async def sync_data(request: SyncRequest):
    logger.info(f"Sync request for user: {request.username}, date: {request.date or 'today'}")
    
    result = await sync.sync_health_data(request.username, request.date)
    
    if result["status"] == "error":
        logger.error(f"Sync failed for user {request.username}: {result['message']}")
        raise HTTPException(status_code=500, detail=result["message"])
    
    logger.info(f"Sync successful for user: {request.username}")
    return result

# Error handler for uncaught exceptions
@app.exception_handler(Exception)
async def generic_exception_handler(request: Request, exc: Exception):
    logger.error(f"Uncaught exception: {str(exc)}")
    return JSONResponse(
        status_code=500,
        content={"status": "error", "message": "Internal server error"}
    )

# Run the application if executed directly
if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=settings.DEBUG) 