# Container for the loop backend — build from the REPO ROOT:
#   docker build -t <you>/loop-backend:latest -f deploy/Dockerfile .
FROM python:3.13-slim

WORKDIR /app
ENV PYTHONUNBUFFERED=1 \
    USE_MOCK_DATA=false

# Deps (kept in sync with backend/pyproject.toml). No build step needed for the app.
RUN pip install --no-cache-dir \
    "fastapi>=0.111" "uvicorn[standard]>=0.30" "sqlmodel>=0.0.21" \
    "pydantic-settings>=2.3" "anthropic>=0.39" "apscheduler>=3.10" "httpx>=0.27"

COPY backend/app ./app

EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]

# NOTE: nudge delivery via Zero.xyz needs Node + @zeroxyz/cli in the image. It's OFF by
# default here. To enable in-cloud delivery, add:
#   RUN apt-get update && apt-get install -y --no-install-recommends nodejs npm \
#       && npm install -g @zeroxyz/cli && rm -rf /var/lib/apt/lists/*
# then set ZERO_ENABLED/ZERO_DRY_RUN and register+fund a wallet at runtime.
