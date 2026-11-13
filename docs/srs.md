# Sports Axle — Software Requirements Specification

Version 1.0 · 13 Nov 2026

## 1. Introduction

### 1.1 Purpose

Sports Axle is the website for Data Axle India's internal sports event. It runs the live
player auction, gives each captain a private view of their squad and budget, lists every
player, and keeps the points table up to date.

### 1.2 Scope

In scope: the five feature areas in section 3, sign-in for captains and the auctioneer, and
loading teams and players from a file before the event.

Out of scope for v1 (see section 6): self-registration, in-app editing of teams and players,
fixtures and scheduling, per-sport scorecards, notifications, native mobile apps.

### 1.3 Roles

| Role | Who | Signs in | Can do |
|---|---|---|---|
| Visitor | Any employee | No | View home, live auction, player list, points table |
| Captain | One per team | Team + access code | Everything a visitor can, plus bid and view their own dashboard |
| Auctioneer (admin) | Event organiser | Admin access code | Everything a visitor can, plus run the auction and record match results |

The source requirements name only captains. The auctioneer role is added because someone has
to put players on the block, close bidding and enter results.

### 1.4 Definitions

- **Purse**: a team's starting auction budget, in rupees (₹, virtual).
- **On the block**: the single player currently being auctioned.
- **Base price**: the lowest opening bid for a player.
- **Unsold**: a player whose bidding closed with no bids.

## 2. Assumptions

1. One event, one auction, 4–12 teams, up to about 200 players, under 300 concurrent viewers.
2. The app runs on one server inside the company network.
3. Organisers prepare team, captain, purse and player data in a JSON file before the event.
4. A match is between two teams and ends in a win for one side or a tie.
5. Points: win 2, tie 1, loss 0.

## 3. Functional requirements

### 3.1 Homepage and branding

| ID | Requirement |
|---|---|
| FR-1.1 | The homepage shows the name "Sports Axle" and the Sports Axle logo. |
| FR-1.2 | The homepage lists every participating team. |
| FR-1.3 | Each team shows its name and its captain's name. |
| FR-1.4 | The site uses a professional, sports-themed design in Data Axle's brand colours (see `design.md` section 7). |
| FR-1.5 | Each team also shows the players it has bought so far. |

### 3.2 Live player auction

| ID | Requirement |
|---|---|
| FR-2.1 | Players are auctioned one at a time; exactly one player or none is on the block. |
| FR-2.2 | The auction page shows the on-block player's name, photograph, department, details and base price. A player without a photo shows their initials. |
| FR-2.3 | The page shows the current highest bid and the leading team, updated within 2 seconds for all viewers. |
| FR-2.4 | A signed-in captain can bid the minimum next bid in one click, or enter a higher amount. |
| FR-2.5 | The first bid must be at least the base price. Each later bid must be at least the current bid plus the bid increment (default ₹100, configurable). |
| FR-2.6 | A bid is rejected if it exceeds the captain's remaining purse. |
| FR-2.7 | A captain cannot raise their own leading bid. |
| FR-2.8 | The auctioneer starts the next player. Players never auctioned come first, in list order; unsold players are then offered again. |
| FR-2.9 | The auctioneer closes bidding. The player is sold to the leading team at the current bid, or marked unsold when there are no bids. |
| FR-2.10 | After closing, the page shows the result of the last player (sold to which team, or unsold) until the next player starts. |
| FR-2.11 | A rejected bid shows the reason to the bidding captain only. |

### 3.3 Captain dashboard

| ID | Requirement |
|---|---|
| FR-3.1 | Each captain has a dashboard reachable only after signing in as that captain. |
| FR-3.2 | The dashboard lists the players the team has bought. |
| FR-3.3 | Each bought player shows its purchase price. |
| FR-3.4 | The dashboard shows total spending and remaining purse. |
| FR-3.5 | **Privacy:** purse, spending and purchase prices are returned only to the owning captain. No other captain, the auctioneer, or a visitor can retrieve them. |
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

### 3.6 Sign-in and data setup

| ID | Requirement |
|---|---|
| FR-6.1 | A captain signs in by choosing their team and entering the team's access code. |
| FR-6.2 | The auctioneer signs in with the admin access code. |
| FR-6.3 | Sessions expire after 12 hours. |
| FR-6.4 | Organisers load teams (name, captain, colour, purse, access code) and players (name, department, details, photo, base price) from a JSON file with one command. |

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

## 6. Deferred (not built)

Editing teams and players in the browser, photo upload, undoing a sale, bid history, a bid
timer, squad size limits, fixtures, net run rate or other tie-breakers, multiple events.
Each is deliberately left out until someone asks for it.

## 7. Acceptance

Every requirement above with a testable outcome is covered by an automated test; the mapping
is in `design.md` section 8.
