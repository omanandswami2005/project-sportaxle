# Sports Axle — Software Requirements Specification

Version 1.2 · 18 Nov 2026

## 1. Introduction

### 1.1 Purpose

Sports Axle is the website for Data Axle India's internal sports event. It runs the live
player auction, gives each captain a private view of their squad and budget, lists every
player, and keeps the points table up to date.

### 1.2 Scope

In scope: the five feature areas in section 3, sign-in for captains and the auctioneer, and
setting up teams and players, either from a file or on the admin page.

Out of scope (see section 6): self-registration, deleting teams, per-sport scorecards,
notifications, native mobile apps.

### 1.3 Roles

| Role | Who | Signs in | Can do |
|---|---|---|---|
| Visitor | Any employee | No | View home, live auction, player list, points table |
| Captain | One per team | Team + access code | Everything a visitor can, plus bid and view their own dashboard |
| Auctioneer (admin) | Event organiser | Admin access code | Everything a visitor can, plus run the auction (pick, pause, close, undo), schedule matches, record results, and add and edit teams and players |

The source requirements name only captains. The auctioneer role is added because someone has
to put players on the block, close bidding and enter results.

### 1.4 Definitions

- **Purse**: a team's starting auction budget, in rupees (₹, virtual).
- **On the block**: the single player currently being auctioned.
- **Base price**: the lowest opening bid for a player.
- **Unsold**: a player whose bidding closed with no bids.

## 2. Assumptions

1. One event, one auction, 4–12 teams, up to about 200 players, about 150 people in the audience, at most about 50 online at once.
2. The app runs on one server inside the company network.
3. Organisers load starting data from a JSON file and add late entries on the admin page.
4. A match is between two teams and ends in a win for one side or a tie.
5. Points: win 2, tie 1, loss 0.

## 3. Functional requirements

### 3.1 Homepage and branding

| ID | Requirement |
|---|---|
| FR-1.1 | The homepage shows the name "Sports Axle" and the Sports Axle logo. |
| FR-1.2 | The homepage lists every participating team. |
| FR-1.3 | Each team shows its name, its captain's name and the captain's photo (initials when there is none). |
| FR-1.4 | The site uses a professional, sports-themed design in Data Axle's brand colours (see `design.md` section 7). |
| FR-1.5 | Each team also shows the players it has bought so far. |
| FR-1.6 | The homepage plays the Sports Axle film. It starts muted when at least half of it scrolls into view, pauses when it leaves, and offers a one-click way to turn sound on. |
| FR-1.7 | The homepage shows live figures (teams, players, players sold, matches played), the player currently on the block with a link to the auction, and a preview of the points table. |
| FR-1.8 | The homepage uses animation (logo intro, scroll reveals, moving bands) and shows all content without animation for visitors who prefer reduced motion. |
| FR-1.9 | The homepage shows the next three scheduled matches with a link to the schedule. |
| FR-1.10 | A full-screen credits page rolls slides (title, guidance, the team, the captains with photos, the sports, "the auction begins shortly") with name bands flowing past, and an optional quiet soundtrack the viewer switches on. The big screen shows it until the first player goes on the block. |

### 3.2 Live player auction

