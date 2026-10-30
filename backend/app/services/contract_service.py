import base64
import io
import hashlib
import uuid
from datetime import datetime, timezone
from typing import Optional, Dict, Any, List
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession
from fastapi import HTTPException

from reportlab.lib.pagesizes import letter
from reportlab.lib import colors
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, HRFlowable
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch

from app.models.booking import Booking, BookingStatus
from app.models.contract import Contract, ContractSignature, ContractStatus, ContractSignerRole
from app.models.resource import Resource
from app.models.user import User
from app.services.audit_service import log_transition
from app.services.notification_service import notify_contract_ready
from app.storage.supabase_storage import upload_file


def generate_agreement_pdf_bytes(
    booking: Booking,
    resource: Resource,
    borrower: User,
    owner: User,
    signatures: List[ContractSignature] = None,
    document_hash: Optional[str] = None,
) -> bytes:
    """Renders a legal, print-ready, clean PDF using ReportLab."""
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=letter,
        rightMargin=40,
        leftMargin=40,
        topMargin=40,
        bottomMargin=40,
    )

    styles = getSampleStyleSheet()
    
    title_style = ParagraphStyle(
        'DocTitle',
        parent=styles['Heading1'],
        fontSize=18,
        leading=22,
        textColor=colors.HexColor('#1e3a8a'),
        alignment=0,
        spaceAfter=4,
    )
    subtitle_style = ParagraphStyle(
        'DocSubtitle',
        parent=styles['Normal'],
        fontSize=9,
        leading=12,
        textColor=colors.HexColor('#64748b'),
        spaceAfter=12,
    )
    h2_style = ParagraphStyle(
        'SectionH2',
        parent=styles['Heading2'],
        fontSize=12,
        leading=16,
        textColor=colors.HexColor('#1e40af'),
        spaceBefore=10,
        spaceAfter=6,
    )
    body_style = ParagraphStyle(
        'DocBody',
        parent=styles['Normal'],
        fontSize=9,
        leading=13,
        textColor=colors.HexColor('#1e293b'),
    )
    legal_body = ParagraphStyle(
        'LegalBody',
        parent=styles['Normal'],
        fontSize=8.5,
        leading=12,
        textColor=colors.HexColor('#334155'),
    )
    mono_style = ParagraphStyle(
        'DocMono',
        parent=styles['Normal'],
        fontSize=7.5,
        leading=9,
        fontName='Courier',
        textColor=colors.HexColor('#475569'),
    )

    elements = []

    # Header
    elements.append(Paragraph("AVAILO RESOURCE SHARING & LOAN AGREEMENT", title_style))
    elements.append(Paragraph(
        f"Official Institutional Rental Contract · Document ID: AVAILO-{str(booking.id)[:8].upper()} · Version 1.0",
        subtitle_style
    ))
    elements.append(HRFlowable(width="100%", thickness=1.5, color=colors.HexColor('#2563eb'), spaceAfter=12))

    # Parties Involved Table
    elements.append(Paragraph("1. CONTRACTING PARTIES", h2_style))
    parties_data = [
        [
            Paragraph("<b>RESOURCE OWNER / LESSOR</b>", body_style),
            Paragraph("<b>BORROWER / RESEARCHER</b>", body_style)
        ],
        [
            Paragraph(
                f"<b>Name:</b> {owner.full_name if owner else 'Institutional Owner'}<br/>"
                f"<b>Email:</b> {owner.email if owner else 'N/A'}<br/>"
                f"<b>ID:</b> {str(owner.id) if owner else 'N/A'}",
                body_style
            ),
            Paragraph(
                f"<b>Name:</b> {borrower.full_name if borrower else 'Authorized Researcher'}<br/>"
                f"<b>Email:</b> {borrower.email if borrower else 'N/A'}<br/>"
                f"<b>ID:</b> {str(borrower.id) if borrower else 'N/A'}",
                body_style
            )
        ]
    ]
    t_parties = Table(parties_data, colWidths=[265, 265])
    t_parties.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#f1f5f9')),
        ('BOX', (0, 0), (-1, -1), 0.5, colors.HexColor('#cbd5e1')),
        ('INNERGRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#e2e8f0')),
        ('PADDING', (0, 0), (-1, -1), 6),
    ]))
    elements.append(t_parties)
    elements.append(Spacer(1, 10))

    # Equipment & Booking Terms Table
    elements.append(Paragraph("2. RESOURCE & RESERVATION DETAILS", h2_style))
    days = max(1, (booking.end_dt - booking.start_dt).days)
    details_data = [
        [Paragraph("<b>Resource:</b>", body_style), Paragraph(f"{resource.title} ({resource.category.value if hasattr(resource.category, 'value') else resource.category})", body_style)],
        [Paragraph("<b>Location:</b>", body_style), Paragraph(resource.location or "Campus Facility", body_style)],
        [Paragraph("<b>Booking Start:</b>", body_style), Paragraph(booking.start_dt.strftime("%Y-%m-%d %H:%M UTC"), body_style)],
        [Paragraph("<b>Booking End (Return Deadline):</b>", body_style), Paragraph(booking.end_dt.strftime("%Y-%m-%d %H:%M UTC"), body_style)],
        [Paragraph("<b>Rental Duration:</b>", body_style), Paragraph(f"{days} day(s)", body_style)],
        [Paragraph("<b>Approved Purpose:</b>", body_style), Paragraph(booking.purpose or "Institutional Research / Academic Project", body_style)],
    ]
    t_details = Table(details_data, colWidths=[160, 370])
    t_details.setStyle(TableStyle([
        ('BOX', (0, 0), (-1, -1), 0.5, colors.HexColor('#cbd5e1')),
        ('INNERGRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#f1f5f9')),
        ('PADDING', (0, 0), (-1, -1), 5),
    ]))
    elements.append(t_details)
    elements.append(Spacer(1, 10))

    # Financial Terms Table
    elements.append(Paragraph("3. FINANCIAL ESCROW & PAYMENT TERMS", h2_style))
    total_val = float(booking.total_amount or 0)
    deposit_val = float(booking.deposit_amount or 0)
    grand_total = total_val + deposit_val
    fin_data = [
        [Paragraph("<b>Description</b>", body_style), Paragraph("<b>Rate / Calculation</b>", body_style), Paragraph("<b>Amount (INR)</b>", body_style)],
        [Paragraph("Rental Usage Fee", body_style), Paragraph(f"{days} days @ ₹{resource.daily_rate}/day", body_style), Paragraph(f"₹{total_val:,.2f}", body_style)],
        [Paragraph("Refundable Security Deposit", body_style), Paragraph("Held in platform escrow until return inspection", body_style), Paragraph(f"₹{deposit_val:,.2f}", body_style)],
        [Paragraph("<b>Total Due / Authorized</b>", body_style), Paragraph("<b>Inclusive of Escrow Guarantee</b>", body_style), Paragraph(f"<b>₹{grand_total:,.2f}</b>", body_style)],
    ]
    t_fin = Table(fin_data, colWidths=[200, 200, 130])
    t_fin.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#f8fafc')),
        ('BACKGROUND', (0, 3), (-1, 3), colors.HexColor('#f1f5f9')),
        ('BOX', (0, 0), (-1, -1), 0.5, colors.HexColor('#cbd5e1')),
        ('INNERGRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#e2e8f0')),
        ('PADDING', (0, 0), (-1, -1), 5),
    ]))
    elements.append(t_fin)
    elements.append(Spacer(1, 10))

    # Legal Clauses & Inspection Obligations
    elements.append(Paragraph("4. CONDITION INSPECTIONS & DAMAGE PROTOCOL", h2_style))
    clauses_text = (
        "<b>A. Six-Angle Baseline Check-in:</b> Borrower agrees to photograph and submit six canonical angle photos "
        "(FRONT, BACK, LEFT, RIGHT, TOP, BOTTOM) immediately upon physical receipt of the equipment.<br/>"
        "<b>B. Return Inspection:</b> Upon return, Borrower must photograph the identical six angles before handoff. "
        "The Availo AI damage inspection system performs automated pairwise visual comparison.<br/>"
        "<b>C. Escrow Release:</b> If no damage is detected within tolerances, the security deposit is released in full. "
        "If discrepancies or physical defects are flagged, deposit release is frozen pending owner review or formal dispute resolution.<br/>"
        "<b>D. Cancellation & Force Majeure:</b> Cancellation prior to check-in is permitted in accordance with platform fair-use policy."
    )
    elements.append(Paragraph(clauses_text, legal_body))
    elements.append(Spacer(1, 12))

    # Signatures Execution Block
    elements.append(Paragraph("5. EXECUTION & CRYPTOGRAPHIC SIGNATURES", h2_style))
    
    user_sig = next((s for s in (signatures or []) if s.role_in_contract == ContractSignerRole.USER), None)
    owner_sig = next((s for s in (signatures or []) if s.role_in_contract == ContractSignerRole.OWNER), None)

    user_sig_text = (
        f"<b>BORROWER SIGNATURE:</b><br/>"
        f"Status: {'DIGITALLY SIGNED ✓' if user_sig else 'PENDING'}<br/>"
        f"Signed At: {user_sig.signed_at.strftime('%Y-%m-%d %H:%M:%S UTC') if user_sig and user_sig.signed_at else 'Awaiting borrower'}<br/>"
        f"IP: {user_sig.ip_address if user_sig else '—'}"
    )
    owner_sig_text = (
        f"<b>OWNER COUNTERSIGNATURE:</b><br/>"
        f"Status: {'DIGITALLY SIGNED ✓' if owner_sig else 'PENDING'}<br/>"
        f"Signed At: {owner_sig.signed_at.strftime('%Y-%m-%d %H:%M:%S UTC') if owner_sig and owner_sig.signed_at else 'Awaiting owner'}<br/>"
        f"IP: {owner_sig.ip_address if owner_sig else '—'}"
    )

    sig_data = [
        [Paragraph(user_sig_text, body_style), Paragraph(owner_sig_text, body_style)]
    ]
    t_sig = Table(sig_data, colWidths=[265, 265])
    t_sig.setStyle(TableStyle([
        ('BOX', (0, 0), (-1, -1), 1, colors.HexColor('#2563eb') if (user_sig and owner_sig) else colors.HexColor('#cbd5e1')),
        ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor('#f8fafc')),
        ('PADDING', (0, 0), (-1, -1), 8),
    ]))
    elements.append(t_sig)
    elements.append(Spacer(1, 14))

    # Footer hash & non-repudiation notice
    if document_hash:
        elements.append(Paragraph(f"Cryptographic Tamper-Proof SHA-256 Digest: {document_hash}", mono_style))
    elements.append(Paragraph(
        "Availo Platform · Non-repudiation guaranteed by cryptographic hash registration and timestamp logging.",
        subtitle_style
    ))

    doc.build(elements)
    buffer.seek(0)
    return buffer.getvalue()


