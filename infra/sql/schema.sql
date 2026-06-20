CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ,
  timezone TEXT NOT NULL DEFAULT 'UTC',
  venue_name TEXT,
  address TEXT NOT NULL,
  location GEOGRAPHY(POINT, 4326) NOT NULL,
  city TEXT NOT NULL,
  region TEXT NOT NULL,
  categories TEXT[] NOT NULL DEFAULT '{}',
  price_type TEXT NOT NULL CHECK (price_type IN ('free', 'paid', 'unknown')),
  source TEXT NOT NULL,
  source_family TEXT NOT NULL DEFAULT 'other',
  source_url TEXT NOT NULL,
  source_event_id TEXT NOT NULL,
  engagement_signals JSONB NOT NULL DEFAULT '{}'::jsonb,
  confidence_score NUMERIC(4, 3) NOT NULL DEFAULT 0.5 CHECK (confidence_score >= 0 AND confidence_score <= 1),
  publish_state TEXT NOT NULL DEFAULT 'pending' CHECK (publish_state IN ('pending', 'verified', 'published', 'rejected')),
  verification_count INTEGER NOT NULL DEFAULT 0 CHECK (verification_count >= 0),
  verified_by_trusted_source BOOLEAN NOT NULL DEFAULT FALSE,
  verification_reasons TEXT[] NOT NULL DEFAULT '{}',
  ingested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  duplicate_of_event_id UUID REFERENCES events(id) ON DELETE SET NULL,
  provenance_source_ids TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (source, source_event_id)
);

CREATE INDEX IF NOT EXISTS idx_events_start_time ON events (start_time);
CREATE INDEX IF NOT EXISTS idx_events_categories ON events USING GIN (categories);
CREATE INDEX IF NOT EXISTS idx_events_price_type ON events (price_type);
CREATE INDEX IF NOT EXISTS idx_events_confidence_score ON events (confidence_score DESC);
CREATE INDEX IF NOT EXISTS idx_events_publish_state ON events (publish_state, start_time);
CREATE INDEX IF NOT EXISTS idx_events_location ON events USING GIST (location);

CREATE TABLE IF NOT EXISTS source_observations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source TEXT NOT NULL,
  source_family TEXT NOT NULL DEFAULT 'other',
  source_url TEXT NOT NULL,
  source_event_id TEXT NOT NULL,
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  http_status INTEGER,
  parser_version TEXT,
  story BOOLEAN NOT NULL DEFAULT FALSE,
  requires_auth BOOLEAN NOT NULL DEFAULT FALSE,
  inaccessible_reason TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  raw_payload JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_source_observations_identity
  ON source_observations (source, source_event_id, fetched_at DESC);
CREATE INDEX IF NOT EXISTS idx_source_observations_url
  ON source_observations (source_url, fetched_at DESC);

CREATE TABLE IF NOT EXISTS event_candidates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_observation_id UUID NOT NULL REFERENCES source_observations(id) ON DELETE CASCADE,
  source TEXT NOT NULL,
  source_family TEXT NOT NULL DEFAULT 'other',
  source_url TEXT NOT NULL,
  source_event_id TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ,
  timezone TEXT NOT NULL DEFAULT 'UTC',
  venue_name TEXT,
  organizer_name TEXT,
  address TEXT NOT NULL,
  location GEOGRAPHY(POINT, 4326),
  city TEXT NOT NULL,
  region TEXT NOT NULL,
  categories TEXT[] NOT NULL DEFAULT '{}',
  price_type TEXT NOT NULL CHECK (price_type IN ('free', 'paid', 'unknown')),
  extraction_confidence NUMERIC(4, 3) NOT NULL DEFAULT 0.0 CHECK (extraction_confidence >= 0 AND extraction_confidence <= 1),
  extraction_model TEXT NOT NULL DEFAULT 'deterministic',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_event_candidates_start_time ON event_candidates (start_time);
CREATE INDEX IF NOT EXISTS idx_event_candidates_location ON event_candidates USING GIST (location);
CREATE INDEX IF NOT EXISTS idx_event_candidates_source ON event_candidates (source, source_event_id);

CREATE TABLE IF NOT EXISTS trusted_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_type TEXT NOT NULL CHECK (source_type IN ('domain', 'account', 'profile_url')),
  source_value TEXT NOT NULL,
  source_family TEXT NOT NULL DEFAULT 'other',
  active BOOLEAN NOT NULL DEFAULT TRUE,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (source_type, source_value)
);

CREATE INDEX IF NOT EXISTS idx_trusted_sources_active ON trusted_sources (active, source_family);

CREATE TABLE IF NOT EXISTS event_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  feedback_type TEXT NOT NULL CHECK (feedback_type IN ('not_relevant', 'duplicate', 'wrong_location')),
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_event_feedback_event ON event_feedback (event_id, created_at DESC);

CREATE TABLE IF NOT EXISTS rejected_events_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source TEXT NOT NULL,
  reason TEXT NOT NULL,
  raw_payload JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_rejected_events_source_reason
  ON rejected_events_audit (source, reason, created_at DESC);

CREATE TABLE IF NOT EXISTS event_moderation_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  action TEXT NOT NULL CHECK (action IN ('suppressed', 'restored')),
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_event_moderation_actions_event
  ON event_moderation_actions (event_id, created_at DESC);

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_events_updated_at ON events;
CREATE TRIGGER trg_events_updated_at
BEFORE UPDATE ON events
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_trusted_sources_updated_at ON trusted_sources;
CREATE TRIGGER trg_trusted_sources_updated_at
BEFORE UPDATE ON trusted_sources
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();
