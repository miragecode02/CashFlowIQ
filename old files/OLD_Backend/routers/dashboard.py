from datetime import date
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from database import get_db

from services.analytics_engine import (
    get_category_spending_summary,
    get_dashboard_summary,
    get_date_range,
    get_daily_summary,
    get_monthly_summary,
    get_expense_split_summary,
    get_top_spending_merchants,
    get_monthly_category_breakdown,
    detect_spending_anomalies,
    calculate_financial_health_score,
    forecast_savings_trend,
    generate_budget_recommendations,
    generate_financial_narrative,
    get_insights_breach_probability,
    get_insights_cushion_safety,
    get_insights_burn_velocity,
    get_insights_category_drift,
    get_insights_spending_by_weekday,
)

from services.subscription_detector import (
    detect_recurring_transactions,
    mark_recurring_transactions,
)

router = APIRouter()

@router.get("/date-range")
def date_range(db: Session = Depends(get_db)):
    return get_date_range(db, user_id=1)


@router.get("/dashboard-summary")
def dashboard_summary(
    period: str = "all",
    start_date: str | None = None,
    end_date: str | None = None,
    db: Session = Depends(get_db),
):
    start_d = date.fromisoformat(start_date) if start_date else None
    end_d = date.fromisoformat(end_date) if end_date else None
    return get_dashboard_summary(db, user_id=1, period=period, start_date=start_d, end_date=end_d)


@router.get("/monthly-category-breakdown")
def monthly_category_breakdown(db: Session = Depends(get_db)):
    return get_monthly_category_breakdown(db, user_id=1)


@router.get("/category-spending-summary")
def category_spending_summary(
    start_date: str | None = None,
    end_date: str | None = None,
    db: Session = Depends(get_db),
):
    start_d = date.fromisoformat(start_date) if start_date else None
    end_d = date.fromisoformat(end_date) if end_date else None
    return get_category_spending_summary(db, user_id=1, start_date=start_d, end_date=end_d)


@router.get("/top-merchants")
def top_merchants(db: Session = Depends(get_db)):
    return get_top_spending_merchants(db, user_id=1)


@router.get("/expense-split-summary")
def expense_split_summary(db: Session = Depends(get_db)):
    return get_expense_split_summary(db, user_id=1)


@router.post("/classify-expenses")
def classify_expenses(db: Session = Depends(get_db)):
    return mark_recurring_transactions(db, user_id=1)


@router.get("/recurring-detections")
def recurring_detections(db: Session = Depends(get_db)):
    return detect_recurring_transactions(db, user_id=1)


@router.get("/daily-summary")
def daily_summary(
    start_date: str,
    end_date: str,
    db: Session = Depends(get_db),
):
    start_d = date.fromisoformat(start_date)
    end_d = date.fromisoformat(end_date)
    return get_daily_summary(db, user_id=1, start_date=start_d, end_date=end_d)


@router.get("/monthly-summary")
def monthly_summary(
    start_date: str | None = None,
    end_date: str | None = None,
    db: Session = Depends(get_db),
):
    start_d = date.fromisoformat(start_date) if start_date else None
    end_d = date.fromisoformat(end_date) if end_date else None
    return get_monthly_summary(db, user_id=1, start_date=start_d, end_date=end_d)


@router.get("/spending-anomalies")
def spending_anomalies(db: Session = Depends(get_db)):
    return detect_spending_anomalies(db, user_id=1)


@router.get("/financial-health-score")
def financial_health_score(
    start_date: str | None = None,
    end_date: str | None = None,
    db: Session = Depends(get_db),
):
    start_d = date.fromisoformat(start_date) if start_date else None
    end_d = date.fromisoformat(end_date) if end_date else None
    return calculate_financial_health_score(db, user_id=1, start_date=start_d, end_date=end_d)


@router.get("/forecast-savings")
def forecast_savings(db: Session = Depends(get_db)):
    return forecast_savings_trend(db, user_id=1)


@router.get("/budget-recommendations")
def budget_recommendations(
    start_date: str | None = None,
    end_date: str | None = None,
    db: Session = Depends(get_db),
):
    start_d = date.fromisoformat(start_date) if start_date else None
    end_d = date.fromisoformat(end_date) if end_date else None
    return generate_budget_recommendations(db, user_id=1, start_date=start_d, end_date=end_d)


@router.get("/financial-insights")
def financial_insights(
    start_date: str | None = None,
    end_date: str | None = None,
    db: Session = Depends(get_db),
):
    start_d = date.fromisoformat(start_date) if start_date else None
    end_d = date.fromisoformat(end_date) if end_date else None
    return generate_financial_narrative(db, user_id=1, start_date=start_d, end_date=end_d)


@router.get("/insights/breach-probability")
def insights_breach_probability(
    start_date: str | None = None,
    end_date: str | None = None,
    db: Session = Depends(get_db),
):
    start_d = date.fromisoformat(start_date) if start_date else None
    end_d = date.fromisoformat(end_date) if end_date else None
    return get_insights_breach_probability(db, user_id=1, start_date=start_d, end_date=end_d)


@router.get("/insights/cushion-safety")
def insights_cushion_safety(
    start_date: str | None = None,
    end_date: str | None = None,
    db: Session = Depends(get_db),
):
    start_d = date.fromisoformat(start_date) if start_date else None
    end_d = date.fromisoformat(end_date) if end_date else None
    return get_insights_cushion_safety(db, user_id=1, start_date=start_d, end_date=end_d)


@router.get("/insights/burn-velocity")
def insights_burn_velocity(
    start_date: str | None = None,
    end_date: str | None = None,
    db: Session = Depends(get_db),
):
    start_d = date.fromisoformat(start_date) if start_date else None
    end_d = date.fromisoformat(end_date) if end_date else None
    return get_insights_burn_velocity(db, user_id=1, start_date=start_d, end_date=end_d)


@router.get("/insights/category-drift")
def insights_category_drift(
    start_date: str | None = None,
    end_date: str | None = None,
    db: Session = Depends(get_db),
):
    start_d = date.fromisoformat(start_date) if start_date else None
    end_d = date.fromisoformat(end_date) if end_date else None
    return get_insights_category_drift(db, user_id=1, start_date=start_d, end_date=end_d)


@router.get("/insights/spending-by-weekday")
def insights_spending_by_weekday(
    start_date: str | None = None,
    end_date: str | None = None,
    db: Session = Depends(get_db),
):
    start_d = date.fromisoformat(start_date) if start_date else None
    end_d = date.fromisoformat(end_date) if end_date else None
    return get_insights_spending_by_weekday(db, user_id=1, start_date=start_d, end_date=end_d)