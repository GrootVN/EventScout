import { CitySelector } from "@/components/onboarding/CitySelector";
import { InterestPicker } from "@/components/onboarding/InterestPicker";
import type { EventSearchState } from "@/lib/events/query";

type EventFiltersProps = {
  state: EventSearchState;
};

export function EventFilters({ state }: EventFiltersProps) {
  return (
    <form className="filters-card" method="GET">
      <div className="filters-header">
        <h2>Scout your week</h2>
        <button className="primary-button" type="submit">
          Update results
        </button>
      </div>

      <CitySelector city={state.city ?? ""} />

      <label className="field">
        <span>Date range</span>
        <select className="input" name="datePreset" defaultValue={state.datePreset}>
          <option value="tonight">Tonight</option>
          <option value="tomorrow">Tomorrow</option>
          <option value="this-weekend">This weekend</option>
          <option value="this-month">This month</option>
          <option value="custom">Custom</option>
        </select>
      </label>

      <div className="field-row">
        <label className="field">
          <span>Start</span>
          <input className="input" type="datetime-local" name="startDate" defaultValue={state.startDate?.slice(0, 16) ?? ""} />
        </label>
        <label className="field">
          <span>End</span>
          <input className="input" type="datetime-local" name="endDate" defaultValue={state.endDate?.slice(0, 16) ?? ""} />
        </label>
      </div>

      <label className="field">
        <span>Keyword</span>
        <input className="input" type="text" name="keyword" defaultValue={state.keyword ?? ""} placeholder="coffee, salsa, market" />
      </label>

      <label className="field">
        <span>Price</span>
        <select className="input" name="priceType" defaultValue={state.priceType ?? "any"}>
          <option value="any">Any price</option>
          <option value="free">Free</option>
          <option value="paid">Paid</option>
          <option value="unknown">Unknown</option>
        </select>
      </label>

      <InterestPicker selected={state.interests ?? []} />

      <fieldset className="field">
        <legend>Vibe</legend>
        <label className="checkbox-row">
          <input type="checkbox" name="soloFriendly" value="true" defaultChecked={state.soloFriendly} />
          <span>Solo-friendly</span>
        </label>
        <label className="checkbox-row">
          <input
            type="checkbox"
            name="newcomerFriendly"
            value="true"
            defaultChecked={state.newcomerFriendly}
          />
          <span>Newcomer-friendly</span>
        </label>
      </fieldset>
    </form>
  );
}
