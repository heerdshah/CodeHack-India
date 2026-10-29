-- 003_credentials.sql: User Credentials / Certifications
DO $$ BEGIN
    CREATE TYPE credential_status AS ENUM (
        'pending_upload', 'analyzing', 'ai_verified_pending_review', 'approved', 'rejected', 'expired'
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS user_credentials (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    credential_name TEXT NOT NULL,
    issuing_body TEXT,
    issue_date DATE,
    expiry_date DATE,
    document_path TEXT NOT NULL,
    status credential_status NOT NULL DEFAULT 'analyzing',
    ai_analysis JSONB,
    reviewed_by UUID REFERENCES users(id) ON DELETE SET NULL,
    reviewed_at TIMESTAMPTZ,
    rejection_reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_credentials_user ON user_credentials(user_id);
CREATE INDEX IF NOT EXISTS idx_user_credentials_status ON user_credentials(status);

