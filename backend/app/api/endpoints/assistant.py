from fastapi import APIRouter, HTTPException, Depends
from typing import Any
from app.schemas.assistant import AssistantChatRequest, AssistantChatResponse
from app.services.assistant_context import sanitize_and_summarize_context
from app.services.assistant_provider import call_ai_provider

router = APIRouter()

@router.post("/chat", response_model=AssistantChatResponse)
async def chat_with_assistant(request: AssistantChatRequest) -> Any:
    sanitized_context = sanitize_and_summarize_context(request.context)
    
    answer, provider, model, mode = await call_ai_provider(
        message=request.message,
        context=sanitized_context,
        language=request.language
    )
    
    return AssistantChatResponse(
        answer=answer,
        provider=provider,
        model=model,
        mode=mode,
        warnings=[]
    )
