from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.config import settings
from app.api.router import api_router
from app.database import engine, Base
import app.models  # Ensure all models are imported so Base.metadata is complete

# Create SQLite database tables if not existing
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title=settings.APP_NAME,
    description="Backend services for dynamic orbit propagation, pass prediction, and resident space object tracking.",
    version="3.0.0"
)

# Backend binds exclusively to 127.0.0.1 so only local callers can reach it.
# Using allow_origins=["*"] is safe here: no external network exposure.
# allow_credentials must be False when allow_origins=["*"] (CORS spec).
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register API Router
app.include_router(api_router, prefix="/api/v1")

from fastapi.responses import FileResponse, JSONResponse
from fastapi import HTTPException
import os
from pathlib import Path

frontend_dist_env = os.environ.get("TRSAT_FRONTEND_DIST_DIR")
if frontend_dist_env:
    FRONTEND_DIST_DIR = Path(frontend_dist_env)
else:
    FRONTEND_DIST_DIR = Path(__file__).parent.parent.parent / "frontend" / "dist"

@app.get("/api")
async def api_root():
    """
    Service entry point returning simple greetings message.
    """
    return {
        "message": "TR-SAT Mission Control V3 API"
    }

@app.get("/{full_path:path}")
async def serve_spa(full_path: str):
    if full_path.startswith("api/") or full_path == "api":
        raise HTTPException(status_code=404, detail="Not Found")
        
    if not FRONTEND_DIST_DIR.exists():
        return JSONResponse(
            status_code=404, 
            content={"message": "Frontend build not found. Run TR-SAT-Build.bat first."}
        )
        
    # Check if the requested file exists
    file_path = FRONTEND_DIST_DIR / full_path
    if full_path and file_path.is_file():
        return FileResponse(file_path)
        
    # SPA Fallback
    index_path = FRONTEND_DIST_DIR / "index.html"
    if index_path.is_file():
        return FileResponse(index_path)
        
    return JSONResponse(
        status_code=404, 
        content={"message": "Frontend index.html not found. Run TR-SAT-Build.bat first."}
    )
