"""SQLModel tables — the persistent state the loop reads and writes each cycle."""

from datetime import datetime, timezone
from enum import Enum
from typing import Optional

from sqlmodel import Field, SQLModel


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class NudgeStatus(str, Enum):
    active = "active"
    followed = "followed"
    dismissed = "dismissed"
    expired = "expired"


class Household(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    name: str = "Demo Home"
    lat: float = 37.77
    lon: float = -122.42
    iso_region: str = "CAISO"          # CAISO | PJM | ERCOT | ...
    tariff_plan: str = "TOU-D"
    credits: int = 0                   # running balance (loop awards; teammates may reconcile)
    created_at: datetime = Field(default_factory=utcnow)


class Appliance(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    household_id: int = Field(foreign_key="household.id", index=True)
    type: str                          # dishwasher | ac | ev_charger | washer | dryer | pool_pump
    model: str = ""                    # "Tesla Model 3", "LG DLEX"
    power_kw: float = 1.0
    flexible: bool = True              # can this load be time-shifted?


class Snapshot(SQLModel, table=True):
    """One observation of the world for a household at a point in time."""

    id: Optional[int] = Field(default=None, primary_key=True)
    household_id: int = Field(foreign_key="household.id", index=True)
    ts: datetime = Field(default_factory=utcnow, index=True)
    price_c_per_kwh: float
    price_percentile: float            # 0..1 vs recent window (0 = cheapest)
    temp_c: float = 20.0
    weather: str = ""
    source: str = "mock"               # mock | nexla | gridstatus


class Nudge(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    household_id: int = Field(foreign_key="household.id", index=True)
    ts: datetime = Field(default_factory=utcnow, index=True)
    kind: str = Field(index=True)      # stable category slug, e.g. shift_dishwasher
    action: str                        # short imperative shown to the user
    reason: str
    est_savings_c: float = 0.0
    credit_reward: int = 0
    window_start: Optional[datetime] = None
    window_end: Optional[datetime] = None
    confidence: float = 0.5
    status: NudgeStatus = Field(default=NudgeStatus.active, index=True)


class Outcome(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    nudge_id: int = Field(foreign_key="nudge.id", index=True)
    household_id: int = Field(foreign_key="household.id", index=True)
    followed: bool
    observed_savings_c: float = 0.0
    ts: datetime = Field(default_factory=utcnow)


class UserPattern(SQLModel, table=True):
    """Learned per-household state the REFLECT stage updates — how the loop self-corrects."""

    id: Optional[int] = Field(default=None, primary_key=True)
    household_id: int = Field(foreign_key="household.id", index=True)
    key: str = Field(index=True)       # e.g. "responsiveness:shift_dishwasher"
    value: str                         # stringified float/json
    updated_at: datetime = Field(default_factory=utcnow)


class CreditEvent(SQLModel, table=True):
    """Emitted when a nudge is followed; teammates' credit system consumes these."""

    id: Optional[int] = Field(default=None, primary_key=True)
    household_id: int = Field(foreign_key="household.id", index=True)
    nudge_id: Optional[int] = Field(default=None, foreign_key="nudge.id")
    amount: int
    reason: str = ""
    ts: datetime = Field(default_factory=utcnow, index=True)


class LoopRun(SQLModel, table=True):
    """Audit row per cycle — powers GET /loop/status and demo metrics."""

    id: Optional[int] = Field(default=None, primary_key=True)
    household_id: int = Field(foreign_key="household.id", index=True)
    ts: datetime = Field(default_factory=utcnow, index=True)
    nudges_created: int = 0
    outcomes_scored: int = 0
    suppressed_kinds: str = ""         # comma-separated, for visibility
    model_used: str = ""
    price_c_per_kwh: float = 0.0
    price_percentile: float = 0.0
    ok: bool = True
    note: str = ""
