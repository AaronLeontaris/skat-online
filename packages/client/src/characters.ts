import type { CharacterId } from "@skat/shared";

export interface VoiceLine {
  /** Sound id = mp3 file name without extension (looked up under /sounds/voice/<character>/). */
  id: string;
  /** Label shown on the chat button. */
  label: string;
}

export interface Character {
  id: CharacterId;
  name: string;
  image: string;
  voiceLines: VoiceLine[];
}

/** The playable characters (Petra / Thomas). */
export const CHARACTERS: readonly Character[] = [
  {
    id: "petra",
    name: "Petra",
    image: "/characters/petra.webp",
    voiceLines: [
      { id: "danke", label: "Danke" },
      { id: "gut_gespielt", label: "Gut gespielt" },
      { id: "hallo", label: "Hallo" },
      { id: "oh", label: "Oh" },
      { id: "schade", label: "Schade" },
      { id: "ups_tut_mir_leid", label: "Ups, tut mir leid" },
      { id: "wer_1_hat_auch_2", label: "Wer 1 hat, hat auch 2" },
    ],
  },
  {
    id: "thomas",
    name: "Thomas",
    image: "/characters/thomas.webp",
    voiceLines: [
      { id: "der_ging_ueber_die_doerfer", label: "Der ging über die Dörfer" },
      { id: "der_ist_doch_bezahlt", label: "Der ist doch bezahlt" },
      { id: "die_damen_muessen_raus", label: "Die Damen müssen raus" },
      { id: "ein_herz_hat_jeder", label: "Ein Herz hat jeder" },
      { id: "ein_gutes_pferd", label: "Ein gutes Pferd" },
      { id: "es_gibt_gute_und_schlechte", label: "Es gibt gute und schlechte" },
      { id: "fanfahre", label: "Fanfahre" },
      { id: "huzza", label: "Huzza" },
      { id: "spielfehler", label: "Spielfehler" },
      { id: "wer_nicht_wagt", label: "Wer nicht wagt" },
      { id: "zug_von_gabriel", label: "Zug von Gabriel" },
      { id: "zug_von_pascal", label: "Zug von Pascal" },
      { id: "zug_von_ron", label: "Zug von Ron" },
    ],
  },
];

export function characterById(id: CharacterId | null | undefined): Character | null {
  if (!id) return null;
  return CHARACTERS.find((c) => c.id === id) ?? null;
}
