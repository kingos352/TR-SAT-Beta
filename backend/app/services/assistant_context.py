from typing import Dict, Any

def sanitize_and_summarize_context(context: Dict[str, Any]) -> Dict[str, Any]:
    """
    Sanitize and summarize the context received from the frontend.
    Strip large arrays.
    """
    sanitized = {}
    
    if not context:
        return sanitized

    for k, v in context.items():
        if isinstance(v, list):
            if len(v) > 5:
                sanitized[k] = f"[Array of {len(v)} items]"
            else:
                sanitized[k] = v
        elif isinstance(v, dict):
            sanitized_dict = {}
            for dk, dv in v.items():
                if isinstance(dv, list):
                    if len(dv) > 5:
                        sanitized_dict[dk] = f"[Array of {len(dv)} items]"
                    else:
                        sanitized_dict[dk] = dv
                else:
                    sanitized_dict[dk] = dv
            sanitized[k] = sanitized_dict
        else:
            sanitized[k] = v
            
    return sanitized
