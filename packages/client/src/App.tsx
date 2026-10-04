import { useState } from "react";
import { SessionProvider, useSession } from "./store";
import { Login } from "./components/Login";
import { Lobby } from "./components/Lobby";
import { Profile } from "./components/Profile";
import { Table } from "./components/Table";

type Screen = "lobby" | "profile";

function AppContent(): JSX.Element {
  const { user, token, snapshot, error, loading, setUser, setError, signOut } = useSession();
  const [screen, setScreen] = useState<Screen>("lobby");

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

      {snapshot ? (
        <Table snapshot={snapshot} onOpenProfile={openProfile} />
      ) : screen === "profile" ? (
        <div className="screen">
          <header className="topbar">
            <h1>Skat Online</h1>
            <div className="topbar-right">
              <button type="button" onClick={() => setScreen("lobby")}>
                Zurück zur Lobby
              </button>
              <button type="button" onClick={() => signOut()}>
                Abmelden
              </button>
            </div>
          </header>
          <Profile user={user} token={token} onUserUpdated={setUser} onError={setError} />
        </div>
      ) : (
        <Lobby token={token} onOpenProfile={openProfile} />
      )}
    </>
  );
}

/** Root component: session provider plus a tiny screen switch. */
export function App(): JSX.Element {
  return (
    <SessionProvider>
      <AppContent />
    </SessionProvider>
  );
}
