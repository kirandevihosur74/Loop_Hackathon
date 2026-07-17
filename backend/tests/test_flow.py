"""End-to-end loop behavior on the deterministic mock brain."""

import pytest
from fastapi.testclient import TestClient

from app.main import app


@pytest.fixture(scope="module")
def client():
    with TestClient(app) as c:      # runs lifespan: init_db + seed
        yield c


def _kinds(client):
    return {n["kind"] for n in client.get("/nudges/active?household_id=1").json()}


def test_cheap_window_creates_run_load_nudges(client):
    out = client.post("/loop/run?household_id=1", json={"force_price_percentile": 0.05}).json()
    kinds = {n["kind"] for n in out["nudges_created"]}
    assert "shift_dishwasher" in kinds
    assert "charge_ev_offpeak" in kinds


def test_follow_awards_credit_event(client):
    active = client.get("/nudges/active?household_id=1").json()
    nid = active[0]["id"]
    before = client.get("/credits/balance?household_id=1").json()["credits"]
    res = client.post(f"/nudges/{nid}/outcome", json={"followed": True}).json()
    assert res["status"] == "followed"
    assert res["credit_event"]["amount"] > 0
    after = client.get("/credits/balance?household_id=1").json()["credits"]
    assert after == before + res["credit_event"]["amount"]


def test_expensive_window_creates_delay_nudges(client):
    out = client.post("/loop/run?household_id=1", json={"force_price_percentile": 0.95}).json()
    kinds = {n["kind"] for n in out["nudges_created"]}
    assert kinds & {"delay_dryer", "raise_ac_setpoint"}


def test_loop_self_corrects_by_suppressing_ignored_kind(client):
    """Dismiss a kind 3x → the loop stops surfacing it (the loop closes)."""
    target = "shift_dishwasher"

    for _ in range(3):
        out = client.post("/loop/run?household_id=1", json={"force_price_percentile": 0.05}).json()
        dishwasher = next(
            (n for n in out["nudges_created"] if n["kind"] == target), None
        )
        if dishwasher is None:  # already active from a prior cycle — fetch it
            dishwasher = next(
                (n for n in client.get("/nudges/active?household_id=1").json() if n["kind"] == target),
                None,
            )
        assert dishwasher is not None, "expected a dishwasher nudge while unsuppressed"
        client.post(f"/nudges/{dishwasher['id']}/outcome", json={"followed": False})

    # Next cheap cycle: the ignored kind must now be suppressed.
    out = client.post("/loop/run?household_id=1", json={"force_price_percentile": 0.05}).json()
    assert target in out["suppressed_kinds"]
    assert target not in {n["kind"] for n in out["nudges_created"]}
    assert target not in _kinds(client)
    # ...but the loop still nudges other kinds it hasn't been told to stop.
    assert _kinds(client), "other nudges should still appear"
