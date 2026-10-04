# Skat Online — Design & Spezifikation

## 1. Überblick

Browserbasierter, echtzeitfähiger Multiplayer-Skat für Live-Runden. 3 aktive Spieler pro Runde,
bis zu 4 Plätze pro Tisch (der Geber setzt aus und schaut zu). Server-autoritative Spiellogik:
der Client erhält niemals fremde Handkarten.

**Stack:** Node/TypeScript + Socket.IO (Server), React + Vite (Client), reine TS-Spiellogik
(`engine`), PostgreSQL + Redis (Persistenz/Presence), Docker Compose auf einer Hetzner-VPS.
**UI-Sprache:** Deutsch. **v1-UI:** bewusst einfach (Textkarten, keine Grafiken/Töne).

## 2. Regeln (implementiert)

Gespielt wird mit 32 Karten (7, 8, 9, 10, Bube, Dame, König, Ass in den Farben
Kreuz ♣, Pik ♠, Herz ♥, Karo ♦).

### 2.1 Geben
- 3 Spieler, 10 Karten je Spieler, 2 Karten verdeckt als Skat.
- Rollen: **Vorhand** (spielt aus, links vom Geber), **Mittelhand**, **Hinterhand** (Geber).
- Bei 4 Spielern setzt der Geber die Runde aus und schaut zu (nur öffentliche Informationen).

### 2.2 Reizen
- Feste Reizwert-Leiter ab 18: 18, 20, 22, 23, 24, 27, 30, 33, 35, 36, 40, 44, 45, 46, 48, 50,
  54, 55, 59, 60, 63, 66, 70, 72, 77, 80, 84, 88, 90, 96, 99, 100, 108, 110, 117, 120, 121, 132,
  144, 153, 156, 165, 168, 176, 187, 192, 198, 216, 240, 264, …
- Mittelhand reizt gegen Vorhand (sagen/halten); der Sieger reizt gegen Hinterhand.
- Höchster gehaltener Reizwert = Mindestspielwert des Alleinspielers.
- Passen alle drei → **Ramsch** (sofern aktiviert), sonst neu geben.

### 2.3 Spielarten
- **Farbspiel** (Kreuz/Pik/Herz/Karo): Trumpf = 4 Buben (♣B > ♠B > ♥B > ♦B) + gewählte Farbe,
  Reihenfolge A–10–K–D–9–8–7.
- **Grand**: nur die 4 Buben sind Trumpf.
- **Null**: kein Trumpf, Buben normale (niedrige) Karten, Alleinspieler darf keinen Stich machen.
  Varianten: Null (23), Null Hand (35), Null Ouvert (46), Null Ouvert Hand (59).

### 2.4 Kartenpunkte
Ass 11, Zehn 10, König 4, Dame 3, Bube 2, 9/8/7 = 0 → 120 gesamt.
Alleinspieler gewinnt ein Farbspiel/Grand mit **≥ 61 Augen** (Gegner spielen als Team).

### 2.5 Spielwert
- Grundwert: Karo 9, Herz 10, Pik 11, Kreuz 12, Grand 24.
- Multiplikator = 1 + Spitzen (Matadore, „mit"/„ohne" fortlaufend ab ♣B) + Schneider + Schwarz
  + Hand + angesagte Boni (Schneider angesagt, Schwarz angesagt, Ouvert).
- **Schneider** = Gegner ≤ 30 Augen (Alleinspieler ≥ 90). **Schwarz** = Gegner ohne Stich.
- Gewonnen: `+Spielwert`. Verloren: `−2 × Spielwert`. Null: feste Werte (oben), verloren `−2 × Wert`.

### 2.6 Sonderregeln (pro Tisch schaltbar)
- **Kontra/Re**: Kontra (Gegner, nach Ansage vor dem offenen Spiel) ×2; Re (Alleinspieler, nach
  Kontra) ×2 → ×4. Standardtiefe: ein Kontra + ein Re (weitere Verdopplungen ausgeschaltet).
- **Bock**: nach einem verlorenen Hand-Spiel oder einem Ramsch wird die nächste Runde zum
  Bock (alle Punktänderungen ×2); Bocks können sich stapeln (×2, ×4, …).
- **Ramsch** (einfach): bei dreimaligem Passen spielt jeder für sich, Buben sind Trumpf, Ziel sind
  die wenigsten Augen; der Skat gehört dem Gewinner des letzten Stichs; der Spieler mit den
  meisten Augen verliert.

## 3. Wertung

Zwei Modi, pro Tisch wählbar, beide server-seitig berechnet:

- **Traditionell (offiziell)**: Solo gewonnen `+Spielwert`; verloren `−2 × Spielwert`.
  Gegner erhalten keine individuelle Punktänderung (offizielle Konvention).
- **Seeger-Fabian (GameDuell-Variante)**: zusätzlich zur Turnierwertung
  - Solo gewonnen: `+Spielwert + 50`
  - Solo verloren: `−2 × Spielwert − 50`
  - Gegner: **+40** je Gegner bei Solo-Verlust.
  - Ramsch (kein Solo): Sieger (wenigste Augen) **+50**, übrige 0.

## 4. Tisch-Modell

- Maximal **4 Plätze**; nur **3 aktiv** pro Runde (Geber setzt aus).
- Tisch wird **beim Erstellen festgelegt** (kein späteres Beitreten); nicht gesetzte Plätze bleiben frei.
- Der aussetzende Spieler **schaut zu**: sieht gespielte Karten, Stiche, Reizwerte und Chat —
  **nie** verdeckte Handkarten.
