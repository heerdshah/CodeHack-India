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


def test_owner_can_view_uploaded_booking_proof_and_approve(
    user_client, mira_client, tomas_client, monkeypatch, tmp_path
):
    """Uploaded PDFs are available to the resource owner before approval."""
    monkeypatch.chdir(tmp_path)

    upload = user_client.post(
        "/bookings/proofs",
        files={"file": ("safety-proof.pdf", b"%PDF-1.4 safety proof", "application/pdf")},
    )
    assert upload.status_code == 201, upload.text
    proof_path = upload.json()["path"]

    booking = user_client.post("/bookings", json={
        "resource_id": "cnc-5axis",
        "start_date": "2027-04-15T09:00:00Z",
        "end_date": "2027-04-15T17:00:00Z",
        "purpose": "Safety review test",
        "proof_files": [proof_path],
    })
    assert booking.status_code == 200, booking.text
    booking_id = booking.json()["id"]

    owner_bookings = mira_client.get("/bookings")
    assert owner_bookings.status_code == 200, owner_bookings.text
    owner_view = next(item for item in owner_bookings.json() if item["id"] == booking_id)
    assert owner_view["isMine"] is False
    assert owner_view["proofFiles"] == [proof_path]

    proof = mira_client.get(f"/bookings/{booking_id}/proofs/0")
    assert proof.status_code == 200, proof.text
    assert proof.headers["content-type"] == "application/pdf"
    assert proof.headers["content-disposition"].startswith("inline;")
    assert proof.content == b"%PDF-1.4 safety proof"

    unauthorized = tomas_client.get(f"/bookings/{booking_id}/proofs/0")
    assert unauthorized.status_code == 403

    approved = mira_client.patch(
        f"/bookings/{booking_id}/status",
        json={"status": "approved"},
    )
    assert approved.status_code == 200, approved.text


def test_booking_submission_notifies_applicant_and_owner(user_client, mira_client):
    booking = user_client.post("/bookings", json={
        "resource_id": "cnc-5axis",
        "start_date": "2027-04-22T09:00:00Z",
        "end_date": "2027-04-22T17:00:00Z",
        "purpose": "Notification navigation test",
    })
    assert booking.status_code == 200, booking.text
    booking_id = booking.json()["id"]

    applicant_notifications = user_client.get("/notifications")
    assert applicant_notifications.status_code == 200, applicant_notifications.text
    submitted = next(
        notification
        for notification in applicant_notifications.json()
        if notification.get("data", {}).get("booking_id") == booking_id
    )
    assert submitted["type"] == "booking_submitted"
    assert submitted["title"] == "Booking Request Submitted"

    owner_notifications = mira_client.get("/notifications")
    assert owner_notifications.status_code == 200, owner_notifications.text
    request_notification = next(
        notification
        for notification in owner_notifications.json()
        if notification.get("data", {}).get("booking_id") == booking_id
    )
    assert request_notification["type"] == "booking_request"

    approved = mira_client.patch(
        f"/bookings/{booking_id}/status",
        json={"status": "approved"},
    )
    assert approved.status_code == 200, approved.text

    applicant_notifications = user_client.get("/notifications")
    approved_notification = next(
        notification
        for notification in applicant_notifications.json()
        if notification.get("data", {}).get("booking_id") == booking_id
        and notification["type"] == "booking_approved"
    )
    assert approved_notification["title"] == "Booking Approved!"


def test_supabase_proof_is_returned_as_inline_pdf(
    user_client, mira_client, monkeypatch
):
    """The API streams stored PDF bytes instead of redirecting to storage."""
    from app.routers import bookings as bookings_router

    booking = user_client.post("/bookings", json={
        "resource_id": "cnc-5axis",
        "start_date": "2027-04-20T09:00:00Z",
        "end_date": "2027-04-20T17:00:00Z",
        "purpose": "Storage stream test",
        "proof_files": [
            "supabase:44444444-4444-4444-4444-444444444444/proof.pdf"
        ],
    })
    assert booking.status_code == 200, booking.text

    class StorageBucket:
        def download(self, path):
            assert path == "44444444-4444-4444-4444-444444444444/proof.pdf"
            return b"%PDF-1.7 stored proof"

    class Storage:
        def from_(self, bucket):
            assert bucket == "booking-proofs"
            return StorageBucket()

    class Supabase:
        storage = Storage()

    monkeypatch.setattr(bookings_router, "get_supabase_admin", lambda: Supabase())
    proof = mira_client.get(f"/bookings/{booking.json()['id']}/proofs/0")

    assert proof.status_code == 200, proof.text
    assert proof.headers["content-type"] == "application/pdf"
    assert proof.headers["content-disposition"].startswith("inline;")
    assert proof.content == b"%PDF-1.7 stored proof"


def test_legacy_filename_only_proof_returns_actionable_error(
    user_client, mira_client, tomas_client
):
    booking = user_client.post("/bookings", json={
        "resource_id": "cnc-5axis",
        "start_date": "2027-04-21T09:00:00Z",
        "end_date": "2027-04-21T17:00:00Z",
        "purpose": "Legacy proof test",
    })
    assert booking.status_code == 200, booking.text
    booking_id = booking.json()["id"]

    from app.repositories.booking_repo import booking_repo
    stored = booking_repo._memory_bookings[booking_id]
    stored["proof_files"] = ["safety-certificate.pdf"]

    response = mira_client.get(f"/bookings/{booking_id}/proofs/0")
    assert response.status_code == 410
    assert "attach the PDF" in response.json()["detail"]

    attached = user_client.post(
        f"/bookings/{booking_id}/proofs",
        files={"file": ("replacement.pdf", b"%PDF-1.4 replacement", "application/pdf")},
    )
    assert attached.status_code == 201, attached.text

    proof = mira_client.get(f"/bookings/{booking_id}/proofs/0")
    assert proof.status_code == 200, proof.text
    assert proof.content == b"%PDF-1.4 replacement"

    unauthorized = tomas_client.post(
        f"/bookings/{booking_id}/proofs",
        files={"file": ("unauthorized.pdf", b"%PDF-1.4 unauthorized", "application/pdf")},
    )
    assert unauthorized.status_code == 403
