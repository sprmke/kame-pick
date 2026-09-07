"""Read candidate data from the local filesystem."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from server.config import CANDIDATES_DIR, MANIFEST_PATH


def load_manifest() -> dict[str, Any]:
    if not MANIFEST_PATH.exists():
        return {"candidates": [], "updated_at": None}
    return json.loads(MANIFEST_PATH.read_text(encoding="utf-8"))


def candidate_dir(slug: str) -> Path:
    return CANDIDATES_DIR / slug


def load_metadata(slug: str) -> dict[str, Any] | None:
    path = candidate_dir(slug) / "metadata.json"
    if not path.exists():
        return None
    return json.loads(path.read_text(encoding="utf-8"))


def load_links(slug: str) -> dict[str, list[str]]:
    path = candidate_dir(slug) / "links.json"
    if not path.exists():
        return {"all": [], "github": [], "linkedin": [], "portfolio_and_other": []}
    return json.loads(path.read_text(encoding="utf-8"))


def load_combined_email(slug: str) -> str:
    path = candidate_dir(slug) / "combined-email.txt"
    if not path.exists():
        return ""
    return path.read_text(encoding="utf-8")


def load_extracted_texts(slug: str) -> list[dict[str, Any]]:
    extracted_dir = candidate_dir(slug) / "extracted"
    if not extracted_dir.exists():
        return []
    index_path = extracted_dir / "index.json"
    index: list[dict] = []
    if index_path.exists():
        index = json.loads(index_path.read_text(encoding="utf-8"))

    texts: list[dict[str, Any]] = []
    for txt in sorted(extracted_dir.glob("*.txt")):
        content = txt.read_text(encoding="utf-8")
        texts.append(
            {
                "filename": txt.name,
                "chars": len(content),
                "preview": content[:500],
                "content": content,
            }
        )
    return texts


def list_attachments(slug: str) -> list[dict[str, Any]]:
    meta = load_metadata(slug)
    if not meta:
        return []
    attachments_dir = candidate_dir(slug) / "attachments"
    result: list[dict[str, Any]] = []
    for att in meta.get("attachments", []):
        saved_as = att.get("saved_as", "")
        path = attachments_dir / saved_as if saved_as else None
        result.append(
            {
                **att,
                "exists": path.exists() if path else False,
                "path": str(path.relative_to(CANDIDATES_DIR.parent.parent))
                if path and path.exists()
                else None,
            }
        )
    return result


def get_candidate_full(slug: str) -> dict[str, Any] | None:
    manifest = load_manifest()
    entry = next((c for c in manifest.get("candidates", []) if c["slug"] == slug), None)
    if not entry and not (candidate_dir(slug) / "metadata.json").exists():
        return None

    meta = load_metadata(slug) or {}
    return {
        **(entry or {"slug": slug}),
        "metadata": meta,
        "links": load_links(slug),
        "email_text": load_combined_email(slug),
        "extracted": load_extracted_texts(slug),
        "attachments": list_attachments(slug),
    }


def get_combined_text_for_scoring(slug: str) -> str:
    parts: list[str] = []
    email = load_combined_email(slug)
    if email:
        parts.append(email)
    for item in load_extracted_texts(slug):
        parts.append(item["content"])
    meta = load_metadata(slug) or {}
    if meta.get("subject"):
        parts.append(meta["subject"])
    if meta.get("from_name"):
        parts.append(meta["from_name"])
    links = load_links(slug)
    parts.extend(links.get("all", []))
    return "\n".join(parts).lower()
