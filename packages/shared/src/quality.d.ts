import { EventRecord, ConfidenceLabel } from "./types";
export declare function isSpamLike(event: Pick<EventRecord, "title" | "description">): boolean;
export declare function isExpired(event: Pick<EventRecord, "end_time" | "start_time">, nowIso: string): boolean;
export declare function hasMandatoryFields(event: Partial<Pick<EventRecord, "title" | "start_time" | "address" | "source_url">>): boolean;
export declare function calculateConfidence(event: EventRecord): number;
export declare function confidenceLabel(confidence: number): ConfidenceLabel;
