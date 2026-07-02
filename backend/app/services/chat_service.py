from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.models.models import ChatMessage, Transaction, TransactionType
from app.schemas.schemas import ChatResponse, ChatMessageOut
from app.core.config import settings
from openai import OpenAI
from datetime import datetime, timezone, timedelta

client = OpenAI(
    api_key=settings.GROQ_API_KEY,
    base_url="https://api.groq.com/openai/v1",
)

SYSTEM_PROMPT = """You are CashFlow IQ's AI financial advisor — a smart, friendly, and concise personal finance assistant built for Indian users.

Your role:
- Analyse spending patterns and give actionable advice
- Help users make purchase decisions (simulate whether they can afford something)
- Suggest savings strategies tailored to Indian context (SIPs, FDs, PPF, etc.)
- Flag unusual spending and budget risks
- Always respond in 2-4 sentences max unless asked for detail
- Use ₹ for currency, keep advice practical and India-specific
- Be encouraging but honest

Conversation behavior:
- If the user greets you (hi, hello, hey etc.), respond with a brief friendly greeting and immediately mention ONE specific insight from their financial data (e.g. their savings rate or top spending category)
- Never give generic responses — always tie back to the user's actual financial data
- If no financial data is available, ask them to add some transactions first

Never make up financial data. Only use the context provided."""


async def get_financial_context(db: AsyncSession, user_id: int) -> str:
    """Build a short financial summary to inject into the chat."""
    try:
        now = datetime.now(timezone.utc)
        month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)

        result = await db.execute(
            select(Transaction)
            .where(
                Transaction.user_id == user_id,
                Transaction.date >= month_start,
            )
            .order_by(Transaction.date.desc())
            .limit(50)
        )
        txns = result.scalars().all()

        if not txns:
            # Fall back to last 30 days
            result = await db.execute(
                select(Transaction)
                .where(
                    Transaction.user_id == user_id,
                    Transaction.date >= now - timedelta(days=30),
                )
                .limit(30)
            )
            txns = result.scalars().all()

        if not txns:
            return "No transaction data available yet."

        income   = sum(t.amount for t in txns if t.type == TransactionType.income)
        spending = sum(t.amount for t in txns if t.type == TransactionType.expense)
        savings  = income - spending
        rate     = (savings / income * 100) if income > 0 else 0

        top = sorted(
            [t for t in txns if t.type == TransactionType.expense],
            key=lambda t: t.amount, reverse=True
        )[:3]
        top_str = ", ".join(f"₹{t.amount:,.0f} on {t.description}" for t in top)

        return (
            f"This month: Income ₹{income:,.0f} | Spent ₹{spending:,.0f} | "
            f"Saved ₹{savings:,.0f} ({rate:.0f}% savings rate). "
            f"Top expenses: {top_str or 'none'}."
        )
    except Exception:
        return "Financial context unavailable."


async def chat_with_advisor(
    db: AsyncSession, user_id: int, user_name: str, message: str
) -> ChatResponse:
    # Load last 10 messages for context
    result = await db.execute(
        select(ChatMessage)
        .where(ChatMessage.user_id == user_id)
        .order_by(ChatMessage.created_at.desc())
        .limit(10)
    )
    history = list(reversed(result.scalars().all()))

    # Build financial context
    fin_context = await get_financial_context(db, user_id)

    # Build messages for Groq
    messages = [
        {
            "role": "system",
            "content": f"{SYSTEM_PROMPT}\n\nUser: {user_name}\nFinancial snapshot: {fin_context}"
        }
    ]
    for msg in history:
        messages.append({"role": msg.role, "content": msg.content})
    messages.append({"role": "user", "content": message})

    # Call Groq
    response = client.chat.completions.create(
        model="llama-3.3-70b-versatile",
        messages=messages,
        max_tokens=300,
        temperature=0.7,
    )
    reply = response.choices[0].message.content.strip()

    # Save user message
    db.add(ChatMessage(user_id=user_id, role="user", content=message))
    # Save assistant reply
    db.add(ChatMessage(user_id=user_id, role="assistant", content=reply))
    await db.commit()

    # Return updated history
    result = await db.execute(
        select(ChatMessage)
        .where(ChatMessage.user_id == user_id)
        .order_by(ChatMessage.created_at.desc())
        .limit(20)
    )
    updated = list(reversed(result.scalars().all()))

    return ChatResponse(
        reply=reply,
        history=[ChatMessageOut.model_validate(m) for m in updated],
    )


async def get_chat_history(db: AsyncSession, user_id: int, limit: int = 20):
    result = await db.execute(
        select(ChatMessage)
        .where(ChatMessage.user_id == user_id)
        .order_by(ChatMessage.created_at.desc())
        .limit(limit)
    )
    return list(reversed(result.scalars().all()))


async def clear_chat_history(db: AsyncSession, user_id: int):
    result = await db.execute(
        select(ChatMessage).where(ChatMessage.user_id == user_id)
    )
    for msg in result.scalars().all():
        await db.delete(msg)
    await db.commit()