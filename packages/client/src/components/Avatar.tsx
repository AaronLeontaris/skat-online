import { useState } from "react";

/** Two-letter initials used when no avatar image is available. */
export function initials(username: string): string {
  const parts = username.trim().split(/\s+/).filter((p) => p.length > 0);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return `${parts[0]![0] ?? ""}${parts[1]![0] ?? ""}`.toUpperCase();
}

export interface AvatarProps {
  username: string;
  avatarUrl: string | null;
  size?: "small" | "large";
}

/** Round avatar image with an initials fallback (no placeholder graphics in v1). */
export function Avatar({ username, avatarUrl, size = "small" }: AvatarProps): JSX.Element {
  const [failed, setFailed] = useState(false);
  const className = `avatar avatar-${size}`;
  if (avatarUrl && !failed) {
    return (
      <img
        className={className}
        src={avatarUrl}
        alt={`Profilfoto von ${username}`}
        onError={() => setFailed(true)}
      />
    );
  }
  return (
    <div className={`${className} avatar-fallback`} aria-hidden="true">
      {initials(username)}
    </div>
  );
}
