import os
import hashlib
import uuid
from io import BytesIO
from datetime import datetime, timezone
from typing import Dict, Any, List, Optional
from reportlab.lib.pagesizes import letter
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, HRFlowable
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib import colors

from backend.app.core.config import settings
from backend.app.repositories.agreement_repo import agreement_repo
from backend.app.services.ai import ai_service

MANDATORY_CLAUSES = [
    "1. Purpose & Access: The resource shall be accessed and utilized exclusively for the academic, research, or approved project purposes stated in this application.",
    "2. Safety & Compliance: The Borrower certifies that they hold all required safety clearances and certifications, and agrees to observe all posted lab safety protocols and wear requisite Personal Protective Equipment (PPE) at all times.",
    "3. Inspection & Pre-Check: The Borrower and Owner agree that condition inspections (covering 6 standardized visual angles) conducted prior to check-out and upon check-in serve as the definitive audit record of physical condition.",
    "4. Damage & Liability: The Borrower shall report any malfunction, anomaly, or damage immediately. Intentional misuse, gross negligence, or failure to perform mandated maintenance shall subject the Borrower to institutional review and suspension of sharing privileges.",
    "5. Return Policy: The resource must be returned strictly before the designated completion time in a clean and orderly state. Late returns without prior authorization trigger automatic queue reassignment and potential access restrictions."
]

