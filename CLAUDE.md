# Sports Axle

Website for Data Axle India's internal sports event: live player auction, private captain
dashboards, player list, points table. Requirements are in `docs/srs.md`, design decisions in
`docs/design.md`. Read both before changing behaviour, and update them in the same commit.

## Commands

```
make install     # uv sync + pnpm install
make seed        # WIPES the database, loads demo data
make api         # FastAPI on :8000
make web         # Vite on :5173 (proxies /api)
make test        # pytest + vitest, ~3 s — run after every change
make e2e         # Playwright in installed Chrome, ~15 s — run before committing UI or API changes
make lint        # ruff + tsc
```

Single test: `cd backend && uv run pytest tests/test_auction.py -k bid_rules`.

## Tooling rules

- Backend: **uv** only (`uv add`, `uv run`). Never pip.
- Frontend: **pnpm** only (`pnpm add`, `pnpm exec`). Never npm, npx or yarn.

## Layout

- `backend/app/routers/` — HTTP only. No business rules here.
- `backend/app/services/` — rules (`auction.py`, `standings.py`). No FastAPI imports here.
- `backend/app/schemas.py` — what each caller may see.
- `backend/app/routers/admin.py` — auctioneer-only setup (add/edit team, add/edit/remove player, photo upload).
- `backend/app/load_photos.py` — copies seeded `backend/photos/` into the database (read-only hosts).
- `docs/example/` — `make example-pdf` rebuilds the sample squads PDF (demo data only).
- `backend/app/import_players.py` — builds `seed.json` players from the Forms export (photos must be downloaded first).
- `backend/app/routers/matches.py` — results, fixtures (schedule) and points tables (overall or `?sport=`).
- `frontend/src/lib/api.ts` — the only place that calls `fetch`. Use `api()` and `usePoll()`.
- `frontend/src/lib/motion.tsx` — scroll and pointer animation helpers. No animation library.
- `frontend/public/media/` — the Sports Axle film shown on the home page.
- `frontend/src/index.css` — brand tokens in `@theme`. Use the token classes (`bg-ink`,
  `text-brand-dark`); never hard-code hex values in components.
- `SportsAxle.html` — original motion film; the visual reference. Do not edit.

## Invariants — do not break

1. **Money is private.** `purse`, `sold_price`, spending and remaining purse leave the server
   only through `DashboardOut` on `GET /api/me/dashboard`, for the signed-in captain. Never add
   them to `TeamOut`, `PlayerOut` or `AuctionOut`. `tests/test_privacy.py` guards this; if you
   add a public endpoint, add its path to that test.
2. **Auction state changes go through `services/auction.py`**, inside its lock and after
   `get_state()` (which row-locks on Postgres). With SQLite, never add `--workers`.
3. **Standings and spending are computed, never stored.** Do not add columns for them.
4. **Authorise on the server** with `require_admin` / `require_captain`. Hiding a button is
   not access control.
5. White text goes on `brand-dark` or `ink`, not on `brand` (fails contrast).
6. **Animated elements' base style is their final state**, so the page is complete with
   animations off. Never hide content behind an animation that reduced motion disables.
7. **Uploads:** keep the type allow-list, size cap, decode-and-re-encode and random name in
   `admin.py`. Photos live in the `photo` table, not on disk (Vercel's disk is read-only).

## Principles

DRY, YAGNI, KISS, SOLID. Features listed under "Deferred" in `docs/srs.md` are left out on
purpose: do not build them unless asked. Prefer deleting code to adding options.

## Testing conventions

- Every new rule gets a pytest test; every new public endpoint gets added to the privacy test.
- UI unit tests render with `renderToStaticMarkup` (no jsdom). Put interaction coverage in
  the single Playwright flow rather than adding more browser tests.
- Keep reporters terse (`-q`, `dot`, `line`).
- pytest prints one known `httpx` deprecation warning from Starlette's test client. Ignore it.

## Git

Small commits, conventional prefixes (`feat:`, `fix:`, `docs:`, `test:`, `chore:`).
Never commit `backend/seed.json`, `backend/photos/*`, `.env` or `*.db`.
