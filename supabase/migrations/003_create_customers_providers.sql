-- =============================================
-- Migration: Create Customers and Providers tables
-- Description: Tables for managing customers and providers
-- =============================================

-- =============================================
-- 1. CUSTOMERS TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS public.customers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    -- Basic Info
    name TEXT NOT NULL,
    email TEXT UNIQUE,
    phone TEXT,
    company TEXT,
    -- Address
    address TEXT,
    city TEXT,
    country TEXT DEFAULT 'Vietnam',
    -- Business Info
    tax_code TEXT,
    contact_person TEXT,
    contact_phone TEXT,
    -- Status & Classification
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'potential')),
    customer_type TEXT DEFAULT 'individual' CHECK (customer_type IN ('individual', 'company', 'agency')),
    -- Notes
    notes TEXT,
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_customers_email ON public.customers(email);
CREATE INDEX IF NOT EXISTS idx_customers_status ON public.customers(status);
CREATE INDEX IF NOT EXISTS idx_customers_company ON public.customers(company);

-- =============================================
-- 2. PROVIDERS TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS public.providers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    -- Basic Info
    name TEXT NOT NULL,
    email TEXT UNIQUE,
    phone TEXT,
    company TEXT,
    -- Address
    address TEXT,
    city TEXT,
    country TEXT DEFAULT 'Vietnam',
    -- Business Info
    tax_code TEXT,
    contact_person TEXT,
    contact_phone TEXT,
    website TEXT,
    -- Service Info
    service_type TEXT DEFAULT 'media' CHECK (service_type IN ('media', 'printing', 'digital', 'events', 'other')),
    -- Status
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'pending')),
    rating INTEGER DEFAULT 0 CHECK (rating >= 0 AND rating <= 5),
    -- Notes
    notes TEXT,
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_providers_email ON public.providers(email);
CREATE INDEX IF NOT EXISTS idx_providers_status ON public.providers(status);
CREATE INDEX IF NOT EXISTS idx_providers_service_type ON public.providers(service_type);

-- =============================================
-- 3. ENABLE RLS
-- =============================================
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.providers ENABLE ROW LEVEL SECURITY;

-- =============================================
-- 4. RLS POLICIES FOR CUSTOMERS
-- =============================================
-- All authenticated users can view customers
CREATE POLICY "Authenticated users can view customers" ON public.customers
    FOR SELECT USING (auth.role() = 'authenticated');

-- All authenticated users can insert customers
CREATE POLICY "Authenticated users can insert customers" ON public.customers
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- All authenticated users can update customers
CREATE POLICY "Authenticated users can update customers" ON public.customers
    FOR UPDATE USING (auth.role() = 'authenticated');

-- Only admins can delete customers
CREATE POLICY "Admins can delete customers" ON public.customers
    FOR DELETE USING (public.is_admin());

-- =============================================
-- 5. RLS POLICIES FOR PROVIDERS
-- =============================================
-- All authenticated users can view providers
CREATE POLICY "Authenticated users can view providers" ON public.providers
    FOR SELECT USING (auth.role() = 'authenticated');

-- All authenticated users can insert providers
CREATE POLICY "Authenticated users can insert providers" ON public.providers
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- All authenticated users can update providers
CREATE POLICY "Authenticated users can update providers" ON public.providers
    FOR UPDATE USING (auth.role() = 'authenticated');

-- Only admins can delete providers
CREATE POLICY "Admins can delete providers" ON public.providers
    FOR DELETE USING (public.is_admin());

-- =============================================
-- 6. GRANT PERMISSIONS
-- =============================================
GRANT SELECT, INSERT, UPDATE, DELETE ON public.customers TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.providers TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.customers TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.providers TO service_role;

-- =============================================
-- 7. UPDATED_AT TRIGGER FUNCTION (if not exists)
-- =============================================
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updated_at
DROP TRIGGER IF EXISTS customers_updated_at ON public.customers;
CREATE TRIGGER customers_updated_at
    BEFORE UPDATE ON public.customers
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS providers_updated_at ON public.providers;
CREATE TRIGGER providers_updated_at
    BEFORE UPDATE ON public.providers
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

-- =============================================
-- 8. INSERT SAMPLE DATA (Optional)
-- =============================================
-- Sample Customers
INSERT INTO public.customers (name, email, phone, company, address, city, status, customer_type, contact_person)
VALUES 
    ('Công ty TNHH ABC', 'contact@abc.vn', '028-1234-5678', 'ABC Company', '123 Nguyễn Huệ', 'Ho Chi Minh', 'active', 'company', 'Nguyễn Văn A'),
    ('Công ty CP XYZ', 'info@xyz.vn', '024-9876-5432', 'XYZ Corporation', '456 Lê Lợi', 'Ha Noi', 'active', 'company', 'Trần Thị B'),
    ('Nguyễn Văn C', 'nguyenvanc@gmail.com', '0901-234-567', NULL, '789 Trần Hưng Đạo', 'Da Nang', 'potential', 'individual', NULL)
ON CONFLICT (email) DO NOTHING;

-- Sample Providers
INSERT INTO public.providers (name, email, phone, company, address, city, service_type, status, rating, contact_person)
VALUES 
    ('MediaPro Vietnam', 'contact@mediapro.vn', '028-5555-1234', 'MediaPro Co., Ltd', '100 Pasteur', 'Ho Chi Minh', 'media', 'active', 5, 'Lê Văn D'),
    ('PrintMax', 'sales@printmax.vn', '024-6666-5678', 'PrintMax JSC', '200 Hai Bà Trưng', 'Ha Noi', 'printing', 'active', 4, 'Phạm Thị E'),
    ('Digital Solutions', 'hello@digitalsol.vn', '028-7777-9012', 'Digital Solutions LLC', '300 Võ Văn Tần', 'Ho Chi Minh', 'digital', 'active', 4, 'Hoàng Văn F')
ON CONFLICT (email) DO NOTHING;