- Einstellungen pro Tisch: `kontraRe`, `bock`, `ramsch`, `scoringMode` (`traditional` | `seegerFabian`).
  Nur der Host konfiguriert, vor Rundenbeginn.

## 5. Konten & Profile

- **Persistente Profile** (Benutzername + Profilfoto).
- **v1**: 4 hartcodierte Testkonten (ge-seedet via `SEED_ACCOUNTS`), Login über E-Mail + Passwort.
- **später**: Selbstregistrierung (1 Konto pro E-Mail) mit E-Mail-Verifikation.
- **Profilfoto**: Upload durch Nutzer, Formate **PNG / JPG / HEIC**; HEIC wird server-seitig nach
  JPEG konvertiert (sharp/libheif), Thumbnails werden erzeugt.

## 6. Chat

Tabellenchat (WebSocket). Nur öffentlicher Chat in v1; Nachrichten in PostgreSQL persistiert.

## 7. Architektur

```
Browser (React SPA) ⇄ WebSocket (Socket.IO-Gateway) ⇄ Game-Engine (reine Regeln/Wertung)
                              ↕
                   PostgreSQL + Redis + Avatar-Speicher
```

1. **Client** (`packages/client`): React + Vite. Einfache deutsche UI: Login, Lobby
   (Tisch erstellen/beitreten, Einstellungen), Tischansicht (Textkarten), Reizen, Spielen, Chat,
   Punktestand, Profil/Foto.
2. **Server** (`packages/server`): Socket.IO-Gateway, Auth (ge-seedete Konten, JWT), Tabellen- und
   Runden-Orchestrierung, Chat, Avatar-Upload + HEIC-Konvertierung, Persistenz.
3. **Engine** (`packages/engine`): reine, deterministische, frameworkfreie Spiellogik. Einzige
   Regelquelle. Unit-getestet. Wiederverwendbar für spätere KI-Gegner.
4. **Shared** (`packages/shared`): Client↔Server-Protokolltypen (Events, Payloads, Validierung).

### Sicherheit / Anti-Cheat
- **Server-autoritativ**: Server hält alle verdeckten Karten; Clients erhalten nur eigene Hand +
  öffentlichen Zustand. Aussetzender Spieler/Zuschauer: nur öffentlicher Zustand.
- **Aktionsvalidierung**: jeder Zug wird auf Legalität und Zugrecht geprüft; Unzulässiges wird
  verworfen.
- **Reconnect/Resync**: bei Verbindungsabbruch Resync über versionierten Zustands-Snapshot +
  append-only Event-Log.

## 8. Datenmodell (Kernentitäten)

- `User` — id, email, password_hash, username, avatar_url, created_at
- `Table` — id, host_user_id, name, status, created_at
- `TableSettings` — kontra_re, bock, ramsch, scoring_mode
- `Seat` — table_id, user_id, seat_index (0–3)
- `Round` — id, table_id, round_number, dealer_seat, active_seats[3], declarer_seat,
  game_type, bid_value, skat_cards, state
- `Trick` / `PlayedCard` — Stichreihenfolge + Gewinner
- `ScoreEntry` — round_id, seat, delta, cumulative
- `ChatMessage` — table_id, user_id, text, created_at
- `EventLog` — append-only Eventstrom je Runde (Reizen, Karten, Kontra/Re) → Resync/Replay

## 9. Echtzeit-Protokoll (Überblick)

**Client → Server:** `table:create`, `table:setSettings`, `table:join`, `table:ready`,
`table:start`, `table:leave`, `game:bid`, `game:pickupSkat`, `game:announce`, `game:playCard`,
`game:kontra`, `game:re`, `chat:send`, `profile:update*`.

**Server → Client:** `state` (Snapshot), `table:state`, `game:event` (dealt, bidMade, bidResult,
skatPicked, announced, cardPlayed, trickWon, kontra, re, roundEnd, scoreUpdate), `chat:message`,
`error`, `presence`.

Präzise Typen liegen in `packages/shared`.

## 10. Deployment (Hetzner)

- Eine Hetzner Cloud VPS (empfohlen **CX32**, 4 vCPU/8 GB; **CX22** reicht für kleine Runden).
- Docker Compose: `postgres` + `redis` + `server`; Reverse-Proxy/TLS via Caddy oder nginx+certbot.
- Avatare auf Block-Storage-Volume oder Object Storage (S3), vom Proxy ausgeliefert.
- Backups: Hetzner-Snapshots + nächtliches `pg_dump`.

## 11. Entscheidungs-Log

| Thema | Entscheidung |
|---|---|
| Regeln | Offiziell (ISkO) + schaltbare Sonderregeln Kontra/Re, Bock, Ramsch |
| Ramsch | Einfacher Ramsch (kein Schieben) |
| Seeger-Fabian | GameDuell-Variante (+50/−50/+40) auf Turnierwertung |
| Solo-Verlust (SF) | `−2 × Spielwert − 50` |
| Spielerzahl | Max 4 Plätze, 3 aktiv, Geber setzt aus |
| Beitreten | Tisch beim Erstellen festgelegt (kein späteres Beitreten) |
| Zuschauer | Aussetzender Spieler sieht nur öffentlichen Zustand |
| Profile | Persistent; v1 4 Testkonten, später Selbstregistrierung |
| Avatare | PNG/JPG/HEIC Upload, serverseitige HEIC→JPEG-Konvertierung |
| UI-Sprache | Deutsch |
| UI-Umfang v1 | Einfach; Textkarten (Wert + Farbe, farbig); Grafiken/Töne später |
| Timer | Keine Zug-Timer in v1 |
| Sub-Agents | Implementierung: deepseek-flash; Review: deepseek-v4-pro |
