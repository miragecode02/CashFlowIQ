from pydantic import BaseModel, EmailStr, field_validator
from typing import Optional, List
from datetime import datetime
from app.models.models import TransactionType


# ── Auth ──────────────────────────────────────────────────────────────────────
class UserRegister(BaseModel):
    name: str
    email: EmailStr
    password: str

    @field_validator("password")
    @classmethod
    def password_strength(cls, v):
        if len(v) < 8:
            raise ValueError("Password must be at least 8 characters")
        return v


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class UserOut(BaseModel):
    id: int
    name: str
    email: str
    is_active: bool
    created_at: datetime

    model_config = {"from_attributes": True}


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut


# ── Categories ────────────────────────────────────────────────────────────────
class CategoryOut(BaseModel):
    id: int
    name: str
    icon: Optional[str]
    color: Optional[str]

    model_config = {"from_attributes": True}


# ── Transactions ──────────────────────────────────────────────────────────────
class TransactionCreate(BaseModel):
    amount: float
    type: TransactionType
    description: str
    note: Optional[str] = None
    category_id: Optional[int] = None
    date: datetime

    @field_validator("amount")
    @classmethod
    def amount_positive(cls, v):
        if v <= 0:
            raise ValueError("Amount must be positive")
        return v


class TransactionOut(BaseModel):
    id: int
    amount: float
    type: TransactionType
    description: str
    note: Optional[str]
    date: datetime
    created_at: datetime
    category: Optional[CategoryOut]

    model_config = {"from_attributes": True}


class DocumentOut(BaseModel):
    id: int
    filename: str
    status: str
    total_found: int
    saved: int
    skipped: int
    created_at: datetime

    model_config = {"from_attributes": True}


class TransactionUpdate(BaseModel):
    amount: Optional[float] = None
    description: Optional[str] = None
    note: Optional[str] = None
    category_id: Optional[int] = None
    date: Optional[datetime] = None


# ── Budgets ───────────────────────────────────────────────────────────────────
class BudgetCreate(BaseModel):
    amount: float
    category_id: Optional[int] = None
    month: int
    year: int


class BudgetOut(BaseModel):
    id: int
    amount: float
    month: int
    year: int
    category: Optional[CategoryOut]
    spent: Optional[float] = 0.0
    remaining: Optional[float] = None

    model_config = {"from_attributes": True}


# ── Fixed Expenses ────────────────────────────────────────────────────────────
class FixedExpenseCreate(BaseModel):
    name: str
    amount: float
    frequency: str = "monthly"
    entry_type: str = "expense"
    category: str = "Utilities"
    emoji: str = "📌"

    @field_validator("amount")
    @classmethod
    def amount_positive(cls, v):
        if v <= 0:
            raise ValueError("Amount must be positive")
        return v


class FixedExpenseOut(BaseModel):
    id: int
    name: str
    amount: float
    frequency: str
    entry_type: str
    category: str
    emoji: str
    is_active: bool
    created_at: datetime

    model_config = {"from_attributes": True}


class FixedExpenseUpdate(BaseModel):
    name: Optional[str] = None
    amount: Optional[float] = None
    frequency: Optional[str] = None
    entry_type: Optional[str] = None
    category: Optional[str] = None
    emoji: Optional[str] = None
    is_active: Optional[bool] = None


# ── Fixed Income ──────────────────────────────────────────────────────────────
class FixedIncomeCreate(BaseModel):
    name: str
    amount: float
    frequency: str = "monthly"
    category: str = "Salary"
    emoji: str = "💰"

    @field_validator("amount")
    @classmethod
    def amount_positive(cls, v):
        if v <= 0:
            raise ValueError("Amount must be positive")
        return v


class FixedIncomeOut(BaseModel):
    id: int
    name: str
    amount: float
    frequency: str
    category: str
    emoji: str
    is_active: bool
    created_at: datetime

    model_config = {"from_attributes": True}


class FixedIncomeUpdate(BaseModel):
    name: Optional[str] = None
    amount: Optional[float] = None
    frequency: Optional[str] = None
    category: Optional[str] = None
    emoji: Optional[str] = None
    is_active: Optional[bool] = None


# ── Analytics ─────────────────────────────────────────────────────────────────
class MonthlyTrend(BaseModel):
    month: str
    income: float
    spending: float


class CategoryBreakdown(BaseModel):
    name: str
    amount: float
    percentage: float
    color: Optional[str]


class AnalyticsSummary(BaseModel):
    total_income: float
    total_spending: float
    net_savings: float
    savings_rate: float
    monthly_trends: List[MonthlyTrend]
    category_breakdown: List[CategoryBreakdown]
    top_category: Optional[CategoryBreakdown]
    fixed_expenses_total: float = 0.0
    fixed_income_total: float = 0.0
    adjusted_spending: float = 0.0
    adjusted_savings: float = 0.0
    fixed_expenses_list: list = []


class ForecastPoint(BaseModel):
    date: str
    predicted_spending: float
    lower_bound: float
    upper_bound: float


# ── Chat ──────────────────────────────────────────────────────────────────────
class ChatRequest(BaseModel):
    message: str


class ChatMessageOut(BaseModel):
    id: int
    role: str
    content: str
    created_at: datetime

    model_config = {"from_attributes": True}


class ChatResponse(BaseModel):
    reply: str
    history: List[ChatMessageOut]