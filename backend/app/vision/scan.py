"""Identify an appliance from an uploaded photo.

Resolution order (first hit wins):
  1. External inference server (`INFERENCE_URL`) — multipart POST, JSON body back
  2. Claude vision (`ANTHROPIC_API_KEY`) — nameplate / device ID + wattage estimate
  3. Perceptual match against `datasets/hardware-analytics` (keyless demo path)
  4. Generic fallback so the upload flow never hard-fails the UI

Returned fields map onto `ApplianceIn` (type / model / power_kw) plus an optional
`note` the frontend can show even though it is not persisted on the Appliance row.
"""

from __future__ import annotations

import base64
import io
import json
import re
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path
from typing import Optional

import httpx

from ..config import get_settings
from ..obs import get_logger, metrics

log = get_logger("vision.scan")

# UI / agent-friendly type slugs we persist on Appliance.type
_CATEGORY_TO_TYPE: dict[str, str] = {
    "ev": "ev_charger",
    "ev charger": "ev_charger",
    "ev_charger": "ev_charger",
    "hvac": "ac",
    "ac": "ac",
    "air conditioner": "ac",
    "heat pump": "ac",
    "kitchen": "kitchen",
    "dishwasher": "dishwasher",
    "laundry": "washer",
    "washer": "washer",
    "dryer": "dryer",
    "electronics": "electronics",
    "other": "other",
    "refrigerator": "kitchen",
    "fridge": "kitchen",
    "microwave": "kitchen",
    "toaster": "kitchen",
    "water dispenser": "kitchen",
    "water cooler": "kitchen",
    "projector": "electronics",
    "monitor": "electronics",
    "laptop": "electronics",
    "adapter": "electronics",
    "charger": "electronics",
    "charging station": "electronics",
    "fan-coil": "ac",
    "fan coil": "ac",
    "baseboard": "ac",
    "convector": "ac",
    "heater": "ac",
    "space heater": "ac",
}


@dataclass
class DetectedAppliance:
    type: str
    model: str
    power_kw: float
    note: str = ""
    source: str = "fallback"  # inference | claude | hardware-match | fallback
    confidence: float = 0.5


def scan_appliance_image(image_bytes: bytes, filename: str = "photo.jpg", content_type: str = "image/jpeg") -> DetectedAppliance:
    """Run the resolution chain on raw image bytes."""
    settings = get_settings()

    if settings.inference_url:
        try:
            hit = _via_inference_url(image_bytes, filename, content_type, settings.inference_url)
            if hit:
                metrics.inc("vision.scan.inference")
                return hit
        except Exception as exc:
            log.warning(f"inference_url failed: {type(exc).__name__}: {exc}")
            metrics.inc("vision.scan.inference_fail")

    if settings.anthropic_api_key:
        try:
            hit = _via_claude(image_bytes, content_type, settings)
            if hit:
                metrics.inc("vision.scan.claude")
                return hit
        except Exception as exc:
            log.warning(f"claude vision failed: {type(exc).__name__}: {exc}")
            metrics.inc("vision.scan.claude_fail")

    try:
        hit = _via_hardware_match(image_bytes)
        if hit:
            metrics.inc("vision.scan.hardware_match")
            return hit
    except Exception as exc:
        log.warning(f"hardware match failed: {type(exc).__name__}: {exc}")
        metrics.inc("vision.scan.hardware_fail")

    metrics.inc("vision.scan.fallback")
    return DetectedAppliance(
        type="other",
        model="Detected Appliance",
        power_kw=1.0,
        note="Could not confidently identify this device — estimate 1 kW. Edit or re-scan with a clearer nameplate shot.",
        source="fallback",
        confidence=0.2,
    )


# --- 1. External inference server -------------------------------------------------------

