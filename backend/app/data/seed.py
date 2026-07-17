"""Idempotent demo seed — one household with representative flexible appliances."""

from sqlmodel import Session, select

from .models import Appliance, Household
from .store import engine


def ensure_seed() -> int:
    with Session(engine) as session:
        existing = session.exec(select(Household)).first()
        if existing:
            return existing.id

        home = Household(
            name="Demo Home",
            lat=37.77,
            lon=-122.42,
            iso_region="CAISO",
            tariff_plan="TOU-D-PRIME",
        )
        session.add(home)
        session.commit()
        session.refresh(home)

        appliances = [
            Appliance(household_id=home.id, type="dishwasher", model="Bosch 300", power_kw=1.8, flexible=True),
            Appliance(household_id=home.id, type="ev_charger", model="Tesla Model 3", power_kw=11.0, flexible=True),
            Appliance(household_id=home.id, type="ac", model="Carrier 3-ton", power_kw=3.5, flexible=True),
            Appliance(household_id=home.id, type="washer", model="LG WM4000", power_kw=1.0, flexible=True),
            Appliance(household_id=home.id, type="dryer", model="LG DLEX4000", power_kw=5.0, flexible=True),
        ]
        session.add_all(appliances)
        session.commit()
        return home.id
