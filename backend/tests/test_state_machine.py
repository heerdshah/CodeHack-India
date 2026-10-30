from app.ai.schemas import PhotoQualityAssessment
from app.routers import inspections

PNG_DATA_URL = (
    "data:image/png;base64,"
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/"
    "l2cAAAAASUVORK5CYII="
)
PHOTOS = {
    angle: PNG_DATA_URL
    for angle in ("Front", "Back", "Left", "Right", "Top", "Bottom")
}


def test_invalid_state_transition_rejected(mira_client, user_client):
    """Direct pending->active must return 400 'Invalid booking transition'."""
    b = user_client.post("/bookings", json={
        "resource_id": "sla-printer",
        "start_date": "2027-05-01T09:00:00Z",
        "end_date": "2027-05-01T17:00:00Z",
        "purpose": "3D resin model"
    })
    assert b.status_code == 200, f"Create failed: {b.text}"
    b_id = b.json()["id"]

    # Owner tries invalid pending->active
    inv = mira_client.patch(f"/bookings/{b_id}/status", json={"status": "active"})
    assert inv.status_code == 400, f"Expected 400 for invalid transition: {inv.text}"
    assert "set only by the agreement and check-in flows" in inv.text, f"Missing message: {inv.text}"
    unsigned = mira_client.patch(f"/bookings/{b_id}/status", json={"status": "signed"})
    assert unsigned.status_code == 400, f"Expected signed state to require signatures: {unsigned.text}"


def test_valid_state_transitions_and_otp(mira_client, user_client, monkeypatch, tmp_path):
    """Only both agreement signatures unlock an OTP and check-in."""
    b = user_client.post("/bookings", json={
        "resource_id": "sla-printer",
        "start_date": "2027-05-02T09:00:00Z",
        "end_date": "2027-05-02T17:00:00Z",
        "purpose": "Architecture prototype"
    })
    assert b.status_code == 200, f"Create failed: {b.text}"
    b_id = b.json()["id"]

    # Owner: pending -> approved
    ap = mira_client.patch(f"/bookings/{b_id}/status", json={"status": "approved"})
    assert ap.status_code == 200, f"Approve failed: {ap.text}"
    assert ap.json()["status"] == "approved"

    agreement = user_client.get(f"/agreements/{b_id}")
    assert agreement.status_code == 200
    document_hash = agreement.json()["document_hash"]
    signature = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j0e8AAAAASUVORK5CYII="

    borrower_signature = user_client.post(f"/bookings/{b_id}/sign", json={
        "signature_data": signature,
        "document_hash": document_hash,
    })
    assert borrower_signature.status_code == 200, borrower_signature.text

    owner_signature = mira_client.post(f"/bookings/{b_id}/sign", json={
        "signature_data": signature,
        "document_hash": document_hash,
    })
    assert owner_signature.status_code == 200, owner_signature.text
    assert owner_signature.json()["agreement"]["is_fully_signed"] is True

    # Only the borrower can receive the post-signature digital access pass.
    otp_res = user_client.post(f"/bookings/{b_id}/otp")
    assert otp_res.status_code == 200, f"OTP failed: {otp_res.text}"
    otp = otp_res.json()["otp"]
    assert len(otp) == 6
    owner_otp = mira_client.post(f"/bookings/{b_id}/otp")
    assert owner_otp.status_code == 403

    # Check-in is blocked until the borrower records the six-angle baseline.
    missing_pre = user_client.post(f"/bookings/{b_id}/checkin", json={"otp": otp})
    assert missing_pre.status_code == 409
    assert "pre-use inspection" in missing_pre.json()["detail"]

    async def assess_photo_quality(*_args):
        return PhotoQualityAssessment()

    monkeypatch.setattr(inspections.ai_service, "assess_photo_quality", assess_photo_quality)
    monkeypatch.setattr(inspections, "PHOTO_BUCKET", str(tmp_path / "photos"))
    pre_inspection = user_client.post(
        "/inspections/submit",
        json={"booking_id": b_id, "phase": "pre", "photos": PHOTOS},
    )
    assert pre_inspection.status_code == 200, pre_inspection.text

    # User checks in with OTP only after the baseline is saved.
    ci = user_client.post(f"/bookings/{b_id}/checkin", json={"otp": otp})
    assert ci.status_code == 200, f"Checkin failed: {ci.text}"
    assert ci.json()["status"] == "active"
