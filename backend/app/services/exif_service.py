"""
EXIF extraction, timestamp validation, and SHA-256 fingerprinting utilities.
Ensures image provenance, anti-tampering, and temporal compliance.
"""
import hashlib
from datetime import datetime, timezone, timedelta
from typing import Optional, Dict, Any
from PIL import Image
from PIL.ExifTags import TAGS
from io import BytesIO


def extract_exif(image_bytes: bytes) -> Dict[str, Any]:
    """Extracts EXIF timestamp and GPS coordinates from image bytes."""
    result = {"timestamp": None, "lat": None, "lng": None}
    try:
        img = Image.open(BytesIO(image_bytes))
        exif_data = img._getexif()
        if not exif_data:
            return result
        for tag_id, value in exif_data.items():
            tag = TAGS.get(tag_id, tag_id)
            if tag == "DateTimeOriginal":
                try:
                    result["timestamp"] = datetime.strptime(str(value), "%Y:%m:%d %H:%M:%S").replace(tzinfo=timezone.utc)
                except Exception:
                    pass
            if tag == "GPSInfo":
                try:
                    lat = value.get(2)
                    lat_ref = value.get(1)
                    lng = value.get(4)
                    lng_ref = value.get(3)
                    if lat and lng:
                        def dms_to_dd(d):
                            return float(d[0]) + float(d[1])/60.0 + float(d[2])/3600.0
                        result["lat"] = dms_to_dd(lat) * (-1 if lat_ref == "S" else 1)
                        result["lng"] = dms_to_dd(lng) * (-1 if lng_ref == "W" else 1)
                except Exception:
                    pass
    except Exception:
        pass
    return result


def compute_fingerprint(image_bytes: bytes) -> str:
    """SHA-256 fingerprint of raw image bytes for tamper detection."""
    return hashlib.sha256(image_bytes).hexdigest()


def validate_exif_timestamp(exif_ts: Optional[datetime], expected_time: datetime, tolerance_minutes: int = 30) -> bool:
    """Returns True if EXIF timestamp is within +/- tolerance_minutes of expected_time."""
    if not exif_ts:
        return True  # Mobile cameras / browsers often strip EXIF metadata
    delta = abs((exif_ts - expected_time).total_seconds())
    return delta <= tolerance_minutes * 60


def process_uploaded_photo(image_bytes: bytes, angle: str, booking_expected_time: Optional[datetime] = None) -> dict:
    """
    Returns metadata dict (exif_timestamp, gps, fingerprint) to store alongside photo records.
    Optionally validates timestamp if expected time is provided.
    """
    exif = extract_exif(image_bytes)
    fingerprint = compute_fingerprint(image_bytes)

    if booking_expected_time and exif["timestamp"]:
        if not validate_exif_timestamp(exif["timestamp"], booking_expected_time):
            raise ValueError(
                f"Photo timestamp mismatch for angle {angle}. "
                f"Photo taken at {exif['timestamp'].isoformat()}, "
                f"expected within 30 min of {booking_expected_time.isoformat()}"
            )

    return {
        "exif_timestamp": exif["timestamp"].isoformat() if exif["timestamp"] else None,
        "exif_gps_lat": exif["lat"],
        "exif_gps_lng": exif["lng"],
        "fingerprint": fingerprint,
    }
