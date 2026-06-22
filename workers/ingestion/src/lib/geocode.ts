interface GeocodeResult {
  lat: number;
  lng: number;
}

const cache = new Map<string, GeocodeResult>();

export async function geocodeAddress(address: string): Promise<GeocodeResult | null> {
  if (cache.has(address)) {
    return cache.get(address) ?? null;
  }

  const baseUrl = process.env.GEOCODING_API_URL;
  const apiKey = process.env.GEOCODING_API_KEY;
  if (!baseUrl || !apiKey) {
    return null;
  }

  const encoded = encodeURIComponent(address);
  const url = `${baseUrl}/${encoded}.json?access_token=${apiKey}&limit=1`;

  const response = await fetch(url);
  if (!response.ok) {
    return null;
  }

  const payload = (await response.json()) as {
    features?: Array<{ center?: [number, number] }>;
  };
  const first = payload.features?.[0];
  if (!first?.center) {
    return null;
  }

  const result = { lng: first.center[0], lat: first.center[1] };
  cache.set(address, result);
  return result;
}

