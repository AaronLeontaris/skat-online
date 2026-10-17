import { useState } from "react";
import { isSoundEnabled, isSpeechEnabled, setSoundEnabled, setSpeechEnabled } from "../sound";

/** Two toggle buttons: basic sounds and voice lines. */
export function SoundToggles(): JSX.Element {
  const [soundOn, setSoundOn] = useState(isSoundEnabled);
  const [speechOn, setSpeechOn] = useState(isSpeechEnabled);

  return (
    <>
      <button
        type="button"
        className="sound-toggle"
        title={soundOn ? "Sound ausschalten" : "Sound einschalten"}
        aria-pressed={!soundOn}
        onClick={() => {
          const next = !soundOn;
          setSoundOn(next);
          setSoundEnabled(next);
        }}
      >
        {soundOn ? "🔊" : "🔇"}
      </button>
      <button
        type="button"
        className="sound-toggle"
        title={speechOn ? "Sprache ausschalten" : "Sprache einschalten"}
        aria-pressed={!speechOn}
        onClick={() => {
          const next = !speechOn;
          setSpeechOn(next);
          setSpeechEnabled(next);
        }}
      >
        {speechOn ? "🗣️" : "🙊"}
      </button>
    </>
  );
}
