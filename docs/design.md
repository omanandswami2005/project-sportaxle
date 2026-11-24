# Sports Axle — Design

Companion to `srs.md`. Describes how the requirements are built and why.

## 1. Architecture

```
Browser (React SPA)
   │  JSON over HTTP, polling
   ▼
FastAPI  ──►  Postgres (Docker container; SQLite for tests)
   └─ also serves the built SPA and player photos
```

One Python process, one database file. In development Vite serves the UI on port 5173 and
proxies `/api` and `/photos` to FastAPI on port 8000. In production FastAPI serves
`frontend/dist` itself.

## 2. Tech stack

| Layer | Choice | Why |
|---|---|---|
| API | FastAPI | Typed request and response models double as validation and as the privacy boundary |
| Data | SQLModel on Postgres (Docker), SQLite in tests | One model definition; Postgres row locks keep bids serialised; tests need no server |
| Auth | PyJWT bearer tokens, PBKDF2-hashed access codes (stdlib) | Stateless and two small functions |
| Python tooling | uv, ruff, pytest | Fast installs, lint and tests |
| UI | React 19, TypeScript, Vite | Standard, fast builds |
| Styling | Tailwind CSS v4 | Brand tokens live in one `@theme` block |
| Routing | react-router | A handful of pages |
| JS tooling | pnpm, Vitest, Playwright | pnpm is the project rule for the UI |

Left out on purpose: Redux or a query library (one 20-line `usePoll` hook covers it), an
ORM migration tool (the database is rebuilt from the seed file), WebSockets (see 5.1).

## 3. Repository layout

```
backend/
  app/
    config.py      settings from environment variables
    db.py          engine and session dependency
    models.py      tables: Team, Player, Auction, Fixture, Match
    schemas.py     API shapes (what each caller is allowed to see)
    security.py    PIN hashing, tokens, require_admin / require_captain
    services/      business rules, no HTTP: auction.py, standings.py
    routers/       thin HTTP layer: auth, catalog, admin, auction, matches (+ fixtures)
    seed.py        rebuild the database from JSON
    main.py        wiring, static files
  tests/           pytest, in-memory database
  seed.example.json
frontend/
  src/
    lib/           api.ts (fetch + usePoll), auth.tsx, format.ts, types.ts,
                   motion.tsx (useInView, Reveal, CountUp, Tilt)
    components/    Logo, PlayerCard (Avatar, StatusBadge), Confetti
    assets/fonts/  Bricolage Grotesque and Inter (static, Latin subset, SIL OFL) for the PDF
    lib/           also squadsPdf.ts (the PDF layout) and pdfAssets.ts (fonts and round photos)
    pages/         Home, Auction, Screen, Players, Schedule, Leaderboard, Squads,
                   Dashboard, Admin, Login
    ui.test.tsx    Vitest
  public/media/    the Sports Axle film (mp4), the credits soundtrack (m4a)
  e2e/             Playwright smoke test
docs/              srs.md, design.md, example/ (squads-example.pdf: `make example-pdf`)
SportsAxle.html    the original motion film: the visual reference
```

## 4. Data model

| Table | Columns | Notes |
|---|---|---|
| `team` | id, name, captain, captain_photo_url, color, **purse**, **pin_hash** | bold = private |
| `player` | id, name, department, sports, photo_url, base_price, status, team_id, **sold_price** | status: available, sold, unsold |
| `auction` | id (always 1), player_id, bid, team_id, last_player_id, ends_at, paused_left | the single live state row; `ends_at` is the countdown deadline (epoch seconds); `paused_left` holds the frozen seconds while paused |
| `fixture` | id, sport, team_a_id, team_b_id, starts_at, venue | a scheduled match; becomes a `match` when its result is recorded |
| `match` | id, sport, team_a_id, team_b_id, winner_id | winner null = tie |

Derived on every read and never stored: a team's spending (sum of `sold_price`), remaining
purse, and the whole points table. One source of truth means they cannot drift.

## 5. Key decisions

### 5.1 Polling, not WebSockets

The auction page fetches `GET /api/auction` once a second. With about 150 people in the audience and at most about 50 online at once, that is
under 50 small requests a second against an indexed primary-key read, well inside what one
process handles, and it meets the 2-second requirement (FR-2.3). Polling needs no connection
management or reconnect logic and is trivial to test. If the audience grows tenfold, swap
`usePoll` for a server-sent event stream; nothing else changes.

