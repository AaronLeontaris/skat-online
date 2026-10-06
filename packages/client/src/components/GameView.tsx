import { useEffect, useRef, useState } from "react";
import type { Card, GameDeclaration, GameKind, Suit } from "@skat/engine";
import { SUIT_SYMBOL, nextBidValue, sortHand } from "@skat/engine";
import type {
  ClientToServer,
  GameEvent,
  PublicPlayer,
  RoundPublicState,
  Snapshot,
} from "@skat/shared";
import { CardView, cardKey, cardLabel, sameCard } from "./CardView";
import { HandView } from "./HandView";
import { Scoreboard } from "./Scoreboard";
import { TrickView } from "./TrickView";
import { phaseLabel, cardList } from "./labels";
import { sidePoints } from "./gameHelpers";
import { useSession } from "../store";

export type Emit = <K extends keyof ClientToServer>(event: K, payload: ClientToServer[K]) => void;

export interface GameViewProps {
  snapshot: Snapshot;
  round: RoundPublicState;
  /** Live connection state; actions are disabled while offline. */
  connected: boolean;
  emit: Emit;
}

function seatLabel(seats: readonly (PublicPlayer | null)[], seatIndex: number | null): string {
  if (seatIndex === null) return "–";
  const player = seats[seatIndex];
  return player ? player.username : `Platz ${seatIndex + 1}`;
}

interface DeclarationDraft {
  kind: GameKind;
  suit: Suit | null;
  hand: boolean;
  ouvert: boolean;
  schneiderAngesagt: boolean;
  schwarzAngesagt: boolean;
}

function toDeclaration(draft: DeclarationDraft): GameDeclaration {
  const declaration: GameDeclaration = {
    kind: draft.kind,
    hand: draft.hand,
    ouvert: draft.ouvert,
    schneiderAngesagt: draft.schneiderAngesagt,
    schwarzAngesagt: draft.schwarzAngesagt,
  };
  if (draft.kind === "suit" && draft.suit) return { ...declaration, suit: draft.suit };
  return declaration;
}

function declarationLabel(declaration: GameDeclaration | null): string {
  if (!declaration) return "–";
  const base =
    declaration.kind === "suit" && declaration.suit
      ? `${SUIT_SYMBOL[declaration.suit]} ${declaration.suit === "clubs" ? "Kreuz" : declaration.suit === "spades" ? "Pik" : declaration.suit === "hearts" ? "Herz" : "Karo"}`
      : declaration.kind === "grand"
        ? "Grand"
        : "Null";
  const parts = [base];
  if (declaration.hand) parts.push("Hand");
  if (declaration.ouvert) parts.push("Ouvert");
  if (declaration.schneiderAngesagt) parts.push("Schneider angesagt");
  if (declaration.schwarzAngesagt) parts.push("Schwarz angesagt");
  return parts.join(" · ");
}

/** Human-readable line for a server game event (used by the small event log). */
function describeEvent(event: GameEvent, seats: readonly (PublicPlayer | null)[]): string {
  const name = (seat: number): string => seatLabel(seats, seat);
  switch (event.type) {
    case "deal":
      return `Gegeben – ${event.activeSeats.map((seat) => name(seat)).join(", ")}, Geber ${name(event.dealerSeat)}`;
    case "biddingStarted":
      return "Reizen begonnen";
    case "bidMade":
      return event.value === "pass" ? `${name(event.seatIndex)} passt` : `${name(event.seatIndex)} bietet ${event.value}`;
    case "declarerChosen":
      return `${name(event.seatIndex)} spielt (Reizwert ${event.bidValue})`;
    case "allPassed":
      return "Alle passen";
    case "skatPickedUp":
      return `${name(event.seatIndex)} nimmt den Skat auf`;
    case "handChosen":
      return `${name(event.seatIndex)} spielt Hand`;
    case "announced":
      return `${name(event.seatIndex)} sagt an: ${declarationLabel(event.declaration)}`;
    case "cardPlayed":
      return `${name(event.seatIndex)} spielt ${cardLabel(event.card)}`;
    case "trickWon":
      return `Stich an ${name(event.winnerSeat)} (${event.points} Punkte)`;
    case "kontra":
      return `${name(event.seatIndex)} sagt Kontra`;
    case "re":
      return `${name(event.seatIndex)} sagt Re`;
    case "roundEnd":
      return `Runde beendet: ${event.result.summary}`;
    default:
      return "";
  }
}

