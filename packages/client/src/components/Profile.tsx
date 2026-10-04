import { useState, type ChangeEvent, type FormEvent } from "react";
import type { User } from "@skat/shared";
import { updateProfile, uploadAvatar } from "../api";
import { Avatar } from "./Avatar";

export interface ProfileProps {
  user: User;
  token: string;
  onUserUpdated: (user: User) => void;
  onError: (message: string | null) => void;
}

/** Avatar upload (raw binary POST) and username editing (PATCH). */
export function Profile({ user, token, onUserUpdated, onError }: ProfileProps): JSX.Element {
  const [username, setUsername] = useState(user.username);
  const [busy, setBusy] = useState(false);
  // Bumping this key remounts the avatar so a re-upload of the same URL is picked up.
  const [avatarVersion, setAvatarVersion] = useState(0);

  async function onAvatarChange(event: ChangeEvent<HTMLInputElement>): Promise<void> {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setBusy(true);
    onError(null);
    try {
      const result = await uploadAvatar(token, file);
      setAvatarVersion((v) => v + 1);
      if (result && typeof result.avatarUrl === "string") {
        onUserUpdated({ ...user, avatarUrl: result.avatarUrl });
      }
    } catch (err) {
      onError(err instanceof Error ? err.message : "Profilfoto konnte nicht hochgeladen werden.");
    } finally {
      setBusy(false);
    }
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    const next = username.trim();
    if (next.length === 0) {
      onError("Benutzername darf nicht leer sein.");
      return;
    }
    setBusy(true);
    onError(null);
    try {
      const updated = await updateProfile(token, next);
      onUserUpdated(updated && updated.username ? updated : { ...user, username: next });
    } catch (err) {
      onError(err instanceof Error ? err.message : "Benutzername konnte nicht geändert werden.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="panel">
      <h2>Profil</h2>
      <div className="profile-row">
        <Avatar key={avatarVersion} username={user.username} avatarUrl={user.avatarUrl} size="large" />
        <div className="profile-fields">
          <p className="muted">{user.email}</p>
          <label className="file-label">
            Profilfoto hochladen
            <input
              type="file"
              accept="image/png,image/jpeg,image/heic"
              onChange={(e) => void onAvatarChange(e)}
              disabled={busy}
            />
          </label>
        </div>
      </div>
      <form onSubmit={(e) => void onSubmit(e)} className="profile-form">
        <label htmlFor="profile-username">Benutzername</label>
        <div className="row">
          <input
            id="profile-username"
            type="text"
            value={username}
            maxLength={40}
            onChange={(e) => setUsername(e.target.value)}
          />
          <button type="submit" disabled={busy || username.trim() === user.username}>
            Speichern
          </button>
        </div>
      </form>
    </section>
  );
}
