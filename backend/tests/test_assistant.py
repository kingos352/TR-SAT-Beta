import pytest
import asyncio
from app.services.assistant_provider import call_ai_provider, local_fallback_assistant
from unittest.mock import patch, AsyncMock, MagicMock

def test_local_fallback_no_provider():
    # Test local fallback mode explicitly
    with patch('app.services.assistant_provider.settings.AI_PROVIDER', 'local'):
        ans, provider, model, mode = asyncio.run(call_ai_provider("Hello", {}, "en"))
        assert mode == "local_fallback"
        assert provider == "local"
        assert model == "local"

def test_guardrails():
    # Telemetry
    ans, warns = local_fallback_assistant("Is this direct telemetry?", {}, "en")
    assert "cannot provide direct telemetry" in ans.lower()
    
    # Collision
    ans, warns = local_fallback_assistant("What is the collision probability?", {}, "en")
    assert "cannot provide collision probability" in ans.lower()

def test_mocked_gemini_call():
    with patch('app.services.assistant_provider.settings.AI_PROVIDER', 'gemini'), \
         patch('app.services.assistant_provider.settings.GEMINI_API_KEY', 'fake_key'), \
         patch('app.services.assistant_provider.settings.GEMINI_MODEL', 'gemini-model'), \
         patch('httpx.AsyncClient.post') as mock_post:
        
        # Mock successful JSON response
        mock_response = MagicMock()
        mock_response.raise_for_status = MagicMock()
        mock_response.json.return_value = {
            "candidates": [
                {
                    "content": {
                        "parts": [
                            {"text": "Mocked gemini response"}
                        ]
                    }
                }
            ]
        }
        
        # httpx.AsyncClient.post is async, so mock_post needs to return an awaitable
        # or we mock the method on the client instance.
        mock_post.return_value = mock_response
        
        # wait, httpx.AsyncClient().post() returns an awaitable that resolves to mock_response.
        async def mock_post_async(*args, **kwargs):
            return mock_response
            
        mock_post.side_effect = mock_post_async
        
        ans, provider, model, mode = asyncio.run(call_ai_provider("What is an orbit?", {}, "en"))
        
        assert mode == "ai"
        assert provider == "gemini"
        assert model == "gemini-model"
        assert ans == "Mocked gemini response"
        mock_post.assert_called_once()
