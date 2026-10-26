import { useEffect, useRef, useState, type FormEvent } from "react";
import type { CharacterId, ChatMessage, SoundKind } from "@skat/shared";
import { characterById } from "../characters";

export interface ChatProps {
  messages: ChatMessage[];
  onSend: (text: string) => void;
  disabled?: boolean;
  /** Collapsible mode (floating launcher + badge); otherwise a normal open panel. */
  collapsible?: boolean;
  /** Called when a voice-line button is pressed (plays the sound for the table). */
  onVoice?: (sound: string, kind: SoundKind) => void;
  /** The player's chosen character; determines which voice lines are offered. */
  character?: CharacterId | null;
}

function formatTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" });
}

/** Table chat: message list plus an input. In collapsible mode it is a floating launcher. */
export function Chat({ messages, onSend, disabled, collapsible = false, onVoice, character = null }: ChatProps): JSX.Element {
  const [open, setOpen] = useState(!collapsible);
  const [seenCount, setSeenCount] = useState(0);
  const [text, setText] = useState("");
  const listRef = useRef<HTMLUListElement>(null);
  const char = characterById(character);

  useEffect(() => {
    if (open) setSeenCount(messages.length);
  }, [messages.length, open]);

  // Always scroll to the newest message while the chat is open.
  useEffect(() => {
    if (open && listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [messages.length, open]);

  const unread = open ? 0 : Math.max(0, messages.length - seenCount);

  function submit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    const trimmed = text.trim();
    if (trimmed.length === 0) return;
    onSend(trimmed);
    setText("");
  }

  if (collapsible && !open) {
    return (
      <button type="button" className="chat-launcher" onClick={() => setOpen(true)} aria-label="Chat öffnen">
        <span aria-hidden="true">💬</span>
        {unread > 0 ? <span className="chat-badge">{unread}</span> : null}
      </button>
    );
  }

  return (
    <section className="panel chat">
      <div className="chat-header">
        <h2>Chat</h2>
        {collapsible ? (
          <button type="button" className="chat-close" onClick={() => setOpen(false)} aria-label="Chat schließen">
            ✕
          </button>
        ) : null}
      </div>
      <ul className="chat-list" ref={listRef}>
        {messages.length === 0 ? (
          <li className="muted small">Noch keine Nachrichten.</li>
        ) : (
          messages.map((message) => (
            <li key={message.id} className="chat-item">
              <span className="chat-author">{message.username}</span>
              <span className="chat-time muted small">{formatTime(message.createdAt)}</span>
              <span className="chat-text">{message.text}</span>
            </li>
          ))
        )}
      </ul>
      {onVoice ? (
        <div className="chat-voice">
          {char ? (
            char.voiceLines.map((line) => (
              <button
                key={line.id}
                type="button"
                className="voice-btn"
                disabled={disabled}
                title={line.label}
                onClick={() => {
                  onSend(line.label);
                  onVoice(line.id, "speech");
                }}
              >
                {line.label}
              </button>
            ))
          ) : (
            <span className="muted small">Wähle im Warteraum einen Charakter für Sprachausgaben.</span>
          )}
        </div>
      ) : null}
      <form className="chat-form" onSubmit={submit}>
        <input
          type="text"
          value={text}
          maxLength={500}
          placeholder="Nachricht"
          aria-label="Nachricht"
          disabled={disabled}
          onChange={(e) => setText(e.target.value)}
        />
        <button type="submit" disabled={disabled || text.trim().length === 0}>
          Senden
        </button>
      </form>
    </section>
  );
}
