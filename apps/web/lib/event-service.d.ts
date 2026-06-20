import { EventQuery, EventRecord, EventSourceFamily, QueryContext, TrustedSource, confidenceLabel, scoreEvent } from "@eventscout/shared";
export interface RankedEvent extends EventRecord {
    ranking: ReturnType<typeof scoreEvent>;
    confidence_label: ReturnType<typeof confidenceLabel>;
}
export declare function getRankedEvents(query: EventQuery, interests: QueryContext["interestCategories"]): Promise<RankedEvent[]>;
export declare function getEventById(id: string): Promise<RankedEvent | null>;
export declare function getFacets(query: EventQuery): Promise<import("@eventscout/shared").EventFacetResponse>;
export declare function createFeedback(input: {
    event_id: string;
    type: "not_relevant" | "duplicate" | "wrong_location";
    note?: string;
}): Promise<void>;
export declare function getFlaggedEvents(): Promise<EventRecord[]>;
export declare function getReviewQueue(): Promise<EventRecord[]>;
export declare function suppressEvent(eventId: string, note?: string): Promise<void>;
export declare function listTrustedSources(): Promise<TrustedSource[]>;
export declare function upsertTrustedSource(input: {
    source_type: "domain" | "account" | "profile_url";
    source_value: string;
    source_family: EventSourceFamily;
    notes?: string;
    active?: boolean;
}): Promise<TrustedSource>;
export declare function deactivateTrustedSource(id: string): Promise<void>;
