"""Request DTOs for the API. Responses reuse SQLModel table models directly."""

from typing import Optional

from pydantic import BaseModel


class HouseholdIn(BaseModel):
    name: str = "Demo Home"
    lat: float = 37.77
    lon: float = -122.42
    iso_region: str = "CAISO"
    tariff_plan: str = "TOU-D"


class ApplianceIn(BaseModel):
    type: str
    model: str = ""
    power_kw: float = 1.0
    flexible: bool = True


class OutcomeIn(BaseModel):
    followed: bool


class RunLoopIn(BaseModel):
    # demo control: pin the price to a percentile (0=cheapest, 1=priciest)
    force_price_percentile: Optional[float] = None
