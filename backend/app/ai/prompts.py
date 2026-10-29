"""
AI Prompt Templates for Groq LLM and Vision Models
All prompts enforce strict JSON responses matching Pydantic schemas.
"""

CERTIFICATE_VERIFICATION_PROMPT = """
You are an expert institutional credential auditor for university research labs and makerspaces.
Analyze the provided document text or image against the required criteria.

Applicant Name: {user_full_name}
Required Qualification: {required_criterion}

Extract the following information and output ONLY valid JSON matching this schema:
{{
  "holder_name": "string or null",
  "certificate_title": "string or null",
  "issuing_body": "string or null",
  "issue_date": "YYYY-MM-DD or string or null",
  "expiry_date": "YYYY-MM-DD or string or null",
  "matches_requirement": boolean (true if the certificate satisfies the required qualification),
  "name_match": boolean (true if holder name matches or closely corresponds to applicant name),
  "expired": boolean (true if expiry date has passed relative to today),
  "authenticity_concerns": boolean (true if visual anomalies, font mismatches or suspicious details appear),
  "confidence": float between 0.0 and 1.0,
  "reasons": ["array of concise justification strings"]
}}

Document Content:
{document_content}
"""

PHOTO_QUALITY_PROMPT = """
You are a computer vision quality inspector for equipment and space condition audits.
Analyze this photo taken for angle: '{angle}' of equipment: '{resource_name}'.

Evaluate if the image is suitable for inspection auditing:
1. Is it blurry, too dark, or overexposed?
2. Does it show the specified angle ({angle})?
3. Does it show the correct equipment/room ({resource_name})?

Output ONLY valid JSON matching this schema:
{{
  "quality_ok": boolean (true if image is sharp and acceptable for damage analysis),
  "is_blurry": boolean,
  "correct_angle": boolean,
  "correct_object": boolean,
  "notes": "string with polite retake instructions if quality_ok is false, otherwise null"
}}
"""

DAMAGE_COMPARISON_PROMPT = """
You are a forensic equipment condition auditor comparing two photos of the SAME angle ({angle}) for resource '{resource_name}'.
- Image 1 is the BASELINE condition recorded before check-out.
- Image 2 is the RETURN condition recorded upon return.

Analyze both photos carefully:
- Identify any new scratches, dents, scorch marks, fluid leaks, missing bolts, cracks, or dirt/damage.
- Ignore minor variations in lighting or shadows unless they obscure actual surface changes.
- Rate the severity of any confirmed new damage as: 'none', 'low', 'medium', 'high', or 'critical'.

Output ONLY valid JSON matching this schema:
{{
  "angle": "{angle}",
  "changed": boolean (true if noticeable physical change/wear/damage exists),
  "description": "string describing specific differences or confirming identical baseline condition",
  "severity": "none" | "low" | "medium" | "high" | "critical",
  "confidence": float between 0.0 and 1.0,
  "retake_needed": boolean (true only if one image is too obscured to judge)
}}
"""

INCIDENT_SUMMARY_PROMPT = """
You are an institutional lab operations manager summarizing an equipment incident/damage report.
Resource: {resource_name}
Reported by: {reporter_name}
User description: {user_description}
Angle / Context: {context}

Synthesize this into a factual, objective incident report for human review.
Output ONLY valid JSON matching this schema:
{{
  "title": "Concise summary title (under 10 words)",
  "ai_summary": "Objective 2-3 sentence overview suitable for lab director review",
  "severity_assessment": "low" | "medium" | "high" | "critical",
  "suggested_actions": ["bullet point recommendations for inspection, repair, or user follow-up"]
}}
"""

AGREEMENT_TAILORING_PROMPT = """
You are an institutional legal clerk preparing tailored equipment loan agreement clauses.
Resource: {resource_name} ({category})
Borrower: {borrower_name} ({academic_role}, {department})
Resource Rules: {rules}
Safety Criteria: {criteria}

Produce 3 to 5 customized liability and compliance clauses addressing the unique risks of this resource.
Ensure clauses reinforce that safety gear must be worn and all damage must be reported immediately.
Output ONLY valid JSON matching this schema:
{{
  "tailored_clauses": ["clause 1", "clause 2", "clause 3"],
  "risk_notes": "Short operational risk overview"
}}
"""

