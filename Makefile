.PHONY: install seed api web test test-api test-web e2e lint example-pdf

install:
	cd backend && uv sync
	cd frontend && pnpm install

seed:  ## WARNING: wipes the database, then loads demo data
	cd backend && uv run python -m app.seed

api:
	cd backend && uv run uvicorn app.main:app --reload

web:
	cd frontend && pnpm dev

test: test-api test-web  ## fast suite, about 3 seconds

test-api:
	cd backend && uv run pytest

test-web:
	cd frontend && pnpm test

e2e:  ## full stack in real Chrome, about 10 seconds
	cd frontend && pnpm e2e

lint:
	cd backend && uv run ruff check .
	cd frontend && pnpm exec tsc --noEmit

example-pdf:  ## rebuild docs/example/squads-example.pdf from the demo seed
	cd backend && uv run python ../docs/example/make_avatars.py
	cd frontend && node scripts/example-pdf.ts
