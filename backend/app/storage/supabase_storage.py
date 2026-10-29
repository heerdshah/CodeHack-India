# app/storage/supabase_storage.py — add local fallback
import os
import logging
from app.core.supabase import supabase_client

logger = logging.getLogger(__name__)

async def upload_file(file_bytes: bytes, bucket_name: str, path: str, content_type: str = "image/jpeg") -> str:
    # Try Supabase first
    if supabase_client:
        try:
            supabase_client.storage.from_(bucket_name).upload(
                path=path, file=file_bytes,
                file_options={"content-type": content_type, "upsert": "true"}
            )
            res = supabase_client.storage.from_(bucket_name).create_signed_url(path, 3600 * 24)
            if res.get("signedURL"):
                return res["signedURL"]
        except Exception as e:
            logger.warning("[Storage] Supabase upload failed, using local fallback: %s", e)

    # Local disk fallback (development / demo offline mode)
    try:
        upload_dir = os.path.join(os.getcwd(), "uploads", bucket_name)
        file_path = os.path.join(upload_dir, path)
        os.makedirs(os.path.dirname(file_path), exist_ok=True)
        with open(file_path, "wb") as f:
            f.write(file_bytes)
        logger.info("[Storage] Saved locally: %s", file_path)
    except Exception as e:
        logger.error("[Storage] Local fallback also failed: %s", e)

    return f"http://localhost:8000/storage/{bucket_name}/{path}"


async def get_signed_url(bucket_name: str, path: str, expires_in: int = 3600) -> str:
    if supabase_client:
        try:
            res = supabase_client.storage.from_(bucket_name).create_signed_url(path, expires_in)
            return res.get("signedURL", f"https://mock-storage.availo.app/{bucket_name}/{path}")
        except Exception as e:
            logger.error("[Storage] Signed URL error: %s", e)
    return f"https://mock-storage.availo.app/{bucket_name}/{path}"
