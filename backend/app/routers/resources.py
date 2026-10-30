from fastapi import APIRouter, Depends, HTTPException, status, Query
from typing import List, Optional, Dict, Any
from datetime import datetime, timezone

from app.schemas.resource import ResourceCreateRequest, ResourceUpdateRequest, ResourceResponse
from app.repositories.resource_repo import resource_repo
from app.repositories.booking_repo import booking_repo
from app.core.deps import require_owner, get_current_user

router = APIRouter(prefix="/resources", tags=["Resources"])

@router.get("", response_model=List[ResourceResponse])
async def list_resources(
    lat: Optional[float] = Query(None),
    lng: Optional[float] = Query(None),
    q: Optional[str] = Query(None),
    category: Optional[str] = Query(None),
    department: Optional[str] = Query(None),
    radius_km: Optional[float] = Query(None)
):
    items = await resource_repo.list_all(
        q=q,
        category=category,
        department=department,
        lat=lat,
        lng=lng,
        radius_km=radius_km
    )

    responses = []
    for r in items:
        # Calculate dynamic bookedUntil and queue size
        bookings = await booking_repo.list_by_resource(r["id"])
        active_bookings = [b for b in bookings if b.get("status") in ["approved", "signed", "active"]]
        active_bookings.sort(key=lambda x: x.get("end_date", ""), reverse=True)
        booked_until = active_bookings[0]["end_date"][:10] if active_bookings else None
        
        waitlist = await booking_repo.get_waitlist_by_resource(r["id"])

        responses.append(ResourceResponse(
            id=r["id"],
            name=r["name"],
            department=r["department"],
            category=r["category"],
            owner_id=r["owner_id"],
            owner_name=r.get("owner_name", "Lab Owner"),
            location=r["location"],
            building=r.get("building"),
            floor=r.get("floor"),
            latitude=r["latitude"],
            longitude=r["longitude"],
            image=r["image"],
            description=r["description"],
            condition=r["condition"],
            criteria=r.get("criteria", []),
            rules=r.get("rules", []),
            approval_mode=r.get("approval_mode", "manual"),
            opening_hours=r.get("opening_hours"),
            bookedUntil=booked_until,
            queue=len(waitlist),
            distance_km=r.get("distance_km"),
            is_active=r.get("is_active", True)
        ))
    return responses

@router.get("/{resource_id}", response_model=ResourceResponse)
async def get_resource(resource_id: str):
    r = await resource_repo.get_by_id(resource_id)
    if not r:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Resource not found")
    
    bookings = await booking_repo.list_by_resource(resource_id)
    active_bookings = [b for b in bookings if b.get("status") in ["approved", "signed", "active"]]
    active_bookings.sort(key=lambda x: x.get("end_date", ""), reverse=True)
    booked_until = active_bookings[0]["end_date"][:10] if active_bookings else None
    waitlist = await booking_repo.get_waitlist_by_resource(resource_id)

    return ResourceResponse(
        id=r["id"],
        name=r["name"],
        department=r["department"],
        category=r["category"],
        owner_id=r["owner_id"],
        owner_name=r.get("owner_name", "Lab Owner"),
        location=r["location"],
        building=r.get("building"),
        floor=r.get("floor"),
        latitude=r["latitude"],
        longitude=r["longitude"],
        image=r["image"],
        description=r["description"],
        condition=r["condition"],
        criteria=r.get("criteria", []),
        rules=r.get("rules", []),
        approval_mode=r.get("approval_mode", "manual"),
        opening_hours=r.get("opening_hours"),
        bookedUntil=booked_until,
        queue=len(waitlist),
        is_active=r.get("is_active", True)
    )

@router.post("", response_model=ResourceResponse)
async def create_resource(req: ResourceCreateRequest, current_user: dict = Depends(require_owner)):
    existing = await resource_repo.get_by_id(req.id)
    if existing:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Resource ID already exists")

    data = req.model_dump()
    data["owner_id"] = current_user["id"]
    data["owner_name"] = current_user["full_name"]
    created = await resource_repo.create(data)

    return ResourceResponse(**created)

@router.patch("/{resource_id}", response_model=ResourceResponse)
async def update_resource(resource_id: str, req: ResourceUpdateRequest, current_user: dict = Depends(require_owner)):
    r = await resource_repo.get_by_id(resource_id)
    if not r:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Resource not found")

    if r["owner_id"] != current_user["id"] and current_user.get("system_role") != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You do not have permission to modify this resource.")

    updates = {k: v for k, v in req.model_dump(exclude_unset=True).items() if v is not None}
    updated = await resource_repo.update(resource_id, updates)
    return ResourceResponse(**updated)

