import { useState, type FormEvent } from "react";
import type { ChatMessage } from "@skat/shared";

export interface ChatProps {
  messages: ChatMessage[];
  onSend: (text: string) => void;
  disabled?: boolean;
}

function formatTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" });
}

/** Table chat: message list plus an input. Messages come from the store. */
export function Chat({ messages, onSend, disabled }: ChatProps): JSX.Element {
  const [text, setText] = useState("");

  function submit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    const trimmed = text.trim();
    if (trimmed.length === 0) return;
    onSend(trimmed);
    setText("");
  }

  return (
    <section className="panel chat">
      <h2>Chat</h2>
      <ul className="chat-list">
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
      <form className="row chat-form" onSubmit={submit}>
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
          Nachricht senden
        </button>
      </form>
    </section>
  );
}
