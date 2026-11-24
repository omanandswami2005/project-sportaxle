# One image, one process (NFR-6): FastAPI serves the API, photos and the built React app.

# --- 1. Build the UI -------------------------------------------------------------------
FROM node:24-alpine AS web
RUN corepack enable
WORKDIR /src/frontend
COPY frontend/package.json frontend/pnpm-lock.yaml frontend/pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile
COPY frontend/ ./
RUN pnpm build

# --- 2. API runtime --------------------------------------------------------------------
FROM python:3.13-slim
COPY --from=ghcr.io/astral-sh/uv:latest /uv /usr/local/bin/uv
ENV UV_COMPILE_BYTECODE=1 UV_LINK_MODE=copy UV_PROJECT_ENVIRONMENT=/opt/venv \
    PATH=/opt/venv/bin:$PATH PYTHONUNBUFFERED=1
WORKDIR /app/backend
COPY backend/pyproject.toml backend/uv.lock ./
RUN uv sync --frozen --no-dev --no-install-project
COPY backend/app ./app
COPY backend/seed.example.json ./
COPY --from=web /src/frontend/dist /app/frontend/dist
RUN mkdir -p photos && useradd --system --uid 10001 app && chown -R app /app
USER app
EXPOSE 8000
HEALTHCHECK --interval=15s --timeout=3s --start-period=20s --retries=3 \
  CMD python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8000/api/teams')"
# A single worker: the auction lock is in-process (CLAUDE.md invariant 2).
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