const MAX_LOG = 8;

/** The whole round area: status, own hand, trick, controls and scores. */
export function GameView({ snapshot, round, connected, emit }: GameViewProps): JSX.Element {
  const { self, table } = snapshot;
  const seats = table.seats;
  const { on } = useSession();
  const [log, setLog] = useState<string[]>([]);
  const seatsRef = useRef(seats);
  seatsRef.current = seats;

  // The event log is cosmetic: every piece of state above comes from snapshots.
  useEffect(() => {
    on("game:event", ({ event }) => {
      const line = describeEvent(event, seatsRef.current);
      if (!line) return;
      setLog((current) => [...current, line].slice(-MAX_LOG));
    });
  }, [on]);

  useEffect(() => {
    setLog([]);
  }, [round.roundNumber]);

  const myTurn = self.seatIndex !== null && round.currentSeat === self.seatIndex;
  const canAct = connected;
  const points = sidePoints(round, round.declarerSeat);
  const isDeclarer = self.seatIndex !== null && round.declarerSeat === self.seatIndex;
  const tricksPlayed = round.completedTricks.length;

  return (
    <div className="game-view">
      <section className="panel stats-bar">
        <dl className="status-grid">
          <div>
            <dt>Runde</dt>
            <dd>
              {round.roundNumber} · {phaseLabel(round.phase)}
            </dd>
          </div>
          <div>
            <dt>Geber</dt>
            <dd>{seatLabel(seats, round.dealerSeat)}</dd>
          </div>
          <div>
            <dt>Alleinspieler</dt>
            <dd>{round.declarerSeat === null ? "–" : seatLabel(seats, round.declarerSeat)}</dd>
          </div>
          <div>
            <dt>Ansage</dt>
            <dd>{declarationLabel(round.declaration)}</dd>
          </div>
          <div>
            <dt>Reizwert</dt>
            <dd>{round.bidValue ?? "–"}</dd>
          </div>
          <div>
            <dt>Am Zug</dt>
            <dd>
              {round.currentSeat === null ? "–" : seatLabel(seats, round.currentSeat)}
              {myTurn ? " (Du)" : ""}
            </dd>
          </div>
          {round.bockActive ? (
            <div>
              <dt>Bock</dt>
              <dd>aktiv</dd>
            </div>
          ) : null}
          {round.kontra || round.re ? (
            <div>
              <dt>Kontra/Re</dt>
              <dd>
                {round.kontra ? "Kontra" : ""}
                {round.re ? " · Re" : ""}
              </dd>
            </div>
          ) : null}
          <div>
            <dt>Augen</dt>
            <dd>
              {points.declarer === null ? "–" : `${points.declarer} : ${points.defenders ?? 0}`}
            </dd>
          </div>
        </dl>
        {round.bidding ? (
          <p className="muted small">
            Bieten: {seatLabel(seats, round.bidding.sayerSeat)} sagt gegen{" "}
            {seatLabel(seats, round.bidding.listenerSeat)} · gehalten: {round.bidding.heldValue ?? "–"}
            {round.bidding.pendingRaise !== null ? ` · Gebot: ${round.bidding.pendingRaise}` : ""}
          </p>
        ) : null}
        {round.lastResult ? (
          <p className="result-line">
            {round.lastResult.won === true ? "Gewonnen" : round.lastResult.won === false ? "Verloren" : "Ramsch"}:{" "}
            {round.lastResult.summary} (Spielwert {round.lastResult.gameValue})
          </p>
        ) : null}
        {!connected ? <p className="error-text">Verbindung unterbrochen – Neuverbindung läuft…</p> : null}
        {log.length > 0 ? (
          <ul className="event-log">
            {log.map((line, index) => (
              <li key={`${index}-${line}`} className="muted small">
                {line}
              </li>
            ))}
          </ul>
        ) : null}
      </section>

      <div className="game-main">
        <TrickView currentTrick={round.currentTrick} completedTricks={round.completedTricks} seats={seats} />

        <Controls
          round={round}
          selfSeat={self.seatIndex}
          hand={self.hand}
          seats={seats}
          disabled={!canAct}
          emit={emit}
        />

        {round.phase === "playing" && table.settings.kontraRe ? (
          <section className="panel">
            <h3>Kontra/Re</h3>
            {!round.kontra && !isDeclarer && self.seatIndex !== null && tricksPlayed === 0 ? (
              <button type="button" className="primary" disabled={!canAct} onClick={() => emit("game:kontra", {})}>
                Kontra
              </button>
            ) : null}
            {round.kontra && !round.re && isDeclarer && tricksPlayed === 0 ? (
              <button type="button" className="primary" disabled={!canAct} onClick={() => emit("game:re", {})}>
                Re
              </button>
            ) : null}
            {tricksPlayed > 0 ? <p className="muted small">Nicht mehr möglich.</p> : null}
            {!isDeclarer && round.kontra ? <p className="muted small">Kontra liegt bereits.</p> : null}
          </section>
        ) : null}

        <Scoreboard scores={round.scores} seats={seats} selfSeat={self.seatIndex} />
      </div>

      {self.seatIndex !== null && self.hand.length > 0 ? (
        <div className="hand-footer">
          <HandView
            hand={self.hand}
            legalPlays={self.legalPlays}
            ownerName={seatLabel(seats, self.seatIndex)}
            onPlay={(card) => emit("game:playCard", { card })}
          />
        </div>
      ) : null}
    </div>
  );
}

