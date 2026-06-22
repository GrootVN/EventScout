import { EventFacetResponse, EventQuery, EventRecord, EventSourceFamily, TrustedSource } from "@eventscout/shared";
export interface EventRepository {
    getEvents(query: EventQuery): Promise<EventRecord[]>;
    getEventById(id: string): Promise<EventRecord | null>;
    getFacets(query: EventQuery): Promise<EventFacetResponse>;
    getFlaggedEvents(): Promise<EventRecord[]>;
    getReviewQueue(): Promise<EventRecord[]>;
    createFeedback(input: {
        event_id: string;
        type: "not_relevant" | "duplicate" | "wrong_location";
        note?: string;
    }): Promise<void>;
    suppressEvent(eventId: string, note?: string): Promise<void>;
    listTrustedSources(): Promise<TrustedSource[]>;
    upsertTrustedSource(input: {
        source_type: "domain" | "account" | "profile_url";
        source_value: string;
        source_family: EventSourceFamily;
        notes?: string;
        active?: boolean;
    }): Promise<TrustedSource>;
    deactivateTrustedSource(id: string): Promise<void>;
}
export declare function getEventRepository(): EventRepository;
