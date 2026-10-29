-- storage.sql: Supabase Storage Buckets and Policies
-- Run this in the Supabase SQL editor to create the private buckets

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES 
    ('verification-docs', 'verification-docs', FALSE, 10485760, ARRAY['application/pdf', 'image/jpeg', 'image/png', 'image/webp']),
    ('inspection-photos', 'inspection-photos', FALSE, 15728640, ARRAY['image/jpeg', 'image/png', 'image/webp']),
    ('incident-photos', 'incident-photos', FALSE, 15728640, ARRAY['image/jpeg', 'image/png', 'image/webp']),
    ('agreements', 'agreements', FALSE, 10485760, ARRAY['application/pdf', 'image/png'])
ON CONFLICT (id) DO UPDATE SET
    public = EXCLUDED.public,
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Storage RLS Policies: Authenticated users can upload to these buckets
DO $$ BEGIN
    CREATE POLICY "Authenticated users upload verification docs"
    ON storage.objects FOR INSERT TO authenticated
    WITH CHECK (bucket_id = 'verification-docs');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE POLICY "Authenticated users upload inspection photos"
    ON storage.objects FOR INSERT TO authenticated
    WITH CHECK (bucket_id = 'inspection-photos');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE POLICY "Authenticated users upload incident photos"
    ON storage.objects FOR INSERT TO authenticated
    WITH CHECK (bucket_id = 'incident-photos');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE POLICY "Authenticated users upload agreements"
    ON storage.objects FOR INSERT TO authenticated
    WITH CHECK (bucket_id = 'agreements');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Service role has full access
DO $$ BEGIN
    CREATE POLICY "Service role full access storage"
    ON storage.objects FOR ALL TO service_role
    USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

