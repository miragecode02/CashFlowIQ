from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from app.core.security import get_current_user
from app.schemas.schemas import AnalyticsSummary, ForecastPoint
from app.services import analytics_service

router = APIRouter(prefix="/analytics", tags=["Analytics"])


@router.get("/summary", response_model=AnalyticsSummary)
async def summary(
    months: int = Query(6, ge=1, le=24),
    db: AsyncSession = Depends(get_db),
    user=Depends(get_current_user),
):
    return await analytics_service.get_analytics_summary(db, user.id, months)


@router.get("/forecast", response_model=list[ForecastPoint])
async def forecast(
    days: int = Query(30, ge=7, le=90),
    db: AsyncSession = Depends(get_db),
    user=Depends(get_current_user),
):
    return await analytics_service.get_spending_forecast(db, user.id, days)


@router.get("/anomalies")
async def anomalies(
    db: AsyncSession = Depends(get_db),
    user=Depends(get_current_user),
):
    return await analytics_service.detect_anomalies(db, user.id)