class AgreementService:
    def generate_pdf_bytes(
        self,
        booking: Dict[str, Any],
        resource: Dict[str, Any],
        user: Dict[str, Any],
        tailored_clauses: List[str],
        user_signature: Optional[str] = None,
        owner_signature: Optional[str] = None
    ) -> bytes:
        buffer = BytesIO()
        doc = SimpleDocTemplate(
            buffer,
            pagesize=letter,
            rightMargin=40,
            leftMargin=40,
            topMargin=40,
            bottomMargin=40
        )

        styles = getSampleStyleSheet()
        title_style = ParagraphStyle(
            'TitleStyle',
            parent=styles['Heading1'],
            fontSize=18,
            leading=22,
            textColor=colors.HexColor('#111111'),
            spaceAfter=10
        )
        body_style = ParagraphStyle(
            'Body',
            parent=styles['Normal'],
            fontSize=10,
            leading=14,
            textColor=colors.HexColor('#222222'),
            spaceAfter=6
        )
        clause_style = ParagraphStyle(
            'Clause',
            parent=styles['Normal'],
            fontSize=9,
            leading=13,
            textColor=colors.HexColor('#333333'),
            spaceAfter=5
        )

        elements = []
        elements.append(Paragraph("RESOURCX INSTITUTIONAL RESOURCE AGREEMENT", title_style))
        elements.append(Paragraph(f"Agreement ID: AGR-{booking.get('id', 'N/A').upper()} | Date: {datetime.now(timezone.utc).strftime('%d %b %Y')}", body_style))
        elements.append(HRFlowable(width="100%", thickness=1, color=colors.HexColor('#cccccc'), spaceAfter=15))

        # Booking metadata table
        data = [
            [Paragraph("<b>Resource:</b>", body_style), Paragraph(resource.get("name", "N/A"), body_style)],
            [Paragraph("<b>Location:</b>", body_style), Paragraph(f"{resource.get('location', '')} ({resource.get('building', '')})", body_style)],
            [Paragraph("<b>Borrower:</b>", body_style), Paragraph(f"{user.get('full_name', '')} ({user.get('academic_role', '')}, {user.get('department', '')})", body_style)],
            [Paragraph("<b>Start Date:</b>", body_style), Paragraph(booking.get("start_date", "")[:16].replace("T", " "), body_style)],
            [Paragraph("<b>End Date:</b>", body_style), Paragraph(booking.get("end_date", "")[:16].replace("T", " "), body_style)],
            [Paragraph("<b>Stated Purpose:</b>", body_style), Paragraph(booking.get("purpose", "N/A"), body_style)]
        ]
        t = Table(data, colWidths=[120, 400])
        t.setStyle(TableStyle([
            ('BACKGROUND', (0,0), (-1,-1), colors.HexColor('#f9f9f9')),
            ('INNERGRID', (0,0), (-1,-1), 0.5, colors.HexColor('#eeeeee')),
            ('BOX', (0,0), (-1,-1), 0.5, colors.HexColor('#dddddd')),
            ('TOPPADDING', (0,0), (-1,-1), 4),
            ('BOTTOMPADDING', (0,0), (-1,-1), 4),
        ]))
        elements.append(t)
        elements.append(Spacer(1, 15))

        elements.append(Paragraph("<b>SECTION I: MANDATORY INSTITUTIONAL TERMS</b>", body_style))
        for c in MANDATORY_CLAUSES:
            elements.append(Paragraph(c, clause_style))
        elements.append(Spacer(1, 10))

        if tailored_clauses:
            elements.append(Paragraph("<b>SECTION II: RESOURCE-SPECIFIC OPERATIONAL COVENANTS</b>", body_style))
            for i, tc in enumerate(tailored_clauses, start=1):
                elements.append(Paragraph(f"Special Rule {i}: {tc}", clause_style))
            elements.append(Spacer(1, 15))

        # Signatures section
        elements.append(HRFlowable(width="100%", thickness=1, color=colors.HexColor('#cccccc'), spaceAfter=15))
        sig_data = [
            [
                Paragraph(f"<b>BORROWER ACKNOWLEDGMENT:</b><br/>{user.get('full_name')}<br/>Status: {'SIGNED' if user_signature else 'AWAITING SIGNATURE'}", body_style),
                Paragraph(f"<b>RESOURCE OWNER APPROVAL:</b><br/>{resource.get('owner_name', 'Resource Owner')}<br/>Status: {'SIGNED' if owner_signature else 'AWAITING SIGNATURE'}", body_style)
            ]
        ]
        sig_table = Table(sig_data, colWidths=[260, 260])
        elements.append(sig_table)

        doc.build(elements)
        return buffer.getvalue()

    async def create_agreement_for_booking(
        self,
        booking: Dict[str, Any],
        resource: Dict[str, Any],
        user: Dict[str, Any]
    ) -> Dict[str, Any]:
        # Check if already exists
        existing = await agreement_repo.get_by_booking_id(booking["id"])
        if existing:
            return existing

        # Generate tailored clauses with AI
        ai_result = await ai_service.tailor_agreement(
            resource_name=resource.get("name", ""),
            category=resource.get("category", ""),
            borrower_name=user.get("full_name", ""),
            academic_role=user.get("academic_role", "Student"),
            department=user.get("department", ""),
            rules=resource.get("rules", []),
            criteria=resource.get("criteria", [])
        )
        tailored = ai_result.tailored_clauses

        # Render PDF
        pdf_bytes = self.generate_pdf_bytes(booking, resource, user, tailored)
        doc_hash = hashlib.sha256(pdf_bytes).hexdigest()
        doc_path = f"agreements/agr_{booking['id']}.pdf"

        # Save to database
        agreement_record = {
            "id": str(uuid.uuid4()),
            "booking_id": booking["id"],
            "document_path": doc_path,
            "document_hash": doc_hash,
            "content_clauses": {
                "mandatory": MANDATORY_CLAUSES,
                "tailored": tailored
            },
            "is_fully_signed": False
        }
        return await agreement_repo.create(agreement_record)

    async def sign_agreement(
        self,
        booking_id: str,
        signer_role: str, # 'user' or 'owner'
        signer_id: str,
        signature_data: str,
        expected_hash: str,
        client_ip: str
    ) -> Dict[str, Any]:
        agreement = await agreement_repo.get_by_booking_id(booking_id)
        if not agreement:
            raise ValueError(f"Agreement not found for booking '{booking_id}'. The booking may not have been approved yet.")

        # Check if this party has already signed
        if signer_role == "user" and agreement.get("user_signed_at"):
            raise ValueError("Borrower signature has already been recorded for this agreement.")
        if signer_role == "owner" and agreement.get("owner_signed_at"):
            raise ValueError("Owner signature has already been recorded for this agreement.")

        # Hash check: reject if document was altered
        if expected_hash and expected_hash != agreement.get("document_hash"):
            raise ValueError("Document integrity check failed: document hash changed (hash mismatch) or does not match server agreement.")

        sig_path = f"agreements/sig_{booking_id}_{signer_role}.png"
        updates = {}
        now_iso = datetime.now(timezone.utc).isoformat()

        if signer_role == "user":
            updates["user_signed_at"] = now_iso
            updates["user_signature_path"] = sig_path
            updates["user_signer_ip"] = client_ip
            updates["user_doc_hash"] = expected_hash
        elif signer_role == "owner":
            updates["owner_signed_at"] = now_iso
            updates["owner_signature_path"] = sig_path
            updates["owner_signer_ip"] = client_ip
            updates["owner_doc_hash"] = expected_hash

        # Check if both signed
        is_user_signed = bool(agreement.get("user_signed_at") or updates.get("user_signed_at"))
        is_owner_signed = bool(agreement.get("owner_signed_at") or updates.get("owner_signed_at"))

        if is_user_signed and is_owner_signed:
            updates["is_fully_signed"] = True
            updates["signed_document_path"] = f"agreements/final_signed_{booking_id}.pdf"

        updated = await agreement_repo.update(agreement["id"], updates)
        return updated

agreement_service = AgreementService()

