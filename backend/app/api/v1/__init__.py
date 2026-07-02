from fastapi import APIRouter
from app.api.v1.endpoints import auth, transactions, analytics, chat, budgets, statements, fixed_expenses, gmail_sync

router = APIRouter()
router.include_router(auth.router)
router.include_router(transactions.router)
router.include_router(analytics.router)
router.include_router(chat.router)
router.include_router(budgets.router)
router.include_router(statements.router)
router.include_router(fixed_expenses.router)
router.include_router(gmail_sync.router)