# Skat Online

Browserbasierter, echtzeitfähiger Multiplayer-Skat für Live-Runden. Node/TypeScript + Socket.IO (Server),
React (Client), reine TypeScript-Spiellogik (`engine`), PostgreSQL + Redis, Docker-Compose-Deployment auf
einer Hetzner-VPS. Server-autoritativ: Clients erhalten niemals fremde Handkarten.

## Struktur

```
packages/
├─ shared/    # Client↔Server-Protokolltypen + Zod-Validierung
├─ engine/    # Reine Skat-Spiellogik (Regeln + Wertung), unit-getestet
├─ server/    # Socket.IO-Gateway, Auth, Tabellen, Runden, Chat, Avatare, Persistenz
└─ client/    # React + Vite (einfache deutsche Oberfläche)
```

## Regeln (v1)

- 3 aktive Spieler pro Runde, bis zu 4 Plätze pro Tisch (der Geber setzt aus).
- Pro Tisch schaltbar: **Kontra/Re**, **Bock**, **Ramsch** (einfach).
- Wertung pro Tisch: **Traditionell** oder **Seeger-Fabian** (GameDuell: Solo +50/−50, Gegner +40).
- Spielarten: Farbspiel (Karo 9 / Herz 10 / Pik 11 / Kreuz 12), Grand (24), Null (23/35/46/59).
- Matadore: Buben und — bei Farbspielen — die Trumpf-Farbe (max. „mit/ohne 11“); bei Hand-Spielen zählt der Skat mit.

## Voraussetzungen

- Node.js ≥ 20, pnpm
- Docker (optional, für Postgres/Redis im Compose-Modus)

## Lokale Entwicklung

```bash
pnpm install
cp .env.example .env          # Testkonten + lokale DB-Konfiguration
docker compose up -d postgres redis   # oder eigene Instanzen
pnpm dev:server               # Socket.IO-Server auf :4000 (startet auch ohne DB im In-Memory-Modus)
pnpm dev:client               # Vite-Dev-Server auf :5173 (Proxys auf :4000)
```

Ohne Docker startet der Server im **In-Memory-Modus** (Warnung im Log) — Spielfluss, Chat und
Profile funktionieren; Benutzer/Chat werden dann nur nicht über einen Neustart hinweg persistiert.

**Testkonten** (aus `.env`, `SEED_ACCOUNTS`):

| E-Mail | Passwort | Name |
|---|---|---|
| anna@example.com | anna123 | Anna |
| ben@example.com | ben123 | Ben |
| clara@example.com | clara123 | Clara |
| david@example.com | david123 | David |

## End-to-End-Smoke-Test

Startet den Server, meldet die Testkonten an und spielt zwei komplette Runden (Ramsch + Grand-Solo):

```bash
pnpm --filter @skat/server run start &   # Server auf :4000
node packages/server/node_modules/.bin/tsx packages/client/scripts/smoke.ts
```

## Tests & Typprüfung

```bash
pnpm -r test        # Engine-Unit-Tests
pnpm -r typecheck   # Typprüfung aller Pakete
```

## Deployment auf einer Hetzner-VPS

1. VPS mit Docker + Docker Compose (empfohlen: **CX32** – 4 vCPU / 8 GB; **CX22** reicht für kleine Runden).
2. Repo hochladen, dann:

```bash
cp .env.example .env          # echte Werte eintragen, v.a. JWT_SECRET + DB-Passwörter
docker compose up -d --build
```

3. `docker-compose.yml` startet `postgres`, `redis` und `server` (Port 4000). Avatare liegen im
   Volume `uploads`.
4. Reverse-Proxy/TLS davor (z. B. Caddy oder nginx + certbot) und `CLIENT_ORIGIN` auf die
   öffentliche Domain setzen. Client-Bundle bauen (`pnpm --filter @skat/client run build`) und
   über den Proxy ausliefern.
5. Backups: Hetzner-Snapshots + nächtliches `pg_dump` (Postgres-Volume).

## Umgebungsvariablen

Siehe `.env.example`: `PORT`, `JWT_SECRET`, `CLIENT_ORIGIN`, `POSTGRES_*`, `REDIS_*`,
`UPLOAD_DIR`, `MAX_UPLOAD_MB`, `SEED_ACCOUNTS` (kommagetrennt `email:passwort:name`).

## Bekannte Vereinfachungen (v1)

- Runden-/Tischzustand liegt im Speicher (Single-Node); Benutzer + Chat in PostgreSQL.
- Keine Zug-Timer; Kontra/Re nur vor der ersten gespielten Karte; einfacher (nicht Schieber-) Ramsch;
  Bock verdoppelt die gesamte Rundendelta; Ramsch-Gleichstand wählt den niedrigsten Platz.
- Reizwert-Leiter ist die gängige 50-Werte-Liste (18–264).

Siehe `DESIGN.md` für die vollständige Spezifikation.
