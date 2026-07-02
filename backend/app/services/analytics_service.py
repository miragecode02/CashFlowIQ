from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from app.models.models import Transaction, TransactionType, Category, FixedExpense, FixedIncome
from app.schemas.schemas import (
    AnalyticsSummary, MonthlyTrend, CategoryBreakdown, ForecastPoint
)
import pandas as pd
import numpy as np
from datetime import datetime, timedelta, timezone
from collections import defaultdict


def now_utc():
    return datetime.now(timezone.utc)


async def get_analytics_summary(
    db: AsyncSession, user_id: int, months: int = 6
) -> AnalyticsSummary:
    result = await db.execute(
        select(Transaction)
        .options(selectinload(Transaction.category))
        .where(Transaction.user_id == user_id)
        .order_by(Transaction.date.desc())
    )
    transactions = result.scalars().all()

    # fetch fixed expenses
    fe_result = await db.execute(
        select(FixedExpense).where(FixedExpense.user_id == user_id, FixedExpense.is_active == True)
    )
    fixed_expenses = fe_result.scalars().all()

    def to_monthly(fe):
        if fe.frequency == "yearly": return fe.amount / 12
        if fe.frequency == "weekly": return fe.amount * 4.33
        return fe.amount

    fixed_monthly_expense = sum(to_monthly(fe) for fe in fixed_expenses if fe.entry_type == "expense")
    fixed_monthly_income  = sum(to_monthly(fe) for fe in fixed_expenses if fe.entry_type == "income")
    fixed_monthly_total   = fixed_monthly_expense  # kept for backward compat

    # fetch fixed incomes
    fi_result = await db.execute(
        select(FixedIncome).where(FixedIncome.user_id == user_id, FixedIncome.is_active == True)
    )
    fixed_incomes = fi_result.scalars().all()
    fixed_income_monthly_total = sum(
        fi.amount if fi.frequency == "monthly" else
        fi.amount / 12 if fi.frequency == "yearly" else
        fi.amount * 4.33 if fi.frequency == "weekly" else fi.amount
        for fi in fixed_incomes
    )

    if not transactions:
        return AnalyticsSummary(
            total_income=0, total_spending=0, net_savings=0,
            savings_rate=0, monthly_trends=[], category_breakdown=[], top_category=None
        )

    # Build DataFrame with UTC-aware dates
    df = pd.DataFrame([{
        "date": t.date,
        "amount": t.amount,
        "type": t.type.value,
        "category": t.category.name if t.category else "Other",
        "category_color": getattr(t.category, "color", "#6366f1") if t.category else "#6366f1",
    } for t in transactions])

    df["date"] = pd.to_datetime(df["date"], utc=True)

    # Monthly trends (last N months)
    cutoff = now_utc() - timedelta(days=30 * months)
    recent = df[df["date"] >= cutoff]

    # If no recent data, use all data
    if recent.empty:
        recent = df

    # Suppress timezone warning by converting to tz-naive for period
    recent = recent.copy()
    recent["date_naive"] = recent["date"].dt.tz_localize(None)
    recent["month_year"] = recent["date_naive"].dt.to_period("M")

    monthly = (
        recent.groupby(["month_year", "type"])["amount"]
        .sum()
        .unstack(fill_value=0)
        .reset_index()
    )
    monthly["month_label"] = monthly["month_year"].dt.strftime("%b")

    monthly_trends = [
        MonthlyTrend(
            month=row["month_label"],
            income=float(row.get("income", 0)),
            spending=float(row.get("expense", 0)),
        )
        for _, row in monthly.iterrows()
    ]

    # Use most recent month with data (not current calendar month)
    now = now_utc()
    df_copy = df.copy()
    df_copy["date_naive"] = df_copy["date"].dt.tz_localize(None)

    this_month = df_copy[
        (df_copy["date"].dt.month == now.month) &
        (df_copy["date"].dt.year == now.year)
    ]

    # Fall back to most recent month with data if current month empty
    if this_month.empty:
        latest = df_copy["date"].max()
        this_month = df_copy[
            (df_copy["date"].dt.month == latest.month) &
            (df_copy["date"].dt.year == latest.year)
        ]

    total_income = float(this_month[this_month["type"] == "income"]["amount"].sum())
    total_spending = float(this_month[this_month["type"] == "expense"]["amount"].sum())
    net_savings = total_income - total_spending
    savings_rate = (net_savings / total_income * 100) if total_income > 0 else 0

    # Category breakdown from the selected month
    expenses = this_month[this_month["type"] == "expense"]
    cat_totals = expenses.groupby(["category"])["amount"].sum().reset_index()
    cat_totals["category_color"] = "#6366f1"
    cat_totals = cat_totals.sort_values("amount", ascending=False)

    breakdown = []
    for _, row in cat_totals.iterrows():
        pct = (row["amount"] / total_spending * 100) if total_spending > 0 else 0
        breakdown.append(CategoryBreakdown(
            name=row["category"],
            amount=float(row["amount"]),
            percentage=round(float(pct), 1),
            color=row["category_color"],
        ))

    top_category = breakdown[0] if breakdown else None

    fe_list = [
        {
            "id": fe.id,
            "name": fe.name,
            "emoji": fe.emoji,
            "entry_type": getattr(fe, "entry_type", "expense"),
            "monthly_amount": round(to_monthly(fe), 2),
        }
        for fe in fixed_expenses
    ]

    return AnalyticsSummary(
        total_income=total_income,
        total_spending=total_spending,
        net_savings=net_savings,
        savings_rate=round(savings_rate, 1),
        monthly_trends=monthly_trends,
        category_breakdown=breakdown,
        top_category=top_category,
        fixed_expenses_total=round(fixed_monthly_expense, 2),
        fixed_income_total=round(fixed_monthly_income, 2),
        adjusted_spending=round(total_spending + fixed_monthly_expense, 2),
        adjusted_savings=round(net_savings + fixed_monthly_income - fixed_monthly_expense, 2),
        fixed_expenses_list=fe_list,
    )


