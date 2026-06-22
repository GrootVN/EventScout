import { PRIMARY_INTERESTS, formatInterestLabel } from "@/data/interests";

type InterestPickerProps = {
  selected: string[];
};

export function InterestPicker({ selected }: InterestPickerProps) {
  const selectedSet = new Set(selected);

  return (
    <fieldset className="field">
      <legend>Interests</legend>
      <div className="chip-grid">
        {PRIMARY_INTERESTS.map((interest) => (
          <label key={interest} className={`chip ${selectedSet.has(interest) ? "active" : ""}`}>
            <input type="checkbox" name="interests" value={interest} defaultChecked={selectedSet.has(interest)} />
            <span>{formatInterestLabel(interest)}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
