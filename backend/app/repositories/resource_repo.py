import math
from typing import Optional, Dict, Any, List
from app.repositories.base import BaseRepository

def haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    R = 6371.0 # Earth radius in km
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = (math.sin(dlat / 2) ** 2 +
         math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) *
         math.sin(dlon / 2) ** 2)
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return round(R * c, 2)

class ResourceRepository(BaseRepository):
    def __init__(self):
        super().__init__("resources")
        self._memory_resources: Dict[str, Dict[str, Any]] = {
            "cnc-5axis": {
                "id": "cnc-5axis",
                "name": "5-Axis CNC Mill",
                "department": "Mechanical Engineering",
                "category": "Robotics & Fabrication",
                "owner_id": "22222222-2222-2222-2222-222222222222",
                "owner_name": "Dr. Mira Okafor",
                "location": "Fabrication Hall B, Bay 3",
                "building": "Engineering Complex North",
                "floor": "Ground Floor",
                "latitude": 37.7749,
                "longitude": -122.4194,
                "image": "/images/res-robotics.jpg",
                "description": "Haas UMC-750 with tool probing for aluminium, brass, and engineering plastics.",
                "condition": "Serviced Oct 2026",
                "criteria": ["Lab Safety Level 2 Certification", "CNC Operator Clearance"],
                "rules": ["Eye and hearing protection mandatory", "Maximum spindle run 4 continuous hours"],
                "approval_mode": "manual",
                "opening_hours": {"mon": {"open": "08:00", "close": "20:00"}, "tue": {"open": "08:00", "close": "20:00"}},
                "max_active_bookings_per_user": 2,
                "max_hours_per_week_per_user": 20,
                "cooldown_hours_after_booking": 4,
                "is_active": True
            },
            "ur10-cobot": {
                "id": "ur10-cobot",
                "name": "UR10e Collaborative Arm",
                "department": "Computer Science",
                "category": "Robotics & Fabrication",
                "owner_id": "33333333-3333-3333-3333-333333333333",
                "owner_name": "Prof. Anders Halden",
                "location": "Robotics Wing, Cell 2",
                "building": "Turing Science Center",
                "floor": "2nd Floor",
                "latitude": 37.7758,
                "longitude": -122.4180,
                "image": "/images/res-robotics.jpg",
                "description": "12.5 kg payload cobot with force-torque sensing and ROS 2 integration.",
                "condition": "Excellent",
                "criteria": ["Cobot Safety Certification"],
                "rules": ["E-stop tested prior to script execution"],
                "approval_mode": "manual",
                "opening_hours": {"mon": {"open": "08:00", "close": "20:00"}},
                "max_active_bookings_per_user": 2,
                "max_hours_per_week_per_user": 20,
                "cooldown_hours_after_booking": 4,
                "is_active": True
            },
            "sla-printer": {
                "id": "sla-printer",
                "name": "Industrial SLA Printer",
                "department": "Architecture & Design",
                "category": "Robotics & Fabrication",
                "owner_id": "22222222-2222-2222-2222-222222222222",
                "owner_name": "Dr. Mira Okafor",
                "location": "Makerspace Level 1",
                "building": "Design Hub",
                "floor": "1st Floor",
                "latitude": 37.7735,
                "longitude": -122.4210,
                "image": "/images/res-robotics.jpg",
                "description": "Large-format resin printing for architectural models and precision prototypes.",
                "condition": "Good — new resin vat",
                "criteria": ["Lab Safety Level 2 Certification", "3D Fabrication Clearance"],
                "rules": ["Nitrile gloves required when handling resin"],
                "approval_mode": "auto",
                "opening_hours": {"mon": {"open": "08:00", "close": "20:00"}},
                "max_active_bookings_per_user": 2,
                "max_hours_per_week_per_user": 20,
                "cooldown_hours_after_booking": 4,
                "is_active": True
            },
            "hplc": {
                "id": "hplc",
                "name": "HPLC System",
                "department": "Chemistry",
                "category": "Analytical Equipment",
                "owner_id": "22222222-2222-2222-2222-222222222222",
                "owner_name": "Dr. Mira Okafor",
                "location": "Chem Block, Lab 214",
                "building": "Franklin Chemical Labs",
                "floor": "2nd Floor",
                "latitude": 37.7765,
                "longitude": -122.4230,
                "image": "/images/res-analytical.jpg",
                "description": "Agilent 1260 Infinity II with diode-array detection and autosampler.",
                "condition": "Calibrated Sep 2026",
                "criteria": ["Chemical Hygiene Training"],
                "rules": ["Filter all mobile phases through 0.22 um"],
                "approval_mode": "manual",
                "opening_hours": {"mon": {"open": "08:00", "close": "20:00"}},
                "max_active_bookings_per_user": 2,
                "max_hours_per_week_per_user": 20,
                "cooldown_hours_after_booking": 4,
                "is_active": True
            },
            "confocal": {
                "id": "confocal",
                "name": "Confocal Microscope",
                "department": "Biosciences",
                "category": "Analytical Equipment",
                "owner_id": "33333333-3333-3333-3333-333333333333",
                "owner_name": "Prof. Anders Halden",
                "location": "Bio Imaging Core",
                "building": "Biomedical Research Center",
                "floor": "3rd Floor",
                "latitude": 37.7770,
                "longitude": -122.4160,
                "image": "/images/res-analytical.jpg",
                "description": "Four-laser confocal with live-cell incubation chamber and spectral detection.",
                "condition": "Excellent",
                "criteria": ["Biosafety Level 2 Training", "Lab Safety Level 2 Certification"],
                "rules": ["Laser warmup required 15 min"],
                "approval_mode": "manual",
                "opening_hours": {"mon": {"open": "08:00", "close": "20:00"}},
                "max_active_bookings_per_user": 2,
                "max_hours_per_week_per_user": 20,
                "cooldown_hours_after_booking": 4,
                "is_active": True
            },
            "sound-stage": {
                "id": "sound-stage",
                "name": "Sound Stage & Grid",
                "department": "Media & Film",
                "category": "Studios & Spaces",
                "owner_id": "33333333-3333-3333-3333-333333333333",
                "owner_name": "Prof. Anders Halden",
                "location": "Media House, Stage A",
                "building": "Creative Arts Pavilion",
                "floor": "Ground Floor",
                "latitude": 37.7720,
                "longitude": -122.4175,
                "image": "/images/res-studio.jpg",
                "description": "Acoustically treated 200 m² stage with lighting grid, cyclorama, and control room.",
                "condition": "Good",
                "criteria": ["Studio Induction"],
                "rules": ["Maximum 25 people in studio", "No liquids near lighting dimmer packs"],
                "approval_mode": "manual",
                "opening_hours": {"mon": {"open": "08:00", "close": "20:00"}},
                "max_active_bookings_per_user": 2,
                "max_hours_per_week_per_user": 20,
                "cooldown_hours_after_booking": 4,
                "is_active": True
            }
        }

    async def get_by_id(self, resource_id: str) -> Optional[Dict[str, Any]]:
        if self.is_live():
            res = self.get_client().table(self.table_name).select("*, users:owner_id(full_name)").eq("id", resource_id).execute()
            if res.data:
                data = res.data[0]
                if "users" in data and data["users"]:
                    data["owner_name"] = data["users"].get("full_name", "")
                return data
        return self._memory_resources.get(resource_id)

    async def list_all(
        self,
        q: Optional[str] = None,
        category: Optional[str] = None,
        department: Optional[str] = None,
        owner_id: Optional[str] = None,
        lat: Optional[float] = None,
        lng: Optional[float] = None,
        radius_km: Optional[float] = None
    ) -> List[Dict[str, Any]]:
        items = []
        if self.is_live():
            query = self.get_client().table(self.table_name).select("*, users:owner_id(full_name)")
            if category:
                query = query.eq("category", category)
            if department:
                query = query.eq("department", department)
            if owner_id:
                query = query.eq("owner_id", owner_id)
            res = query.execute()
            raw_items = res.data or []
            for r in raw_items:
                if "users" in r and r["users"]:
                    r["owner_name"] = r["users"].get("full_name", "")
                items.append(r)
        else:
            items = list(self._memory_resources.values())

        # In-memory filter / search
        filtered = []
        for r in items:
            if owner_id and r.get("owner_id") != owner_id:
                continue
            if category and r.get("category") != category:
                continue
            if department and r.get("department") != department:
                continue
            if q:
                search_str = f"{r.get('name', '')} {r.get('department', '')} {r.get('location', '')} {r.get('description', '')}".lower()
                if q.lower() not in search_str:
                    continue

            # Compute distance if lat, lng are provided
            if lat is not None and lng is not None and "latitude" in r and "longitude" in r:
                dist = haversine_km(lat, lng, float(r["latitude"]), float(r["longitude"]))
                r["distance_km"] = dist
                if radius_km is not None and dist > radius_km:
                    continue
            else:
                r["distance_km"] = None

            filtered.append(r)

        # Sort by distance if location provided
        if lat is not None and lng is not None:
            filtered.sort(key=lambda x: (x.get("distance_km") is None, x.get("distance_km") or 999999))

        return filtered

    async def create(self, resource_data: Dict[str, Any]) -> Dict[str, Any]:
        if self.is_live():
            res = self.get_client().table(self.table_name).insert(resource_data).execute()
            if res.data:
                return res.data[0]
        self._memory_resources[resource_data["id"]] = resource_data
        return resource_data

    async def update(self, resource_id: str, updates: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        if self.is_live():
            res = self.get_client().table(self.table_name).update(updates).eq("id", resource_id).execute()
            if res.data:
                return res.data[0]
        r = self._memory_resources.get(resource_id)
        if r:
            r.update(updates)
            return r
        return None

resource_repo = ResourceRepository()

