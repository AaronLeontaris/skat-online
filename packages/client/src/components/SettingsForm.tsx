import type { TableSettings } from "@skat/shared";

export interface SettingsFormProps {
  value: TableSettings;
  onChange: (next: TableSettings) => void;
  disabled?: boolean;
  idPrefix: string;
}

/** Kontra/Re, Bock, Ramsch toggles plus the scoring mode radio group. */
export function SettingsForm({ value, onChange, disabled, idPrefix }: SettingsFormProps): JSX.Element {
  function toggle(key: "kontraRe" | "bock" | "ramsch"): void {
    onChange({ ...value, [key]: !value[key] });
  }

  return (
    <fieldset className="settings-form" disabled={disabled}>
      <legend>Einstellungen</legend>
      <label className="check">
        <input
          id={`${idPrefix}-kontra-re`}
          type="checkbox"
          checked={value.kontraRe}
          onChange={() => toggle("kontraRe")}
        />
        Kontra/Re
      </label>
      <label className="check">
        <input id={`${idPrefix}-bock`} type="checkbox" checked={value.bock} onChange={() => toggle("bock")} />
        Bock
      </label>
      <label className="check">
        <input
          id={`${idPrefix}-ramsch`}
          type="checkbox"
          checked={value.ramsch}
          onChange={() => toggle("ramsch")}
        />
        Ramsch
      </label>
      <div className="settings-group">
        <span className="group-label">Wertung</span>
        <label className="check">
          <input
            type="radio"
            name={`${idPrefix}-scoring`}
            checked={value.scoringMode === "traditional"}
            onChange={() => onChange({ ...value, scoringMode: "traditional" })}
          />
          Traditionell
        </label>
        <label className="check">
          <input
            type="radio"
            name={`${idPrefix}-scoring`}
            checked={value.scoringMode === "seegerFabian"}
            onChange={() => onChange({ ...value, scoringMode: "seegerFabian" })}
          />
          Seeger-Fabian
        </label>
      </div>
    </fieldset>
  );
}
