import { randomUUID } from "node:crypto";
import type { ChatMessage } from "@skat/shared";
import { dbOk, pool } from "./db";

export async function sendChat(
  tableId: string,
  userId: string,
  username: string,
  text: string,
): Promise<ChatMessage> {
  const msg: ChatMessage = {
    id: randomUUID(),
    tableId,
    userId,
    username,
    text,
    createdAt: new Date().toISOString(),
  };
  if (dbOk) {
    await pool
      .query(
        "INSERT INTO chat_messages (id, table_id, user_id, username, text) VALUES ($1,$2,$3,$4,$5)",
        [msg.id, tableId, userId, username, text],
      )
      .catch(() => {});
  }
  return msg;
}
