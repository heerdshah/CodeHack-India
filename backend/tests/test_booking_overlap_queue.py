"""
test_booking_overlap_queue.py — Overlap detection, waitlist and fair-allocation tests.

All bookings use single-day 09:00–17:00 windows (8h) so weekly total stays under 20h.
"""


def test_fair_allocation_over_56h_rejected(user_client):
    """A booking > 20h in a single week is rejected with 'Fair allocation'."""
    res = user_client.post("/bookings", json={
        "resource_id": "cnc-5axis",
        # 3 days = 72h booking — exceeds 20h weekly limit
        "start_date": "2027-03-10T08:00:00Z",
        "end_date": "2027-03-13T08:00:00Z",
        "purpose": "Long machining run"
    })
    assert res.status_code == 400, f"Expected 400 for over-limit booking: {res.text}"
    assert "allocation" in res.text.lower() or "limit" in res.text.lower(), \
        f"Expected fair-allocation message, got: {res.text}"


def test_overlap_goes_to_waitlist(user_client, tomas_client, mira_client):
    """Second booking on same resource/same dates is waitlisted."""
    # First booking by user_client (Priya) on cnc-5axis (owned by Mira)
    b1 = user_client.post("/bookings", json={
        "resource_id": "cnc-5axis",
        "start_date": "2027-04-01T09:00:00Z",
        "end_date": "2027-04-01T17:00:00Z",
        "purpose": "Machining test part"
    })
    assert b1.status_code == 200, f"b1 create failed: {b1.text}"
    b1_id = b1.json()["id"]
    assert b1.json()["status"] == "pending"

    # Owner Mira approves b1 so slot is locked
    ap_res = mira_client.patch(f"/bookings/{b1_id}/status", json={"status": "approved"})
    assert ap_res.status_code == 200, f"Approve failed: {ap_res.text}"

    # Tomas creates conflicting booking on same day
    b2 = tomas_client.post("/bookings", json={
        "resource_id": "cnc-5axis",
        "start_date": "2027-04-01T10:00:00Z",
        "end_date": "2027-04-01T16:00:00Z",
        "purpose": "Conflicting booking"
    })
    assert b2.status_code == 200, f"b2 create failed: {b2.text}"
    body = b2.json()
    assert body["status"] == "waitlisted", f"Expected waitlisted, got: {body}"
    assert body.get("waitlist_position", 0) >= 1


def test_borrower_cannot_approve_booking(user_client, tomas_client):
    """Security: A borrower attempting to approve a booking must get 403."""
    b = user_client.post("/bookings", json={
        "resource_id": "cnc-5axis",
        "start_date": "2027-04-10T09:00:00Z",
        "end_date": "2027-04-10T17:00:00Z",
        "purpose": "Security test booking"
    })
    assert b.status_code == 200
    b_id = b.json()["id"]

    # Borrower Priya tries to approve own booking -> 403
    res_self = user_client.patch(f"/bookings/{b_id}/status", json={"status": "approved"})
    assert res_self.status_code == 403, f"Expected 403, got: {res_self.status_code} {res_self.text}"

    # Another borrower Tomas tries to approve -> 403
    res_other = tomas_client.patch(f"/bookings/{b_id}/status", json={"status": "approved"})
    assert res_other.status_code == 403, f"Expected 403, got: {res_other.status_code} {res_other.text}"
