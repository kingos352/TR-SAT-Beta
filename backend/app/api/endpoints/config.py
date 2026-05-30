from fastapi import APIRouter, HTTPException, Body
from pydantic import BaseModel
import os
from typing import Optional
from app.config import save_env_vars, settings

router = APIRouter()

class SetupRequest(BaseModel):
    cesium_token: str
    spacetrack_user: str
    spacetrack_password: str
    ai_key: Optional[str] = ""

@router.get("/status")
async def get_setup_status():
    cesium_token = settings.CESIUM_ION_TOKEN or os.environ.get("CESIUM_ION_TOKEN", "")
    spacetrack_user = settings.SPACETRACK_USERNAME or os.environ.get("SPACETRACK_USERNAME", "")
    spacetrack_password = settings.SPACETRACK_PASSWORD or os.environ.get("SPACETRACK_PASSWORD", "")
    
    setup_required = not (cesium_token and spacetrack_user and spacetrack_password)
    return {"setup_required": setup_required}

@router.get("/current")
async def get_current_config():
    return {
        "cesium_token": settings.CESIUM_ION_TOKEN,
        "spacetrack_user": settings.SPACETRACK_USERNAME,
        "spacetrack_password": settings.SPACETRACK_PASSWORD,
        "ai_key": settings.GEMINI_API_KEY
    }

@router.post("/setup")
async def perform_setup(req: SetupRequest):
    if not req.cesium_token or not req.spacetrack_user or not req.spacetrack_password:
        raise HTTPException(status_code=400, detail="Missing required fields")
    
    env_data = {
        "CESIUM_ION_TOKEN": req.cesium_token,
        "SPACETRACK_USERNAME": req.spacetrack_user,
        "SPACETRACK_PASSWORD": req.spacetrack_password,
    }
    if req.ai_key:
        env_data["GEMINI_API_KEY"] = req.ai_key
        env_data["AI_PROVIDER"] = "gemini"
    else:
        env_data["GEMINI_API_KEY"] = ""
        env_data["AI_PROVIDER"] = "local"
    
    save_env_vars(env_data)
    
    # Update settings fields dynamically so setup status returns setup_required = False immediately
    settings.CESIUM_ION_TOKEN = req.cesium_token
    settings.SPACETRACK_USERNAME = req.spacetrack_user
    settings.SPACETRACK_PASSWORD = req.spacetrack_password
    if req.ai_key:
        settings.GEMINI_API_KEY = req.ai_key
        settings.AI_PROVIDER = "gemini"
    else:
        settings.GEMINI_API_KEY = ""
        settings.AI_PROVIDER = "local"
    
    return {"status": "success", "message": "Configuration saved"}
