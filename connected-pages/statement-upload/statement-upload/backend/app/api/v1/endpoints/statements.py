from fastapi import APIRouter, UploadFile, File, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.core.database import get_db
from app.core.security import get_current_user
from app.models.models import User, Transaction, Category, TransactionType
from app.services.statement_parser import parse_bank_statement
from datetime import timezone

router = APIRouter()


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
        raise HTTPException(422, "No transactions found in the file. Make sure it's a valid bank statement.")

    # Load categories from DB
    result = await db.execute(select(Category))
    categories = {c.name: c.id for c in result.scalars().all()}

    saved = 0
    skipped = 0
    for t in parsed:
        try:
            cat_id = categories.get(t["category_name"]) or categories.get("Other") or 6
            tx_type = TransactionType.income if t["type"] == "income" else TransactionType.expense

            # Make date timezone-aware
            dt = t["date"]
            if dt.tzinfo is None:
                dt = dt.replace(tzinfo=timezone.utc)

            tx = Transaction(
                user_id=user.id,
                amount=t["amount"],
                type=tx_type,
                description=t["description"],
                category_id=cat_id,
                date=dt,
            )
            db.add(tx)
            saved += 1
        except Exception:
            skipped += 1
            continue

    await db.commit()

    return {
        "success": True,
        "total_found": len(parsed),
        "saved": saved,
        "skipped": skipped,
        "message": f"Successfully imported {saved} transactions from your statement.",
    }
