from posixpath import split
from datetime import datetime, timedelta
from sqlalchemy import func
from models import Transaction

from sqlalchemy.orm import Session
from sqlalchemy import func
from models import Transaction
from sqlalchemy import extract
from sqlalchemy import func
from sqlalchemy import extract, func
from statistics import mean, stdev



from datetime import date, timedelta
from sqlalchemy import func
from models import Transaction


def get_date_range(db, user_id: int):
    """Return min and max transaction dates in the dataset."""
    min_d = db.query(func.min(Transaction.date)).filter(
        Transaction.user_id == user_id
    ).scalar()
    max_d = db.query(func.max(Transaction.date)).filter(
        Transaction.user_id == user_id
    ).scalar()
    return {"min_date": str(min_d) if min_d else None, "max_date": str(max_d) if max_d else None}


def get_dashboard_summary(db, user_id, period="all", start_date=None, end_date=None):
    base_query = db.query(Transaction).filter(
        Transaction.user_id == user_id
    )

    latest_date = db.query(func.max(Transaction.date)).filter(
        Transaction.user_id == user_id
    ).scalar()

    if not latest_date:
        return {
            "total_income": 0,
            "total_expense": 0,
            "net_cash_flow": 0,
            "savings_rate_percent": 0,
        }

    query = base_query

    # Custom date range takes precedence
    if start_date is not None and end_date is not None:
        query = query.filter(
            Transaction.date >= start_date,
            Transaction.date <= end_date
        )
    elif period == "day":
        query = query.filter(Transaction.date == latest_date)

    if period == "week":
        start_date = latest_date - timedelta(days=7)
        query = query.filter(
            Transaction.date >= start_date,
            Transaction.date <= latest_date
        )

    elif period == "month":
        start_of_month = date(latest_date.year, latest_date.month, 1)

        # next month
        if latest_date.month == 12:
            next_month = date(latest_date.year + 1, 1, 1)
        else:
            next_month = date(latest_date.year, latest_date.month + 1, 1)

        query = query.filter(
            Transaction.date >= start_of_month,
            Transaction.date < next_month
        )

    elif period == "year":
        start_of_year = date(latest_date.year, 1, 1)
        end_of_year = date(latest_date.year + 1, 1, 1)

        query = query.filter(
            Transaction.date >= start_of_year,
            Transaction.date < end_of_year
        )

    transactions = query.all()

    total_income = sum(t.amount for t in transactions if t.amount > 0)
    total_expense = abs(sum(t.amount for t in transactions if t.amount < 0))
    net_cash_flow = total_income - total_expense

    savings_rate = (
        (net_cash_flow / total_income) * 100 if total_income > 0 else 0
    )

    return {
        "total_income": round(total_income, 2),
        "total_expense": round(total_expense, 2),
        "net_cash_flow": round(net_cash_flow, 2),
        "savings_rate_percent": round(savings_rate, 2),
    }

def get_expense_split_summary(db: Session, user_id: int, start_date=None, end_date=None):

    from sqlalchemy import func

    q_fixed = db.query(func.sum(Transaction.amount)).filter(
        Transaction.user_id == user_id,
        Transaction.expense_type == "fixed"
    )
    q_variable = db.query(func.sum(Transaction.amount)).filter(
        Transaction.user_id == user_id,
        Transaction.expense_type == "variable"
    )
    q_income = db.query(func.sum(Transaction.amount)).filter(
        Transaction.user_id == user_id,
        Transaction.amount > 0
    )
    if start_date is not None:
        q_fixed = q_fixed.filter(Transaction.date >= start_date)
        q_variable = q_variable.filter(Transaction.date >= start_date)
        q_income = q_income.filter(Transaction.date >= start_date)
    if end_date is not None:
        q_fixed = q_fixed.filter(Transaction.date <= end_date)
        q_variable = q_variable.filter(Transaction.date <= end_date)
        q_income = q_income.filter(Transaction.date <= end_date)

    total_fixed = q_fixed.scalar() or 0
    total_variable = q_variable.scalar() or 0
    total_income = q_income.scalar() or 0

    total_fixed = abs(total_fixed)
    total_variable = abs(total_variable)

    fixed_ratio = 0
    if total_income > 0:
        fixed_ratio = (total_fixed / total_income) * 100

    return {
        "total_fixed_expense": round(total_fixed, 2),
        "total_variable_expense": round(total_variable, 2),
        "fixed_expense_percent_of_income": round(fixed_ratio, 2)
    }

