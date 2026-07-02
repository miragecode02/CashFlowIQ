from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from datetime import datetime
from app.core.database import get_db
from app.core.security import get_current_user
from app.schemas.schemas import BudgetCreate, BudgetOut
from app.services.budget_service import create_or_update_budget, get_budgets_with_spending

router = APIRouter(prefix="/budgets", tags=["Budgets"])


@router.post("", response_model=BudgetOut, status_code=201)
async def upsert_budget(
    data: BudgetCreate,
    db: AsyncSession = Depends(get_db),
    user=Depends(get_current_user),
):
    budget = await create_or_update_budget(db, user.id, data)
    return BudgetOut.model_validate(budget)


@router.get("", response_model=list[BudgetOut])
async def get_budgets(
    month: int = Query(default=datetime.now().month, ge=1, le=12),
    year: int = Query(default=datetime.now().year),
    db: AsyncSession = Depends(get_db),
    user=Depends(get_current_user),
):
    enriched = await get_budgets_with_spending(db, user.id, month, year)
    return [
        BudgetOut(
            id=b["id"],
            amount=b["amount"],
            month=b["month"],
            year=b["year"],
            category=b["category"],
            spent=b["spent"],
            remaining=b["remaining"],
        )
        for b in enriched
    ]
