"""Appliance photo scan endpoint — hardware-analytics match (keyless)."""

from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app.main import app

REPO_ROOT = Path(__file__).resolve().parents[2]
SAMPLE = REPO_ROOT / "datasets" / "hardware-analytics" / "images" / "20260717_115226.jpg"


@pytest.fixture(scope="module")
def client():
    with TestClient(app) as c:
        yield c


@pytest.mark.skipif(not SAMPLE.exists(), reason="hardware-analytics sample image missing")
def test_scan_photo_matches_hardware_and_persists(client):
    before = client.get("/household/1/appliances").json()
    with SAMPLE.open("rb") as f:
        res = client.post(
            "/household/1/appliances/scan",
            files={"file": ("20260717_115226.jpg", f, "image/jpeg")},
        )
    assert res.status_code == 200, res.text
    body = res.json()
    assert body["model"]
    assert body["power_kw"] > 0
    assert body["source"] in {"hardware-match", "claude", "inference", "fallback"}
    # Identified scans persist; the generic fallback (unidentified) must not.
    assert body["identified"] is (body["source"] != "fallback")
    # Dataset photo should match strongly when no external inference is configured.
    if body["source"] == "hardware-match":
        assert "Wellsys" in body["model"] or "S4" in body["model"] or "Water" in body["model"]
        assert body["power_kw"] == pytest.approx(0.54, rel=0.05)

    after = client.get("/household/1/appliances").json()
    if body["identified"]:
        assert body["id"]
        assert len(after) == len(before) + 1
        assert any(a["id"] == body["id"] for a in after)
    else:
        assert body["id"] is None
        assert len(after) == len(before)


def test_scan_unidentified_returns_default_config_without_persisting(client, monkeypatch):
    """Fallback detection → identified false, id null, default config, no new row."""
    from app.api.routers import household as household_router
    from app.vision.scan import DetectedAppliance

    monkeypatch.setattr(
        household_router,
        "scan_appliance_image",
        lambda *args, **kwargs: DetectedAppliance(
            type="other",
            model="Detected Appliance",
            power_kw=1.0,
            note="Could not confidently identify this device.",
            source="fallback",
            confidence=0.2,
        ),
    )

    before = client.get("/household/1/appliances").json()
    res = client.post(
        "/household/1/appliances/scan",
        files={"file": ("mystery.jpg", b"\xff\xd8\xff\xe0 not really a jpeg", "image/jpeg")},
    )
    assert res.status_code == 200, res.text
    body = res.json()
    assert body["identified"] is False
    assert body["id"] is None
    # Still a usable default device config for manual-entry prefill.
    assert body["type"] == "other"
    assert body["model"]
    assert body["power_kw"] == pytest.approx(1.0)
    assert body["note"]

    after = client.get("/household/1/appliances").json()
    assert len(after) == len(before)


def test_scan_rejects_non_image(client):
    res = client.post(
        "/household/1/appliances/scan",
        files={"file": ("notes.txt", b"not an image", "text/plain")},
    )
    assert res.status_code == 400