def get_daily_summary(db, user_id: int, start_date, end_date):
    """Daily net cash flow for a date range. Use for short ranges (day/week/month)."""
    results = db.query(
        Transaction.date,
        func.sum(Transaction.amount).label('net')
    ).filter(
        Transaction.user_id == user_id,
        Transaction.date >= start_date,
        Transaction.date <= end_date
    ).group_by(
        Transaction.date
    ).order_by(
        Transaction.date
    ).all()

    return [
        {"date": str(r.date), "net_cash_flow": round(float(r.net), 2)}
        for r in results
    ]


def get_monthly_summary(db, user_id: int, start_date=None, end_date=None):
    q = db.query(
        extract('year', Transaction.date).label('year'),
        extract('month', Transaction.date).label('month'),
        func.sum(Transaction.amount).label('net')
    ).filter(
        Transaction.user_id == user_id
    )
    if start_date is not None:
        q = q.filter(Transaction.date >= start_date)
    if end_date is not None:
        q = q.filter(Transaction.date <= end_date)
    results = q.group_by(
        'year', 'month'
    ).order_by(
        'year', 'month'
    ).all()

    monthly_data = []

    for r in results:
        monthly_data.append({
            "year": int(r.year),
            "month": int(r.month),
            "net_cash_flow": round(float(r.net), 2)
        })

    return monthly_data


def get_monthly_category_breakdown(db, user_id: int):

    results = db.query(
        extract('year', Transaction.date).label('year'),
        extract('month', Transaction.date).label('month'),
        Transaction.category,
        func.sum(Transaction.amount).label("total")
    ).filter(
        Transaction.user_id == user_id,
        Transaction.amount < 0
    ).group_by(
        'year', 'month', Transaction.category
    ).order_by(
        'year', 'month'
    ).all()

    data = []

    for r in results:
        data.append({
            "year": int(r.year),
            "month": int(r.month),
            "category": r.category,
            "total_spent": round(abs(float(r.total)), 2)
        })

    return data

def get_category_spending_summary(db, user_id: int, start_date=None, end_date=None):
    q = db.query(
        Transaction.category,
        func.sum(Transaction.amount).label("total_spent")
    ).filter(
        Transaction.user_id == user_id,
        Transaction.amount < 0
    )
    if start_date is not None:
        q = q.filter(Transaction.date >= start_date)
    if end_date is not None:
        q = q.filter(Transaction.date <= end_date)
    results = q.group_by(
        Transaction.category
    ).order_by(
        func.sum(Transaction.amount)
    ).all()

    category_summary = []

    for r in results:
        category_summary.append({
            "category": r.category,
            "total_spent": round(abs(float(r.total_spent)), 2)
        })

    return category_summary

def get_top_spending_merchants(db, user_id: int, limit: int = 5):

    from sqlalchemy import func

    results = db.query(
        Transaction.merchant,
        func.sum(Transaction.amount).label("total_spent")
    ).filter(
        Transaction.user_id == user_id,
        Transaction.amount < 0
    ).group_by(
        Transaction.merchant
    ).order_by(
        func.sum(Transaction.amount)
    ).limit(limit).all()

    top_merchants = []

    for r in results:
        top_merchants.append({
            "merchant": r.merchant,
            "total_spent": round(abs(float(r.total_spent)), 2)
        })

    return top_merchants


def detect_spending_anomalies(db, user_id: int):

    from sqlalchemy import extract, func

    results = db.query(
        extract('month', Transaction.date).label('month'),
        func.sum(Transaction.amount).label("total")
    ).filter(
        Transaction.user_id == user_id,
        Transaction.amount < 0
    ).group_by(
        'month'
    ).all()

    monthly_totals = [abs(float(r.total)) for r in results]

    if len(monthly_totals) < 3:
        return {"message": "Not enough data for anomaly detection"}

    avg = mean(monthly_totals)
    deviation = stdev(monthly_totals)

    threshold = avg + (1.5 * deviation)

    anomalies = []

    for r in results:
        total = abs(float(r.total))
        if total > threshold:
            anomalies.append({
                "month": int(r.month),
                "total_spent": round(total, 2)
            })

    return {
        "average_monthly_spend": round(avg, 2),
        "anomaly_threshold": round(threshold, 2),
        "anomalies": anomalies
    }

def calculate_financial_health_score(db, user_id: int, start_date=None, end_date=None):

    summary = get_dashboard_summary(db, user_id, start_date=start_date, end_date=end_date)
    split = get_expense_split_summary(db, user_id, start_date=start_date, end_date=end_date)

    income = summary["total_income"]
    expense = summary["total_expense"]
    savings_rate = summary["savings_rate_percent"]

    fixed = split["total_fixed_expense"]
    variable = split["total_variable_expense"]

    score = 100

    # 1️⃣ Savings Score
    if savings_rate < 0:
        score -= 40
    elif savings_rate < 10:
        score -= 25
    elif savings_rate < 20:
        score -= 10

    # 2️⃣ Fixed Expense Ratio
    if income > 0:
        fixed_ratio = (fixed / income) * 100
        if fixed_ratio > 60:
            score -= 20
        elif fixed_ratio > 40:
            score -= 10

    # 3️⃣ Expense Over Income
    if expense > income:
        score -= 20

    return {
        "financial_health_score": max(score, 0),
        "savings_rate": savings_rate,
        "total_income": income,
        "total_expense": expense
    }

