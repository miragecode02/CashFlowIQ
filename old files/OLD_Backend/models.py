from sqlalchemy import Column, Integer, String, Float, Date, Boolean, ForeignKey
from sqlalchemy.orm import relationship
from database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    email = Column(String, unique=True, nullable=False)
    monthly_income = Column(Float, nullable=True)

    transactions = relationship("Transaction", back_populates="user")


class Transaction(Base):
    __tablename__ = "transactions"

    id = Column(Integer, primary_key=True, index=True)

    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)

    date = Column(Date, nullable=False)
    narration = Column(String, nullable=False)

    amount = Column(Float, nullable=False)
    type = Column(String, nullable=False)

    merchant = Column(String, nullable=True)
    category = Column(String, nullable=True)

    expense_type = Column(String, nullable=True)
    recurring_flag = Column(Boolean, default=False)

    closing_balance = Column(Float, nullable=True)

    user = relationship("User", back_populates="transactions")
