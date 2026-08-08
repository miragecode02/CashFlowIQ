from fastapi import APIRouter, UploadFile, File, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.core.database import get_db
from app.core.security import get_current_user
from app.models.models import User, Transaction, Category, TransactionType
from app.services.statement_parser import parse_bank_statement
from datetime import timezone

router = APIRouter(prefix="/statements", tags=["Statements"])

BATCH_SIZE = 50

DEFAULT_CATEGORIES = [
    {"id": 1, "name": "Food & Dining"},
    {"id": 2, "name": "Shopping"},
    {"id": 3, "name": "Transport"},
    {"id": 4, "name": "Entertainment"},
    {"id": 5, "name": "Health"},
    {"id": 6, "name": "Other"},
    {"id": 7, "name": "Utilities"},
    {"id": 8, "name": "Education"},
    {"id": 9, "name": "Investments"},
    {"id": 10, "name": "Income"},
]


async def ensure_categories(db: AsyncSession) -> dict:
    result = await db.execute(select(Category))
    existing = result.scalars().all()
    if not existing:
        for cat in DEFAULT_CATEGORIES:
            db.add(Category(id=cat["id"], name=cat["name"]))
        await db.commit()
        result = await db.execute(select(Category))
        existing = result.scalars().all()
    return {c.name: c.id for c in existing}


@router.post("/upload")
async def upload_statement(
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    allowed = [".pdf", ".csv", ".xlsx", ".xls"]
    filename = file.filename or ""
    if not any(filename.lower().endswith(ext) for ext in allowed):
        raise HTTPException(400, "Only PDF, CSV, and Excel files are supported.")

    file_bytes = await file.read()
    if len(file_bytes) > 10 * 1024 * 1024:
        raise HTTPException(400, "File too large. Max size is 10MB.")

    try:
        parsed = parse_bank_statement(file_bytes, filename)
    except Exception as e:
        raise HTTPException(422, f"Could not parse statement: {str(e)}")

    if not parsed:
        raise HTTPException(422, "No transactions found in the file.")

    categories = await ensure_categories(db)
    other_id = categories.get("Other", 6)

    saved = 0
    skipped = 0
    batch = []

    for t in parsed:
        try:
            cat_id = categories.get(t["category_name"], other_id)
            tx_type = TransactionType.income if t["type"] == "income" else TransactionType.expense
            dt = t["date"]
            if dt.tzinfo is None:
                dt = dt.replace(tzinfo=timezone.utc)
            batch.append(Transaction(
                user_id=user.id,
                amount=t["amount"],
                type=tx_type,
                description=t["description"],
                note=t.get("note"),
                category_id=cat_id,
                date=dt,
            ))
            saved += 1
            if len(batch) >= BATCH_SIZE:
                db.add_all(batch)
                await db.commit()
                batch = []
        except Exception:
            skipped += 1
            continue

    if batch:
        db.add_all(batch)
        await db.commit()

    return {
        "success": True,
        "total_found": len(parsed),
        "saved": saved,
        "skipped": skipped,
        "message": f"Successfully imported {saved} transactions from your statement.",
    }