interface ControlsProps {
  round: RoundPublicState;
  selfSeat: number | null;
  hand: readonly Card[];
  seats: readonly (PublicPlayer | null)[];
  disabled: boolean;
  emit: Emit;
}

function Controls({ round, selfSeat, hand, seats, disabled, emit }: ControlsProps): JSX.Element | null {
  if (selfSeat === null) return null;
  const myTurn = round.currentSeat === selfSeat;

  if (round.phase === "bidding" && round.bidding) {
    const { sayerSeat, listenerSeat, heldValue, pendingRaise } = round.bidding;
    if (selfSeat === sayerSeat && myTurn) {
      const base = pendingRaise ?? heldValue ?? 0;
      const next = nextBidValue(base);
      return (
        <section className="panel controls">
          <h3>Bieten</h3>
          <p className="muted small">Du bist dran.</p>
          <div className="row wrap">
            {next === null ? (
              <span className="muted small">Höchstes Gebot erreicht.</span>
            ) : (
              <button type="button" className="primary" disabled={disabled} onClick={() => emit("game:bid", { value: next })}>
                {next} bieten
              </button>
            )}
            <button type="button" disabled={disabled} onClick={() => emit("game:bid", { pass: true })}>
              Passen
            </button>
          </div>
        </section>
      );
    }
    if (selfSeat === listenerSeat && myTurn) {
      const offer = pendingRaise ?? heldValue;
      return (
        <section className="panel controls">
          <h3>Bieten</h3>
          <p className="muted small">{offer === null ? "Warte auf ein Gebot." : `Gebot: ${offer}`}</p>
          <div className="row wrap">
            <button
              type="button"
              className="primary"
              disabled={disabled || offer === null}
              onClick={() => offer !== null && emit("game:bid", { value: offer })}
            >
              Halten
            </button>
            <button type="button" disabled={disabled} onClick={() => emit("game:bid", { pass: true })}>
              Passen
            </button>
          </div>
        </section>
      );
    }
    return (
      <section className="panel controls">
        <h3>Bieten</h3>
        <p className="muted small">
          {seatLabel(seats, sayerSeat)} sagt gegen {seatLabel(seats, listenerSeat)}.
        </p>
      </section>
    );
  }

  if (round.phase === "skat") {
    if (selfSeat === round.declarerSeat && myTurn) {
      return (
        <SkatControls
          key={`skat-${round.roundNumber}`}
          round={round}
          hand={hand}
          disabled={disabled}
          emit={emit}
        />
      );
    }
    return (
      <section className="panel controls">
        <h3>Skat</h3>
        <p className="muted small">Der Alleinspieler entscheidet über den Skat.</p>
      </section>
    );
  }

  if (round.phase === "announce") {
    if (selfSeat === round.declarerSeat && myTurn) {
      return <AnnounceControls key={`announce-${round.roundNumber}`} disabled={disabled} emit={emit} />;
    }
    return (
      <section className="panel controls">
        <h3>Ansagen</h3>
        <p className="muted small">Der Alleinspieler sagt sein Spiel an.</p>
      </section>
    );
  }

  if (round.phase === "playing") {
    return (
      <section className="panel controls">
        <h3>Spiel</h3>
        <p className="muted small">
          {myTurn ? "Du bist dran – wähle eine Karte." : "Warte auf den nächsten Zug."}
        </p>
      </section>
    );
  }

  if (round.phase === "scoring" || round.phase === "roundEnd") {
    return (
      <section className="panel controls">
        <h3>Wertung</h3>
        <p className="muted small">{round.lastResult ? round.lastResult.summary : "Runde beendet."}</p>
        {round.lastResult ? (
          <ul className="delta-list">
            {round.lastResult.deltas.map((delta) => (
              <li key={delta.seatIndex}>
                Platz {delta.seatIndex + 1}: {delta.delta > 0 ? `+${delta.delta}` : delta.delta}
              </li>
            ))}
          </ul>
        ) : null}
      </section>
    );
  }

  return null;
}

