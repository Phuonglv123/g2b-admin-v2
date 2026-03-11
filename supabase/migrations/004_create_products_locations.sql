-- =============================================
-- Migration: Create Products and Locations tables
-- Description: Tables for managing advertising products/inventory
-- Based on MongoDB productSchema
-- =============================================

-- =============================================
-- 1. LOCATIONS TABLE (referenced by products)
-- =============================================
CREATE TABLE IF NOT EXISTS public.locations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    -- Basic Info
    name TEXT NOT NULL,
    address TEXT NOT NULL,
    district TEXT,
    city TEXT NOT NULL,
    province TEXT,
    country TEXT DEFAULT 'Vietnam',
    -- Coordinates
    latitude DECIMAL(10, 8),
    longitude DECIMAL(11, 8),
    -- Additional Info
    description TEXT,
    landmark TEXT,
    -- Status
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_locations_city ON public.locations(city);
CREATE INDEX IF NOT EXISTS idx_locations_status ON public.locations(status);

-- =============================================
-- 2. PRODUCTS TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS public.products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    -- User reference
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    -- Basic Info
    product_code TEXT NOT NULL UNIQUE,
    product_name TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('billboard', 'digital', 'led', 'transit', 'poster', 'banner', 'other')),
    areas TEXT[] DEFAULT '{}',
    status INTEGER NOT NULL DEFAULT 1 CHECK (status IN (0, 1, 2)), -- 0: inactive, 1: active, 2: maintenance
    -- Media
    images TEXT[] DEFAULT '{}',
    -- Pricing
    cost DECIMAL(15, 2) NOT NULL,
    production_cost TEXT,
    currency TEXT NOT NULL DEFAULT 'VND',
    -- Traffic & Duration
    traffic TEXT NOT NULL,
    booking_duration TEXT NOT NULL,
    -- References
    provider_id UUID NOT NULL REFERENCES public.providers(id) ON DELETE RESTRICT,
    location_id UUID NOT NULL REFERENCES public.locations(id) ON DELETE RESTRICT,
    -- Attributes (JSONB for flexibility)
    attributes JSONB NOT NULL DEFAULT '{
        "width": 0,
        "height": 0,
        "video_duration": 0,
        "pixel_width": 0,
        "pixel_height": 0,
        "opera_time_from": "",
        "opera_time_to": "",
        "frequency": "",
        "shape": "",
        "note": "",
        "add_side": 0,
        "quantity_of_ad": 0,
        "lighting": 0
    }'::jsonb,
    -- Description
    description TEXT,
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_products_user_id ON public.products(user_id);
CREATE INDEX IF NOT EXISTS idx_products_product_code ON public.products(product_code);
CREATE INDEX IF NOT EXISTS idx_products_type ON public.products(type);
CREATE INDEX IF NOT EXISTS idx_products_status ON public.products(status);
CREATE INDEX IF NOT EXISTS idx_products_provider_id ON public.products(provider_id);
CREATE INDEX IF NOT EXISTS idx_products_location_id ON public.products(location_id);
CREATE INDEX IF NOT EXISTS idx_products_cost ON public.products(cost);

-- GIN index for JSONB attributes search
CREATE INDEX IF NOT EXISTS idx_products_attributes ON public.products USING GIN (attributes);

-- =============================================
-- 3. ENABLE RLS
-- =============================================
ALTER TABLE public.locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

-- =============================================
-- 4. RLS POLICIES FOR LOCATIONS
-- =============================================
CREATE POLICY "Authenticated users can view locations" ON public.locations
    FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can insert locations" ON public.locations
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can update locations" ON public.locations
    FOR UPDATE USING (auth.role() = 'authenticated');

CREATE POLICY "Admins can delete locations" ON public.locations
    FOR DELETE USING (public.is_admin());

-- =============================================
-- 5. RLS POLICIES FOR PRODUCTS
-- =============================================
-- Users can view all products
CREATE POLICY "Authenticated users can view products" ON public.products
    FOR SELECT USING (auth.role() = 'authenticated');

-- Users can only insert products for themselves
CREATE POLICY "Users can insert own products" ON public.products
    FOR INSERT WITH CHECK (auth.uid() = user_id OR public.is_admin());

-- Users can only update their own products (admins can update all)
CREATE POLICY "Users can update own products" ON public.products
    FOR UPDATE USING (auth.uid() = user_id OR public.is_admin());

-- Users can only delete their own products (admins can delete all)
CREATE POLICY "Users can delete own products" ON public.products
    FOR DELETE USING (auth.uid() = user_id OR public.is_admin());

-- =============================================
-- 6. GRANT PERMISSIONS
-- =============================================
GRANT SELECT, INSERT, UPDATE, DELETE ON public.locations TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.products TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.locations TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.products TO service_role;

-- =============================================
-- 7. TRIGGERS FOR UPDATED_AT
-- =============================================
DROP TRIGGER IF EXISTS locations_updated_at ON public.locations;
CREATE TRIGGER locations_updated_at
    BEFORE UPDATE ON public.locations
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS products_updated_at ON public.products;
CREATE TRIGGER products_updated_at
    BEFORE UPDATE ON public.products
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

-- =============================================
-- 8. INSERT SAMPLE DATA
-- =============================================
-- Sample Locations
INSERT INTO public.locations (id, name, address, district, city, latitude, longitude, description, landmark)
VALUES 
    ('a0000000-0000-0000-0000-000000000001', 'Ngã tư Phú Nhuận', '01 Nguyễn Văn Trỗi', 'Phú Nhuận', 'Ho Chi Minh', 10.8012, 106.6792, 'Vị trí đắc địa tại ngã tư Phú Nhuận', 'Gần sân bay Tân Sơn Nhất'),
    ('a0000000-0000-0000-0000-000000000002', 'Ngã 6 Gò Vấp', 'Nguyễn Oanh', 'Gò Vấp', 'Ho Chi Minh', 10.8432, 106.6589, 'Khu vực đông đúc, lượng traffic cao', 'Gần chợ Gò Vấp'),
    ('a0000000-0000-0000-0000-000000000003', 'Hồ Hoàn Kiếm', 'Đinh Tiên Hoàng', 'Hoàn Kiếm', 'Ha Noi', 21.0285, 105.8542, 'Vị trí trung tâm Hà Nội', 'Cạnh hồ Hoàn Kiếm'),
    ('a0000000-0000-0000-0000-000000000004', 'Cầu Rồng', 'Nguyễn Văn Linh', 'Sơn Trà', 'Da Nang', 16.0608, 108.2275, 'Biểu tượng du lịch Đà Nẵng', 'Cầu Rồng')
ON CONFLICT (id) DO NOTHING;

-- =============================================
-- 9. VIEW FOR PRODUCTS WITH RELATIONS
-- =============================================
CREATE OR REPLACE VIEW public.products_view AS
SELECT 
    p.*,
    l.name as location_name,
    l.address as location_address,
    l.city as location_city,
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
