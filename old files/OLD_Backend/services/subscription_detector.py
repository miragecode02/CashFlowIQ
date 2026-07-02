from sqlalchemy.orm import Session
from sqlalchemy import func
from models import Transaction


def detect_recurring_transactions(db: Session, user_id: int):

    recurring_candidates = db.query(
        Transaction.merchant,
        Transaction.amount,
        func.count(Transaction.id).label("count")
    ).filter(
        Transaction.user_id == user_id,
        Transaction.amount < 0  # expenses only
    ).group_by(
        Transaction.merchant,
        Transaction.amount
    ).having(
        func.count(Transaction.id) >= 3
    ).all()

    recurring_list = []

    for r in recurring_candidates:
        recurring_list.append({
            "merchant": r.merchant,
            "amount": abs(float(r.amount)),
            "occurrences": r.count
        })

    return recurring_list

def mark_recurring_transactions(db: Session, user_id: int):

    recurring_candidates = db.query(
        Transaction.merchant,
        Transaction.amount
    ).filter(
        Transaction.user_id == user_id,
        Transaction.amount < 0
    ).group_by(
        Transaction.merchant,
        Transaction.amount
    ).having(
        func.count(Transaction.id) >= 3
    ).all()

    for merchant, amount in recurring_candidates:
        db.query(Transaction).filter(
            Transaction.user_id == user_id,
            Transaction.merchant == merchant,
            Transaction.amount == amount
        ).update({
            Transaction.recurring_flag: True,
            Transaction.expense_type: "fixed"
        })

    # Mark all other expenses as variable
    db.query(Transaction).filter(
        Transaction.user_id == user_id,
        Transaction.amount < 0,
        Transaction.recurring_flag == False
    ).update({
        Transaction.expense_type: "variable"
    })

    db.commit()

    return {"message": "Recurring transactions marked successfully"}