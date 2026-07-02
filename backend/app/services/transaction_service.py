from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, extract
from sqlalchemy.orm import selectinload
from app.models.models import Transaction, TransactionType
from app.schemas.schemas import TransactionCreate, TransactionUpdate
from fastapi import HTTPException, status
from datetime import datetime
from typing import Optional


async def create_transaction(
    db: AsyncSession, user_id: int, data: TransactionCreate
) -> Transaction:
    txn = Transaction(
        user_id=user_id,
        amount=data.amount,
        type=data.type,
        description=data.description,
        note=data.note,
        category_id=data.category_id,
        date=data.date,
    )
    db.add(txn)
    await db.flush()
    result = await db.execute(
        select(Transaction)
        .options(selectinload(Transaction.category))
        .where(Transaction.id == txn.id)
    )
    return result.scalar_one()


async def get_transactions(
    db: AsyncSession,
    user_id: int,
    skip: int = 0,
    limit: int = 50,
    type: Optional[TransactionType] = None,
    category_id: Optional[int] = None,
    month: Optional[int] = None,
    year: Optional[int] = None,
) -> list[Transaction]:
    q = (
        select(Transaction)
        .options(selectinload(Transaction.category))
        .where(Transaction.user_id == user_id)
        .order_by(Transaction.date.desc())
    )
    if type:
        q = q.where(Transaction.type == type)
    if category_id:
        q = q.where(Transaction.category_id == category_id)
    if month:
        q = q.where(extract("month", Transaction.date) == month)
    if year:
        q = q.where(extract("year", Transaction.date) == year)
    q = q.offset(skip).limit(limit)
    result = await db.execute(q)
    return result.scalars().all()


async def get_transaction_by_id(
    db: AsyncSession, user_id: int, txn_id: int
) -> Transaction:
    result = await db.execute(
        select(Transaction)
        .options(selectinload(Transaction.category))
        .where(and_(Transaction.id == txn_id, Transaction.user_id == user_id))
    )
    txn = result.scalar_one_or_none()
    if not txn:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Transaction not found")
    return txn


async def update_transaction(
    db: AsyncSession, user_id: int, txn_id: int, data: TransactionUpdate
) -> Transaction:
    txn = await get_transaction_by_id(db, user_id, txn_id)
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(txn, field, value)
    await db.flush()
    await db.refresh(txn)
    return txn


async def delete_transaction(db: AsyncSession, user_id: int, txn_id: int) -> None:
    txn = await get_transaction_by_id(db, user_id, txn_id)
    await db.delete(txn)
