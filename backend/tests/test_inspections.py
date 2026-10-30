import base64
import uuid

from app.ai.schemas import AngleDamageComparison, PhotoQualityAssessment
from app.repositories.booking_repo import booking_repo
from app.repositories.notification_repo import notification_repo
from app.routers import inspections


BORROWER_ID = "44444444-4444-4444-4444-444444444444"
OWNER_ID = "33333333-3333-3333-3333-333333333333"
PNG_DATA_URL = (
    "data:image/png;base64,"
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/"
    "l2cAAAAASUVORK5CYII="
)
PHOTOS = {
    angle: PNG_DATA_URL
    for angle in ("Front", "Back", "Left", "Right", "Top", "Bottom")
}


def _create_booking(status="signed"):
    booking_id = f"inspection-test-{uuid.uuid4().hex}"
    booking_repo._memory_bookings[booking_id] = {
        "id": booking_id,
        "resource_id": "sound-stage",
        "user_id": BORROWER_ID,
        "status": status,
        "start_date": "2026-10-24T09:00:00Z",
        "end_date": "2026-10-26T18:00:00Z",
        "purpose": "Inspection test booking",
    }
    return booking_id


def _mock_ai(monkeypatch, changed=False):
    async def assess(*_args):
        return PhotoQualityAssessment()

    async def compare(angle, *_args):
        return AngleDamageComparison(
            angle=angle,
            changed=changed,
            description="Possible new mark" if changed else "No visible damage",
            severity="medium" if changed else "none",
            confidence=0.9 if changed else 0.1,
        )

    monkeypatch.setattr(inspections.ai_service, "assess_photo_quality", assess)
    monkeypatch.setattr(inspections.ai_service, "compare_angle_damage", compare)


def test_six_angle_photos_are_persisted_and_only_booking_parties_can_view(
    user_client, owner_client, tomas_client, monkeypatch, tmp_path
):
    booking_id = _create_booking()
    _mock_ai(monkeypatch)
    monkeypatch.setattr(inspections, "PHOTO_BUCKET", str(tmp_path / "photos"))

    response = user_client.post(
        "/inspections/submit",
        json={"booking_id": booking_id, "phase": "pre", "photos": PHOTOS},
    )
    assert response.status_code == 200, response.text

    owner_response = owner_client.get(
        f"/inspections/{booking_id}/pre/photos/Front"
    )
    assert owner_response.status_code == 200
    assert owner_response.content == base64.b64decode(PNG_DATA_URL.split(",", 1)[1])

    denied = tomas_client.get(f"/inspections/{booking_id}/pre/photos/Front")
    assert denied.status_code == 403


def test_return_review_notifies_borrower_and_rejects_non_owner(
    user_client, owner_client, mira_client, monkeypatch, tmp_path
):
    booking_id = _create_booking()
    _mock_ai(monkeypatch, changed=True)
    monkeypatch.setattr(inspections, "PHOTO_BUCKET", str(tmp_path / "photos"))

    pre_response = user_client.post(
        "/inspections/submit",
        json={"booking_id": booking_id, "phase": "pre", "photos": PHOTOS},
    )
    assert pre_response.status_code == 200, pre_response.text

    booking_repo._memory_bookings[booking_id]["status"] = "active"
    post_response = user_client.post(
        "/inspections/submit",
        json={"booking_id": booking_id, "phase": "post", "photos": PHOTOS},
    )
    assert post_response.status_code == 200, post_response.text
    assert post_response.json()["flagged"] is True

    denied = mira_client.post(
        f"/inspections/{booking_id}/review",
        json={"decision": "damage"},
    )
    assert denied.status_code == 403

    reviewed = owner_client.post(
        f"/inspections/{booking_id}/review",
        json={"decision": "damage", "notes": "Visible dent on the left side."},
    )
    assert reviewed.status_code == 200
    assert reviewed.json()["decision"] == "damage"
    assert booking_repo._memory_bookings[booking_id]["status"] == "returned"

    borrower_notifications = [
        item
        for item in notification_repo._memory_notifs.values()
        if item.get("user_id") == BORROWER_ID
        and item.get("type") == "damage_reported"
        and item.get("data", {}).get("booking_id") == booking_id
    ]
    assert len(borrower_notifications) == 1


def test_inspection_requires_all_six_images(user_client):
    booking_id = _create_booking()
    response = user_client.post(
        "/inspections/submit",
        json={
            "booking_id": booking_id,
            "phase": "pre",
            "photos": {"Front": PNG_DATA_URL},
        },
    )
    assert response.status_code == 400


def test_owner_can_close_return_inspection_without_damage(
    user_client, owner_client, monkeypatch, tmp_path
):
    booking_id = _create_booking()
    _mock_ai(monkeypatch)
    monkeypatch.setattr(inspections, "PHOTO_BUCKET", str(tmp_path / "photos"))

    before = user_client.post(
        "/inspections/submit",
        json={"booking_id": booking_id, "phase": "pre", "photos": PHOTOS},
    )
    assert before.status_code == 200, before.text
    booking_repo._memory_bookings[booking_id]["status"] = "active"
    after = user_client.post(
        "/inspections/submit",
        json={"booking_id": booking_id, "phase": "post", "photos": PHOTOS},
    )
    assert after.status_code == 200, after.text

    reviewed = owner_client.post(
        f"/inspections/{booking_id}/review",
        json={"decision": "no_damage"},
    )
    assert reviewed.status_code == 200
    assert reviewed.json()["decision"] == "no_damage"
    assert booking_repo._memory_bookings[booking_id]["status"] == "returned"
