-- 005_agreements.sql: Agreements table
CREATE TABLE IF NOT EXISTS agreements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    booking_id TEXT UNIQUE NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
    document_path TEXT NOT NULL,
    document_hash TEXT NOT NULL, -- SHA-256
    content_clauses JSONB NOT NULL,
    user_signed_at TIMESTAMPTZ,
    user_signature_path TEXT,
    user_signer_ip TEXT,
    user_doc_hash TEXT,
    owner_signed_at TIMESTAMPTZ,
    owner_signature_path TEXT,
    owner_signer_ip TEXT,
    owner_doc_hash TEXT,
    signed_document_path TEXT,
    is_fully_signed BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_agreements_booking ON agreements(booking_id);

