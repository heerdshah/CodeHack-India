import os
import json
import time
import base64
import logging
from io import BytesIO
from typing import Optional, List, Dict, Any, Union
from PIL import Image
from pydantic import ValidationError

from backend.app.core.config import settings
from backend.app.ai.schemas import (
    CertificateVerificationResult,
    PhotoQualityAssessment,
    AngleDamageComparison,
    IncidentSummaryResult,
    AgreementClausesResult
)
from backend.app.ai.prompts import (
    CERTIFICATE_VERIFICATION_PROMPT,
    PHOTO_QUALITY_PROMPT,
    DAMAGE_COMPARISON_PROMPT,
    INCIDENT_SUMMARY_PROMPT,
    AGREEMENT_TAILORING_PROMPT
)

logger = logging.getLogger("resourcx.ai")

class AIService:
    def __init__(self):
        self._groq_client = None

    def get_client(self):
        if self._groq_client is not None:
            return self._groq_client
        if not settings.GROQ_API_KEY:
            logger.warning("[AI Service] GROQ_API_KEY is not configured. AI fallback to human review mode enabled.")
            return None
        try:
            from groq import Groq
            self._groq_client = Groq(api_key=settings.GROQ_API_KEY)
            return self._groq_client
        except Exception as e:
            logger.error(f"[AI Service] Failed to initialize Groq client: {e}")
            return None

    def is_available(self) -> bool:
        return bool(settings.GROQ_API_KEY and self.get_client() is not None)

    # Image preparation: compress, resize, encode base64
    def prepare_image_b64(self, image_bytes: bytes, max_dim: int = 1024, quality: int = 80) -> str:
        try:
            im = Image.open(BytesIO(image_bytes))
            if im.mode in ("RGBA", "P"):
                im = im.convert("RGB")
            im.thumbnail((max_dim, max_dim))
            buf = BytesIO()
            im.save(buf, format="JPEG", quality=quality)
            encoded = base64.b64encode(buf.getvalue()).decode("utf-8")
            return f"data:image/jpeg;base64,{encoded}"
        except Exception as e:
            logger.error(f"[AI Service] Error resizing image: {e}")
            encoded = base64.b64encode(image_bytes).decode("utf-8")
            return f"data:image/jpeg;base64,{encoded}"

    # PDF extraction / rasterization
    def extract_pdf_content(self, pdf_bytes: bytes) -> Dict[str, Any]:
        """
        Extracts text from PDF. If no text layer found (scanned), rasterizes first page to JPEG.
        Returns {'text': str, 'images': [b64_urls]}
        """
        text = ""
        images = []
        try:
            import fitz # PyMuPDF
            doc = fitz.open(stream=pdf_bytes, filetype="pdf")
            for page in doc:
                text += page.get_text() + "\n"
            
            # If text is too short, rasterize the first page to image
            if len(text.strip()) < 50 and len(doc) > 0:
                page = doc[0]
                pix = page.get_pixmap(dpi=150)
                img_data = pix.tobytes("jpeg")
                images.append(self.prepare_image_b64(img_data))
            doc.close()
        except ImportError:
            # Fallback if PyMuPDF not available
            text = "PDF text extraction unavailable (PyMuPDF library not installed)."
        except Exception as e:
            logger.error(f"[AI Service] PDF processing error: {e}")
            text = f"Error processing document: {str(e)}"
        
        return {"text": text.strip(), "images": images}

    # Core LLM invocation with backoff, JSON mode, and repair retry
    def _call_groq_json(self, messages: List[Dict[str, Any]], model: str, schema_cls, max_retries: int = 2) -> Any:
        client = self.get_client()
        if not client:
            return None

        for attempt in range(max_retries):
            try:
                # Groq API call with JSON mode and low temperature
                response = client.chat.completions.create(
                    model=model,
                    messages=messages,
                    response_format={"type": "json_object"},
                    temperature=0.1
                )
                content = response.choices[0].message.content
                raw_json = json.loads(content)
                parsed = schema_cls.model_validate(raw_json)
                return parsed
            except ValidationError as ve:
                logger.warning(f"[AI Service] Pydantic validation error on attempt {attempt + 1}: {ve}")
                if attempt == 0:
                    # Retry once with repair message
                    messages.append({
                        "role": "assistant",
                        "content": content if 'content' in locals() else "{}"
                    })
                    messages.append({
                        "role": "user",
                        "content": f"Your JSON response did not match the expected schema: {ve}. Please fix your JSON and return ONLY valid JSON matching the schema."
                    })
                else:
                    return None
            except Exception as e:
                err_str = str(e)
                if "429" in err_str or "rate limit" in err_str.lower():
                    wait_time = (2 ** attempt) * 1.5
                    logger.warning(f"[AI Service] Rate limit 429 hit. Backing off for {wait_time}s...")
                    time.sleep(wait_time)
                else:
                    logger.error(f"[AI Service] Groq API call failed: {e}")
                    return None

        return None

    # 1. Certificate Verification
    async def verify_certificate(
        self,
        document_bytes: bytes,
        file_mime: str,
        user_full_name: str,
        required_criterion: str
    ) -> CertificateVerificationResult:
        if not self.is_available():
            return CertificateVerificationResult(
                holder_name=user_full_name,
                certificate_title=required_criterion,
                matches_requirement=False,
                name_match=False,
                expired=False,
                authenticity_concerns=False,
                confidence=0.0,
                reasons=["AI unavailable (GROQ_API_KEY missing). Credential submitted to owner/manager for manual review."]
            )

        extracted_text = ""
        image_urls = []
        if "pdf" in file_mime.lower():
            pdf_info = self.extract_pdf_content(document_bytes)
            extracted_text = pdf_info["text"]
            image_urls = pdf_info["images"]
        else:
            image_urls = [self.prepare_image_b64(document_bytes)]

        # Prepare messages
        prompt_text = CERTIFICATE_VERIFICATION_PROMPT.format(
            user_full_name=user_full_name,
            required_criterion=required_criterion,
            document_content=extracted_text if extracted_text else "[Scanned Image Attached]"
        )

        user_content: List[Dict[str, Any]] = [{"type": "text", "text": prompt_text}]
        if image_urls:
            user_content.append({"type": "image_url", "image_url": {"url": image_urls[0]}})

        model = settings.GROQ_VISION_MODEL if image_urls else settings.GROQ_TEXT_MODEL
        messages = [{"role": "user", "content": user_content}]

        result = self._call_groq_json(messages, model, CertificateVerificationResult)
        if not result:
            return CertificateVerificationResult(
                matches_requirement=False,
                name_match=False,
                expired=False,
                authenticity_concerns=False,
                confidence=0.0,
                reasons=["AI analysis failed JSON validation. Escalated to manual human review."]
            )
        return result

    # 2. Photo Quality Check
    async def assess_photo_quality(
        self,
        photo_bytes: bytes,
        angle: str,
        resource_name: str
    ) -> PhotoQualityAssessment:
        if not self.is_available():
            return PhotoQualityAssessment(quality_ok=True, notes="AI offline. Quality check bypassed.")

        image_url = self.prepare_image_b64(photo_bytes)
        prompt_text = PHOTO_QUALITY_PROMPT.format(angle=angle, resource_name=resource_name)
        messages = [{
            "role": "user",
            "content": [
                {"type": "text", "text": prompt_text},
                {"type": "image_url", "image_url": {"url": image_url}}
            ]
        }]

        result = self._call_groq_json(messages, settings.GROQ_VISION_MODEL, PhotoQualityAssessment)
        return result or PhotoQualityAssessment(quality_ok=True)

    # 3. Six-Angle Damage Comparison (1 call per angle: baseline + return image)
    async def compare_angle_damage(
        self,
        angle: str,
        resource_name: str,
        baseline_bytes: bytes,
        return_bytes: bytes
    ) -> AngleDamageComparison:
        if not self.is_available():
            return AngleDamageComparison(
                angle=angle,
                changed=False,
                description="AI offline. Comparison forwarded to manual return review.",
                severity="none",
                confidence=0.0
            )

        b64_base = self.prepare_image_b64(baseline_bytes)
        b64_ret = self.prepare_image_b64(return_bytes)
        prompt_text = DAMAGE_COMPARISON_PROMPT.format(angle=angle, resource_name=resource_name)

        messages = [{
            "role": "user",
            "content": [
                {"type": "text", "text": prompt_text},
                {"type": "image_url", "image_url": {"url": b64_base}},
                {"type": "image_url", "image_url": {"url": b64_ret}}
            ]
        }]

        result = self._call_groq_json(messages, settings.GROQ_VISION_MODEL, AngleDamageComparison)
        return result or AngleDamageComparison(
            angle=angle,
            changed=False,
            description="Comparison failed validation; human review required.",
            severity="none",
            confidence=0.0
        )

    # 4. Incident Report Summary
    async def summarize_incident(
        self,
        resource_name: str,
        reporter_name: str,
        user_description: str,
        context: str = ""
    ) -> IncidentSummaryResult:
        if not self.is_available():
            return IncidentSummaryResult(
                title=f"Incident: {resource_name}",
                ai_summary=user_description[:200],
                severity_assessment="medium",
                suggested_actions=["Inspect resource before next booking", "Contact borrower for details"]
            )

        prompt_text = INCIDENT_SUMMARY_PROMPT.format(
            resource_name=resource_name,
            reporter_name=reporter_name,
            user_description=user_description,
            context=context
        )
        messages = [{"role": "user", "content": prompt_text}]

        result = self._call_groq_json(messages, settings.GROQ_TEXT_MODEL, IncidentSummaryResult)
        return result or IncidentSummaryResult(
            title=f"Reported issue on {resource_name}",
            ai_summary=user_description,
            severity_assessment="medium",
            suggested_actions=["Review equipment condition with lab technician"]
        )

    # 5. Tailor Agreement Clauses
    async def tailor_agreement(
        self,
        resource_name: str,
        category: str,
        borrower_name: str,
        academic_role: str,
        department: str,
        rules: List[str],
        criteria: List[str]
    ) -> AgreementClausesResult:
        if not self.is_available():
            return AgreementClausesResult(
                tailored_clauses=[
                    f"The borrower agrees to operate {resource_name} strictly according to standard campus safety guidelines.",
                    "Mandatory personal protective equipment (PPE) must be used at all times during operation.",
                    "Any equipment anomaly, breakdown or surface damage must be logged immediately upon discovery."
                ],
                risk_notes="Standard institutional liability terms applied."
            )

        prompt_text = AGREEMENT_TAILORING_PROMPT.format(
            resource_name=resource_name,
            category=category,
            borrower_name=borrower_name,
            academic_role=academic_role,
            department=department,
            rules=", ".join(rules) if rules else "Standard lab rules",
            criteria=", ".join(criteria) if criteria else "Standard qualification"
        )
        messages = [{"role": "user", "content": prompt_text}]

        result = self._call_groq_json(messages, settings.GROQ_TEXT_MODEL, AgreementClausesResult)
        return result or AgreementClausesResult(
            tailored_clauses=[
                f"Borrower agrees to adhere strictly to rules specified for {resource_name}.",
                "All safety protocols and required supervision must be maintained.",
                "Borrower is responsible for returning the resource in clean and serviced condition."
            ]
        )

ai_service = AIService()

