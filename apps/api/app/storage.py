from pathlib import Path
from uuid import uuid4

from app.config import get_settings


class Storage:
    def save(self, data: bytes, content_type: str, filename: str) -> str:
        raise NotImplementedError


class LocalStorage(Storage):
    def __init__(self) -> None:
        settings = get_settings()
        self.root = Path(settings.media_dir)
        self.root.mkdir(parents=True, exist_ok=True)
        self.public_base = settings.public_base_url.rstrip("/")

    def save(self, data: bytes, content_type: str, filename: str) -> str:
        ext = Path(filename).suffix.lower() or _ext_for(content_type)
        key = f"{uuid4().hex}{ext}"
        path = self.root / key
        path.write_bytes(data)
        return f"{self.public_base}/media/{key}"


class S3Storage(Storage):
    def __init__(self) -> None:
        import boto3
        from botocore.client import Config

        settings = get_settings()
        self.bucket = settings.s3_bucket
        self.public_base = (settings.s3_public_url or settings.public_base_url).rstrip("/")
        self.client = boto3.client(
            "s3",
            endpoint_url=settings.s3_endpoint or None,
            aws_access_key_id=settings.s3_access_key,
            aws_secret_access_key=settings.s3_secret_key,
            region_name=settings.s3_region,
            use_ssl=settings.s3_use_ssl,
            config=Config(signature_version="s3v4"),
        )

    def save(self, data: bytes, content_type: str, filename: str) -> str:
        ext = Path(filename).suffix.lower() or _ext_for(content_type)
        key = f"polls/{uuid4().hex}{ext}"
        self.client.put_object(
            Bucket=self.bucket,
            Key=key,
            Body=data,
            ContentType=content_type or "application/octet-stream",
        )
        settings = get_settings()
        if settings.s3_public_url:
            return f"{self.public_base.rstrip('/')}/{key}"
        return f"{settings.public_base_url.rstrip('/')}/media/{key}"


def _ext_for(content_type: str) -> str:
    return {
        "image/jpeg": ".jpg",
        "image/jpg": ".jpg",
        "image/png": ".png",
        "image/webp": ".webp",
        "image/gif": ".gif",
        "image/heic": ".heic",
    }.get(content_type, ".bin")


def get_storage() -> Storage:
    settings = get_settings()
    if settings.s3_endpoint and settings.s3_access_key and settings.s3_secret_key:
        return S3Storage()
    return LocalStorage()
