from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """App configuration, loaded from environment / .env (see .env.example)."""

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # Agent brain — Claude API direct
    anthropic_api_key: str = ""
    plan_model: str = "claude-haiku-4-5-20251001"      # cheap, high-cadence "digestive work"
    analysis_model: str = "claude-sonnet-5"            # heavier weekly analysis

    # Storage
    database_url: str = "sqlite:///./loop.db"

    # Loop
    loop_cadence_minutes: int = 60
    enable_scheduler: bool = False                     # demo uses manual trigger

    # Ingest — real CAISO OASIS by default (keyless); falls back to mock if offline.
    use_mock_data: bool = False
    default_iso: str = "CAISO"
    caiso_node: str = ""            # blank → auto by household lat (NP15 / SP15)
    nexla_service_key: str = ""
    nexla_sink_url: str = ""
    gridstatus_api_key: str = ""

    # Shadow/sun signal (teammate's SF shadow dataset → sun-aware nudges).
    shadow_enabled: bool = True
    shadow_data_dir: str = ""       # blank → repo datasets/shadow_data; set in Docker

    # Nudge delivery via Zero.xyz (agent tool layer; pays per call in USDC on Base).
    # Two safety gates: disabled by default, AND dry-run by default (build the CLI call
    # but do NOT spend) — flip both off + fund the wallet to actually send.
    zero_enabled: bool = False
    zero_dry_run: bool = True
    zero_cli: str = "zero"
    zero_sms_capability: str = "z_4Bd9DO.1"   # Spraay SMS ($0.02/call); swap via `zero search`
    zero_sms_to_field: str = "to"
    zero_sms_body_field: str = "body"
    zero_target_phone: str = ""               # demo recipient (E.164, e.g. +14155552671)
    zero_max_pay: float = 0.05                # per-call USDC ceiling
    zero_timeout: int = 60


@lru_cache
def get_settings() -> Settings:
    return Settings()
