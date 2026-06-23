export type RuntimeMode = "development" | "test" | "production";

function normalizeMode(value: string | undefined): RuntimeMode {
  if (value === "production" || value === "test" || value === "development") {
    return value;
  }

  return "development";
}

export function getRuntimeMode(): RuntimeMode {
  return normalizeMode(process.env.NODE_ENV);
}

export function isProduction() {
  return getRuntimeMode() === "production";
}

export function isTest() {
  return getRuntimeMode() === "test";
}

export function isDevelopment() {
  return getRuntimeMode() === "development";
}
