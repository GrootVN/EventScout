import { CanonicalEventCandidate, EventRecord } from "./types";
export declare function normalizeCandidate(candidate: CanonicalEventCandidate, nowIso: string): Omit<EventRecord, "id">;
