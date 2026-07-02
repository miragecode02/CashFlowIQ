from fastapi import APIRouter, UploadFile, File, Depends
from sqlalchemy.orm import Session
import pandas as pd
from database import get_db
from models import Transaction
from datetime import datetime
from services.merchant_extracter import extract_merchant
from services.expense_classifier import classify_category

router = APIRouter()


@router.post("/upload-transactions")

async def upload_transactions(
    file: UploadFile = File(...),
    db: Session = Depends(get_db)
):
    df = pd.read_csv(file.file)

    df = df.dropna(subset=["Date"])

    for _, row in df.iterrows():
        merchant_name = extract_merchant(row.get("Narration", ""))
        category_name = classify_category(merchant_name)
        withdrawal = row.get("Withdrawal Amt.")
        deposit = row.get("Deposit Amt.")

        withdrawal = float(withdrawal) if pd.notna(withdrawal) and str(withdrawal).strip() != "" else 0
        deposit = float(deposit) if pd.notna(deposit) and str(deposit).strip() != "" else 0

        if deposit > 0:
            amount = deposit
            txn_type = "income"

        elif withdrawal > 0:
            amount = -withdrawal
            txn_type = "expense"

        else:
            continue



        

        transaction = Transaction(
            user_id=1,
            date=pd.to_datetime(row["Date"]).date(),
            narration=row.get("Narration", ""),
            amount=amount,
            type=txn_type,
            merchant=merchant_name,
            category=category_name,
            closing_balance=row.get("Closing Balance", None)
        )
                        


        
        db.add(transaction)

    db.commit()

    return {"message": "Transactions uploaded successfully"}
