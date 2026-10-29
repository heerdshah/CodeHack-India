-- 004_bookings.sql: Bookings table with Exclusion Constraint
DO $$ BEGIN
    CREATE TYPE booking_status AS ENUM (
        'pending', 'approved', 'rejected', 'waitlisted', 
        'signed', 'active', 'returned', 'completed', 'cancelled', 'overdue'
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS bookings (
    id TEXT PRIMARY KEY DEFAULT ('bk-' || substr(md5(random()::text), 1, 8)),
    resource_id TEXT NOT NULL REFERENCES resources(id) ON DELETE RESTRICT,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    start_date TIMESTAMPTZ NOT NULL,
    end_date TIMESTAMPTZ NOT NULL,
    booking_period TSTZRANGE GENERATED ALWAYS AS (tstzrange(start_date, end_date, '[)')) STORED,
    purpose TEXT NOT NULL,
    status booking_status NOT NULL DEFAULT 'pending',
    proof_files TEXT[] NOT NULL DEFAULT '{}',
    rejection_reason TEXT,
    checkin_otp TEXT,
    otp_expires_at TIMESTAMPTZ,
    checked_in_at TIMESTAMPTZ,
    returned_at TIMESTAMPTZ,
    owner_verified BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_booking_dates CHECK (end_date > start_date),
    CONSTRAINT prevent_booking_overlap EXCLUDE USING gist (
        resource_id WITH =,
        booking_period WITH &&
    ) WHERE (status IN ('approved', 'signed', 'active', 'overdue'))
);

CREATE INDEX IF NOT EXISTS idx_bookings_resource ON bookings(resource_id);
CREATE INDEX IF NOT EXISTS idx_bookings_user ON bookings(user_id);
CREATE INDEX IF NOT EXISTS idx_bookings_status ON bookings(status);
CREATE INDEX IF NOT EXISTS idx_bookings_period ON bookings USING gist (booking_period);

