"""
Gemini Vision Damage Detection Service
Sends all 12 images (6 before + 6 after) in ONE API call.
Falls back to Groq per-angle method if GEMINI_API_KEY not set.
"""
import json
import logging
import asyncio
from typing import Optional

from app.core.config import settings
from app.utils.cache import cache_get, cache_set

logger = logging.getLogger("availo.gemini_damage")

DAMAGE_PROMPT = """You are an expert equipment damage inspector for an institutional resource sharing platform.

You will be shown 12 images: 6 BEFORE photos (taken at check-in) and 6 AFTER photos (taken at return), one pair per angle: FRONT, BACK, LEFT, RIGHT, TOP, BOTTOM.

For each of the 6 angle pairs, compare the BEFORE and AFTER photo and determine if there is any new damage, scratches, dents, stains, missing parts, or structural changes that were NOT present in the BEFORE image.

Return ONLY valid JSON — no explanation, no markdown, no preamble:
{
  "pairs": [
    {
      "angle": "FRONT",
      "match": true,
      "confidence": 0.05,
      "anomalies": [],
      "closeup_required": false,
      "severity": "none"
    }
  ],
  "overall_damage_detected": false,
  "overall_severity": "NONE",
  "overall_confidence": 0.05,
  "summary": "No damage detected across all 6 angles."
}

Severity scale per angle: "none" | "minor" | "moderate" | "severe"
Overall severity: "NONE" | "MINOR" | "MODERATE" | "SEVERE"
  - NONE: all confidence < 0.2
  - MINOR: max confidence 0.2–0.45
  - MODERATE: max confidence 0.45–0.7
  - SEVERE: max confidence > 0.7
"""

ANGLES = ["FRONT", "BACK", "LEFT", "RIGHT", "TOP", "BOTTOM"]


def _compute_overall_severity(pairs: list[dict]) -> str:
    max_conf = max((p.get("confidence", 0) for p in pairs if not p.get("match", True)), default=0)
    if max_conf < 0.2:
        return "NONE"
    elif max_conf < 0.45:
        return "MINOR"
    elif max_conf < 0.7:
        return "MODERATE"
    else:
        return "SEVERE"


async def analyze_damage_gemini(
    booking_id: str,
    before_image_bytes_list: list[bytes],   # 6 items, order matches ANGLES
    after_image_bytes_list: list[bytes],    # 6 items, order matches ANGLES
) -> dict:
    """
    Sends all 12 images in ONE Gemini Vision call.
    Caches result in Redis/local cache: key=damage:{booking_id} TTL=86400s (24h).
    Falls back to a safe default (NONE severity) if Gemini unavailable.
    """
    # Check cache first
    cache_key = f"damage:{booking_id}"
    cached = cache_get(cache_key)
    if cached:
        logger.info("[Gemini Damage] Cache HIT for booking %s", booking_id)
        return json.loads(cached)

    gemini_key = getattr(settings, "GEMINI_API_KEY", None)
    if not gemini_key:
        logger.warning("[Gemini Damage] GEMINI_API_KEY not set. Returning safe default.")
        return _safe_default(booking_id, reason="GEMINI_API_KEY not configured")

    try:
        import google.generativeai as genai
        genai.configure(api_key=gemini_key)
        model_name = getattr(settings, "GEMINI_MODEL", "gemini-2.0-flash")
        model = genai.GenerativeModel(model_name)

        # Build image parts: [before_FRONT, after_FRONT, before_BACK, after_BACK, ...]
        image_parts = []
        for i, angle in enumerate(ANGLES):
            before_bytes = before_image_bytes_list[i] if i < len(before_image_bytes_list) else b""
            after_bytes = after_image_bytes_list[i] if i < len(after_image_bytes_list) else b""
            if before_bytes:
                image_parts.append({"mime_type": "image/jpeg", "data": before_bytes})
            if after_bytes:
                image_parts.append({"mime_type": "image/jpeg", "data": after_bytes})

        # Run in thread to avoid blocking event loop
        def _call():
            response = model.generate_content([DAMAGE_PROMPT] + image_parts)
            return response.text

        raw_text = await asyncio.to_thread(_call)

        # Parse JSON — strip markdown fences if present
        clean = raw_text.strip().lstrip("```json").lstrip("```").rstrip("```").strip()
        result = json.loads(clean)

        # Recompute severity server-side (don't trust model)
        if "pairs" in result:
            result["overall_severity"] = _compute_overall_severity(result["pairs"])
            result["overall_damage_detected"] = result["overall_severity"] != "NONE"

        # Cache result
        cache_set(cache_key, json.dumps(result), ex=86400)
        logger.info("[Gemini Damage] Analysis complete for booking %s. Severity: %s",
                    booking_id, result.get("overall_severity"))
        return result

    except json.JSONDecodeError as e:
        logger.error("[Gemini Damage] JSON parse error: %s", e)
        return _safe_default(booking_id, reason="AI_JSON_PARSE_ERROR")
    except Exception as e:
        logger.error("[Gemini Damage] API error: %s", e)
        return _safe_default(booking_id, reason=f"AI_ERROR: {str(e)[:100]}")


def _safe_default(booking_id: str, reason: str = "AI_UNAVAILABLE") -> dict:
    """Returns a safe 'no damage' default with a flag for manual review."""
    pairs = [
        {
            "angle": angle,
            "match": True,
            "confidence": 0.0,
            "anomalies": [],
            "closeup_required": False,
            "severity": "none"
        }
        for angle in ANGLES
    ]
    return {
        "pairs": pairs,
        "overall_damage_detected": False,
        "overall_severity": "NONE",
        "overall_confidence": 0.0,
        "summary": f"AI analysis unavailable ({reason}). Manual review required.",
        "manual_review_required": True,
    }
