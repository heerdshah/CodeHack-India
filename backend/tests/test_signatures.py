"""
test_signatures.py — Agreement signing: role enforcement and hash integrity.
Signer role is derived from logged-in session; mismatched role requests return 403.
"""


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
        "signature_data": "data:image/png;base64,fakesig",
        "document_hash": doc_hash
    })
    assert bad1.status_code == 403, f"Expected 403 for owner-sign-as-user: {bad1.text}"

    # Borrower tries to sign as 'owner' — must be 403
    bad2 = user_client.post(f"/bookings/{b_id}/sign", json={
        "signer_role": "owner",
        "signature_data": "data:image/png;base64,fakesig",
        "document_hash": doc_hash
    })
    assert bad2.status_code == 403, f"Expected 403 for user-sign-as-owner: {bad2.text}"

    # Third party borrower (Tomas) tries to sign -> 403
    bad3 = tomas_client.post(f"/bookings/{b_id}/sign", json={
        "signature_data": "data:image/png;base64,fakesig",
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
        "signature_data": "data:image/png;base64,fakesig",
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

    # Borrower signs (signer_role derived automatically as 'user')
    s1 = user_client.post(f"/bookings/{b_id}/sign", json={
        "signature_data": "data:image/png;base64,borrowersig",
        "document_hash": doc_hash
    })
    assert s1.status_code == 200, f"Borrower sign failed: {s1.text}"

    # Owner signs (signer_role derived automatically as 'owner')
    s2 = owner_client.post(f"/bookings/{b_id}/sign", json={
        "signature_data": "data:image/png;base64,ownersig",
        "document_hash": doc_hash
    })
    assert s2.status_code == 200, f"Owner sign failed: {s2.text}"
    assert s2.json()["agreement"]["is_fully_signed"] is True

    # Booking status should now be 'signed'
    bks = user_client.get("/bookings")
    assert bks.status_code == 200
    my_b = next((x for x in bks.json() if x["id"] == b_id), None)
    assert my_b is not None
    assert my_b["status"] == "signed"