def _via_inference_url(
    image_bytes: bytes, filename: str, content_type: str, url: str
) -> Optional[DetectedAppliance]:
    """POST multipart `file` to INFERENCE_URL; accept several common JSON shapes."""
    with httpx.Client(timeout=60.0) as client:
        res = client.post(
            url,
            files={"file": (filename or "photo.jpg", image_bytes, content_type or "application/octet-stream")},
            data={"image": filename or "photo.jpg"},  # some Gradio / HF spaces expect this too
        )
        res.raise_for_status()
        payload = res.json()

    # Gradio often wraps: {"data": [...]} — unwrap one level.
    if isinstance(payload, dict) and "data" in payload and isinstance(payload["data"], list) and payload["data"]:
        first = payload["data"][0]
        payload = first if isinstance(first, (dict, str)) else payload
        if isinstance(payload, str):
            payload = _extract_json(payload) or {"model": payload}

    return _normalize_detection(payload, source="inference", default_confidence=0.85)


# --- 2. Claude vision -------------------------------------------------------------------

_CLAUDE_PROMPT = """Identify the household appliance or device in this photo (product shot or nameplate).
Read any visible brand, model, and wattage / amperage / voltage from labels when present.
Reply with ONLY a JSON object (no markdown) matching:
{
  "type": "ev_charger|ac|dishwasher|washer|dryer|kitchen|laundry|electronics|other",
  "model": "Brand Model or short name",
  "power_w": <number watts, typical in-use or nameplate>,
  "note": "one short sentence for the homeowner",
  "confidence": <0..1>
}
Prefer nameplate rated watts when readable; otherwise a typical in-use estimate.
"""


def _via_claude(image_bytes: bytes, content_type: str, settings) -> Optional[DetectedAppliance]:
    import anthropic

    media = content_type if content_type.startswith("image/") else "image/jpeg"
    # Claude rejects some types (heic); coerce unknown to jpeg label — bytes still sent.
    if media not in ("image/jpeg", "image/png", "image/gif", "image/webp"):
        media = "image/jpeg"

    extra = {"default_headers": {"User-Agent": "loop-backend/1.0"}} if settings.anthropic_base_url else {}
    client = anthropic.Anthropic(
        api_key=settings.anthropic_api_key,
        base_url=settings.anthropic_base_url or None,
        **extra,
    )
    b64 = base64.standard_b64encode(image_bytes).decode("ascii")
    message = client.messages.create(
        model=settings.analysis_model or settings.plan_model,
        max_tokens=512,
        messages=[{
            "role": "user",
            "content": [
                {
                    "type": "image",
                    "source": {"type": "base64", "media_type": media, "data": b64},
                },
                {"type": "text", "text": _CLAUDE_PROMPT},
            ],
        }],
    )
    text = "".join(getattr(b, "text", "") for b in message.content if getattr(b, "type", None) == "text")
    obj = _extract_json(text)
    if not obj:
        return None
    return _normalize_detection(obj, source="claude", default_confidence=0.75)


# --- 3. Hardware-analytics perceptual match ---------------------------------------------

def _hardware_dir() -> Optional[Path]:
    settings = get_settings()
    base = Path(settings.hardware_data_dir) if settings.hardware_data_dir \
        else Path(__file__).resolve().parents[3] / "datasets" / "hardware-analytics"
    return base if (base / "dataset.json").exists() else None