interface SkatControlsProps {
  round: RoundPublicState;
  hand: readonly Card[];
  disabled: boolean;
  emit: Emit;
}

function SkatControls({ round, hand, disabled, emit }: SkatControlsProps): JSX.Element {
  const [mode, setMode] = useState<"idle" | "discard">("idle");
  const [selected, setSelected] = useState<readonly Card[]>([]);
  const skat = round.skat ?? [];

  function toggle(card: Card): void {
    setSelected((current) => {
      const exists = current.some((c) => sameCard(c, card));
      if (exists) return current.filter((c) => !sameCard(c, card));
      if (current.length >= 2) return current;
      return [...current, card];
    });
  }

  function confirm(): void {
    const first = selected[0];
    const second = selected[1];
    if (!first || !second) return;
    emit("game:pickupSkat", { action: "take", discard: [first, second] });
    setMode("idle");
    setSelected([]);
  }

  const selectionCount = selected.length;

  if (mode === "idle") {
    return (
      <section className="panel controls">
        <h3>Skat aufnehmen</h3>
        <div className="row wrap">
          <button type="button" className="primary" disabled={disabled} onClick={() => setMode("discard")}>
            Skat aufnehmen
          </button>
          <button type="button" disabled={disabled} onClick={() => emit("game:pickupSkat", { action: "hand" })}>
            Hand spielen
          </button>
        </div>
        <p className="muted small">
          Beim Aufnehmen kommen die zwei Skat-Karten zur Hand; danach zwei Karten ablegen.
        </p>
      </section>
    );
  }

  const discardPool = sortHand([
    ...hand,
    ...skat.filter((card) => !hand.some((held) => sameCard(held, card))),
  ]);

  return (
    <section className="panel controls">
      <h3>Ablegen</h3>
      <p className="muted small">
        Wähle zwei Karten zum Ablegen ({selectionCount}/2).
        {skat.length > 0 ? ` Skat: ${cardList(skat)}` : ""}
      </p>
      <div className="hand">
        {discardPool.map((card) => (
          <CardView
            key={cardKey(card)}
            card={card}
            selected={selected.some((c) => sameCard(c, card))}
            onClick={toggle}
          />
        ))}
      </div>
      <div className="row">
        <button type="button" className="primary" disabled={disabled || selectionCount !== 2} onClick={confirm}>
          Ablegen
        </button>
        <button
          type="button"
          onClick={() => {
            setMode("idle");
            setSelected([]);
          }}
        >
          Abbrechen
        </button>
      </div>
    </section>
  );
}

