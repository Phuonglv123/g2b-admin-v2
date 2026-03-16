-- =============================================
-- Migration: Merge Location fields into Products table
-- Description: Remove separate locations table and embed location data directly into products
-- Rationale: Each location is used only once per product, so normalization is unnecessary
-- =============================================

-- =============================================
-- 1. ADD LOCATION COLUMNS TO PRODUCTS TABLE
-- =============================================

-- Location name and full address
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS location_name TEXT;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS location_address TEXT;

-- Structured address (2 levels: ward, province)
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS street_number TEXT;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS street_name TEXT;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS ward TEXT;
-- Note: Use nullable first, then set default after data migration
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS city_province TEXT;

-- Vietnam administrative codes (for API reference)
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS province_code INTEGER;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS ward_code INTEGER;

-- GPS coordinates
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS latitude DECIMAL(10, 8);
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS longitude DECIMAL(11, 8);
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS gps_coordinates TEXT;

-- Additional location info
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS landmark TEXT;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS local_tax DECIMAL(5, 2);

-- Comments for documentation
COMMENT ON COLUMN public.products.location_name IS 'Short name for the location';
COMMENT ON COLUMN public.products.location_address IS 'Full formatted address';
COMMENT ON COLUMN public.products.street_number IS 'House/building number';
COMMENT ON COLUMN public.products.street_name IS 'Street name';
COMMENT ON COLUMN public.products.ward IS 'Phường/Xã (Ward/Commune)';
COMMENT ON COLUMN public.products.city_province IS 'Tỉnh/Thành phố (Province/City)';
COMMENT ON COLUMN public.products.province_code IS 'Vietnam provinces API code';
COMMENT ON COLUMN public.products.ward_code IS 'Vietnam wards API code';
COMMENT ON COLUMN public.products.gps_coordinates IS 'GPS coordinates as "latitude,longitude"';
COMMENT ON COLUMN public.products.landmark IS 'Nearby landmark or view direction';
COMMENT ON COLUMN public.products.local_tax IS 'Local tax percentage';

-- =============================================
-- 2. MIGRATE DATA FROM LOCATIONS TO PRODUCTS
-- =============================================

-- Copy basic location data from existing locations table
-- Only copy columns that exist in the original locations table
UPDATE public.products p
SET 
    location_name = l.name,
    location_address = l.address,
    city_province = COALESCE(l.city, l.province, 'Ho Chi Minh'),
    latitude = l.latitude,
    longitude = l.longitude,
    landmark = l.landmark
FROM public.locations l
WHERE p.location_id = l.id;

-- Set default for city_province where NULL
UPDATE public.products 
SET city_province = 'Ho Chi Minh' 
WHERE city_province IS NULL;

-- Build gps_coordinates from lat/lng if available
UPDATE public.products
SET gps_coordinates = latitude::TEXT || ',' || longitude::TEXT
WHERE latitude IS NOT NULL AND longitude IS NOT NULL AND gps_coordinates IS NULL;

-- =============================================
-- 3. CREATE INDEXES FOR FAST FILTERING
-- =============================================

-- Index for filtering by city/province (most common filter)
CREATE INDEX IF NOT EXISTS idx_products_city_province ON public.products(city_province);

-- Index for filtering by ward
CREATE INDEX IF NOT EXISTS idx_products_ward ON public.products(ward);

-- Composite index for location-based queries
CREATE INDEX IF NOT EXISTS idx_products_location ON public.products(city_province, ward);

-- Index for province code (for API-based filtering)
CREATE INDEX IF NOT EXISTS idx_products_province_code ON public.products(province_code);

-- =============================================
-- 4. UPDATE PRODUCTS VIEW (simplified without location join)
-- =============================================

DROP VIEW IF EXISTS public.products_view;

CREATE OR REPLACE VIEW public.products_view AS
SELECT 
    p.id,
    p.user_id,
    p.product_code,
    p.product_name,
    p.type,
    p.areas,
    p.status,
    p.images,
    p.cost,
    p.production_cost,
    p.currency,
    p.traffic,
    p.booking_duration,
    p.provider_id,
    p.attributes,
    p.description,
    p.created_at,
    p.updated_at,
    -- Location fields (now directly from products)
    p.location_name,
    p.location_address,
    p.street_number,
    p.street_name,
    p.ward,
    p.city_province,
    p.province_code,
    p.ward_code,
    p.latitude,
    p.longitude,
    p.gps_coordinates,
    p.landmark,
    p.local_tax,
    -- Provider info (still joined)
    pr.name as provider_name,
    pr.phone as provider_phone,
    -- User info
    u.full_name as user_name
FROM public.products p
LEFT JOIN public.providers pr ON p.provider_id = pr.id
LEFT JOIN public.users u ON p.user_id = u.id;

-- Grant access to the view
GRANT SELECT ON public.products_view TO anon;
GRANT SELECT ON public.products_view TO authenticated;
GRANT SELECT ON public.products_view TO service_role;

-- =============================================
-- 5. REMOVE LOCATION_ID FOREIGN KEY (make nullable first)
-- =============================================

-- Drop the foreign key constraint first
ALTER TABLE public.products DROP CONSTRAINT IF EXISTS products_location_id_fkey;

-- Make location_id nullable (for backward compatibility during transition)
ALTER TABLE public.products ALTER COLUMN location_id DROP NOT NULL;

-- Note: We keep location_id column for now to avoid breaking existing code
-- It can be removed in a future migration after all code is updated

-- =============================================
-- 6. CREATE HELPER FUNCTION FOR LOCATION SEARCH
-- =============================================

-- Function to search products by location text
CREATE OR REPLACE FUNCTION public.search_products_by_location(search_text TEXT)
RETURNS SETOF public.products_view AS $$
BEGIN
    RETURN QUERY
    SELECT *
    FROM public.products_view
    WHERE 
        location_name ILIKE '%' || search_text || '%'
        OR location_address ILIKE '%' || search_text || '%'
        OR ward ILIKE '%' || search_text || '%'
        OR city_province ILIKE '%' || search_text || '%'
        OR street_name ILIKE '%' || search_text || '%'
        OR landmark ILIKE '%' || search_text || '%';
END;
$$ LANGUAGE plpgsql STABLE;

-- =============================================
-- 7. OPTIONAL: DROP LOCATIONS TABLE
-- =============================================
-- Uncomment this after verifying migration is successful
-- DROP TABLE IF EXISTS public.locations CASCADE;
