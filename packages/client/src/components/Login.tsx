import { useState, type FormEvent } from "react";
import { ApiError, login as apiLogin, register as apiRegister } from "../api";
import { useSession } from "../store";

/** Email + password sign-in / sign-up against the auth API. */
export function Login(): JSX.Element {
  const { signIn } = useSession();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [registered, setRegistered] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function switchMode(next: "login" | "register"): void {
    setMode(next);
    setError(null);
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      if (mode === "login") {
        const result = await apiLogin(email.trim(), password);
        signIn(result.token, result.user);
      } else {
        const result = await apiRegister(email.trim(), password, username.trim());
        setRegistered(result.email ?? email.trim());
      }
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        setError("E-Mail oder Passwort ist falsch.");
      } else if (err instanceof ApiError && err.status === 403) {
        setError("Bitte bestätige zuerst deine E-Mail-Adresse.");
      } else if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("Anmeldung fehlgeschlagen.");
      }
    } finally {
      setBusy(false);
    }
  }

  if (registered !== null) {
    return (
      <div className="screen screen-center">
        <div className="panel login-panel verify-panel">
          <img className="login-logo" src="/logo.png" alt="Skat Online" />
          <h2 className="verify-title">Bestätige dein Konto</h2>
          <p className="ok-text">
            Wir haben eine Bestätigungs-E-Mail an <strong>{registered}</strong> gesendet.
          </p>
          <p className="muted small">
            Bitte öffne den Link in der E-Mail, um dein Konto zu aktivieren. Falls du keine E-Mail siehst, wirf auch einen
            Blick in deinen Spam-Ordner.
          </p>
          <button type="button" onClick={() => setRegistered(null)}>
            Zurück zur Anmeldung
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="screen screen-center">
      <form className="panel login-panel" onSubmit={onSubmit}>
        <img className="login-logo" src="/logo.png" alt="Skat Online" />

        <div className="login-tabs" role="tablist">
          <button
            type="button"
            className={mode === "login" ? "primary" : ""}
            onClick={() => switchMode("login")}
          >
            Anmelden
          </button>
          <button
            type="button"
            className={mode === "register" ? "primary" : ""}
            onClick={() => switchMode("register")}
          >
            Registrieren
          </button>
        </div>

        {mode === "register" ? (
          <>
            <label htmlFor="reg-username">Benutzername</label>
            <input
              id="reg-username"
              type="text"
              autoComplete="nickname"
              maxLength={30}
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
            />
          </>
        ) : null}

        <label htmlFor="login-email">E-Mail</label>
        <input
          id="login-email"
          type="email"
          autoComplete="username"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <label htmlFor="login-password">Passwort</label>
        <input
          id="login-password"
          type="password"
          autoComplete={mode === "login" ? "current-password" : "new-password"}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        {error ? (
          <p className="error-text" role="alert">
            {error}
          </p>
        ) : null}
        <button type="submit" className="primary" disabled={busy}>
          {busy ? "Bitte warten…" : mode === "login" ? "Anmelden" : "Registrieren"}
        </button>
      </form>
    </div>
  );
}
