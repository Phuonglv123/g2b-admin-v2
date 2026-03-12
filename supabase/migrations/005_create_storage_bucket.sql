-- =============================================
-- Migration: Create Storage Bucket for Product Images
-- Description: Creates the 'g2b' bucket for storing product images and PDFs
-- NOTE: This migration needs to be run by service_role or via Dashboard
-- =============================================

-- =============================================
-- 1. CREATE STORAGE BUCKET (if not exists)
-- =============================================
-- Note: Storage bucket creation requires special permissions
-- This SQL may fail if run with anon key - use Dashboard or service_role

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'g2b',
    'g2b',
    true, -- Public bucket for product images and PDFs
    104857600, -- 100MB file size limit (for larger PDFs)
    ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf']
)
ON CONFLICT (id) DO UPDATE SET
    public = true,
    file_size_limit = 104857600,
    allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf'];

-- =============================================
-- 2. STORAGE POLICIES
-- =============================================

-- Drop existing policies if any (to avoid conflicts)
DROP POLICY IF EXISTS "Public Read Access for g2b" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated Upload for g2b" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated Update for g2b" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated Delete for g2b" ON storage.objects;

-- Allow public read access to images
CREATE POLICY "Public Read Access for g2b"
ON storage.objects FOR SELECT
USING (bucket_id = 'g2b');

-- Allow authenticated users to upload images
CREATE POLICY "Authenticated Upload for g2b"
ON storage.objects FOR INSERT
WITH CHECK (
    bucket_id = 'g2b' 
    AND auth.role() = 'authenticated'
);

-- Allow authenticated users to update their uploads
CREATE POLICY "Authenticated Update for g2b"
ON storage.objects FOR UPDATE
USING (
    bucket_id = 'g2b' 
    AND auth.role() = 'authenticated'
);

-- Allow authenticated users to delete images
CREATE POLICY "Authenticated Delete for g2b"
ON storage.objects FOR DELETE
USING (
    bucket_id = 'g2b' 
    AND auth.role() = 'authenticated'
);

-- =============================================
-- 3. VERIFY BUCKET EXISTS
-- =============================================
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'g2b') THEN
        RAISE NOTICE 'WARNING: Bucket g2b was not created. Please create it manually via Supabase Dashboard.';
    ELSE
        RAISE NOTICE 'SUCCESS: Bucket g2b exists and is configured.';
    END IF;
END $$;
