from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional
from app.core.database import get_db
from app.core.security import get_current_user
from app.schemas.schemas import TransactionCreate, TransactionOut, TransactionUpdate
from app.models.models import TransactionType
from app.services import transaction_service

router = APIRouter(prefix="/transactions", tags=["Transactions"])


@router.post("", response_model=TransactionOut, status_code=201)
async def create(
    data: TransactionCreate,
    db: AsyncSession = Depends(get_db),
    user=Depends(get_current_user),
):
    return await transaction_service.create_transaction(db, user.id, data)


@router.get("", response_model=list[TransactionOut])
async def list_transactions(
    skip: int = 0,
    limit: int = 50,
    type: Optional[TransactionType] = None,
    category_id: Optional[int] = None,
    month: Optional[int] = Query(None, ge=1, le=12),
    year: Optional[int] = None,
    db: AsyncSession = Depends(get_db),
    user=Depends(get_current_user),
):
    return await transaction_service.get_transactions(
        db, user.id, skip, limit, type, category_id, month, year
    )


@router.get("/{txn_id}", response_model=TransactionOut)
async def get_one(
    txn_id: int,
    db: AsyncSession = Depends(get_db),
    user=Depends(get_current_user),
):
    return await transaction_service.get_transaction_by_id(db, user.id, txn_id)


@router.patch("/{txn_id}", response_model=TransactionOut)
async def update(
    txn_id: int,
    data: TransactionUpdate,
    db: AsyncSession = Depends(get_db),
    user=Depends(get_current_user),
):
    return await transaction_service.update_transaction(db, user.id, txn_id, data)


@router.delete("/{txn_id}", status_code=204)
async def delete(
    txn_id: int,
    db: AsyncSession = Depends(get_db),
    user=Depends(get_current_user),
):
    await transaction_service.delete_transaction(db, user.id, txn_id)
