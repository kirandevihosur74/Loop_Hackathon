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
    assert body["id"]
    assert body["model"]
    assert body["power_kw"] > 0
    assert body["source"] in {"hardware-match", "claude", "inference", "fallback"}
    # Dataset photo should match strongly when no external inference is configured.
    if body["source"] == "hardware-match":
        assert "Wellsys" in body["model"] or "S4" in body["model"] or "Water" in body["model"]
        assert body["power_kw"] == pytest.approx(0.54, rel=0.05)

    after = client.get("/household/1/appliances").json()
    assert len(after) == len(before) + 1
    assert any(a["id"] == body["id"] for a in after)


def test_scan_rejects_non_image(client):
    res = client.post(
        "/household/1/appliances/scan",
        files={"file": ("notes.txt", b"not an image", "text/plain")},
    )
    assert res.status_code == 400
