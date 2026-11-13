# Sports Axle — Design

Companion to `srs.md`. Describes how the requirements are built and why.

## 1. Architecture

```
Browser (React SPA)
   │  JSON over HTTP, polling
   ▼
FastAPI  ──►  SQLite (one file)
   └─ also serves the built SPA and player photos
```

One Python process, one database file. In development Vite serves the UI on port 5173 and
proxies `/api` and `/photos` to FastAPI on port 8000. In production FastAPI serves
`frontend/dist` itself.

## 2. Tech stack

| Layer | Choice | Why |
|---|---|---|
| API | FastAPI | Typed request and response models double as validation and as the privacy boundary |
| Data | SQLModel on SQLite | One model definition; no database server to run for a 300-person event |
| Auth | PyJWT bearer tokens, PBKDF2-hashed access codes (stdlib) | Stateless and two small functions |
| Python tooling | uv, ruff, pytest | Fast installs, lint and tests |
| UI | React 19, TypeScript, Vite | Standard, fast builds |
| Styling | Tailwind CSS v4 | Brand tokens live in one `@theme` block |
| Routing | react-router | Five pages |
| JS tooling | pnpm, Vitest, Playwright | pnpm is the project rule for the UI |

Left out on purpose: Redux or a query library (one 20-line `usePoll` hook covers it), an
ORM migration tool (the database is rebuilt from the seed file), Docker, WebSockets (see 5.1).

## 3. Repository layout

```
backend/
  app/
    config.py      settings from environment variables
    db.py          engine and session dependency
    models.py      tables: Team, Player, Auction, Match
    schemas.py     API shapes (what each caller is allowed to see)
    security.py    PIN hashing, tokens, require_admin / require_captain
    services/      business rules, no HTTP: auction.py, standings.py
    routers/       thin HTTP layer: auth, catalog, admin, auction, matches
    seed.py        rebuild the database from JSON
    main.py        wiring, static files
  tests/           pytest, in-memory database
  seed.example.json
frontend/
  src/
    lib/           api.ts (fetch + usePoll), auth.tsx, format.ts, types.ts,
                   motion.tsx (useInView, Reveal, CountUp, Tilt)
    components/    Logo, PlayerCard (Avatar, StatusBadge)
    pages/         Home, Auction, Players, Dashboard, Leaderboard, Admin, Login
    ui.test.tsx    Vitest
  public/media/    the Sports Axle film (mp4)
  e2e/             Playwright smoke test
docs/              srs.md, design.md
SportsAxle.html    the original motion film: the visual reference
```

## 4. Data model

| Table | Columns | Notes |
|---|---|---|
| `team` | id, name, captain, color, **purse**, **pin_hash** | bold = private |
| `player` | id, name, department, details, photo_url, base_price, status, team_id, **sold_price** | status: available, sold, unsold |
| `auction` | id (always 1), player_id, bid, team_id, last_player_id | the single live state row |
| `match` | id, sport, team_a_id, team_b_id, winner_id | winner null = tie |

Derived on every read and never stored: a team's spending (sum of `sold_price`), remaining
purse, and the whole points table. One source of truth means they cannot drift.

## 5. Key decisions

### 5.1 Polling, not WebSockets

The auction page fetches `GET /api/auction` once a second. With under 300 viewers that is
under 300 small requests a second against an indexed primary-key read, well inside what one
process handles, and it meets the 2-second requirement (FR-2.3). Polling needs no connection
management or reconnect logic and is trivial to test. If the audience grows tenfold, swap
`usePoll` for a server-sent event stream; nothing else changes.

### 5.2 Bids are serialised by one lock

`services/auction.py` holds a single `threading.Lock` around every state change (start, bid,
close). Each change reads the state, checks the rules and commits inside the lock, so two
simultaneous bids cannot both win and a purse cannot be overdrawn (NFR-2).

**Constraint:** this is correct only with one server process. Run uvicorn with a single
worker. Scaling out would require a database row lock instead.

### 5.3 Privacy is enforced by response schemas

`TeamOut`, `PlayerOut` and `AuctionOut` have no purse, PIN or price fields, so FastAPI strips
them from every public response even when the route returns a full database row. Money
appears in exactly one schema, `DashboardOut`, served by one route, `GET /api/me/dashboard`,
which takes the team from the signed-in token and accepts no team parameter. A captain
therefore cannot ask for another team's data. `tests/test_privacy.py` scans every public
endpoint for private field names.

### 5.4 Photo uploads

`POST /api/players` accepts an optional image. The server checks the content type against
an allow-list (JPG, PNG, WebP), caps the size at 2 MB, and saves it under a random name in
`backend/photos/`; the uploaded filename is never used. Photos are served at `/photos`.

### 5.5 Home page motion

All of it is CSS keyframes and transitions plus four small helpers in `lib/motion.tsx`
built on `IntersectionObserver`; there is no animation library. Every animated element's
base style is its final state, so with `prefers-reduced-motion` the page is simply static
and fully visible. The film autoplays muted (browsers block autoplay with sound) when half
of it is in view and pauses when it leaves.

### 5.6 Sign-in

Captains choose their team and enter its access code; the auctioneer enters the admin code
from the `ADMIN_PIN` environment variable. Codes are stored as salted PBKDF2-SHA256 hashes.
The API returns a 12-hour JWT holding the role and team id; the browser keeps it in
`localStorage` and sends it as a bearer token.

