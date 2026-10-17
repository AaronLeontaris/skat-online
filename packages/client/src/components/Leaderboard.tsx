import type { LeaderboardEntry } from "@skat/shared";
import { Avatar } from "./Avatar";

export type LeaderSortMode = "traditional" | "seegerFabian";

function formatAvg(value: number | null): string {
  if (value === null) return "–";
  const rounded = value.toFixed(1);
  return value > 0 ? `+${rounded}` : rounded;
}

export function Leaderboard({
  entries,
  sortMode,
}: {
  entries: LeaderboardEntry[];
  sortMode: LeaderSortMode;
}): JSX.Element {
  const sorted = [...entries].sort((a, b) => {
    const av = sortMode === "traditional" ? a.traditionalAvg : a.seegerAvg;
    const bv = sortMode === "traditional" ? b.traditionalAvg : b.seegerAvg;
    if (av === null && bv === null) return a.username.localeCompare(b.username);
    if (av === null) return 1;
    if (bv === null) return -1;
    return bv - av;
  });

  if (sorted.length === 0) {
    return <p className="muted">Noch keine Spieler.</p>;
  }

  return (
    <ol className="leaderboard-list">
      {sorted.map((entry, i) => {
        const avg = sortMode === "traditional" ? entry.traditionalAvg : entry.seegerAvg;
        return (
          <li key={entry.userId} className="leaderboard-row">
            <span className="leaderboard-rank">{i + 1}</span>
            <Avatar username={entry.username} avatarUrl={entry.avatarUrl} size="small" />
            <span className="leaderboard-name">{entry.username}</span>
            <span className="leaderboard-games muted small">{entry.gamesPlayed} Spiele</span>
            <span className="leaderboard-avg">{formatAvg(avg)}</span>
          </li>
        );
      })}
    </ol>
  );
}
