type CitySelectorProps = {
  city: string;
};

export function CitySelector({ city }: CitySelectorProps) {
  return (
    <label className="field">
      <span>City or neighborhood</span>
      <input className="input" type="text" name="city" defaultValue={city} placeholder="Cincinnati" />
    </label>
  );
}
