-- =============================================
-- RESET DATABASE - XÓA SẠCH VÀ TẠO LẠI
-- CHẠY TRONG SUPABASE SQL EDITOR
-- =============================================

-- 1. XÓA VIEW TRƯỚC
DROP VIEW IF EXISTS public.products_view CASCADE;

-- 2. XÓA BẢNG PRODUCTS (sẽ xóa cả FK constraints)
DROP TABLE IF EXISTS public.products CASCADE;

-- 3. XÓA BẢNG LOCATIONS (không cần nữa)
DROP TABLE IF EXISTS public.locations CASCADE;

-- 4. TẠO LẠI BẢNG PRODUCTS (với location embedded)
CREATE TABLE public.products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    product_code TEXT NOT NULL UNIQUE,
    product_name TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('billboard', 'digital', 'led', 'transit', 'poster', 'banner', 'other')),
    areas TEXT[] DEFAULT '{}',
    status INTEGER NOT NULL DEFAULT 1 CHECK (status IN (0, 1, 2)),
    images TEXT[] DEFAULT '{}',
    cost DECIMAL(15, 2) NOT NULL DEFAULT 0,
    production_cost TEXT,
    currency TEXT NOT NULL DEFAULT 'VND',
    traffic TEXT NOT NULL,
    booking_duration TEXT NOT NULL,
    provider_id UUID NOT NULL REFERENCES public.providers(id) ON DELETE RESTRICT,
    -- Location fields (embedded)
    location_name TEXT,
    location_address TEXT,
    street_number TEXT,
    street_name TEXT,
    ward TEXT,
    city_province TEXT DEFAULT 'Ho Chi Minh',
    province_code INTEGER,
    ward_code INTEGER,
    latitude DECIMAL(10, 8),
    longitude DECIMAL(11, 8),
    gps_coordinates TEXT,
    landmark TEXT,
    local_tax DECIMAL(5, 2),
    -- Attributes
    attributes JSONB NOT NULL DEFAULT '{}'::jsonb,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. TẠO INDEXES
CREATE INDEX idx_products_user_id ON public.products(user_id);
CREATE INDEX idx_products_product_code ON public.products(product_code);
CREATE INDEX idx_products_type ON public.products(type);
CREATE INDEX idx_products_status ON public.products(status);
CREATE INDEX idx_products_provider_id ON public.products(provider_id);
CREATE INDEX idx_products_city_province ON public.products(city_province);
CREATE INDEX idx_products_ward ON public.products(ward);
CREATE INDEX idx_products_cost ON public.products(cost);
CREATE INDEX idx_products_attributes ON public.products USING GIN (attributes);

-- 6. TẠO VIEW
CREATE VIEW public.products_view AS
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
    pr.name as provider_name,
    pr.phone as provider_phone,
    u.full_name as user_name
FROM public.products p
LEFT JOIN public.providers pr ON p.provider_id = pr.id
LEFT JOIN public.users u ON p.user_id = u.id;

-- 7. ENABLE RLS
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

-- 8. TẠO RLS POLICIES
DROP POLICY IF EXISTS "Users can view all products" ON public.products;
DROP POLICY IF EXISTS "Users can insert own products" ON public.products;
DROP POLICY IF EXISTS "Users can update own products" ON public.products;
DROP POLICY IF EXISTS "Users can delete own products" ON public.products;

CREATE POLICY "Users can view all products" ON public.products
    FOR SELECT USING (true);

CREATE POLICY "Users can insert own products" ON public.products
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Authenticated users can update products" ON public.products
    FOR UPDATE USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can delete products" ON public.products
    FOR DELETE USING (auth.role() = 'authenticated');

-- 9. GRANT PERMISSIONS
GRANT ALL ON public.products TO authenticated;
GRANT SELECT ON public.products TO anon;
GRANT SELECT ON public.products_view TO anon;
GRANT SELECT ON public.products_view TO authenticated;
GRANT SELECT ON public.products_view TO service_role;

-- 10. KIỂM TRA
SELECT column_name, data_type FROM information_schema.columns 
WHERE table_name = 'products' AND table_schema = 'public'
ORDER BY ordinal_position;
