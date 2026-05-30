from pydantic import BaseModel, Field
from typing import Dict, Any, List, Optional

class AssistantChatRequest(BaseModel):
    message: str = Field(..., description="The user's message")
    context: Dict[str, Any] = Field(default_factory=dict, description="Context from frontend (e.g. active object, AER)")
    language: str = Field(default="en", description="Language preference")

class AssistantChatResponse(BaseModel):
    answer: str
    provider: str
    model: str
    mode: str = Field(..., description="Either 'ai' or 'local_fallback'")
    warnings: List[str] = Field(default_factory=list)
