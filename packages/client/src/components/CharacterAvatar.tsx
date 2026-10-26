import type { CharacterId } from "@skat/shared";
import { characterById } from "../characters";
import { initials } from "./Avatar";

export type CharacterAvatarSize = "small" | "medium" | "large";

export interface CharacterAvatarProps {
  /** Chosen character, or null if the player hasn't picked one. */
  character: CharacterId | null;
  avatarUrl: string | null;
  username: string;
  size?: CharacterAvatarSize;
}

/**
 * Character portrait with the player's own profile photo overlaid where the
 * character's face is (neck sits at ~70% from the bottom of the portrait).
 */
export function CharacterAvatar({
  character,
  avatarUrl,
  username,
  size = "small",
}: CharacterAvatarProps): JSX.Element {
  const char = characterById(character);
  if (!char) {
    return (
      <div className={`char-avatar char-avatar-${size} char-avatar-empty`} aria-hidden="true">
        {initials(username)}
      </div>
    );
  }
  return (
    <div className={`char-avatar char-avatar-${size}`}>
      <img className="char-body" src={char.image} alt={char.name} draggable={false} />
      {avatarUrl ? (
        <img className="char-face" src={avatarUrl} alt={`Profilfoto von ${username}`} draggable={false} />
      ) : (
        <div className="char-face char-face-fallback" aria-hidden="true">
          {initials(username)}
        </div>
      )}
    </div>
  );
}
