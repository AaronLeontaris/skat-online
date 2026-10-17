import { useEffect, useState } from "react";
import { SessionProvider, useSession } from "./store";
import { Login } from "./components/Login";
import { Lobby } from "./components/Lobby";
import { Profile } from "./components/Profile";
import { Splash } from "./components/Splash";
import { Table } from "./components/Table";
import { Verify } from "./components/Verify";

type Screen = "lobby" | "profile";

function getVerifyToken(): string | null {
  if (typeof window === "undefined") return null;
  return new URLSearchParams(window.location.search).get("verify");
}

function AppContent(): JSX.Element {
  const { user, token, snapshot, error, loading, setUser, setError, signOut } = useSession();
  const [screen, setScreen] = useState<Screen>("lobby");

  useEffect(() => {
    document.body.classList.toggle("deck-turnier", user?.deckType === "turnier");
  }, [user?.deckType]);

  if (!user || !token) {
    if (loading) {
      return (
        <div className="screen screen-center">
          <p className="muted">Anmeldung wird geprüft…</p>
        </div>
      );
    }
    return <Login />;
  }

  const openProfile = (): void => setScreen("profile");

  return (
    <>
      {error ? (
        <div className="toast" role="alert">
          <span>{error}</span>
          <button type="button" className="toast-close" onClick={() => setError(null)} aria-label="Schließen">
            ×
          </button>
        </div>
      ) : null}

      {screen === "profile" ? (
        <div className="screen">
          <header className="topbar">
            <img className="brand-logo" src="/logo.png" alt="Skat Online" />
            <div className="topbar-right">
              <button type="button" onClick={() => setScreen("lobby")}>
                Zurück
              </button>
              <button type="button" onClick={() => signOut()}>
                Abmelden
              </button>
            </div>
          </header>
          <Profile user={user} token={token} onUserUpdated={setUser} onError={setError} />
        </div>
      ) : snapshot ? (
        <Table snapshot={snapshot} onOpenProfile={openProfile} />
      ) : (
        <Lobby token={token} onOpenProfile={openProfile} />
      )}
    </>
  );
}

/** Root component: session provider plus a tiny screen switch. */
export function App(): JSX.Element {
  const [splash, setSplash] = useState(true);
  const verifyToken = getVerifyToken();

  useEffect(() => {
    const timer = window.setTimeout(() => setSplash(false), 2200);
    return () => window.clearTimeout(timer);
  }, []);

  if (verifyToken) {
    return <Verify token={verifyToken} />;
  }

  return (
    <>
      {splash ? <Splash /> : null}
      <SessionProvider>
        <AppContent />
      </SessionProvider>
    </>
  );
}