def forecast_savings_trend(db, user_id: int, months_ahead: int = 6):

    monthly_data = get_monthly_summary(db, user_id)

    if len(monthly_data) < 2:
        return {"message": "Not enough data for forecasting"}

    nets = [m["net_cash_flow"] for m in monthly_data]

    avg_monthly_net = sum(nets) / len(nets)

    projected = []

    for i in range(1, months_ahead + 1):
        projected.append({
            "month_offset": i,
            "projected_net_cash_flow": round(avg_monthly_net, 2)
        })

    return {
        "average_monthly_net_cash_flow": round(avg_monthly_net, 2),
        "projection_months": months_ahead,
        "forecast": projected
    }

def generate_budget_recommendations(db, user_id: int, start_date=None, end_date=None):

    summary = get_dashboard_summary(db, user_id, start_date=start_date, end_date=end_date)
    categories = get_category_spending_summary(db, user_id, start_date=start_date, end_date=end_date)

    income = summary["total_income"]
    savings_rate = summary["savings_rate_percent"]

    if income == 0:
        return {"message": "No income data available"}

    recommendations = []

    # Sort categories by highest spending
    categories_sorted = sorted(
        categories,
        key=lambda x: x["total_spent"],
        reverse=True
    )

    if not categories_sorted:
        return {"message": "No expense data available"}

    top_category = categories_sorted[0]

    if savings_rate < 0:
        suggested_cut = top_category["total_spent"] * 0.5
    elif savings_rate < 10:
        suggested_cut = top_category["total_spent"] * 0.3
    else:
        suggested_cut = top_category["total_spent"] * 0.1

    recommendations.append({
        "focus_category": top_category["category"],
        "current_spend": top_category["total_spent"],
        "suggested_monthly_budget": round(
            top_category["total_spent"] - suggested_cut, 2
        ),
        "reason": "Improve savings rate"
    })

    return {
        "savings_rate": savings_rate,
        "recommendations": recommendations
    }

def get_insights_breach_probability(db, user_id: int, start_date=None, end_date=None):
    """Estimate month-end deficit risk from savings rate and expense trend."""
    summary = get_dashboard_summary(db, user_id, start_date=start_date, end_date=end_date)
    income = summary["total_income"]
    expense = summary["total_expense"]
    savings_rate = summary["savings_rate_percent"]

    if income == 0:
        return {"probability": 0, "explanation": "No income data to assess risk."}

    if savings_rate < 0:
        deficit = expense - income
        probability = min(90, 50 + abs(savings_rate))
        explanation = f"Spending exceeds income by ₹{abs(deficit):,.0f}. High risk of continued deficit."
    elif savings_rate < 10:
        probability = 35
        explanation = "Low savings rate increases deficit risk if income drops or expenses rise."
    else:
        probability = 15
        explanation = "Healthy savings rate provides buffer against unexpected expenses."

    return {"probability": round(probability, 0), "explanation": explanation}


def get_insights_cushion_safety(db, user_id: int, start_date=None, end_date=None):
    """Estimate emergency fund months from net cash flow pattern."""
    monthly = get_monthly_summary(db, user_id, start_date=start_date, end_date=end_date)
    if len(monthly) < 2:
        return {"monthsCoverage": 0, "maxMonths": 6, "trend": "flat"}

    nets = [m["net_cash_flow"] for m in monthly]
    avg_net = sum(nets) / len(nets)
    expenses = [abs(m["net_cash_flow"]) for m in monthly if m["net_cash_flow"] < 0]
    avg_expense = abs(sum(nets) / len(nets)) if nets else 0
    # Use last 3 months expense as burn rate
    recent = monthly[-3:] if len(monthly) >= 3 else monthly
    burn = abs(sum(m["net_cash_flow"] for m in recent if m["net_cash_flow"] < 0)) / max(len(recent), 1)

    if burn <= 0:
        return {"monthsCoverage": 6, "maxMonths": 6, "trend": "up"}

    # Cumulative positive net as proxy for "savings"
    cumulative = sum(n for n in nets if n > 0)
    months = min(6, max(0, cumulative / burn)) if burn > 0 else 0
    trend = "up" if len(nets) >= 2 and nets[-1] > nets[-2] else "down" if len(nets) >= 2 else "flat"

    return {"monthsCoverage": round(months, 1), "maxMonths": 6, "trend": trend}