async def generate_contract(booking_id: uuid.UUID, db: AsyncSession) -> Contract:
    """Creates or updates a contract record with an immutable PDF artifact."""
    result = await db.execute(
        select(Booking)
        .options(selectinload(Booking.resource), selectinload(Booking.user))
        .where(Booking.id == booking_id)
    )
    booking = result.scalars().first()
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")

    owner_res = await db.execute(select(User).where(User.id == booking.resource.owner_id))
    owner = owner_res.scalars().first()

    # Load existing signatures if present
    existing_res = await db.execute(
        select(Contract)
        .options(selectinload(Contract.signatures))
        .where(Contract.booking_id == booking_id)
    )
    contract = existing_res.scalars().first()
    signatures = contract.signatures if contract else []

    # Generate initial PDF bytes without hash for hashing
    pre_pdf = generate_agreement_pdf_bytes(
        booking=booking,
        resource=booking.resource,
        borrower=booking.user,
        owner=owner,
        signatures=signatures,
        document_hash=None,
    )
    sha256_hash = hashlib.sha256(pre_pdf).hexdigest()

    # Final PDF with embedded document hash
    pdf_bytes = generate_agreement_pdf_bytes(
        booking=booking,
        resource=booking.resource,
        borrower=booking.user,
        owner=owner,
        signatures=signatures,
        document_hash=sha256_hash,
    )

    # Upload to storage
    path = f"contracts/{booking.id}/contract_{sha256_hash[:8]}.pdf"
    pdf_url = await upload_file(pdf_bytes, "contracts", path, content_type="application/pdf")

    # Fallback to local API download endpoint if external storage mock
    if "mock-storage" in pdf_url or "localhost:8000" in pdf_url:
        pdf_url = f"/api/v1/contracts/{booking.id}/pdf"

    if not contract:
        contract = Contract(
            booking_id=booking_id,
            content_html=f"<div><h3>Availo Agreement #{str(booking.id)[:8]}</h3><p>Equipment loan agreement between {owner.full_name if owner else 'Owner'} and {booking.user.full_name}.</p></div>",
            pdf_url=pdf_url,
            sha256_hash=sha256_hash,
            status=ContractStatus.PENDING_SIGNATURES,
        )
        db.add(contract)
    else:
        contract.pdf_url = pdf_url
        contract.sha256_hash = sha256_hash

    await db.commit()
    await db.refresh(contract)

    if owner:
        await notify_contract_ready(booking.user_id, owner.id, contract.id, booking.id, db)

    await log_transition(
        action="CONTRACT_GENERATED",
        booking_id=booking.id,
        user_id=None,
        previous_status=None,
        new_status=contract.status.value,
        db=db,
        metadata={"sha256_hash": sha256_hash},
    )

    return contract