| ID | Requirement |
|---|---|
| FR-2.1 | Players are auctioned one at a time; exactly one player or none is on the block. |
| FR-2.2 | The auction page shows the on-block player's name, photograph, department, the sports they signed up for and base price. A player without a photo shows their initials. |
| FR-2.3 | The page shows the current highest bid and the leading team, updated within 2 seconds for all viewers. |
| FR-2.4 | A signed-in captain can bid the minimum next bid in one click, or enter a higher amount. |
| FR-2.5 | The first bid must be at least the base price. Each later bid must be at least the current bid plus the bid increment (default ₹100, configurable). |
| FR-2.6 | A bid is rejected if it exceeds the captain's remaining purse. |
| FR-2.7 | A captain cannot raise their own leading bid. |
| FR-2.8 | The auctioneer starts the next player: either one they choose from the players not yet sold, or by default a random draw (from players never auctioned; once none are left, from the unsold ones, which are offered again). |
| FR-2.9 | Bidding closes when the countdown reaches zero, or earlier when the auctioneer closes it. The player is sold to the leading team at the latest bid, or marked unsold when there are no bids. |
| FR-2.10 | After closing, the page shows the result of the last player (sold to which team, or unsold) until the next player starts. |
| FR-2.11 | A rejected bid shows the reason to the bidding captain only. |
| FR-2.12 | Each player on the block has a 30-second countdown (configurable). Every accepted bid restarts it at 30 seconds. All viewers see the same countdown, kept by the server. |
| FR-2.13 | A bid arriving after the countdown reached zero is rejected; the player goes to the bid that was leading. |
| FR-2.14 | The auctioneer can pause bidding: the countdown freezes and bids are rejected until they resume it, when the countdown continues from where it stopped. |
| FR-2.15 | The auctioneer can undo the last result (sold or unsold) while no player is on the block. The player goes back on the block with no bids and a fresh countdown; a buyer's purse is refunded. |
| FR-2.17 | The auctioneer sets a squad size limit (players a team may buy, not counting the captain) and can change or clear it at any time. A team at the limit cannot bid. The limit cannot be set below a squad that already exists, counting a leading bid. Everyone sees the limit. |
| FR-2.18 | A captain's bid button is disabled, with the reason, when their remaining purse is below the minimum bid or their squad is full. |
| FR-2.19 | Unsold players are never drawn again automatically: when no unseen player is left the auctioneer is told so, and offers an unsold player again by choosing them. |
| FR-2.16 | A big-screen view for the projector shows the on-block player, the bid, the leading team and captain, and the countdown in large type, then a "SOLD!" or "UNSOLD" splash with the buying team. It never shows the price of a past sale. |
| FR-2.20 | The auctioneer can reset the auction after a test run: every player becomes Available with no team or price, nothing is on the block and every purse is full again. Teams, access codes, players, photos, matches and the squad limit stay. The admin page asks them to type RESET first. |

### 3.3 Captain dashboard

| ID | Requirement |
|---|---|
| FR-3.1 | Each captain has a dashboard reachable only after signing in as that captain. |
| FR-3.2 | The dashboard lists the players the team has bought. |
| FR-3.3 | Each bought player shows its purchase price. |
| FR-3.4 | The dashboard shows total spending and remaining purse. |
| FR-3.5 | **Privacy:** purse, spending and purchase prices are returned only to the owning captain. No other captain, the auctioneer, or a visitor can retrieve them. The auctioneer sets a purse when adding a team but cannot read it back. |
| FR-3.6 | A captain sees their own remaining purse on the auction page while bidding. |

### 3.4 Player list

| ID | Requirement |
|---|---|
| FR-4.1 | Everyone, captains included, can see the complete player list. |
| FR-4.2 | Each player shows name, photograph (or initials) and department. |
| FR-4.3 | Each player is clearly marked Available, Sold or Unsold; sold players show the buying team. |
| FR-4.4 | The list can be filtered by status, with a count per status. |
| FR-4.5 | The list never shows purchase prices (follows from FR-3.5). |

### 3.5 Points table

| ID | Requirement |
|---|---|
| FR-5.1 | A dedicated page shows the points table. |
| FR-5.2 | The table lists every team, including teams that have not played. |
| FR-5.3 | Each row shows rank, matches played, wins, losses, ties and points. |
| FR-5.4 | Standings are recalculated from match results on every view; nobody edits the table by hand. |
| FR-5.5 | Teams rank by points, then wins. Teams level on both share a rank. |
| FR-5.6 | The auctioneer records a result: sport, two different teams, and the winner or a tie. |
| FR-5.7 | The auctioneer can delete a wrongly entered result; standings correct themselves. |
| FR-5.8 | The page lists recorded results. |
| FR-5.9 | The points table can also be shown for one sport (tabs: Overall plus each sport played). Sport names match case-insensitively. |
| FR-5.10 | A schedule page lists upcoming fixtures (sport, two teams, date and time, venue) by day, for everyone. |
| FR-5.11 | The auctioneer adds and deletes fixtures, and records a fixture's result in one click (team A won, team B won, tie); the fixture then leaves the schedule and counts in the points tables. The same match (sport, pair of teams, start time) cannot be scheduled twice, and a result needs at least one player in each team's squad. |

