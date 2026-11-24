// Mirrors backend/app/schemas.py.

export type Team = { id: number; name: string; captain: string; color: string; captain_photo_url: string | null };

export type PlayerStatus = "available" | "sold" | "unsold";

export type Player = {
  id: number;
  name: string;
  department: string;
  sports: string;
  photo_url: string | null;
  base_price: number;
  status: PlayerStatus;
  team_id: number | null;
};

export type Purchase = Player & { sold_price: number };

export type AuctionState = {
  player: Player | null;
  bid: number | null;
  team_id: number | null;
  min_bid: number | null;
  seconds_left: number | null;
  ms_left: number | null;
  paused: boolean;
  squad_limit: number | null; // most players a team may buy; null = no limit
  last: Player | null;
};

export type Dashboard = {
  team: Team;
  purse: number;
  spent: number;
  remaining: number;
  players: Purchase[];
};

export type Match = {
  id: number;
  sport: string;
  team_a_id: number;
  team_b_id: number;
  winner_id: number | null;
};

export type Fixture = {
  id: number;
  sport: string;
  team_a_id: number;
  team_b_id: number;
  starts_at: string; // event-local time, e.g. "2026-11-25T10:00:00"
  venue: string;
};

export type Standing = {
  rank: number;
  team_id: number;
  team: string;
  played: number;
  wins: number;
  losses: number;
  ties: number;
  points: number;
};

export type Session = { token: string; role: "admin" | "captain"; team_id: number | null };
