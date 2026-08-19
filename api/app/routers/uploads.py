from fastapi import APIRouter, File, HTTPException, UploadFile, status

from app.deps import UserDep
from app.schemas import UploadOut
from app.storage import get_storage

router = APIRouter(tags=["uploads"])

ALLOWED = {"image/jpeg", "image/jpg", "image/png", "image/webp", "image/gif", "image/heic"}
MAX_BYTES = 8 * 1024 * 1024


@router.post("/uploads", response_model=UploadOut)
async def upload_image(_user: UserDep, file: UploadFile = File(...)) -> UploadOut:
    content_type = (file.content_type or "").lower()
    if content_type not in ALLOWED:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="unsupported_image")
    data = await file.read()
    if not data:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="empty_file")
    if len(data) > MAX_BYTES:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="file_too_large")
    url = get_storage().save(data, content_type, file.filename or "photo.jpg")
    return UploadOut(url=url)
