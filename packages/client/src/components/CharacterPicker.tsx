import { useRef } from "react";
import type { CharacterId } from "@skat/shared";
import { CHARACTERS } from "../characters";
import { CharacterAvatar } from "./CharacterAvatar";

export interface CharacterPickerProps {
  value: CharacterId | null;
  avatarUrl: string | null;
  username: string;
  onChange: (id: CharacterId) => void;
  disabled?: boolean;
}

/** Swipeable Petra/Thomas selector (horizontal scroll-snap cards). */
export function CharacterPicker({
  value,
  avatarUrl,
  username,
  onChange,
  disabled = false,
}: CharacterPickerProps): JSX.Element {
  const trackRef = useRef<HTMLDivElement>(null);

  function focus(index: number): void {
    const track = trackRef.current;
    if (!track) return;
    const card = track.children[index] as HTMLElement | undefined;
    card?.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
  }

  function step(dir: -1 | 1): void {
    const current = CHARACTERS.findIndex((c) => c.id === value);
    const next = Math.min(CHARACTERS.length - 1, Math.max(0, (current < 0 ? 0 : current) + dir));
    focus(next);
    onChange(CHARACTERS[next].id);
  }

  return (
    <div className="char-picker">
      <button
        type="button"
        className="char-arrow"
        onClick={() => step(-1)}
        disabled={disabled || value === CHARACTERS[0]?.id}
        aria-label="Vorheriger Charakter"
      >
        ‹
      </button>
      <div className="char-track" ref={trackRef}>
        {CHARACTERS.map((c) => (
          <button
            type="button"
            key={c.id}
            className={`char-card${value === c.id ? " char-card-selected" : ""}`}
            onClick={() => onChange(c.id)}
            disabled={disabled}
            aria-pressed={value === c.id}
          >
            <CharacterAvatar character={c.id} avatarUrl={avatarUrl} username={username} size="large" />
            <span className="char-name">{c.name}</span>
            {value === c.id ? <span className="badge badge-ok">Gewählt</span> : null}
          </button>
        ))}
      </div>
      <button
        type="button"
        className="char-arrow"
        onClick={() => step(1)}
        disabled={disabled || value === CHARACTERS[CHARACTERS.length - 1]?.id}
        aria-label="Nächster Charakter"
      >
        ›
      </button>
    </div>
  );
}
