from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from app.models.models import ChatMessage, Transaction, TransactionType, FixedExpense
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
- The financial snapshot below is broken down PER MONTH, each with its own category breakdown and top expenses — use these specific numbers and category/merchant names in your answer instead of speaking in generalities. Reference actual figures (₹ amounts, % changes, category names) whenever the question relates to them.
- CRITICAL: when the user asks about a specific month (e.g. "in July", "last month"), only answer using that exact month's block from the breakdown. If that month isn't listed in the breakdown, say plainly that you don't have detailed data for that month. NEVER take a figure from a different month's block (even a memorable one like "rent") and present it as belonging to the month asked about — this is a hard rule, not a suggestion.
- If a top expense is listed as "(no description recorded)", that means there is genuinely no merchant/label data for it — say so honestly (e.g. "an unlabeled ₹X expense") rather than guessing or substituting a category/merchant name from elsewhere in the data.
- Never give generic responses — always tie back to the user's actual financial data
- If no financial data is available, ask them to add some transactions first

Never make up financial data. Only use the context provided."""


MONTHS_OF_DETAIL = 6  # how many recent distinct months get a real per-month breakdown


async def get_financial_context(db: AsyncSession, user_id: int) -> str:
    """Build a rich financial summary to inject into the chat — including a genuine
    per-month breakdown for the last several months, not just the latest one. Without
    this, the model has no real data to answer "what about last month/July" questions
    and will fabricate an answer using whatever numbers it does have."""
    try:
        result = await db.execute(
            select(Transaction)
            .options(selectinload(Transaction.category))
            .where(Transaction.user_id == user_id)
            .order_by(Transaction.date.desc())
        )
        all_txns = result.scalars().all()

        if not all_txns:
            return "No transaction data available yet."

        # Group transactions by calendar month
        months: dict[tuple[int, int], list] = {}
        for t in all_txns:
            key = (t.date.year, t.date.month)
            months.setdefault(key, []).append(t)

        ordered_months = sorted(months.keys(), reverse=True)[:MONTHS_OF_DETAIL]

        def totals(txns):
            income = sum(t.amount for t in txns if t.type == TransactionType.income)
            spending = sum(t.amount for t in txns if t.type == TransactionType.expense)
            return income, spending

        month_blocks = []
        prev_spending_for_trend = None
        latest_label = None
        for i, key in enumerate(ordered_months):
            txns = months[key]
            income, spending = totals(txns)
            savings = income - spending
            rate = (savings / income * 100) if income > 0 else 0
            label = datetime(key[0], key[1], 1).strftime("%B %Y")
            if i == 0:
                latest_label = label

            cat_totals: dict[str, float] = {}
            for t in txns:
                if t.type == TransactionType.expense:
                    name = t.category.name if t.category else "Other"
                    cat_totals[name] = cat_totals.get(name, 0) + t.amount
            top_cats = sorted(cat_totals.items(), key=lambda x: -x[1])[:3]
            cat_str = ", ".join(f"{name} ₹{amt:,.0f}" for name, amt in top_cats)

            top_expenses = sorted(
                [t for t in txns if t.type == TransactionType.expense],
                key=lambda t: t.amount, reverse=True
            )[:3]
            top_str = ", ".join(
                f"₹{t.amount:,.0f} ({t.description.strip() if t.description and t.description.strip() else 'no description recorded'})"
                for t in top_expenses
            )

            trend = ""
            if i == 0 and len(ordered_months) > 1:
                prev_spending_for_trend = totals(months[ordered_months[1]])[1]
                if prev_spending_for_trend > 0:
                    delta = (spending - prev_spending_for_trend) / prev_spending_for_trend * 100
                    trend = f" (spending {'up' if delta > 0 else 'down'} {abs(delta):.0f}% vs prior month)"

            month_blocks.append(
                f"{label}: Income ₹{income:,.0f}, Spent ₹{spending:,.0f}, Saved ₹{savings:,.0f} "
                f"({rate:.0f}% savings rate){trend}. Top categories: {cat_str or 'none'}. "
                f"Top expenses: {top_str or 'none'}."
            )

        fe_result = await db.execute(
            select(FixedExpense).where(FixedExpense.user_id == user_id, FixedExpense.is_active == True)
        )
        fixed = fe_result.scalars().all()
        fixed_expense_total = sum(fe.amount for fe in fixed if fe.entry_type == "expense")
        fixed_income_total = sum(fe.amount for fe in fixed if fe.entry_type == "income")
        fixed_str = (
            f"Recurring fixed costs ₹{fixed_expense_total:,.0f}/mo, fixed income ₹{fixed_income_total:,.0f}/mo. "
            if fixed else ""
        )

        months_str = "\n".join(month_blocks)

        return (
            f"Most recent month with activity: {latest_label} (today's calendar date may be later than this — "
            f"this is simply the user's latest logged activity, not necessarily the current month).\n"
            f"Per-month breakdown (most recent {len(ordered_months)} months with data — this is the ONLY data "
            f"you have; if asked about a month not listed here, say you don't have that month's detail rather "
            f"than guessing):\n{months_str}\n"
            f"{fixed_str}Total transactions on record: {len(all_txns)}."
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

    # Call Groq — gpt-oss-120b is Groq's recommended replacement for the
    # deprecated llama-3.3-70b-versatile model. It's a reasoning model, so
    # reasoning_effort is kept low to stay fast for a chat UI, and max_tokens
    # is raised since hidden reasoning tokens count against the same budget.
    response = client.chat.completions.create(
        model="openai/gpt-oss-120b",
        reasoning_effort="low",
        messages=messages,
        max_tokens=500,
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