"""Household + appliance onboarding — teammates' frontend uses these."""

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from sqlmodel import Session, select

from ...data.models import Appliance, Household
from ...data.store import get_session
from ...schemas import ApplianceIn, HouseholdIn
from ...vision import scan_appliance_image

router = APIRouter(prefix="/household", tags=["household"])

_MAX_UPLOAD_BYTES = 12 * 1024 * 1024  # 12 MB


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


@router.post("/{household_id}/appliances/scan")
async def scan_appliance(
    household_id: int,
    file: UploadFile = File(..., description="Photo of an appliance or nameplate"),
    session: Session = Depends(get_session),
) -> dict:
    """Identify an appliance from a photo and persist it on the household.

    Resolution: INFERENCE_URL → Claude vision → hardware-analytics image match → fallback.
    Response matches the Appliance row plus `identified` / `note` / `source` /
    `confidence` for the My Home UI (note is not stored on the Appliance table).

    When the chain bottoms out on the generic fallback the model genuinely could
    not identify the device: nothing is persisted, `identified` is false, `id` is
    null, and the default config (type/model/power_kw) is returned so the client
    can prefill its manual Add Appliance form.
    """
    if not session.get(Household, household_id):
        raise HTTPException(404, "household not found")

    content_type = (file.content_type or "").lower()
    if content_type and not (
        content_type.startswith("image/") or content_type == "application/octet-stream"
    ):
        raise HTTPException(400, "expected an image upload")

    raw = await file.read()
    if not raw:
        raise HTTPException(400, "empty upload")
    if len(raw) > _MAX_UPLOAD_BYTES:
        raise HTTPException(413, "image too large (max 12 MB)")

    detected = scan_appliance_image(
        raw,
        filename=file.filename or "photo.jpg",
        content_type=content_type or "image/jpeg",
    )

    identified = detected.source != "fallback"
    if not identified:
        # Genuine "couldn't identify" — don't persist a guess; hand the client a
        # sensible default config to prefill manual entry with.
        return {
            "id": None,
            "identified": False,
            "type": detected.type,
            "model": detected.model,
            "power_kw": detected.power_kw,
            "flexible": True,
            "household_id": household_id,
            "note": detected.note,
            "source": detected.source,
            "confidence": detected.confidence,
        }

    appliance = Appliance(
        household_id=household_id,
        type=detected.type,
        model=detected.model,
        power_kw=detected.power_kw,
        flexible=True,
    )
    session.add(appliance)
    session.commit()
    session.refresh(appliance)

    return {
        "id": appliance.id,
        "identified": True,
        "type": appliance.type,
        "model": appliance.model,
        "power_kw": appliance.power_kw,
        "flexible": appliance.flexible,
        "household_id": appliance.household_id,
        "note": detected.note,
        "source": detected.source,
        "confidence": detected.confidence,
    }


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
