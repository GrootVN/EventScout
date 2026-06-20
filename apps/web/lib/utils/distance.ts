const EARTH_RADIUS_MILES = 3958.8;

function toRadians(value: number) {
  return (value * Math.PI) / 180;
}

export function calculateDistanceMiles(
  latitudeA: number | null,
  longitudeA: number | null,
  latitudeB: number | null,
  longitudeB: number | null
) {
  if (
    latitudeA === null ||
    longitudeA === null ||
    latitudeB === null ||
    longitudeB === null
  ) {
    return null;
  }

  const dLat = toRadians(latitudeB - latitudeA);
  const dLng = toRadians(longitudeB - longitudeA);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(latitudeA)) *
      Math.cos(toRadians(latitudeB)) *
      Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return Number((EARTH_RADIUS_MILES * c).toFixed(1));
}
