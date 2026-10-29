"""
test_state_machine.py — Booking state-machine transition tests.

Valid: pending->approved, approved->signed (via status patch for test), signed->active (via OTP)
Invalid: pending->active must be rejected with 400.
"""


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
    assert "Invalid booking transition" in inv.text, f"Missing message: {inv.text}"


def test_valid_state_transitions_and_otp(mira_client, user_client):
    """pending->approved->signed (manual patch)->OTP->active."""
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

    # Owner: approved -> signed (direct status patch in test)
    sg = mira_client.patch(f"/bookings/{b_id}/status", json={"status": "signed"})
    assert sg.status_code == 200, f"Signed failed: {sg.text}"
    assert sg.json()["status"] == "signed"

    # Owner generates OTP
    otp_res = mira_client.post(f"/bookings/{b_id}/otp")
    assert otp_res.status_code == 200, f"OTP failed: {otp_res.text}"
    otp = otp_res.json()["otp"]
    assert len(otp) == 6

    # User checks in with OTP
    ci = user_client.post(f"/bookings/{b_id}/checkin", json={"otp": otp})
    assert ci.status_code == 200, f"Checkin failed: {ci.text}"
    assert ci.json()["status"] == "active"
