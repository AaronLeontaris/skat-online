import type { SoundKind } from "@skat/shared";

/** Sound ids → file paths served from /sounds (public). */
const SOUND_FILES: Record<string, string> = {
  playingOneCard: "/sounds/playingOneCard.mp3",
  shuffelingCards: "/sounds/shuffelingCards.mp3",
  hallo: "/sounds/hallo.mp3",
};

const SOUND_KEY = "skat.sound.enabled";
const SPEECH_KEY = "skat.speech.enabled";

function readBool(key: string): boolean {
  try {
    return window.localStorage.getItem(key) !== "0";
  } catch {
    return true;
  }
}

function writeBool(key: string, value: boolean): void {
  try {
    window.localStorage.setItem(key, value ? "1" : "0");
  } catch {
    // ignore
  }
}

export function isSoundEnabled(): boolean {
  return readBool(SOUND_KEY);
}

export function isSpeechEnabled(): boolean {
  return readBool(SPEECH_KEY);
}

export function setSoundEnabled(value: boolean): void {
  writeBool(SOUND_KEY, value);
}

export function setSpeechEnabled(value: boolean): void {
  writeBool(SPEECH_KEY, value);
}

/** Play a sound if its category (sound / speech) is not muted. */
export function playSound(sound: string, kind: SoundKind): void {
  if (kind === "sound" && !isSoundEnabled()) return;
  if (kind === "speech" && !isSpeechEnabled()) return;
  const url = SOUND_FILES[sound];
  if (!url) return;
  const audio = new Audio(url);
  void audio.play().catch(() => {
    // Autoplay can be blocked before the first user gesture; ignore.
  });
}
