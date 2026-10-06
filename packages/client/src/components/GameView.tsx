import { useState } from "react";
import type { Card, GameDeclaration, GameKind, Suit } from "@skat/engine";
import { SUIT_SYMBOL, nextBidValue, sortHand } from "@skat/engine";
import type {
  ClientToServer,
  PublicPlayer,
  RoundPublicState,
  Snapshot,
} from "@skat/shared";
import { CardView, cardKey, sameCard } from "./CardView";
import { HandView } from "./HandView";
import { Scoreboard } from "./Scoreboard";
import { TrickView } from "./TrickView";
import { cardList } from "./labels";
import { declarationLabel, remainingCards, seatLabel } from "./gameHelpers";

export type Emit = <K extends keyof ClientToServer>(event: K, payload: ClientToServer[K]) => void;

export interface GameViewProps {
  snapshot: Snapshot;
  round: RoundPublicState;
  /** Live connection state; actions are disabled while offline. */
  connected: boolean;
  emit: Emit;
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

/** The whole round area: opponents left/right, the current trick centered, controls, scores, own hand. */
/** One opponent at the side of the table, showing only their card count. */
function Opponent({
  name,
  cardCount,
  active,
}: {
  name: string;
  cardCount: number;
  active: boolean;
}): JSX.Element {
  return (
    <div className={`opponent${active ? " opponent-active" : ""}`}>
      <span className="opponent-name">{name}</span>
      <div className="card-backs">
        {Array.from({ length: cardCount }, (_, i) => (
          <span key={i} className="card-back" aria-hidden="true" />
        ))}
      </div>
      <span className="muted small">{cardCount} Karten</span>
    </div>
  );
}

export function GameView({ snapshot, round, connected, emit }: GameViewProps): JSX.Element {
  const { self, table } = snapshot;
  const seats = table.seats;

  const canAct = connected;
  const isDeclarer = self.seatIndex !== null && round.declarerSeat === self.seatIndex;
  const tricksPlayed = round.completedTricks.length;

  const opponents =
    self.seatIndex !== null ? round.activeSeats.filter((s) => s !== self.seatIndex) : round.activeSeats;

  return (
    <div className="game-view">
      <div className="game-table">
        <div className="opponents opponents-left">
          {opponents.length > 0 ? (
            <Opponent
              name={seatLabel(seats, opponents[0])}
              cardCount={remainingCards(round, opponents[0])}
              active={round.currentSeat === opponents[0]}
            />
          ) : null}
        </div>

        <div className="game-center">
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

        <div className="opponents opponents-right">
          {opponents.length > 1 ? (
            <Opponent
              name={seatLabel(seats, opponents[1])}
              cardCount={remainingCards(round, opponents[1])}
              active={round.currentSeat === opponents[1]}
            />
          ) : null}
        </div>
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