`usePoll` sends one request at a time (the next is scheduled after the answer) and drops an
answer that arrives after a `refresh()`, so a slow network never piles requests up or shows an
older bid after a newer one.

On Vercel the auction felt slow and out of sync with 3–4 captains bidding at once. Polling was not
the cause: every poll was a serverless call that could cold-start and then crossed the network to
a remote database, and overlapping polls could arrive out of order. On one EC2 instance with
Postgres beside it (`DEPLOY.md`) a poll is a local primary-key read of a few milliseconds, and 14
people polling once a second is about 14 requests a second. WebSockets would add connection and
reconnect handling without making that faster.

### 5.2 Bids are serialised by one lock

`services/auction.py` holds a single `threading.Lock` around every state change (start, bid,
close). Each change reads the state, checks the rules and commits inside the lock, so two
simultaneous bids cannot both win and a purse cannot be overdrawn (NFR-2).

On Postgres every change also locks the single `auction` row (`SELECT ... FOR UPDATE`, ignored by
SQLite), so bids stay serialised across several processes or serverless instances. The public
poll reads without a lock and only locks when a countdown has actually expired. With SQLite, still
run one uvicorn worker.

### 5.2a Bid countdown

Starting a player sets `ends_at` to now + `BID_SECONDS`; every accepted bid moves it to now +
`BID_SECONDS` again. There is no background timer: the expired player is settled, inside the
lock, by whichever request comes next. `GET /api/auction` is polled every second by every
viewer, so in practice the hammer falls within a second of zero; a bid, "Next player" or
"close" arriving first settles it too, so a late bid can never win. If the auctioneer's device dies, an expired countdown still settles on
its own at the next poll by anyone; only starting the next player needs an admin, who can sign
in on another device (there is deliberately no automatic pause: it would misfire whenever the
auctioneer's tab is in the background). The server sends `seconds_left` and `ms_left` (never a timestamp), so viewers' clocks do not
matter. The browser counts down locally from `ms_left` using `performance.now()` (`lib/countdown.ts`)
and re-anchors on every poll, bid or tab wake-up, so the second hand ticks smoothly even if a poll
is slightly late while the server remains the sole authority on when bidding closes.

### 5.2b Pause, undo and edits

- **Pause** moves the remaining time from `ends_at` into `paused_left`; **resume** moves it
  back. While paused nothing can expire and bids are refused.
- **Undo** reverses only the last result: the player becomes available, loses any team and
  price, and goes straight back on the block with a fresh countdown. Because spending is a
  sum over `sold_price`, the buyer's purse is refunded with no extra bookkeeping. One level of
  undo is enough for a mis-click; there is no history to step back through.
- **Edits** to teams and players also go through `services/auction.py` inside the lock: a
  new purse is checked against spending, and a base price cannot change on the block, so
  neither can race with a bid. The purse field is write-only, like at creation. Blank form
  fields mean "unchanged", which lets the auctioneer reset an access code alone. A replaced
  uploaded photo is deleted; seeded photos (in sub-folders) are never deleted.
- **Squad limit** is one row in `eventsetting` (a new table, so existing databases only need
  `create_all`). Changing it takes the auction lock and refuses a value below any existing squad,
  counting the player a team is leading on. `place_bid` enforces it; `AuctionOut.squad_limit` shows it.
- **Random draw.** `start_next` picks with `secrets.choice` from `available` players only, so
  unsold players never loop; the auctioneer re-offers one by choosing it. Tests replace `_pick`.

### 5.2c Schedule, per-sport tables, squads

Fixtures are a plain table ordered by `starts_at`, a naive event-local time (everyone is in
one office). Recording a fixture's result creates the `match` and deletes the fixture in one
commit, so a match is never both scheduled and played. A sport's table is the same
`standings.compute` run over that sport's matches (`?sport=`, case-insensitive), so there is
still one ranking rule. The squads page, its CSV and its PDF (`lib/squadsPdf.ts`, drawn with jsPDF, loaded only when the button is clicked) are built in the browser from the public
team and player lists: no new endpoint and no prices. The PDF has a cover, then a page per team in
Data Axle colours with the logo drawn as vector shapes. It embeds Bricolage Grotesque (headings)
and Inter (text) from `src/assets/fonts` and crops each photo to a circle on a canvas; a photo or
font that fails to load falls back to initials or Helvetica, so the download never fails.
`make example-pdf` rebuilds `docs/example/squads-example.pdf` from the demo seed and generated
placeholder portraits (never real staff data).

### 5.2d Big screen

`/screen` is a fixed full-viewport layer over the normal layout (it hides the header) sized
in `vh` units so it fills any projector. It polls `/api/auction` like the auction page.
The SOLD splash names the team, not the price: `last` is a `PlayerOut`, which has no price.

### 5.2e Credits

`/credits` and the big screen's idle state share one `CreditsShow` component, so the
projector rolls credits before the auction and switches to the live view by itself when the
first player goes on the block. Names live in `frontend/src/credits.ts`; captains come from
`/api/teams`. The soundtrack (`public/media/credits-ambient.m4a`, a 64-second seamless loop,
mastered quiet) starts only on a click, because browsers block autoplay with sound. Under
reduced motion the slides still change but without movement, and the bands stand still.

### 5.3 Privacy is enforced by response schemas

`TeamOut`, `PlayerOut` and `AuctionOut` have no purse, PIN or price fields, so FastAPI strips
them from every public response even when the route returns a full database row. Money
appears in exactly one schema, `DashboardOut`, served by one route, `GET /api/me/dashboard`,
which takes the team from the signed-in token and accepts no team parameter. A captain
therefore cannot ask for another team's data. `tests/test_privacy.py` scans every public
endpoint for private field names.

### 5.4 Photo uploads

`POST /api/players` accepts an optional image. The server checks the content type against
an allow-list (JPG, PNG, WebP), caps the size at 2 MB, and re-encodes it as WebP (at most 640 px)
under a random name, and stores the bytes in the `photo` table in the same commit as the team or
player change, so a refused edit leaves nothing behind and a read-only host (Vercel) works. The
uploaded filename is never used. `GET /photos/<path>` serves the table first, then the seeded
folder `backend/photos/` (guarded against `..`). Seeded photos are not in git: on Vercel run
`python -m app.load_photos` once against the real database to copy them into the table.

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

Wrong codes are counted in the `loginfailure` table: 10 per person (IP) per target in 5 minutes,
and 60 from everyone together, give `429` until the window passes. It is a cooldown, so nobody
can lock a captain or the auctioneer out for long, and one person's typos do not block others.
The IP is the first `X-Forwarded-For` entry only when `VERCEL` is set (otherwise the header is
the client's own claim and is ignored). Admin tokens carry an HMAC of `ADMIN_PIN` keyed by
`SECRET_KEY`: to rotate a leaked admin code, change `ADMIN_PIN` and redeploy, which signs out
every old admin session. A captain's token carries the salt of their access code, so resetting the code signs
that token out. On startup, a non-SQLite database (or Vercel) refuses the default `SECRET_KEY`
(and one under 32 characters) and the default or short `ADMIN_PIN`. Responses carry nosniff,
frame-deny and a CSP; uploads are decoded and re-encoded as WebP, with a pixel cap.

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
| PATCH | `/teams/{id}` | admin | edit a team (multipart; optional `captain_photo`, `purse`, `pin`) |
| PATCH | `/players/{id}` | admin | edit a player (multipart; optional `photo`) |
| GET | `/auction` | anyone | on-block player, bid, leading team, `min_bid`, `seconds_left`, `paused`, last result; settles an expired countdown |
| POST | `/auction/pause` | admin | freeze the countdown and bids |
| POST | `/auction/resume` | admin | continue the countdown |
| POST | `/auction/undo` | admin | put the last result's player back on the block |
| POST | `/auction/next` | admin | put a random unseen player on the block, or the chosen `{player_id}` |
| PUT | `/auction/squad-limit` | admin | `{limit}` (1-100, or null for none) |
| POST | `/auction/bid` | captain | `{amount}` |
| POST | `/auction/close` | admin | sell or mark unsold |
| GET | `/me/dashboard` | captain | own squad, prices, spent, remaining |
| GET | `/matches` | anyone | results, newest first |
| POST | `/matches` | admin | record a result |
| DELETE | `/matches/{id}` | admin | remove a wrong result |
| GET | `/standings` | anyone | computed points table; `?sport=` for one sport |
| GET | `/fixtures` | anyone | scheduled matches, soonest first |
| POST | `/fixtures` | admin | schedule a match |
| DELETE | `/fixtures/{id}` | admin | remove a fixture |
| POST | `/fixtures/{id}/result` | admin | `{winner_id or null}`: record it as a match |

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
| API | `make test-api` | ~2 s | Auction rules FR-2.5 to 2.15 and reset FR-2.20 (countdown and pause with a controllable clock), edits FR-6.10 and 6.11, fixtures and per-sport tables FR-5.9 to 5.11, roles, privacy FR-3.5 and 4.5, standings FR-5.2 to 5.7, admin setup FR-6.5 to 6.8, base price for all FR-6.13, startup seeding FR-6.9 |
| UI unit | `make test-web` | <1 s | Formatting, player card states FR-2.2, 4.2, 4.3, countdown, squads CSV FR-7.1, schedule grouping |
| End to end | `make e2e` | ~16 s | One pass through FR-1 to FR-7 in real Chrome |

How they stay fast and cheap to read:

- API tests use an in-memory SQLite database per test and call the app in-process, with
  access-code hashing cut to one PBKDF2 round (`security.PIN_ITERATIONS`; production keeps 100,000).
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
cp .env.example .env   # POSTGRES_PASSWORD, SECRET_KEY, ADMIN_PIN
make seed          # starts the Postgres container, wipes it, loads backend/seed.example.json
make api           # terminal 1
make web           # terminal 2, open http://localhost:5173
```

For the real event: copy `seed.example.json` to `backend/seed.json` (git-ignored), put real
names, purses and access codes in it, drop photos in `backend/photos/` (captains in
`backend/photos/captains/`) and reference them as `/photos/<file>` in `photo_url` or
`captain_photo_url`. Teams and players can also be added later on the admin page.

`seed.json` (access codes) and `photos/` (staff photos) are never committed, so a deploy from
git does not have them: copy both to the server yourself. Then:

```
cd frontend && pnpm build
cd backend && SEED_FILE=seed.json SECRET_KEY=<random> ADMIN_PIN=<code> \
  uv run uvicorn app.main:app --host 0.0.0.0
```

With `SEED_FILE` set, the first start fills the empty database from that file and every later
start leaves it alone, so a restart mid-auction loses nothing. To start over on purpose, run
`uv run python -m app.seed seed.json` (wipes the database).

| Variable | Default | Meaning |
|---|---|---|
| `SECRET_KEY` | dev value | signs tokens; **must** be set for the event |
| `ADMIN_PIN` | `admin-1234` | auctioneer access code; **must** be set for the event |
| `DATABASE_URL` | `sqlite:///sportsaxle.db` (the Makefile sets the Docker Postgres) | database location |
| `BID_INCREMENT` | `100` | minimum raise in rupees |
| `BID_SECONDS` | `30` | countdown per player, restarted by every bid |
| `SEED_FILE` | unset | JSON loaded on startup **only if the database has no teams** (FR-6.9) |

### Docker

The EC2 deployment (S3 for the raw exports, loading the real data, backups) is in
[`DEPLOY.md`](../DEPLOY.md).

`Dockerfile` builds the UI with pnpm, then runs one uvicorn worker (the auction lock is
in-process) that serves the API, photos and the built app. `docker-compose.yml` adds Postgres
in a container, with its data in the `pgdata` volume.

```
cp .env.example .env     # set POSTGRES_PASSWORD, SECRET_KEY, ADMIN_PIN
make up                  # http://localhost:8000
make down
```

`backend/photos/` is mounted read-only; `seed.json` is not in the image. To load it, set
`SEED_FILE=seed.json` and copy it in, or wipe and seed by hand:

```
docker compose cp backend/seed.json app:/app/backend/seed.json
docker compose exec app python -m app.seed seed.json      # wipes the database
```

Postgres listens on `127.0.0.1:5432`. The Makefile reads `.env` and points `make api`, `seed`,
`wipe` and `feed` at it (`postgresql+psycopg://sportsaxle:<password>@localhost:5432/sportsaxle`),
starting the container first (`make db`). `make test` and `make e2e` keep their own SQLite
databases.

## Caching and sound

- `/assets/*` (hashed) is `immutable` for a year; `/media/*` is cached a day with stale-while-revalidate (`vercel.json`).
- `/photos/*` is cached a day, stale-while-revalidate a week, with an ETag (304 when unchanged). Not `immutable`: `make feed` reuses photo names, so a changed photo must be picked up.
- `public/sw.js` keeps `/photos` and `/assets` on the device (cache first, refreshed in the background). It never touches `/api`, the page or `/media`.
- The big screen preloads every player and captain photo (`lib/preload.ts`) and plays synthesised cues (`lib/sound.ts`, Web Audio, nothing to download). Audio needs a click, hence the "Enable sound" button.