def get_insights_burn_velocity(db, user_id: int, start_date=None, end_date=None):
    """Monthly expense trend for burn velocity chart."""
    q = db.query(
        extract('year', Transaction.date).label('year'),
        extract('month', Transaction.date).label('month'),
        func.sum(Transaction.amount).label('expense')
    ).filter(
        Transaction.user_id == user_id,
        Transaction.amount < 0
    )
    if start_date:
        q = q.filter(Transaction.date >= start_date)
    if end_date:
        q = q.filter(Transaction.date <= end_date)
    results = q.group_by('year', 'month').order_by('year', 'month').all()
    monthly_expense = [abs(float(r.expense or 0)) for r in results[-5:]]

    if len(monthly_expense) < 2:
        return {"changePercent": 0, "trendData": monthly_expense}
    trend_data = monthly_expense
    if len(trend_data) < 2:
        return {"changePercent": 0, "trendData": trend_data}

    prev = trend_data[-2] if len(trend_data) >= 2 else trend_data[0]
    curr = trend_data[-1]
    change = ((curr - prev) / prev * 100) if prev > 0 else 0

    return {"changePercent": round(change, 1), "trendData": trend_data}


def get_insights_category_drift(db, user_id: int, start_date=None, end_date=None):
    """Compare current period category spend vs average baseline."""
    categories = get_category_spending_summary(db, user_id, start_date=start_date, end_date=end_date)
    if not categories:
        return []

    totals = [c["total_spent"] or 0 for c in categories]
    avg_baseline = sum(totals) / len(totals) if totals else 0

    drift_items = []
    for c in categories:
        current = c["total_spent"] or 0
        baseline = avg_baseline
        growth = ((current - baseline) / baseline * 100) if baseline > 0 else 0
        drift_items.append({
            "category": c["category"] or "Uncategorized",
            "currentSpend": round(current, 2),
            "baseline": round(baseline, 2),
            "growthPercent": round(growth, 1)
        })
    return sorted(drift_items, key=lambda x: x["growthPercent"], reverse=True)


def get_insights_spending_by_weekday(db, user_id: int, start_date=None, end_date=None):
    """Spending intensity by day of week for heatmap (day only, no hour)."""
    from sqlalchemy import extract
    q = db.query(
        extract('dow', Transaction.date).label('dow'),
        func.sum(Transaction.amount).label('total')
    ).filter(
        Transaction.user_id == user_id,
        Transaction.amount < 0
    )
    if start_date:
        q = q.filter(Transaction.date >= start_date)
    if end_date:
        q = q.filter(Transaction.date <= end_date)
    results = q.group_by('dow').all()

    days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
    by_day = {i: 0 for i in range(7)}
    for r in results:
        dow = int(r.dow) if r.dow is not None else 0
        by_day[dow] = abs(float(r.total or 0))

    max_val = max(by_day.values()) or 1
    cells = []
    for i, day in enumerate(days):
        amount = by_day[i]
        intensity = amount / max_val
        cells.append({"day": day, "intensity": round(intensity, 2), "amount": round(amount, 2)})
    return cells


def generate_financial_narrative(db, user_id: int, start_date=None, end_date=None):

    summary = get_dashboard_summary(db, user_id, start_date=start_date, end_date=end_date)
    split = get_expense_split_summary(db, user_id, start_date=start_date, end_date=end_date)
    score_data = calculate_financial_health_score(db, user_id, start_date=start_date, end_date=end_date)

    savings_rate = summary["savings_rate_percent"]
    fixed_percent = split["fixed_expense_percent_of_income"]
    score = score_data["financial_health_score"]

    insights = []

    # Savings insight
    if savings_rate < 0:
        insights.append(
            "You are currently spending more than you earn."
        )
    elif savings_rate < 10:
        insights.append(
            "Your savings rate is low. Consider reducing discretionary expenses."
        )
    else:
        insights.append(
            "Your savings rate is healthy."
        )

    # Fixed expense insight
    if fixed_percent > 60:
        insights.append(
            "A large portion of your income is locked in fixed expenses."
        )
    elif fixed_percent > 40:
        insights.append(
            "Fixed expenses are moderate but could be optimized."
        )

    # Score interpretation
    if score < 40:
        insights.append(
            "Your overall financial health needs immediate attention."
        )
    elif score < 70:
        insights.append(
            "Your financial health is stable but has room for improvement."
        )
    else:
        insights.append(
            "Your financial health is strong."
        )

    return {
        "financial_health_score": score,
        "insights": insights
    }