-- 008_incidents.sql: Incidents and Damage reports
DO $$ BEGIN
    CREATE TYPE incident_status AS ENUM ('reported', 'under_review', 'confirmed', 'dismissed', 'resolved');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE incident_severity AS ENUM ('low', 'medium', 'high', 'critical');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS incidents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    booking_id TEXT REFERENCES bookings(id) ON DELETE SET NULL,
    resource_id TEXT NOT NULL REFERENCES resources(id) ON DELETE CASCADE,
    reported_by UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    angle inspection_angle,
    status incident_status NOT NULL DEFAULT 'reported',
    severity incident_severity NOT NULL DEFAULT 'medium',
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    ai_summary TEXT,
    photos TEXT[] NOT NULL DEFAULT '{}',
    review_notes TEXT,
    reviewed_by UUID REFERENCES users(id) ON DELETE SET NULL,
    reviewed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_incidents_resource ON incidents(resource_id);
CREATE INDEX IF NOT EXISTS idx_incidents_status ON incidents(status);

