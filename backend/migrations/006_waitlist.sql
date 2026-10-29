-- 006_waitlist.sql: FIFO Waitlist table
DO $$ BEGIN
    CREATE TYPE waitlist_status AS ENUM ('waiting', 'promoted_holding', 'accepted', 'expired', 'cancelled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS waitlist (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    resource_id TEXT NOT NULL REFERENCES resources(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    requested_start_date TIMESTAMPTZ NOT NULL,
    requested_end_date TIMESTAMPTZ NOT NULL,
    purpose TEXT NOT NULL,
    position INT NOT NULL,
    status waitlist_status NOT NULL DEFAULT 'waiting',
    hold_until TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_waitlist_dates CHECK (requested_end_date > requested_start_date)
);

CREATE INDEX IF NOT EXISTS idx_waitlist_resource_pos ON waitlist(resource_id, position);
CREATE INDEX IF NOT EXISTS idx_waitlist_user ON waitlist(user_id);