### 3.6 Sign-in and data setup

| ID | Requirement |
|---|---|
| FR-6.1 | A captain signs in by choosing their team and entering the team's access code. |
| FR-6.2 | The auctioneer signs in with the admin access code. |
| FR-6.3 | Sessions expire after 12 hours. Resetting a captain's code signs that captain out; changing `ADMIN_PIN` and redeploying signs out every auctioneer session. |
| FR-6.4 | Organisers load teams (name, captain, captain photo, colour, purse, access code) and players (name, department, sports, photo, base price) from a JSON file with one command. A player has no skills or roles, only the sports they chose. |
| FR-6.9 | A deployed server given the JSON file loads it on first start, when the database has no teams; later restarts keep the live data. |
| FR-6.10 | The auctioneer edits a team: name, captain, colour, captain photo, a new purse (write-only, never below what the team has already spent) and a new access code. Blank fields stay unchanged. |
| FR-6.11 | The auctioneer edits a player: name, department, sports, base price and photo. The base price cannot change while the player is on the block. |
| FR-6.12 | Organisers build the player list from the Microsoft Forms nomination export with one command (`python -m app.import_players`). It keeps teams and access codes, folds department spellings, drops emails, and resizes photos downloaded from the form. Photo links in the export need a company sign-in, so the files must be downloaded; players without a file show initials. |
| FR-6.5 | The auctioneer has an admin page, reachable only when signed in as the auctioneer. |
| FR-6.6 | On the admin page the auctioneer adds a team: unique name, captain, colour, purse and an access code of at least 6 characters. The new captain can sign in at once. |
| FR-6.7 | On the admin page the auctioneer adds a player: name, department, sports, base price and an optional photo (JPG, PNG or WebP, up to 2 MB). The player joins the auction pool as Available. |
| FR-6.8 | The auctioneer can remove a player who is not sold and not on the block. |
| FR-6.13 | The auctioneer sets one base price for every player not yet sold in a single step. Sold players and the player on the block keep theirs. |

### 3.7 Final squads

| ID | Requirement |
|---|---|
| FR-7.1 | A squads page lists every team with its captain and players, and the players not in a squad. It can be downloaded as a branded PDF (cover page, then one page per team in Data Axle colours with the logo), printed, or downloaded as CSV. It never shows prices. |

## 4. Non-functional requirements

| ID | Requirement |
|---|---|
| NFR-1 | Security: access codes are stored hashed. Every write and every private read is authorised on the server; hiding a button is never the only protection. |
| NFR-2 | Integrity: two bids arriving together are processed one after the other; a team can never spend more than its purse. |
| NFR-3 | Performance: pages load in under 2 seconds on office Wi-Fi; a bid is confirmed in under 500 ms. |
| NFR-4 | Usability: works on phones (360 px) and on a projector; body text meets WCAG AA contrast; animations respect reduced-motion settings. |
| NFR-5 | Maintainability: the fast test suite runs in under 5 seconds; the end-to-end test in under 30 seconds. |
| NFR-6 | Deployability: one process serves the API and the website. |

## 5. Known limitation

The live auction shows the current bid to everyone, so anyone watching continuously could add
up what each team has spent. That is inherent in an open auction. The app does not store or
serve those totals to anyone but the owning captain.

Likewise, editing a purse is refused below what the team has spent (FR-6.10), so an auctioneer
could probe a team's spending by trying purses. They already see every winning bid live, so
this reveals nothing beyond the limitation above.

## 6. Deferred (not built)

Deleting teams, bid history, net run rate or other tie-breakers, multiple events.
Each is deliberately left out until someone asks for it.

### 6.1 Pending (requested, not yet built)

- **Squad rules:** a maximum number of players per team, and a reserve so a team cannot
  spend so much that it cannot afford the rest of its squad at base prices.

## 7. Acceptance

Every requirement above with a testable outcome is covered by an automated test; the mapping
is in `design.md` section 8.