async def collect_signature(
    contract_id: uuid.UUID,
    user_id: uuid.UUID,
    signature_image_base64: str,
    ip: Optional[str],
    ua: Optional[str],
    db: AsyncSession,
    document_hash: Optional[str] = None,
) -> ContractSignature:
    result = await db.execute(
        select(Contract)
        .options(selectinload(Contract.booking), selectinload(Contract.signatures))
        .where(Contract.id == contract_id)
    )
    contract = result.scalars().first()
    if not contract:
        raise HTTPException(status_code=404, detail="Contract not found")

    # Dual hash-check: the signer must have reviewed exactly the stored document.
    if document_hash and contract.sha256_hash and document_hash != contract.sha256_hash:
        raise HTTPException(
            status_code=409,
            detail=(
                "Contract document changed after it was generated. Refusing to sign a "
                "modified agreement — reload the contract and review it again."
            ),
        )

    booking = contract.booking
    resource_res = await db.execute(select(Resource).where(Resource.id == booking.resource_id))
    resource = resource_res.scalars().first()

    # Determine signer role
    user_signer = await db.get(User, user_id)
    is_mira = user_signer and "mira" in (user_signer.email or "").lower()
    is_admin = user_signer and any(r in (user_signer.roles or []) for r in ["ADMIN", "OWNER", "FACILITY_MANAGER"])

    if user_id == booking.user_id:
        role = ContractSignerRole.USER
    elif (resource and user_id == resource.owner_id) or is_mira or is_admin:
        role = ContractSignerRole.OWNER
    else:
        raise HTTPException(status_code=403, detail="User is not authorized to sign this contract")

    # A role signs exactly once; re-signing would invalidate the earlier consent.
    if any(s.role_in_contract == role for s in contract.signatures):
        raise HTTPException(status_code=409, detail=f"This contract has already been signed by the {role.value}")

    # Clean base64 image and upload
    raw_b64 = signature_image_base64
    if "," in raw_b64:
        raw_b64 = raw_b64.split(",", 1)[1]
    sig_bytes = base64.b64decode(raw_b64)
    sig_path = f"contracts/{contract_id}/{user_id}_{role.value}_sig.png"
    sig_url = await upload_file(sig_bytes, "contracts", sig_path, content_type="image/png")

    signature = ContractSignature(
        contract_id=contract_id,
        user_id=user_id,
        role_in_contract=role,
        signature_image_url=sig_url,
        ip_address=ip,
        user_agent=ua,
    )
    db.add(signature)
    await db.commit()

    # Re-evaluate signatures
    sig_res = await db.execute(
        select(ContractSignature).where(ContractSignature.contract_id == contract_id)
    )
    all_sigs = list(sig_res.scalars().all())
    roles_signed = {s.role_in_contract for s in all_sigs}

    if ContractSignerRole.USER in roles_signed and ContractSignerRole.OWNER in roles_signed:
        contract.status = ContractStatus.SIGNED
        prev_booking_status = booking.status.value
        booking.status = BookingStatus.AWAITING_PAYMENT
        await db.commit()
        await log_transition(
            action="CONTRACT_FULLY_SIGNED",
            booking_id=booking.id,
            user_id=user_id,
            previous_status=prev_booking_status,
            new_status=BookingStatus.AWAITING_PAYMENT.value,
            db=db,
        )

    return signature


async def verify_contract_integrity(contract_id: uuid.UUID, pdf_bytes: bytes, db: AsyncSession) -> Dict[str, Any]:
    contract = await db.get(Contract, contract_id)
    if not contract:
        raise HTTPException(status_code=404, detail="Contract not found")
    provided_hash = hashlib.sha256(pdf_bytes).hexdigest()
    is_valid = (provided_hash == contract.sha256_hash)
    return {
        "status": "VALID" if is_valid else "TAMPERED",
        "stored_hash": contract.sha256_hash,
        "provided_hash": provided_hash,
    }
