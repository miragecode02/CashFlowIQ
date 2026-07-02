from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, extract
from sqlalchemy.orm import selectinload
from app.models.models import Budget, Transaction, TransactionType
from app.schemas.schemas import BudgetCreate, BudgetOut
from datetime import datetime


async def create_or_update_budget(
    db: AsyncSession, user_id: int, data: BudgetCreate
) -> Budget:
    # Check existing budget for same month/year/category
    q = select(Budget).where(
        and_(
            Budget.user_id == user_id,
            Budget.month == data.month,
            Budget.year == data.year,
            Budget.category_id == data.category_id,
        )
    )
    result = await db.execute(q)
    existing = result.scalar_one_or_none()

    if existing:
        existing.amount = data.amount
        await db.flush()
        return existing

    budget = Budget(
        user_id=user_id,
        amount=data.amount,
        category_id=data.category_id,
        month=data.month,
        year=data.year,
    )
    db.add(budget)
    await db.flush()
    return budget


async def get_budgets_with_spending(
    db: AsyncSession, user_id: int, month: int, year: int
) -> list[dict]:
    budget_result = await db.execute(
        select(Budget)
        .options(selectinload(Budget.category))
        .where(
            and_(
                Budget.user_id == user_id,
                Budget.month == month,
                Budget.year == year,
            )
        )
    )
    budgets = budget_result.scalars().all()

    enriched = []
    for b in budgets:
        # Sum actual spending for this category this month
        q = select(Transaction).where(
            and_(
                Transaction.user_id == user_id,
                Transaction.type == TransactionType.expense,
                Transaction.category_id == b.category_id,
                extract("month", Transaction.date) == month,
                extract("year", Transaction.date) == year,
            )
        )
        txn_result = await db.execute(q)
        transactions = txn_result.scalars().all()
        spent = sum(t.amount for t in transactions)

        enriched.append({
            "id": b.id,
            "amount": b.amount,
            "month": b.month,
            "year": b.year,
            "category": b.category,
            "spent": spent,
            "remaining": b.amount - spent,
        })

    return enriched
