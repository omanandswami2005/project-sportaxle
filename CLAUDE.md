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
make e2e         # Playwright in installed Chrome, ~10 s — run before committing UI or API changes
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
- `frontend/src/lib/api.ts` — the only place that calls `fetch`. Use `api()` and `usePoll()`.
- `frontend/src/index.css` — brand tokens in `@theme`. Use the token classes (`bg-ink`,
  `text-brand-dark`); never hard-code hex values in components.
- `SportsAxle.html` — original motion film; the visual reference. Do not edit.

## Invariants — do not break

1. **Money is private.** `purse`, `sold_price`, spending and remaining purse leave the server
   only through `DashboardOut` on `GET /api/me/dashboard`, for the signed-in captain. Never add
   them to `TeamOut`, `PlayerOut` or `AuctionOut`. `tests/test_privacy.py` guards this; if you
   add a public endpoint, add its path to that test.
2. **Auction state changes go through `services/auction.py`**, inside its lock. The lock
   assumes one server process: never add `--workers`.
3. **Standings and spending are computed, never stored.** Do not add columns for them.
4. **Authorise on the server** with `require_admin` / `require_captain`. Hiding a button is
   not access control.
5. White text goes on `brand-dark` or `ink`, not on `brand` (fails contrast).

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
