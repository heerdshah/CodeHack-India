-- 002_resources.sql: Resources table and Enums
DO $$ BEGIN
    CREATE TYPE resource_category AS ENUM ('Robotics & Fabrication', 'Analytical Equipment', 'Studios & Spaces');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE approval_mode AS ENUM ('manual', 'auto');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS resources (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    department TEXT NOT NULL,
    category resource_category NOT NULL,
    owner_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    location TEXT NOT NULL,
    building TEXT,
    floor TEXT,
    latitude DOUBLE PRECISION NOT NULL,
    longitude DOUBLE PRECISION NOT NULL,
    image TEXT NOT NULL,
    description TEXT NOT NULL,
    condition TEXT NOT NULL,
    criteria TEXT[] NOT NULL DEFAULT '{}',
    rules TEXT[] NOT NULL DEFAULT '{}',
    approval_mode approval_mode NOT NULL DEFAULT 'manual',
    opening_hours JSONB NOT NULL DEFAULT '{
        "mon": {"open": "08:00", "close": "20:00"},
        "tue": {"open": "08:00", "close": "20:00"},
        "wed": {"open": "08:00", "close": "20:00"},
        "thu": {"open": "08:00", "close": "20:00"},
        "fri": {"open": "08:00", "close": "20:00"},
        "sat": {"open": "09:00", "close": "18:00"},
        "sun": null
    }'::jsonb,
    max_active_bookings_per_user INT NOT NULL DEFAULT 2,
    max_hours_per_week_per_user INT NOT NULL DEFAULT 20,
    cooldown_hours_after_booking INT NOT NULL DEFAULT 4,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_resources_category ON resources(category);
CREATE INDEX IF NOT EXISTS idx_resources_owner ON resources(owner_id);
CREATE INDEX IF NOT EXISTS idx_resources_coords ON resources(latitude, longitude);

