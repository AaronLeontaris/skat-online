import type { RoundPublicState } from "@skat/shared";

/**
 * A readable score line for a player. The server may add a `score`/`points`
 * field to `PublicPlayer`; this reads it defensively without a hard type
 * dependency so the client stays compatible with the frozen shared protocol.
 */
export function playerScore(player: object | null | undefined): number | null {
  if (!player) return null;
  const record = player as Record<string, unknown>;
  for (const key of ["score", "points", "total"]) {
    const value = record[key];
    if (typeof value === "number") return value;
  }
  return null;
}

/** Team score line of one side (declarer vs. defenders), i.e. the "Augen". */
export interface SidePoints {
  declarer: number | null;
  defenders: number | null;
}

/**
 * Augenzahl per side, when the server exposes it. Tries `trickPoints` on the
 * round first, then derives it from completed tricks (which are public).
 */
export function sidePoints(round: RoundPublicState, declarerSeat: number | null): SidePoints {
  const record = round as unknown as Record<string, unknown>;
  const direct = record["trickPoints"];
  if (direct && typeof direct === "object") {
    const rec = direct as Record<string, unknown>;
    const declarer = typeof rec["declarer"] === "number" ? (rec["declarer"] as number) : null;
    const defenders = typeof rec["defenders"] === "number" ? (rec["defenders"] as number) : null;
    if (declarer !== null || defenders !== null) return { declarer, defenders };
  }
  if (declarerSeat === null) return { declarer: null, defenders: null };
  let declarer = 0;
  let defenders = 0;
  for (const trick of round.completedTricks) {
    if (trick.winnerSeat === declarerSeat) declarer += trick.points;
    else defenders += trick.points;
  }
  return { declarer, defenders };
}