interface AnnounceControlsProps {
  disabled: boolean;
  emit: Emit;
}

function AnnounceControls({ disabled, emit }: AnnounceControlsProps): JSX.Element {
  const [draft, setDraft] = useState<DeclarationDraft>({
    kind: "suit",
    suit: null,
    hand: false,
    ouvert: false,
    schneiderAngesagt: false,
    schwarzAngesagt: false,
  });

  const suits: { suit: Suit; label: string }[] = [
    { suit: "clubs", label: "Kreuz" },
    { suit: "spades", label: "Pik" },
    { suit: "hearts", label: "Herz" },
    { suit: "diamonds", label: "Karo" },
  ];

  function chooseSuit(suit: Suit): void {
    setDraft((d) => ({ ...d, kind: "suit", suit }));
  }

  function chooseKind(kind: GameKind): void {
    setDraft((d) => ({ ...d, kind, suit: kind === "suit" ? d.suit : null }));
  }

  function toggleFlag(key: "ouvert" | "schneiderAngesagt" | "schwarzAngesagt"): void {
    setDraft((d) => ({ ...d, [key]: !d[key] }));
  }

  const canAnnounce = draft.kind !== "suit" || draft.suit !== null;

  return (
    <section className="panel controls">
      <h3>Ansagen</h3>
      <div className="row wrap">
        {suits.map(({ suit, label }) => (
          <button
            key={suit}
            type="button"
            className={draft.kind === "suit" && draft.suit === suit ? "primary" : undefined}
            disabled={disabled}
            onClick={() => chooseSuit(suit)}
          >
            {label} {SUIT_SYMBOL[suit]}
          </button>
        ))}
        <button
          type="button"
          className={draft.kind === "grand" ? "primary" : undefined}
          disabled={disabled}
          onClick={() => chooseKind("grand")}
        >
          Grand
        </button>
        <button
          type="button"
          className={draft.kind === "null" ? "primary" : undefined}
          disabled={disabled}
          onClick={() => chooseKind("null")}
        >
          Null
        </button>
      </div>

      <div className="row wrap">
        <label className="check">
          <input
            type="checkbox"
            checked={draft.hand}
            disabled={disabled}
            onChange={() => setDraft((d) => ({ ...d, hand: !d.hand }))}
          />
          Hand spielen
        </label>
        <label className="check">
          <input
            type="checkbox"
            checked={draft.ouvert}
            disabled={disabled || !draft.hand}
            onChange={() => toggleFlag("ouvert")}
          />
          Ouvert
        </label>
        <label className="check">
          <input
            type="checkbox"
            checked={draft.schneiderAngesagt}
            disabled={disabled || !draft.hand}
            onChange={() => toggleFlag("schneiderAngesagt")}
          />
          Schneider angesagt
        </label>
        <label className="check">
          <input
            type="checkbox"
            checked={draft.schwarzAngesagt}
            disabled={disabled || !draft.hand}
            onChange={() => toggleFlag("schwarzAngesagt")}
          />
          Schwarz angesagt
        </label>
      </div>

      <div className="row">
        <button
          type="button"
          className="primary"
          disabled={disabled || !canAnnounce}
          onClick={() => emit("game:announce", { declaration: toDeclaration(draft) })}
        >
          Ansagen
        </button>
        <span className="muted small">{declarationLabel(toDeclaration(draft))}</span>
      </div>
    </section>
  );
}
