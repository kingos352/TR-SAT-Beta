import httpx
from typing import Dict, Any, Tuple, List
from app.config import settings

def local_fallback_assistant(message: str, context: Dict[str, Any], language: str) -> Tuple[str, List[str]]:
    """
    Robust local fallback assistant answering common questions.
    Returns (answer, warnings).
    """
    msg = message.lower()
    
    # Guardrails
    if "telemetry" in msg or "direct telemetry" in msg:
        return "I cannot provide direct telemetry. Live tracking uses mathematical propagation (SGP4) from TLEs.", []
        
    if "collision" in msg and "probability" in msg:
        return "I cannot provide collision probability. Conjunction analysis uses geometric miss distance.", []
        
    if "visibility" in msg and "guaranteed" in msg:
        return "I cannot guarantee optical visibility. Visibility depends on weather, illumination, and other factors.", []
        
    if "api key" in msg or "password" in msg:
        return "I cannot provide API keys or sensitive information.", []
        
    # Basic answers
    if "tle" in msg or "gp" in msg:
        return "TLE (Two-Line Element) or GP (General Perturbation) data is used to propagate satellite orbits using the SGP4 model.", []
        
    if "sgp4" in msg:
        return "SGP4 is a mathematical model used to calculate the position and velocity of Earth-orbiting satellites from TLE data.", []
        
    return "I am running in local fallback mode. Please configure an AI provider for more complex queries.", []


async def call_ai_provider(message: str, context: Dict[str, Any], language: str) -> Tuple[str, str, str, str]:
    """
    Proxy to Gemini or OpenRouter.
    Returns (answer, provider, model, mode).
    """
    provider = settings.AI_PROVIDER.lower()
    
    if provider == "local":
        ans, warns = local_fallback_assistant(message, context, language)
        return ans, "local", "local", "local_fallback"
        
    system_prompt = f"You are the TR-SAT Assistant. Language: {language}. Context: {context}."
    
    prompt = (f"{system_prompt}\n"
              f"Rules:\n"
              f"- Do not provide direct telemetry, state that live tracking uses SGP4/TLE.\n"
              f"- Do not provide collision probability, mention geometric miss distance.\n"
              f"- Do not guarantee optical visibility.\n"
              f"- Do not reveal API keys.\n"
              f"User message: {message}")

    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            if provider == "gemini":
                if not settings.GEMINI_API_KEY:
                    raise ValueError("Gemini API key missing")
                
                url = f"https://generativelanguage.googleapis.com/v1beta/models/{settings.GEMINI_MODEL}:generateContent?key={settings.GEMINI_API_KEY}"
                payload = {
                    "contents": [{"parts": [{"text": prompt}]}]
                }
                
                resp = await client.post(url, json=payload)
                resp.raise_for_status()
                data = resp.json()
                
                answer = data["candidates"][0]["content"]["parts"][0]["text"]
                return answer, "gemini", settings.GEMINI_MODEL, "ai"
                
            elif provider == "openrouter":
                if not settings.OPENROUTER_API_KEY:
                    raise ValueError("OpenRouter API key missing")
                    
                url = "https://openrouter.ai/api/v1/chat/completions"
                headers = {
                    "Authorization": f"Bearer {settings.OPENROUTER_API_KEY}",
                    "HTTP-Referer": "http://localhost:5173",
                    "X-Title": "TR-SAT"
                }
                payload = {
                    "model": settings.OPENROUTER_MODEL,
                    "messages": [
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": prompt}
                    ]
                }
                
                resp = await client.post(url, headers=headers, json=payload)
                resp.raise_for_status()
                data = resp.json()
                
                answer = data["choices"][0]["message"]["content"]
                return answer, "openrouter", settings.OPENROUTER_MODEL, "ai"
                
            else:
                ans, warns = local_fallback_assistant(message, context, language)
                return ans, "local", "local", "local_fallback"
                
    except Exception as e:
        print(f"AI Provider error: {e}")
        ans, warns = local_fallback_assistant(message, context, language)
        return ans, "local", "local", "local_fallback"
