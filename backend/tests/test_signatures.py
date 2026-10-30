"""
test_signatures.py — Agreement signing: role enforcement and hash integrity.
Signer role is derived from logged-in session; mismatched role requests return 403.
"""

import asyncio

from app.repositories.agreement_repo import agreement_repo


PNG_SIGNATURE = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j0e8AAAAASUVORK5CYII="


def test_live_agreement_update_returns_persisted_signature(monkeypatch):
    class FakeQuery:
        def update(self, values):
            self.values = values
            return self

        def eq(self, field, value):
            assert (field, value) == ("id", "agreement-1")
            return self

        def select(self, fields):
            assert fields == "*"
            return self

        def execute(self):
            return type("Response", (), {
                "data": [{"id": "agreement-1", **self.values}]
            })()

    class FakeClient:
        def table(self, table_name):
            assert table_name == "agreements"
            return FakeQuery()

    monkeypatch.setattr(agreement_repo, "is_live", lambda: True)
    monkeypatch.setattr(agreement_repo, "get_client", lambda: FakeClient())

    updated = asyncio.run(agreement_repo.update(
        "agreement-1",
        {"user_signed_at": "2026-10-30T10:00:00Z"},
    ))

    assert updated is not None
    assert updated["user_signed_at"] == "2026-10-30T10:00:00Z"


def test_wrong_party_cannot_sign(owner_client, user_client, tomas_client):
    """Owner cannot sign as borrower; borrower cannot sign as owner; third party cannot sign."""
    # User Priya books confocal (owned by Anders Halden)
    b = user_client.post("/bookings", json={
        "resource_id": "confocal",
        "start_date": "2027-06-10T09:00:00Z",
        "end_date": "2027-06-10T17:00:00Z",
        "purpose": "Fluorescence imaging"
    })
    assert b.status_code == 200, f"Create failed: {b.text}"
    b_id = b.json()["id"]

    # Owner Anders approves -> agreement generated
    owner_client.patch(f"/bookings/{b_id}/status", json={"status": "approved"})

    # Fetch agreement hash
    agr = user_client.get(f"/agreements/{b_id}")
    assert agr.status_code == 200, f"Agreement fetch failed: {agr.text}"
    doc_hash = agr.json()["document_hash"]
    assert doc_hash

    # Owner tries to sign as 'user' (borrower) — must be 403
    bad1 = owner_client.post(f"/bookings/{b_id}/sign", json={
        "signer_role": "user",
        "signature_data": PNG_SIGNATURE,
        "document_hash": doc_hash
    })
    assert bad1.status_code == 403, f"Expected 403 for owner-sign-as-user: {bad1.text}"

    # Borrower tries to sign as 'owner' — must be 403
    bad2 = user_client.post(f"/bookings/{b_id}/sign", json={
        "signer_role": "owner",
        "signature_data": PNG_SIGNATURE,
        "document_hash": doc_hash
    })
    assert bad2.status_code == 403, f"Expected 403 for user-sign-as-owner: {bad2.text}"

    # Third party borrower (Tomas) tries to sign -> 403
    bad3 = tomas_client.post(f"/bookings/{b_id}/sign", json={
        "signature_data": PNG_SIGNATURE,
        "document_hash": doc_hash
    })
    assert bad3.status_code == 403, f"Expected 403 for unrelated borrower: {bad3.text}"


def test_hash_mismatch_rejected(owner_client, user_client):
    """Tampered hash must return 400 with 'hash mismatch'."""
    b = user_client.post("/bookings", json={
        "resource_id": "confocal",
        "start_date": "2027-06-11T09:00:00Z",
        "end_date": "2027-06-11T17:00:00Z",
        "purpose": "Hash test imaging"
    })
    assert b.status_code == 200, f"Create failed: {b.text}"
    b_id = b.json()["id"]

    owner_client.patch(f"/bookings/{b_id}/status", json={"status": "approved"})

    # Sign with tampered hash
    bad = user_client.post(f"/bookings/{b_id}/sign", json={
        "signature_data": PNG_SIGNATURE,
        "document_hash": "tampered_hash_abc123"
    })
    assert bad.status_code == 400, f"Expected 400 for tampered hash: {bad.text}"
    assert "hash mismatch" in bad.text.lower(), f"Expected 'hash mismatch': {bad.text}"


def test_both_parties_sign_fully_signed(owner_client, user_client):
    """Both valid signatures set is_fully_signed=True and status becomes 'signed'."""
    b = user_client.post("/bookings", json={
        "resource_id": "confocal",
        "start_date": "2027-06-12T09:00:00Z",
        "end_date": "2027-06-12T17:00:00Z",
        "purpose": "Full signature flow test"
    })
    assert b.status_code == 200, f"Create failed: {b.text}"
    b_id = b.json()["id"]

    owner_client.patch(f"/bookings/{b_id}/status", json={"status": "approved"})

    agr = user_client.get(f"/agreements/{b_id}")
    assert agr.status_code == 200
    doc_hash = agr.json()["document_hash"]

    # Neither party can obtain an access pass before both signatures.
    unsigned_pass = user_client.post(f"/bookings/{b_id}/otp")
    assert unsigned_pass.status_code == 400
    owner_pass = owner_client.post(f"/bookings/{b_id}/otp")
    assert owner_pass.status_code == 403

    # Borrower signs (signer_role derived automatically as 'user')
    s1 = user_client.post(f"/bookings/{b_id}/sign", json={
        "signature_data": PNG_SIGNATURE,
        "document_hash": doc_hash
    })
    assert s1.status_code == 200, f"Borrower sign failed: {s1.text}"

    owner_agreement = owner_client.get(f"/agreements/{b_id}")
    assert owner_agreement.status_code == 200, owner_agreement.text
    assert owner_agreement.json()["user_signature"] == PNG_SIGNATURE
    owner_notifications = owner_client.get("/notifications")
    assert owner_notifications.status_code == 200, owner_notifications.text
    assert any(
        notification["type"] == "booking_signature"
        and notification.get("data", {}).get("booking_id") == b_id
        for notification in owner_notifications.json()
    )

    # Owner signs (signer_role derived automatically as 'owner')
    s2 = owner_client.post(f"/bookings/{b_id}/sign", json={
        "signature_data": PNG_SIGNATURE,
        "document_hash": doc_hash
    })
    assert s2.status_code == 200, f"Owner sign failed: {s2.text}"
    assert s2.json()["agreement"]["is_fully_signed"] is True
    borrower_agreement = user_client.get(f"/agreements/{b_id}")
    assert borrower_agreement.status_code == 200, borrower_agreement.text
    assert borrower_agreement.json()["owner_signature"] == PNG_SIGNATURE
    borrower_notifications = user_client.get("/notifications")
    assert borrower_notifications.status_code == 200, borrower_notifications.text
    assert any(
        notification["type"] == "booking_signature"
        and notification.get("data", {}).get("booking_id") == b_id
        for notification in borrower_notifications.json()
    )

    # Booking status should now be 'signed'
    bks = user_client.get("/bookings")
    assert bks.status_code == 200
    my_b = next((x for x in bks.json() if x["id"] == b_id), None)
    assert my_b is not None
    assert my_b["status"] == "signed"
    assert my_b["otp"]
