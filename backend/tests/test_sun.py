"""Sun-exposure plan + blind/AC nudges (SF shadow dataset)."""

import types

import pytest
from fastapi.testclient import TestClient

from app.agent.client import _mock_plan
from app.ingest import shadow
from app.main import app


@pytest.fixture(scope="module")
def client():
    with TestClient(app) as c:
        yield c


# --- day-ahead schedule ---------------------------------------------------------------

def test_schedule_covers_the_day_for_an_sf_home():
    home = types.SimpleNamespace(id=1, lat=37.77, lon=-122.42)
    plan = shadow.sun_schedule(home)
    assert plan is not None and plan["in_extent"] is True
    assert plan["date"] == "2025-04-15"
    # dataset covers 12 hourly steps, 07:00–18:00
    assert [t["hour"] for t in plan["timeline"]] == list(range(7, 19))
    for t in plan["timeline"]:
        assert t["in_sun"] in (True, False, None)
    assert plan["actions"], "an SF home should get at least one blind/AC action"
    for a in plan["actions"]:
        assert a["device"] in ("blinds", "ac")
        assert a["action"] in ("open", "close", "precool", "off")


def test_schedule_reports_outside_extent_for_non_sf():
    home = types.SimpleNamespace(id=2, lat=40.0, lon=-100.0)  # Nebraska
    plan = shadow.sun_schedule(home)
    assert plan is not None and plan["in_extent"] is False
    assert plan["actions"] == []


def test_shaded_home_keeps_blinds_open_for_daylight():
    # An Embarcadero point that the dataset shows in shade all day.
    home = types.SimpleNamespace(id=3, lat=37.7935, lon=-122.3960)
    plan = shadow.sun_schedule(home)
    assert plan["sun_windows"] == []
    assert any(a["device"] == "blinds" and a["action"] == "open" for a in plan["actions"])


# --- endpoint -------------------------------------------------------------------------

def test_sun_plan_endpoint(client):
    r = client.get("/household/1/sun-plan")
    assert r.status_code == 200
    body = r.json()
    assert body["available"] is True
    assert body["in_extent"] is True
    assert len(body["timeline"]) == 12


def test_sun_plan_endpoint_missing_household(client):
    assert client.get("/household/9999/sun-plan").status_code == 404


# --- real-time nudges: full open/close + on/off matrix --------------------------------

def _ctx(in_sun, temp, pct, next2, price=18.0):
    return {
        "snapshot": {"price_c_per_kwh": price, "price_percentile": pct, "temp_c": temp, "weather": ""},
        "appliances": [{"type": "ac", "model": "Carrier", "power_kw": 3.5, "flexible": True}],
        "active_kinds": [], "suppressed_kinds": [],
        "sun": {"period": "day", "in_sun": in_sun, "sun_az": 200.0, "in_sun_next_2h": next2},
    }


def test_close_blinds_when_sunny_warm_and_pricey():
    kinds = {r["kind"] for r in _mock_plan(_ctx(True, 24, 0.7, [True, True], price=30))}
    assert "close_blinds" in kinds


def test_open_blinds_when_shaded_and_mild():
    kinds = {r["kind"] for r in _mock_plan(_ctx(False, 20, 0.5, [False, False]))}
    assert "open_blinds" in kinds


def test_ac_off_when_shaded_and_mild_and_staying_shaded():
    kinds = {r["kind"] for r in _mock_plan(_ctx(False, 20, 0.5, [False, False]))}
    assert "ac_off" in kinds


def test_precool_when_sun_incoming_and_power_cheap():
    kinds = {r["kind"] for r in _mock_plan(_ctx(False, 21, 0.2, [False, True]))}
    assert "precool_ac" in kinds
