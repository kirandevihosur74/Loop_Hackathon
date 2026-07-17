"""Household + appliance onboarding — teammates' frontend uses these."""

from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select

from ...data.models import Appliance, Household
from ...data.store import get_session
from ...schemas import ApplianceIn, HouseholdIn

router = APIRouter(prefix="/household", tags=["household"])


@router.post("")
def create_household(body: HouseholdIn, session: Session = Depends(get_session)) -> Household:
    home = Household(**body.model_dump())
    session.add(home)
    session.commit()
    session.refresh(home)
    return home


@router.get("/{household_id}")
def get_household(household_id: int, session: Session = Depends(get_session)) -> Household:
    home = session.get(Household, household_id)
    if not home:
        raise HTTPException(404, "household not found")
    return home


@router.get("/{household_id}/appliances")
def list_appliances(household_id: int, session: Session = Depends(get_session)) -> list[Appliance]:
    return session.exec(
        select(Appliance).where(Appliance.household_id == household_id)
    ).all()


@router.post("/{household_id}/appliances")
def add_appliance(
    household_id: int, body: ApplianceIn, session: Session = Depends(get_session)
) -> Appliance:
    if not session.get(Household, household_id):
        raise HTTPException(404, "household not found")
    appliance = Appliance(household_id=household_id, **body.model_dump())
    session.add(appliance)
    session.commit()
    session.refresh(appliance)
    return appliance


@router.delete("/{household_id}/appliances/{appliance_id}")
def delete_appliance(
    household_id: int, appliance_id: int, session: Session = Depends(get_session)
) -> dict:
    appliance = session.get(Appliance, appliance_id)
    if not appliance or appliance.household_id != household_id:
        raise HTTPException(404, "appliance not found")
    session.delete(appliance)
    session.commit()
    return {"deleted": appliance_id}
