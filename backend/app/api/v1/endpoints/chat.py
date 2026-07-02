from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from app.core.security import get_current_user
from app.schemas.schemas import ChatRequest, ChatResponse, ChatMessageOut
from app.services.chat_service import chat_with_advisor, get_chat_history, clear_chat_history

router = APIRouter(prefix="/chat", tags=["AI Advisor"])


@router.post("", response_model=ChatResponse)
async def chat(
    data: ChatRequest,
    db: AsyncSession = Depends(get_db),
    user=Depends(get_current_user),
):
    return await chat_with_advisor(db, user.id, user.name, data.message)


@router.get("/history", response_model=list[ChatMessageOut])
async def history(
    limit: int = 20,
    db: AsyncSession = Depends(get_db),
    user=Depends(get_current_user),
):
    messages = await get_chat_history(db, user.id, limit)
    return [ChatMessageOut.model_validate(m) for m in messages]


@router.delete("/history", status_code=204)
async def clear_history(
    db: AsyncSession = Depends(get_db),
    user=Depends(get_current_user),
):
    await clear_chat_history(db, user.id)