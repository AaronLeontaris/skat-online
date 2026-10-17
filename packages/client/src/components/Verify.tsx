import { useEffect, useState } from "react";
import { verifyEmail } from "../api";

/** Confirms a verification token from the email link, then points back to login. */
export function Verify({ token }: { token: string }): JSX.Element {
  const [status, setStatus] = useState<"loading" | "ok" | "error">("loading");
  const [message, setMessage] = useState("");

  useEffect(() => {
    let cancelled = false;
    verifyEmail(token)
      .then(() => {
        if (!cancelled) {
          setStatus("ok");
          setMessage("E-Mail bestätigt! Du kannst dich jetzt anmelden.");
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setStatus("error");
          setMessage(err instanceof Error ? err.message : "Bestätigung fehlgeschlagen.");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  return (
    <div className="screen screen-center">
      <div className="panel login-panel">
        <img className="login-logo" src="/logo.png" alt="Skat Online" />
        {status === "loading" ? <p className="muted">E-Mail wird bestätigt…</p> : null}
        {status === "ok" ? <p className="ok-text">{message}</p> : null}
        {status === "error" ? <p className="error-text">{message}</p> : null}
        <a className="primary verify-link" href="/">
          Zur Anmeldung
        </a>
      </div>
    </div>
  );
}