@lru_cache(maxsize=1)
def _hardware_index() -> list[tuple[int, dict]]:
    """[(avg_hash, record), ...] for each viewable JPG with a matching JSON record."""
    from PIL import Image

    root = _hardware_dir()
    if not root:
        return []

    data = json.loads((root / "dataset.json").read_text(encoding="utf-8"))
    records = data.get("records") or []
    by_photo: dict[str, dict] = {}
    for rec in records:
        pf = rec.get("photo_file") or ""
        by_photo[Path(pf).name] = rec
        view = rec.get("viewable_jpg")
        if view:
            by_photo[Path(view).name] = rec

    # Sidecar JSON files (photo.json) fill gaps when dataset.json omits viewable_jpg.
    for side in root.glob("*.json"):
        if side.name in {"dataset.json", "meta.json"}:
            continue
        try:
            rec = json.loads(side.read_text(encoding="utf-8"))
        except json.JSONDecodeError:
            continue
        if not isinstance(rec, dict):
            continue
        pf = rec.get("photo_file") or side.stem
        by_photo.setdefault(Path(str(pf)).name, rec)
        # HEIC originals decode to images/<stem>.jpg or images/<name>.HEIC.jpg
        by_photo.setdefault(f"{side.stem}.jpg", rec)

    images_dir = root / "images"
    indexed: list[tuple[int, dict]] = []
    if not images_dir.is_dir():
        return []

    for img_path in images_dir.iterdir():
        if img_path.suffix.lower() not in {".jpg", ".jpeg", ".png", ".webp"}:
            continue
        rec = by_photo.get(img_path.name)
        if not rec:
            stem = img_path.stem  # e.g. IMG_4081.HEIC or 20260717_115226
            for key, r in by_photo.items():
                key_stem = Path(key).stem
                if stem == key_stem or stem.startswith(key_stem) or key_stem.startswith(stem.split(".")[0]):
                    rec = r
                    break
        if not rec:
            continue
        try:
            with Image.open(img_path) as im:
                indexed.append((_average_hash(im), rec))
        except Exception:
            continue
    return indexed

def _via_hardware_match(image_bytes: bytes) -> Optional[DetectedAppliance]:
    from PIL import Image

    index = _hardware_index()
    if not index:
        return None

    with Image.open(io.BytesIO(image_bytes)) as im:
        query = _average_hash(im)

    best_rec = None
    best_dist = 999
    for h, rec in index:
        dist = _hamming(query, h)
        if dist < best_dist:
            best_dist = dist
            best_rec = rec

    # 64-bit aHash: ≤10 is a strong match; ≤18 is "same device / similar crop"
    if best_rec is None or best_dist > 18:
        return None

    return _record_to_detection(best_rec, confidence=max(0.4, 1.0 - best_dist / 24.0))


def _average_hash(im, size: int = 8):
    """Simple aHash — enough to match dataset demos without extra deps."""
    from PIL import Image

    gray = im.convert("L").resize((size, size), Image.Resampling.LANCZOS)
    pixels = list(gray.getdata())
    avg = sum(pixels) / len(pixels)
    bits = 0
    for i, p in enumerate(pixels):
        if p >= avg:
            bits |= 1 << i
    return bits


def _hamming(a: int, b: int) -> int:
    return (a ^ b).bit_count()


def _record_to_detection(rec: dict, confidence: float) -> DetectedAppliance:
    device = rec.get("device") or {}
    brand = (device.get("brand") or "").strip()
    model = (device.get("model") or "").strip()
    name = (device.get("name") or "").strip()
    category = (device.get("category") or "").lower()

    label_parts = [p for p in (brand, model) if p and p.lower() != "unknown"]
    label = " ".join(label_parts) if label_parts else (name.split("(")[0].strip() or "Appliance")

    power_w = _power_w_from_record(rec)
    note = (rec.get("notes") or "").strip()
    if len(note) > 160:
        note = note[:157].rstrip() + "…"

    return DetectedAppliance(
        type=_map_type(category + " " + name.lower()),
        model=label[:80],
        power_kw=round(max(power_w, 1) / 1000.0, 3),
        note=note,
        source="hardware-match",
        confidence=confidence,
    )


def _power_w_from_record(rec: dict) -> float:
    np = rec.get("nameplate_ratings") or {}
    if isinstance(np.get("rated_power_w"), (int, float)) and np["rated_power_w"] > 0:
        return float(np["rated_power_w"])

    pc = rec.get("power_consumption") or {}
    for key in (
        "in_use_w",
        "in_use_hot_w",
        "in_use_cold_w",
        "in_use_fan_w",
        "typical_in_use_w",
    ):
        val = pc.get(key)
        if isinstance(val, dict):
            low, high = val.get("low"), val.get("high")
            if isinstance(low, (int, float)) and isinstance(high, (int, float)):
                return (float(low) + float(high)) / 2.0
        elif isinstance(val, (int, float)) and val > 0:
            return float(val)

    # Nested ranges anywhere under power_consumption
    for val in pc.values():
        if isinstance(val, dict) and "low" in val and "high" in val:
            try:
                return (float(val["low"]) + float(val["high"])) / 2.0
            except (TypeError, ValueError):
                continue
    return 1000.0


