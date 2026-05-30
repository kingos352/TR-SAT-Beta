from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import text
from app.database import get_db
from app.config import settings

router = APIRouter()

@router.get("", response_model=dict)
async def check_health(db: Session = Depends(get_db)):
    """
    Service health validation endpoint.
    Performs database ping connectivity validation.
    """
    db_status = "configured"
    try:
        # Perform simple query to ping SQLite database
        db.execute(text("SELECT 1"))
    except Exception:
        db_status = "unreachable"

    return {
        "status": "ok",
        "app": settings.APP_NAME,
        "environment": settings.APP_ENV,
        "database": db_status
    }
