-- 007_inspections.sql: 6-Angle Inspections and Photos
DO $$ BEGIN
    CREATE TYPE inspection_phase AS ENUM ('pre', 'post');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE inspection_angle AS ENUM ('Front', 'Back', 'Left', 'Right', 'Top', 'Bottom');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS inspections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    booking_id TEXT NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
    phase inspection_phase NOT NULL,
    completed_by UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    findings TEXT[] NOT NULL DEFAULT '{}',
    flagged BOOLEAN NOT NULL DEFAULT FALSE,
    ai_analysis JSONB,
    completed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_booking_phase UNIQUE (booking_id, phase)
);

CREATE INDEX IF NOT EXISTS idx_inspections_booking ON inspections(booking_id);

CREATE TABLE IF NOT EXISTS inspection_photos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    inspection_id UUID NOT NULL REFERENCES inspections(id) ON DELETE CASCADE,
    angle inspection_angle NOT NULL,
    photo_path TEXT NOT NULL,
    ai_quality_ok BOOLEAN NOT NULL DEFAULT TRUE,
    ai_quality_notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_inspection_angle UNIQUE (inspection_id, angle)
);

CREATE INDEX IF NOT EXISTS idx_inspection_photos_inspection ON inspection_photos(inspection_id);

