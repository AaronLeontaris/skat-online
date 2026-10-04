import type { ScoringMode } from "./types";

export interface SoloScore {
  /** Delta applied to the declarer. */
  declarerDelta: number;
  /** Delta applied to each defender (0 in traditional mode). */
  defenderDelta: number;
}

export interface SoloScoreInput {
  /** Final game value including Kontra/Re multipliers. */
  value: number;
  won: boolean;
  scoringMode: ScoringMode;
  /** Bock round multiplier (default 1; stacked Bocks multiply). */
  bockMultiplier?: number;
}

/**
 * Score a solo game (suit/Grand/Null).
 * Traditional: +value / −2×value, defenders unchanged.
 * Seeger-Fabian (GameDuell): +value+50 / −2×value−50, defenders +40 on a loss.
 * Bock multiplies the whole delta.
 */
export function scoreSolo(input: SoloScoreInput): SoloScore {
  const m = input.bockMultiplier ?? 1;
  if (input.scoringMode === "traditional") {
    return input.won
      ? { declarerDelta: input.value * m, defenderDelta: 0 }
      : { declarerDelta: -2 * input.value * m, defenderDelta: 0 };
  }
  return input.won
    ? { declarerDelta: (input.value + 50) * m, defenderDelta: 0 }
    : { declarerDelta: (-2 * input.value - 50) * m, defenderDelta: 40 * m };
}

/**
 * Score a plain Ramsch round. `points` are the three active players' card points
 * (Skat already added to the last-trick winner).
 * Traditional: most points loses −20.
 * Seeger-Fabian: fewest points wins +50.
 * Returns deltas aligned with `points` order.
 */
export function ramschDeltas(
  points: readonly [number, number, number],
  scoringMode: ScoringMode,
  bockMultiplier = 1,
): [number, number, number] {
  const m = bockMultiplier;
  const deltas: [number, number, number] = [0, 0, 0];
  if (scoringMode === "traditional") {
    let loser = 0;
    for (let i = 1; i < 3; i++) if (points[i] > points[loser]) loser = i;
    deltas[loser] = -20 * m;
    return deltas;
  }
  let winner = 0;
  for (let i = 1; i < 3; i++) if (points[i] < points[winner]) winner = i;
  deltas[winner] = 50 * m;
  return deltas;
}
