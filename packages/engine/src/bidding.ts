/**
 * The official bid ladder. Beyond the listed values bidding is essentially never
 * required in practice; `nextBidValue` returns null at the top of the ladder.
 */
export const BID_LADDER: readonly number[] = [
  18, 20, 22, 23, 24, 27, 30, 33, 35, 36, 40, 44, 45, 46, 48, 50, 54, 55, 59, 60,
  63, 66, 70, 72, 77, 80, 84, 88, 90, 96, 99, 100, 108, 110, 117, 120, 121, 132,
  144, 153, 156, 165, 168, 176, 187, 192, 198, 216, 240, 264,
];

export const MIN_BID = 18;

export function isValidBidValue(value: number): boolean {
  return BID_LADDER.includes(value);
}

/** Next value strictly greater than `value`, or null if none. */
export function nextBidValue(value: number): number | null {
  for (const v of BID_LADDER) {
    if (v > value) return v;
  }
  return null;
}

/** Whether `next` is a legal bid immediately following `current` on the ladder. */
export function isNextBidValue(current: number | null, next: number): boolean {
  return nextBidValue(current ?? 0) === next;
}
