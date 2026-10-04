# Skat Online

Browserbasierter, Echtzeit-Multiplayer-Skat. Node/TypeScript + Socket.IO Server, React Client,
reine TypeScript Spiellogik, PostgreSQL + Redis, Docker-Compose-Deployment auf einer Hetzner-VPS.

## Struktur

```
packages/
├─ shared/    # Client↔Server-Protokolltypen
├─ engine/    # Reine Skat-Spiellogik (Regeln + Wertung), ohne I/O
├─ server/    # Socket.IO-Gateway, Auth, Tabellen, Chat, Avatare, Persistenz
└─ client/    # React + Vite (einfache deutsche Oberfläche)
```

## Voraussetzungen

- Node.js >= 20
- pnpm

## Lokale Entwicklung

```bash
pnpm install
cp .env.example .env
docker compose up -d postgres redis   # oder eigene Postgres/Redis-Instanzen
pnpm dev:server
pnpm dev:client
```

Siehe `DESIGN.md` für die vollständige Spezifikation.
