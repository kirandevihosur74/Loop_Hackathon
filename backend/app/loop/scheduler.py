"""APScheduler wrapper — fires run_cycle for every household on the configured cadence.

Off by default (ENABLE_SCHEDULER=false); the demo drives cycles with POST /loop/run.
"""

from apscheduler.schedulers.background import BackgroundScheduler
from sqlmodel import Session, select

from ..config import get_settings
from ..data.models import Household
from ..data.store import engine
from .engine import run_cycle

_scheduler: BackgroundScheduler | None = None


def _tick() -> None:
    with Session(engine) as session:
        for household in session.exec(select(Household)).all():
            try:
                run_cycle(session, household)
            except Exception as exc:  # keep the scheduler alive across a bad cycle
                print(f"[scheduler] cycle failed for household {household.id}: {exc}")


def start_scheduler() -> None:
    global _scheduler
    if _scheduler:
        return
    minutes = max(1, get_settings().loop_cadence_minutes)
    _scheduler = BackgroundScheduler(daemon=True)
    _scheduler.add_job(_tick, "interval", minutes=minutes, id="loop_cycle", next_run_time=None)
    _scheduler.start()
    print(f"[scheduler] started — every {minutes} min")


def stop_scheduler() -> None:
    global _scheduler
    if _scheduler:
        _scheduler.shutdown(wait=False)
        _scheduler = None