# --- Normalization ----------------------------------------------------------------------

def _normalize_detection(
    payload: Any, *, source: str, default_confidence: float
) -> Optional[DetectedAppliance]:
    if isinstance(payload, list) and payload:
        payload = payload[0]
    if not isinstance(payload, dict):
        return None

    # Nested common wrappers
    for key in ("appliance", "result", "prediction", "output"):
        inner = payload.get(key)
        if isinstance(inner, dict):
            payload = {**payload, **inner}

    model = (
        payload.get("model")
        or payload.get("name")
        or payload.get("device_name")
        or payload.get("label")
        or ""
    )
    if isinstance(model, dict):
        brand = model.get("brand") or ""
        m = model.get("model") or model.get("name") or ""
        model = f"{brand} {m}".strip()
    model = str(model).strip() or "Detected Appliance"

    raw_type = str(
        payload.get("type")
        or payload.get("category")
        or payload.get("appliance_type")
        or "other"
    )
    type_slug = _map_type(raw_type)

    power_kw = payload.get("power_kw")
    if power_kw is None and payload.get("power_w") is not None:
        try:
            power_kw = float(payload["power_w"]) / 1000.0
        except (TypeError, ValueError):
            power_kw = None
    if power_kw is None and payload.get("watts") is not None:
        try:
            power_kw = float(payload["watts"]) / 1000.0
        except (TypeError, ValueError):
            power_kw = None
    if power_kw is None and payload.get("kw") is not None:
        power_kw = payload.get("kw")
    try:
        power_kw = float(power_kw) if power_kw is not None else 1.0
    except (TypeError, ValueError):
        power_kw = 1.0
    power_kw = max(0.0, round(power_kw, 3))

    note = str(payload.get("note") or payload.get("notes") or payload.get("reason") or "").strip()
    try:
        confidence = float(payload.get("confidence", default_confidence))
    except (TypeError, ValueError):
        confidence = default_confidence

    return DetectedAppliance(
        type=type_slug,
        model=model[:80],
        power_kw=power_kw,
        note=note[:200],
        source=source,
        confidence=max(0.0, min(1.0, confidence)),
    )


def _map_type(raw: str) -> str:
    s = (raw or "other").strip().lower().replace("-", " ").replace("_", " ")
    s_compact = s.replace(" ", "_")
    if s_compact in _CATEGORY_TO_TYPE:
        return _CATEGORY_TO_TYPE[s_compact]
    if s in _CATEGORY_TO_TYPE:
        return _CATEGORY_TO_TYPE[s]
    for key, val in _CATEGORY_TO_TYPE.items():
        if key in s:
            return val
    # Already a known backend slug
    known = {"ev_charger", "ac", "dishwasher", "washer", "dryer", "kitchen", "electronics", "other"}
    compact = raw.strip().lower().replace(" ", "_")
    if compact in known:
        return compact
    return "other"


def _extract_json(text: str) -> Optional[dict]:
    t = (text or "").strip()
    if not t:
        return None
    if "```" in t:
        parts = t.split("```")
        t = max(parts, key=len)
        if t.lstrip().lower().startswith("json"):
            t = t.lstrip()[4:]
    start, end = t.find("{"), t.rfind("}")
    if start < 0 or end <= start:
        return None
    try:
        obj = json.loads(t[start : end + 1])
    except json.JSONDecodeError:
        # Tolerate trailing commas lightly
        cleaned = re.sub(r",\s*}", "}", t[start : end + 1])
        cleaned = re.sub(r",\s*]", "]", cleaned)
        try:
            obj = json.loads(cleaned)
        except json.JSONDecodeError:
            return None
    return obj if isinstance(obj, dict) else None
