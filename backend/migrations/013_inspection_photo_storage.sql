-- Inspection images are private; the API serves them only after checking booking participation.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'inspection-photos',
    'inspection-photos',
    FALSE,
    6291456,
    ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO UPDATE
SET public = FALSE,
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

ALTER TABLE public.inspections
    ADD COLUMN IF NOT EXISTS owner_decision TEXT
        CHECK (owner_decision IN ('damage', 'no_damage')),
    ADD COLUMN IF NOT EXISTS reviewed_by UUID REFERENCES public.users(id),
    ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS review_notes TEXT;
