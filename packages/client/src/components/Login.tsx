import { useState, type FormEvent } from "react";
import { ApiError, login as apiLogin } from "../api";
import { useSession } from "../store";

const SEED_HINT = "anna@example.com / anna123";

/** Email + password sign-in against `POST /api/auth/login`. */
export function Login(): JSX.Element {
  const { signIn } = useSession();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const result = await apiLogin(email.trim(), password);
      signIn(result.token, result.user);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        setError("E-Mail oder Passwort ist falsch.");
      } else if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("Anmeldung fehlgeschlagen.");
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="screen screen-center">
      <form className="panel login-panel" onSubmit={onSubmit}>
        <h1>Skat Online</h1>
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
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        {error ? <p className="error-text" role="alert">{error}</p> : null}
        <button type="submit" className="primary" disabled={busy}>
          {busy ? "Anmelden…" : "Anmelden"}
        </button>
        <p className="hint">Testkonto: {SEED_HINT}</p>
      </form>
    </div>
  );
}
