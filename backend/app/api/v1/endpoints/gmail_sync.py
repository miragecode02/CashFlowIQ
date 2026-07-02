from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.core.database import get_db
from app.core.security import get_current_user
from app.models.models import Transaction, TransactionType, Category
from app.schemas.schemas import UserOut
from datetime import datetime, timezone
from pydantic import BaseModel
from typing import List
import re

router = APIRouter(prefix="/sync", tags=["Gmail Sync"])

CATEGORY_MAP = {
    "food": 1, "swiggy": 1, "zomato": 1, "restaurant": 1,
    "uber": 3, "ola": 3, "rapido": 3, "petrol": 3, "fuel": 3,
    "amazon": 2, "flipkart": 2, "shopping": 2,
    "netflix": 4, "spotify": 4, "hotstar": 4,
    "hospital": 5, "pharmacy": 5, "medical": 5,
    "electricity": 7, "airtel": 7, "jio": 7, "bill": 7,
    "zerodha": 9, "groww": 9, "sip": 9, "mutual": 9,
    "salary": 10, "credit": 10,
}

def guess_category(description: str) -> int:
    desc = description.lower()
    for keyword, cat_id in CATEGORY_MAP.items():
        if keyword in desc:
            return cat_id
    return 6  # Other


class EmailTransaction(BaseModel):
    amount: float
    type: str  # "income" or "expense"
    description: str
    date: str  # ISO format


class GmailSyncRequest(BaseModel):
    transactions: List[EmailTransaction]


@router.post("/gmail")
async def sync_from_gmail(
    data: GmailSyncRequest,
    db: AsyncSession = Depends(get_db),
    user=Depends(get_current_user),
):
    if not data.transactions:
        raise HTTPException(400, "No transactions provided")

    saved = 0
    skipped = 0

    for txn in data.transactions:
        try:
            dt = datetime.fromisoformat(txn.date)
            if dt.tzinfo is None:
                dt = dt.replace(tzinfo=timezone.utc)

            # Check for duplicate (same amount + description + date)
            existing = await db.execute(
                select(Transaction).where(
                    Transaction.user_id == user.id,
                    Transaction.amount == txn.amount,
                    Transaction.description == txn.description,
                )
            )
            if existing.scalar_one_or_none():
                skipped += 1
                continue

            cat_id = guess_category(txn.description)
            txn_type = TransactionType.income if txn.type == "income" else TransactionType.expense

            db.add(Transaction(
                user_id=user.id,
                amount=txn.amount,
                type=txn_type,
                description=txn.description,
                category_id=cat_id,
                date=dt,
                note="Imported from Gmail",
            ))
            saved += 1
        except Exception:
            skipped += 1
            continue

    await db.commit()

    return {
        "saved": saved,
        "skipped": skipped,
        "message": f"Imported {saved} transactions from Gmail"
    }