async def get_spending_forecast(
    db: AsyncSession, user_id: int, days_ahead: int = 30
) -> list[ForecastPoint]:
    result = await db.execute(
        select(Transaction).where(
            Transaction.user_id == user_id,
            Transaction.type == TransactionType.expense,
        )
    )
    transactions = result.scalars().all()

    if len(transactions) < 14:
        avg = np.mean([t.amount for t in transactions]) if transactions else 1000
        return [
            ForecastPoint(
                date=(now_utc() + timedelta(days=i + 1)).strftime("%Y-%m-%d"),
                predicted_spending=round(avg, 2),
                lower_bound=round(avg * 0.8, 2),
                upper_bound=round(avg * 1.2, 2),
            )
            for i in range(days_ahead)
        ]

    try:
        from prophet import Prophet

        df = pd.DataFrame([{"ds": t.date, "y": t.amount} for t in transactions])
        df["ds"] = pd.to_datetime(df["ds"], utc=True).dt.tz_localize(None)
        daily = df.resample("D", on="ds")["y"].sum().reset_index()

        model = Prophet(yearly_seasonality=False, weekly_seasonality=True, daily_seasonality=False)
        model.fit(daily)

        future = model.make_future_dataframe(periods=days_ahead)
        forecast_df = model.predict(future)
        now_naive = datetime.now()
        future_only = forecast_df[forecast_df["ds"] > now_naive].tail(days_ahead)

        return [
            ForecastPoint(
                date=row["ds"].strftime("%Y-%m-%d"),
                predicted_spending=max(0, round(row["yhat"], 2)),
                lower_bound=max(0, round(row["yhat_lower"], 2)),
                upper_bound=max(0, round(row["yhat_upper"], 2)),
            )
            for _, row in future_only.iterrows()
        ]
    except Exception:
        daily_avg = sum(t.amount for t in transactions) / max(
            (transactions[0].date - transactions[-1].date).days, 1
        )
        return [
            ForecastPoint(
                date=(now_utc() + timedelta(days=i + 1)).strftime("%Y-%m-%d"),
                predicted_spending=round(daily_avg, 2),
                lower_bound=round(daily_avg * 0.8, 2),
                upper_bound=round(daily_avg * 1.2, 2),
            )
            for i in range(days_ahead)
        ]


async def detect_anomalies(db: AsyncSession, user_id: int) -> list[dict]:
    result = await db.execute(
        select(Transaction)
        .options(selectinload(Transaction.category))
        .where(
            Transaction.user_id == user_id,
            Transaction.type == TransactionType.expense,
        )
    )
    transactions = result.scalars().all()
    if len(transactions) < 5:
        return []

    df = pd.DataFrame([{
        "id": t.id,
        "amount": t.amount,
        "description": t.description,
        "date": str(t.date),
        "category": t.category.name if t.category else "Other",
    } for t in transactions])

    anomalies = []
    for cat, group in df.groupby("category"):
        if len(group) < 3:
            continue
        mean, std = group["amount"].mean(), group["amount"].std()
        flagged = group[group["amount"] > mean + 2 * std]
        for _, row in flagged.iterrows():
            anomalies.append({
                "transaction_id": int(row["id"]),
                "description": row["description"],
                "amount": float(row["amount"]),
                "category": cat,
                "date": row["date"],
                "avg_for_category": round(float(mean), 2),
                "message": f"This ₹{row['amount']:,.0f} {cat} expense is unusually high (avg ₹{mean:,.0f})",
            })

    return sorted(anomalies, key=lambda x: x["amount"], reverse=True)[:5]