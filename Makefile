.PHONY: install db wipe feed seed api web test test-api test-web e2e lint example-pdf up down logs \
	pull-data docker-wipe docker-feed

# Settings come from .env (copy .env.example). The app, seed, wipe and feed all use the Postgres
# container from docker-compose.yml; tests keep their own SQLite databases.
-include .env
export
DATABASE_URL ?= postgresql+psycopg://sportsaxle:$(POSTGRES_PASSWORD)@localhost:5432/sportsaxle

# The real event exports (never in git). Override in .env if the names differ.
DATA ?= data
FORM ?= form.xlsx
CAPTAINS ?= captains.zip
PLAYERS ?= players.zip

install:
	cd backend && uv sync
	cd frontend && pnpm install

db:  ## start only the Postgres container and wait until it accepts connections
	docker compose up -d --wait db

wipe: db  ## WARNING: deletes ALL data in DATABASE_URL (teams, captains, players, photos, results)
	cd backend && uv run python -m app.wipe --yes

feed: db  ## load captains + players from the raw exports into an EMPTY database; codes go to backend/captain-codes.csv
	cd backend && uv run python -m app.feed --captains "../$(DATA)/$(CAPTAINS)" \
		--form "../$(DATA)/$(FORM)" --players-zip "../$(DATA)/$(PLAYERS)" --codes "../$(DATA)/captain-codes.csv"

seed: db  ## WARNING: wipes the database, then loads demo data
	cd backend && uv run python -m app.seed

api: db
	cd backend && uv run uvicorn app.main:app --reload

web:
	cd frontend && pnpm dev

test: test-api test-web  ## fast suite, about 3 seconds

test-api:
	cd backend && env -u DATABASE_URL uv run pytest

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

up:  ## Docker: app + Postgres on http://localhost:8000 (needs .env, see .env.example)
	docker compose up -d --build

down:  ## Docker: stop (data stays in the pgdata volume; `docker compose down -v` deletes it)
	docker compose down

logs:
	docker compose logs -f app

# --- Server (EC2): the same steps inside the app image, no uv or pnpm on the host ------------

pull-data:  ## download the exports from S3_DATA (e.g. s3://bucket/sportsaxle/) into $(DATA)/
	aws s3 cp "$(S3_DATA)" "$(DATA)/" --recursive

docker-wipe:  ## WARNING: deletes ALL event data in the Postgres container
	docker compose run --rm app python -m app.wipe --yes

docker-feed:  ## load $(DATA)/ exports into the EMPTY Postgres container; codes -> $(DATA)/captain-codes.csv
	docker compose run --rm --user "$$(id -u):$$(id -g)" -v "$(abspath $(DATA)):/data" app \
		python -m app.feed --captains "/data/$(CAPTAINS)" --form "/data/$(FORM)" \
		--players-zip "/data/$(PLAYERS)" --codes /data/captain-codes.csv
