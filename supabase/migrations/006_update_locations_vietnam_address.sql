-- =============================================
-- Migration: Update Locations table for Vietnam address structure
-- Description: Add structured address fields for Vietnam (street_number, street_name, ward, province_code, etc.)
-- Also adds GPS coordinates, currency, and local_tax fields
-- =============================================

-- =============================================
-- 1. ADD NEW COLUMNS TO LOCATIONS TABLE
-- =============================================

-- Street address components
ALTER TABLE public.locations ADD COLUMN IF NOT EXISTS street_number TEXT;
ALTER TABLE public.locations ADD COLUMN IF NOT EXISTS street_name TEXT;
ALTER TABLE public.locations ADD COLUMN IF NOT EXISTS ward TEXT;

-- Vietnam administrative codes (for API reference)
ALTER TABLE public.locations ADD COLUMN IF NOT EXISTS province_code INTEGER;
ALTER TABLE public.locations ADD COLUMN IF NOT EXISTS district_code INTEGER;
ALTER TABLE public.locations ADD COLUMN IF NOT EXISTS ward_code INTEGER;

-- Additional fields
ALTER TABLE public.locations ADD COLUMN IF NOT EXISTS gps_coordinates TEXT; -- Format: "lat,lng" for easy display
ALTER TABLE public.locations ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'VND';
ALTER TABLE public.locations ADD COLUMN IF NOT EXISTS local_tax DECIMAL(5, 2); -- Tax percentage

-- Update comments
COMMENT ON COLUMN public.locations.street_number IS 'House/building number';
COMMENT ON COLUMN public.locations.street_name IS 'Street name without number';
COMMENT ON COLUMN public.locations.ward IS 'Phường/Xã (Ward/Commune)';
COMMENT ON COLUMN public.locations.province_code IS 'Vietnam provinces API code';
COMMENT ON COLUMN public.locations.district_code IS 'Vietnam districts API code';
COMMENT ON COLUMN public.locations.ward_code IS 'Vietnam wards API code';
COMMENT ON COLUMN public.locations.gps_coordinates IS 'GPS coordinates as "latitude,longitude"';
COMMENT ON COLUMN public.locations.currency IS 'Currency code (VND, USD, etc.)';
COMMENT ON COLUMN public.locations.local_tax IS 'Local tax percentage applicable to this location';

-- Rename 'city' to 'province' for clarity (in Vietnam context)
-- Note: We keep 'city' column for backward compatibility but add 'province' as alias
ALTER TABLE public.locations RENAME COLUMN province TO province_name;
ALTER TABLE public.locations RENAME COLUMN city TO city_province;

-- Add index for searching by address components
CREATE INDEX IF NOT EXISTS idx_locations_ward ON public.locations(ward);
CREATE INDEX IF NOT EXISTS idx_locations_street_name ON public.locations(street_name);
CREATE INDEX IF NOT EXISTS idx_locations_province_code ON public.locations(province_code);

-- =============================================
-- 2. UPDATE PRODUCTS_VIEW TO INCLUDE NEW FIELDS
-- =============================================
DROP VIEW IF EXISTS public.products_view;

CREATE OR REPLACE VIEW public.products_view AS
SELECT 
    p.*,
    l.name as location_name,
    l.address as location_address,
    l.city_province as location_city,
    l.district as location_district,
    l.ward as location_ward,
    l.street_name as location_street,
    l.street_number as location_street_number,
    l.latitude as location_latitude,
    l.longitude as location_longitude,
    l.gps_coordinates as location_gps,
    l.currency as location_currency,
    l.local_tax as location_local_tax,
    l.province_code as location_province_code,
    l.district_code as location_district_code,
    l.ward_code as location_ward_code,
    pr.name as provider_name,
    pr.phone as provider_phone,
    u.full_name as user_name
FROM public.products p
LEFT JOIN public.locations l ON p.location_id = l.id
LEFT JOIN public.providers pr ON p.provider_id = pr.id
LEFT JOIN public.users u ON p.user_id = u.id;

-- Grant access to the view
GRANT SELECT ON public.products_view TO authenticated;
GRANT SELECT ON public.products_view TO service_role;

-- =============================================
-- 3. CREATE FUNCTION TO FORMAT FULL ADDRESS
-- =============================================
CREATE OR REPLACE FUNCTION public.format_vietnam_address(
    p_street_number TEXT,
    p_street_name TEXT,
    p_ward TEXT,
    p_district TEXT,
    p_city_province TEXT
) RETURNS TEXT AS $$
DECLARE
    v_address TEXT := '';
BEGIN
    -- Build address from components
    IF p_street_number IS NOT NULL AND p_street_number != '' THEN
        v_address := p_street_number;
    END IF;
    
    IF p_street_name IS NOT NULL AND p_street_name != '' THEN
        IF v_address != '' THEN
            v_address := v_address || ' ';
        END IF;
        v_address := v_address || p_street_name;
    END IF;
    
    IF p_ward IS NOT NULL AND p_ward != '' THEN
        IF v_address != '' THEN
            v_address := v_address || ', ';
        END IF;
        v_address := v_address || p_ward;
    END IF;
    
    IF p_district IS NOT NULL AND p_district != '' THEN
        IF v_address != '' THEN
            v_address := v_address || ', ';
        END IF;
        v_address := v_address || p_district;
    END IF;
    
    IF p_city_province IS NOT NULL AND p_city_province != '' THEN
        IF v_address != '' THEN
            v_address := v_address || ', ';
        END IF;
        v_address := v_address || p_city_province;
    END IF;
    
    RETURN v_address;
END;
$$ LANGUAGE plpgsql IMMUTABLE;
