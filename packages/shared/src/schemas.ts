import { z } from "zod";
import type { ClientToServer, TableSettings } from "./protocol";

const cardSchema = z.object({
  suit: z.enum(["clubs", "spades", "hearts", "diamonds"]),
  rank: z.enum(["7", "8", "9", "10", "J", "Q", "K", "A"]),
});

const gameDeclarationSchema = z.object({
  kind: z.enum(["suit", "grand", "null"]),
  suit: z.enum(["clubs", "spades", "hearts", "diamonds"]).optional(),
  hand: z.boolean(),
  ouvert: z.boolean(),
  schneiderAngesagt: z.boolean(),
  schwarzAngesagt: z.boolean(),
});

export const tableSettingsSchema: z.ZodType<TableSettings> = z.object({
  kontraRe: z.boolean(),
  bock: z.boolean(),
  ramsch: z.boolean(),
  scoringMode: z.enum(["traditional", "seegerFabian"]),
});

/** Zod schemas for validating client → server payloads. */
export const clientPayloadSchemas: { [K in keyof ClientToServer]: z.ZodType<ClientToServer[K]> } = {
  "table:create": z.object({
    name: z.string().min(1).max(60),
    settings: tableSettingsSchema,
  }),
  "table:join": z.object({
    tableId: z.string().min(1),
    seatIndex: z.number().int().min(0).max(3),
  }),
  "table:leave": z.object({}).strict(),
  "table:setSettings": z.object({ settings: tableSettingsSchema }),
  "table:ready": z.object({ ready: z.boolean() }),
  "table:start": z.object({}).strict(),
  "game:bid": z.union([
    z.object({ value: z.number().int().positive() }),
    z.object({ pass: z.literal(true) }),
  ]),
  "game:pickupSkat": z.union([
    z.object({ action: z.literal("take"), discard: z.tuple([cardSchema, cardSchema]) }),
    z.object({ action: z.literal("hand") }),
  ]),
  "game:announce": z.object({ declaration: gameDeclarationSchema }),
  "game:playCard": z.object({ card: cardSchema }),
  "game:kontra": z.object({}).strict(),
  "game:re": z.object({}).strict(),
  "chat:send": z.object({ text: z.string().min(1).max(500) }),
};

export { cardSchema, gameDeclarationSchema };
