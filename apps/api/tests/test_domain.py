from pathlib import Path

FORBIDDEN = ("polescale.com", "PulseGal", "pulsegal.com", "Pulsegal")
SKIP_DIRS = {
    ".git",
    "node_modules",
    "dist",
    "__pycache__",
    ".pytest_cache",
    "data",
    ".pnpm-store",
}
SKIP_SUFFIXES = {".png", ".jpg", ".jpeg", ".webp", ".gif", ".pyc", ".woff", ".woff2"}


def test_domain_strings_are_pollscale():
    root = Path(__file__).resolve().parents[3]
    leftovers: list[str] = []
    for path in root.rglob("*"):
        if not path.is_file():
            continue
        if any(part in SKIP_DIRS for part in path.parts):
            continue
        if path.suffix.lower() in SKIP_SUFFIXES:
            continue
        if path.name == "test_domain.py":
            continue
        try:
            text = path.read_text(encoding="utf-8")
        except (UnicodeDecodeError, OSError):
            continue
        for needle in FORBIDDEN:
            if needle in text:
                leftovers.append(f"{path.relative_to(root)}: {needle}")
    assert leftovers == [], "leftover domain strings:\n" + "\n".join(leftovers)