There is no login rate limiting. Use long access codes and keep the app on the internal
network.

## 6. API

All paths are under `/api`. Rule violations return `409` with a readable `detail`.

| Method | Path | Who | Purpose |
|---|---|---|---|
| POST | `/auth/login` | anyone | `{team_id or null, pin}` → token |
| GET | `/teams` | anyone | teams and captains |
| GET | `/players` | anyone | all players with status and team, no prices |
| POST | `/teams` | admin | add a team (JSON, includes purse and access code) |
| POST | `/players` | admin | add a player (multipart form, optional `photo` file) |
| DELETE | `/players/{id}` | admin | remove a player who is not sold or on the block |
| GET | `/auction` | anyone | on-block player, bid, leading team, `min_bid`, last result |
| POST | `/auction/next` | admin | put the next player on the block |
| POST | `/auction/bid` | captain | `{amount}` |
| POST | `/auction/close` | admin | sell or mark unsold |
| GET | `/me/dashboard` | captain | own squad, prices, spent, remaining |
| GET | `/matches` | anyone | results, newest first |
| POST | `/matches` | admin | record a result |
| DELETE | `/matches/{id}` | admin | remove a wrong result |
| GET | `/standings` | anyone | computed points table |

The server sends `min_bid` so the bidding rule lives in one place and the UI never
recalculates it.

## 7. Visual design

Taken from `SportsAxle.html` (the motion film) and from colours sampled on data-axle.com.

| Token | Hex | Use |
|---|---|---|
| `ink` | `#221F20` | text, dark bands, table headers (Data Axle black) |
| `brand` | `#00A0DC` | logo ball, accents, progress bars (Data Axle blue) |
| `brand-dark` | `#0077A8` | buttons and blue text: `brand` fails contrast under white text |
| `sky` | `#7FCDF1` | secondary accent |
| `mist` | `#E6F4FB` | tinted panels, avatar background |
| `fog` | `#F3F4F5` | neutral panels |
| `steel` | `#3C4456` | secondary text |

- **Logo:** Data Axle's X drawn as four arms, with a blue ball at the axle (`Logo.tsx`).
- **Type:** Bricolage Grotesque 800 for headings and numbers, system sans for body.
- **Motifs from the film:** faint 60° blue stripes behind hero areas, a tilted black ticker
  band of sports, pill buttons, a pulsing blue "live" dot, bar-fill leaderboard rows.
- **Home page:** dark hero with the logo assembling as in the film (arms fly in, ball
  drops and bounces, confetti), sports icons orbiting it, a pointer-following blue
  spotlight, count-up stats, three counter-moving bands, the film in an offset frame,
  3D-tilting team cards and a bar-race leaderboard preview.
- **Layout:** white pages, one sticky nav, max width 1152 px, single column on phones.

Tokens are defined once in `frontend/src/index.css` under `@theme`.

## 8. Testing

| Suite | Command | Time | Covers |
|---|---|---|---|
| API | `make test-api` | ~2 s | Auction rules FR-2.5 to 2.10, roles, privacy FR-3.5 and 4.5, standings FR-5.2 to 5.7, admin setup FR-6.5 to 6.8 |
| UI unit | `make test-web` | <1 s | Formatting, player card states FR-2.2, 4.2, 4.3 |
| End to end | `make e2e` | ~15 s | One pass through FR-1 to FR-6 in real Chrome |

How they stay fast and cheap to read:

- API tests use an in-memory SQLite database per test and call the app in-process.
- UI unit tests render components to a string; no browser or DOM emulation.
- The end-to-end suite is one test using the installed Chrome (nothing to download),
  against FastAPI serving the built UI from a freshly seeded throwaway database.
- Reporters are terse (`-q`, `dot`, `line`): a pass prints a few lines, a failure prints
  only the failing assertion. That keeps output small for people and for AI agents.

## 9. Principles in practice

- **DRY:** one `api()` and one `usePoll()` for all requests; one `PlayerCard` for the list,
  the dashboard and the tests; standings and spending computed, not stored; `min_bid` computed
  only on the server.
- **YAGNI:** everything in `srs.md` section 6 is absent from the code.
- **KISS:** polling, SQLite, one lock, one process.
- **SOLID:** routers handle HTTP only; services hold rules and know nothing about HTTP;
  schemas decide visibility; role guards are injected dependencies, so a route declares who
  may call it rather than checking inline.

## 10. Running it

```
make install
make seed          # wipes the database and loads backend/seed.example.json
make api           # terminal 1
make web           # terminal 2, open http://localhost:5173
```

For the real event: copy `seed.example.json` to `backend/seed.json` (git-ignored), put real
names, purses and access codes in it, drop photos in `backend/photos/` and reference them as
`/photos/<file>`. Teams and players can also be added later on the admin page. Then:

```
cd backend && uv run python -m app.seed seed.json
cd frontend && pnpm build
cd backend && SECRET_KEY=<random> ADMIN_PIN=<code> uv run uvicorn app.main:app --host 0.0.0.0
```

| Variable | Default | Meaning |
|---|---|---|
| `SECRET_KEY` | dev value | signs tokens; **must** be set for the event |
| `ADMIN_PIN` | `admin-1234` | auctioneer access code; **must** be set for the event |
| `DATABASE_URL` | `sqlite:///sportsaxle.db` | database location |
| `BID_INCREMENT` | `100` | minimum raise in rupees |
