export function logInfo(message: string, details?: unknown) {
  console.log(`[ingestion] ${message}`, details ?? "");
}

export function logError(message: string, details?: unknown) {
  console.error(`[ingestion] ${message}`, details ?? "");
}

