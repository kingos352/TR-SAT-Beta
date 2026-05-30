from fastapi import APIRouter
from app.api.endpoints import health, catalog, propagation, observer, telemetry, spacetrack, conjunction, catalog_visualization, visibility, assistant, analytics, research, advanced_research, config, user_satellites

api_router = APIRouter()
api_router.include_router(health.router, prefix="/health", tags=["system"])
api_router.include_router(catalog.router, prefix="/catalog", tags=["catalog"])
api_router.include_router(propagation.router, prefix="/propagation", tags=["propagation"])
api_router.include_router(observer.router, prefix="/observer", tags=["observer"])
api_router.include_router(telemetry.router, prefix="/ws", tags=["telemetry"])
api_router.include_router(spacetrack.router, prefix="/spacetrack", tags=["spacetrack"])
api_router.include_router(conjunction.router, prefix="/conjunction", tags=["conjunction"])
api_router.include_router(catalog_visualization.router, prefix="/catalog-visualization", tags=["catalog-visualization"])
api_router.include_router(visibility.router, prefix="/visibility", tags=["visibility"])
api_router.include_router(assistant.router, prefix="/assistant", tags=["assistant"])
api_router.include_router(analytics.router, prefix="/analytics", tags=["analytics"])
api_router.include_router(research.router, prefix="/research", tags=["research"])
api_router.include_router(advanced_research.router, prefix="/advanced-research", tags=["advanced-research"])
api_router.include_router(config.router, prefix="/config", tags=["config"])
api_router.include_router(user_satellites.router, prefix="/user-satellites", tags=["user-satellites"])
