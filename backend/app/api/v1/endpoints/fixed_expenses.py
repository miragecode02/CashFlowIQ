from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_
from app.core.database import get_db
from app.core.security import get_current_user
from app.models.models import FixedExpense, Transaction, TransactionType, Category
from app.schemas.schemas import FixedExpenseCreate, FixedExpenseOut, FixedExpenseUpdate
from typing import List
from datetime import datetime, timezone

router = APIRouter(prefix="/fixed-expenses", tags=["Fixed Expenses"])

CATEGORY_MAP = {
    "Housing": 6, "Utilities": 7, "Subscriptions": 4, "Insurance": 5,
    "Education": 8, "Health": 5, "Transport": 3, "Investments": 9,
    "Salary": 10, "Freelance": 10, "Rental": 10, "Business": 10,
    "Dividends": 9, "Pension": 10, "Other": 6,
}


@router.get("", response_model=List[FixedExpenseOut])
async def list_fixed_expenses(
    db: AsyncSession = Depends(get_db),
    user=Depends(get_current_user),
):
    result = await db.execute(
        select(FixedExpense)
        .where(FixedExpense.user_id == user.id)
        .order_by(FixedExpense.created_at.desc())
    )
    return result.scalars().all()


@router.post("", response_model=FixedExpenseOut, status_code=201)
async def create_fixed_expense(
    data: FixedExpenseCreate,
    db: AsyncSession = Depends(get_db),
    user=Depends(get_current_user),
):
    fe = FixedExpense(
        user_id=user.id,
        name=data.name,
        amount=data.amount,
        frequency=data.frequency,
        entry_type=data.entry_type,
        category=data.category,
        emoji=data.emoji,
    )
    db.add(fe)
    await db.commit()
    await db.refresh(fe)
    return fe


@router.patch("/{fe_id}", response_model=FixedExpenseOut)
async def update_fixed_expense(
    fe_id: int,
    data: FixedExpenseUpdate,
    db: AsyncSession = Depends(get_db),
    user=Depends(get_current_user),
):
    result = await db.execute(
        select(FixedExpense).where(FixedExpense.id == fe_id, FixedExpense.user_id == user.id)
    )
    fe = result.scalar_one_or_none()
    if not fe:
        raise HTTPException(status_code=404, detail="Not found")
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(fe, field, value)
    await db.commit()
    await db.refresh(fe)
    return fe


@router.delete("/{fe_id}", status_code=204)
async def delete_fixed_expense(
    fe_id: int,
    db: AsyncSession = Depends(get_db),
    user=Depends(get_current_user),
):
    result = await db.execute(
        select(FixedExpense).where(FixedExpense.id == fe_id, FixedExpense.user_id == user.id)
    )
    fe = result.scalar_one_or_none()
    if not fe:
        raise HTTPException(status_code=404, detail="Not found")
    await db.delete(fe)
    await db.commit()


@router.post("/apply-monthly")
async def apply_monthly_fixed(
    db: AsyncSession = Depends(get_db),
    user=Depends(get_current_user),
):
    """
    Auto-create transactions for all active fixed entries for the current month.
    Safe to call multiple times — skips if already applied this month.
    """
    now = datetime.now(timezone.utc)
    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    month_end   = now.replace(day=28, hour=23, minute=59, second=59)

    # Get all active fixed entries
    fe_result = await db.execute(
        select(FixedExpense).where(
            FixedExpense.user_id == user.id,
            FixedExpense.is_active == True,
        )
    )
    fixed_entries = fe_result.scalars().all()

    if not fixed_entries:
        return {"applied": 0, "skipped": 0, "message": "No fixed entries found"}

    applied = 0
    skipped = 0

    for fe in fixed_entries:
        # Check if a transaction with this description already exists this month
        existing = await db.execute(
            select(Transaction).where(
                and_(
                    Transaction.user_id == user.id,
                    Transaction.description == f"[Fixed] {fe.name}",
                    Transaction.date >= month_start,
                    Transaction.date <= month_end,
                )
            )
        )
        if existing.scalar_one_or_none():
            skipped += 1
            continue

        # Calculate monthly amount
        if fe.frequency == "yearly":
            amount = fe.amount / 12
        elif fe.frequency == "weekly":
            amount = fe.amount * 4.33
        else:
            amount = fe.amount

        # Map to category
        cat_id = CATEGORY_MAP.get(fe.category, 6)

        txn_type = TransactionType.income if fe.entry_type == "income" else TransactionType.expense

        txn = Transaction(
            user_id=user.id,
            amount=round(amount, 2),
            type=txn_type,
            description=f"[Fixed] {fe.name}",
            note=f"Auto-applied from Fixed Manager ({fe.frequency})",
            category_id=cat_id,
            date=month_start,
        )
        db.add(txn)
        applied += 1

    await db.commit()

    return {
        "applied": applied,
        "skipped": skipped,
        "message": f"Applied {applied} fixed transactions for {now.strftime('%B %Y')}",
    }


@router.get("/apply-monthly/status")
async def get_apply_status(
    db: AsyncSession = Depends(get_db),
    user=Depends(get_current_user),
):
    """Check if fixed transactions have been applied this month."""
    now = datetime.now(timezone.utc)
    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    month_end   = now.replace(day=28, hour=23, minute=59, second=59)

    result = await db.execute(
        select(Transaction).where(
            and_(
                Transaction.user_id == user.id,
                Transaction.description.like("[Fixed]%"),
                Transaction.date >= month_start,
                Transaction.date <= month_end,
            )
        )
    )
    applied_txns = result.scalars().all()

    return {
        "applied_this_month": len(applied_txns) > 0,
        "count": len(applied_txns),
        "month": now.strftime("%B %Y"),
    }