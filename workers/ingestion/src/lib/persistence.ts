import { Pool } from "pg";
import {
  EventCandidate,
  EventRecord,
  SourceRawRecord,
  TrustedSource
} from "@eventscout/shared";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

const EVENT_COLUMNS = `
  id,
  title,
  description,
  start_time,
  end_time,
  timezone,
  venue_name,
  address,
  ST_Y(location::geometry) AS lat,
  ST_X(location::geometry) AS lng,
  city,
  region,
  categories,
  price_type,
  source,
  source_family,
  source_url,
  source_event_id,
  engagement_signals,
  confidence_score,
  publish_state,
  verification_count,
  verified_by_trusted_source,
  verification_reasons,
  ingested_at,
  last_seen_at,
  duplicate_of_event_id,
  provenance_source_ids
`;

export async function findPotentialDuplicates(
  event: Pick<EventRecord, "title" | "start_time" | "lat" | "lng">
): Promise<EventRecord[]> {
  const result = await pool.query(
    `
    SELECT ${EVENT_COLUMNS}
    FROM events
    WHERE start_time >= $1::timestamptz - INTERVAL '6 hours'
      AND start_time <= $1::timestamptz + INTERVAL '6 hours'
      AND ST_DWithin(
        location::geography,
        ST_MakePoint($2, $3)::geography,
        2000
      )
    LIMIT 20
    `,
    [event.start_time, event.lng, event.lat]
  );

  return result.rows;
}

export async function upsertEvent(event: EventRecord): Promise<string> {
  const result = await pool.query(
    `
    INSERT INTO events (
      title,
      description,
      start_time,
      end_time,
      timezone,
      venue_name,
      address,
      location,
      city,
      region,
      categories,
      price_type,
      source,
      source_family,
      source_url,
      source_event_id,
      engagement_signals,
      confidence_score,
      publish_state,
      verification_count,
      verified_by_trusted_source,
      verification_reasons,
      ingested_at,
      last_seen_at,
      duplicate_of_event_id,
      provenance_source_ids
    ) VALUES (
      $1, $2, $3, $4, $5, $6, $7,
      ST_SetSRID(ST_MakePoint($8, $9), 4326),
      $10, $11, $12, $13, $14, $15, $16, $17::jsonb, $18, $19, $20, $21, $22, $23, $24, $25, $26
    )
    ON CONFLICT (source, source_event_id) DO UPDATE
      SET
        title = EXCLUDED.title,
        description = EXCLUDED.description,
        start_time = EXCLUDED.start_time,
        end_time = EXCLUDED.end_time,
        timezone = EXCLUDED.timezone,
        venue_name = EXCLUDED.venue_name,
        address = EXCLUDED.address,
        location = EXCLUDED.location,
        city = EXCLUDED.city,
        region = EXCLUDED.region,
        categories = EXCLUDED.categories,
        price_type = EXCLUDED.price_type,
        source_family = EXCLUDED.source_family,
        source_url = EXCLUDED.source_url,
        engagement_signals = EXCLUDED.engagement_signals,
        confidence_score = EXCLUDED.confidence_score,
        publish_state = EXCLUDED.publish_state,
        verification_count = EXCLUDED.verification_count,
        verified_by_trusted_source = EXCLUDED.verified_by_trusted_source,
        verification_reasons = EXCLUDED.verification_reasons,
        last_seen_at = EXCLUDED.last_seen_at,
        duplicate_of_event_id = EXCLUDED.duplicate_of_event_id,
        provenance_source_ids = EXCLUDED.provenance_source_ids
    RETURNING id
    `,
    [
      event.title,
      event.description,
      event.start_time,
      event.end_time,
      event.timezone,
      event.venue_name,
      event.address,
      event.lng,
      event.lat,
      event.city,
      event.region,
      event.categories,
      event.price_type,
      event.source,
      event.source_family,
      event.source_url,
      event.source_event_id,
      JSON.stringify(event.engagement_signals),
      event.confidence_score,
      event.publish_state,
      event.verification_count,
      event.verified_by_trusted_source,
      event.verification_reasons,
      event.ingested_at,
      event.last_seen_at,
      event.duplicate_of_event_id ?? null,
      event.provenance_source_ids ?? []
    ]
  );

  return result.rows[0].id as string;
}

export async function insertSourceObservation(
  raw: SourceRawRecord & { source: string; source_family: string }
): Promise<string> {
  const result = await pool.query(
    `
    INSERT INTO source_observations (
      source,
      source_family,
      source_url,
      source_event_id,
      fetched_at,
      http_status,
      parser_version,
      story,
      requires_auth,
      inaccessible_reason,
      metadata,
      raw_payload
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11::jsonb, $12::jsonb)
    RETURNING id
    `,
    [
      raw.source,
      raw.source_family,
      raw.source_url,
      raw.source_event_id,
      raw.fetched_at,
      raw.http_status ?? null,
      raw.parser_version ?? null,
      raw.story ?? false,
      raw.requires_auth ?? false,
      raw.inaccessible_reason ?? null,
      JSON.stringify(raw.metadata ?? {}),
      JSON.stringify(raw.payload)
    ]
  );
  return result.rows[0].id as string;
}

export async function insertEventCandidate(
  candidate: Omit<EventCandidate, "id" | "created_at">
): Promise<string> {
  const result = await pool.query(
    `
    INSERT INTO event_candidates (
      source_observation_id,
      source,
      source_family,
      source_url,
      source_event_id,
      title,
      description,
      start_time,
      end_time,
      timezone,
      venue_name,
      organizer_name,
      address,
      location,
      city,
      region,
      categories,
      price_type,
      extraction_confidence,
      extraction_model
    )
    VALUES (
      $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13,
      CASE WHEN $14::double precision IS NULL OR $15::double precision IS NULL
        THEN NULL
        ELSE ST_SetSRID(ST_MakePoint($14, $15), 4326)
      END,
      $16, $17, $18, $19, $20, $21
    )
    RETURNING id
    `,
    [
      candidate.source_observation_id,
      candidate.source,
      candidate.source_family,
      candidate.source_url,
      candidate.source_event_id,
      candidate.title,
      candidate.description,
      candidate.start_time,
      candidate.end_time ?? null,
      candidate.timezone,
      candidate.venue_name ?? null,
      candidate.organizer_name ?? null,
      candidate.address,
      candidate.lng ?? null,
      candidate.lat ?? null,
      candidate.city,
      candidate.region,
      candidate.categories,
      candidate.price_type,
      candidate.extraction_confidence,
      candidate.extraction_model
    ]
  );
  return result.rows[0].id as string;
}

export async function getActiveTrustedSources(): Promise<TrustedSource[]> {
  const result = await pool.query(
    `
    SELECT
      id,
      source_type,
      source_value,
      source_family,
      active,
      notes,
      created_at,
      updated_at
    FROM trusted_sources
    WHERE active = TRUE
    `
  );
  return result.rows;
}

export async function insertRejectedEvent(reason: string, source: string, rawPayload: unknown) {
  await pool.query(
    `
    INSERT INTO rejected_events_audit (source, reason, raw_payload)
    VALUES ($1, $2, $3::jsonb)
    `,
    [source, reason, JSON.stringify(rawPayload)]
  );
}
