# 🚀 Setup Supabase cho User Management

## Bước 1: Chạy Migration Scripts

Vào **Supabase Dashboard** > **SQL Editor** và chạy các file theo thứ tự:

### 1. Tạo Users Table
```sql
-- Copy và paste toàn bộ nội dung file này
supabase/migrations/001_create_users_table.sql
```

### 2. Tạo User Management Functions
```sql
-- Copy và paste toàn bộ nội dung file này
supabase/migrations/002_create_user_function.sql
```

## Bước 2: Tạo Admin Account Đầu Tiên

### Cách 1: Qua Supabase Dashboard (Đơn giản nhất)

1. Vào **Authentication** > **Users**
2. Click **"Add User"** > **"Create New User"**
3. Nhập:
   - Email: `admin@mediaflow.com`
   - Password: `Admin@123456`
   - ✅ Check **"Auto Confirm User"**
4. Click **"Create User"**
5. Sau đó vào **SQL Editor** và chạy:

```sql
UPDATE public.users 
SET role = 'admin', full_name = 'Administrator'
WHERE email = 'admin@mediaflow.com';
```

### Cách 2: Qua SQL (Nếu muốn tự động)

```sql
-- Chạy trong SQL Editor
INSERT INTO auth.users (
  instance_id,
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at
) VALUES (
  '00000000-0000-0000-0000-000000000000',
  gen_random_uuid(),
  'authenticated',
  'authenticated',
  'admin@mediaflow.com',
  crypt('Admin@123456', gen_salt('bf')),
  NOW(),
  '{"provider":"email","providers":["email"]}'::jsonb,
  '{"full_name":"Administrator"}'::jsonb,
  NOW(),
  NOW()
);
```

## Bước 3: Test Login

1. Vào app và login với:
   - Email: `admin@mediaflow.com`
   - Password: `Admin@123456`

2. Vào trang **Users** và thử:
   - ✅ Tạo user mới
   - ✅ Cập nhật user
   - ✅ Xóa user
   - ✅ Reset password

## ✨ Tính Năng

Sau khi setup xong, bạn có thể:

- ✅ **Tạo user mới** với email, password, role, status
- ✅ **Cập nhật thông tin** user (name, phone, role, status)
- ✅ **Xóa user** (không thể tự xóa chính mình)
- ✅ **Reset password** cho user bất kỳ
- ✅ **Tự động validation**: email format, password length, duplicate email
- ✅ **Security**: Chỉ admin mới có quyền quản lý users

## 🔐 Roles & Permissions

- **Admin**: Full access - quản lý tất cả users
- **Manager**: Limited access (tùy chỉnh sau)
- **User**: Basic access (chỉ xem profile của mình)

## 🐛 Troubleshooting

### Lỗi: "Only admins can create users"
```sql
-- Check role hiện tại
SELECT id, email, role FROM public.users WHERE id = auth.uid();

-- Update thành admin nếu cần
UPDATE public.users SET role = 'admin' WHERE email = 'your-email@example.com';
```

### Lỗi: "Function does not exist"
→ Chạy lại file `002_create_user_function.sql`

### Lỗi: "Email already exists"
→ Sử dụng email khác hoặc xóa user cũ

## 📚 Documentation

Chi tiết đầy đủ: `supabase/USER_MANAGEMENT.md`

---

## 🖼️ Setup Storage cho Product Images

### Bước 1: Tạo Storage Bucket (QUAN TRỌNG!)

**Cách 1: Qua Supabase Dashboard (Khuyến nghị)**

1. Vào **Supabase Dashboard** > **Storage**
2. Click **"New Bucket"**
3. Nhập:
   - Name: `g2b`
   - ✅ Check **"Public bucket"** (để có thể truy cập public URL)
4. Click **"Create bucket"**

**Cách 2: Qua SQL Editor**

Chạy file migration:
```sql
-- Copy và paste toàn bộ nội dung file này
supabase/migrations/005_create_storage_bucket.sql
```

### Bước 2: Cấu hình RLS Policy

Vào **SQL Editor** và chạy:

```sql
-- Drop existing policies if any
DROP POLICY IF EXISTS "Public Read Access for g2b" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated Upload for g2b" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated Update for g2b" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated Delete for g2b" ON storage.objects;

-- Allow public read access
CREATE POLICY "Public Read Access for g2b"
ON storage.objects FOR SELECT
USING (bucket_id = 'g2b');

-- Allow authenticated users to upload
CREATE POLICY "Authenticated Upload for g2b"
ON storage.objects FOR INSERT
WITH CHECK (
    bucket_id = 'g2b' 
    AND auth.role() = 'authenticated'
);

-- Allow authenticated users to update
CREATE POLICY "Authenticated Update for g2b"
ON storage.objects FOR UPDATE
USING (bucket_id = 'g2b' AND auth.role() = 'authenticated');

-- Allow authenticated users to delete
CREATE POLICY "Authenticated Delete for g2b"
ON storage.objects FOR DELETE
USING (bucket_id = 'g2b' AND auth.role() = 'authenticated');
```

### Bước 3: Kiểm tra field `images` trong bảng `products`

Chạy SQL này để verify:
```sql
-- Check if images column exists
SELECT column_name, data_type, column_default 
FROM information_schema.columns 
WHERE table_name = 'products' AND column_name = 'images';

-- If column doesn't exist, add it:
ALTER TABLE public.products 
ADD COLUMN IF NOT EXISTS images TEXT[] DEFAULT '{}';
```

### Bước 4: Verify Setup

Mở Console (F12) khi upload PDF, bạn sẽ thấy logs như:
```
🔄 ConvertAPI: Converting PDF "product.pdf" (500 KB) from page 2...
🌐 ConvertAPI: Calling API...
✅ ConvertAPI response: {...}
✅ ConvertAPI: Converted 3 pages successfully
📤 Uploading 3 images to Supabase bucket 'g2b/products/BIL_001'...
✅ Uploaded page 2: https://xxx.supabase.co/storage/v1/object/public/g2b/...
```

### Troubleshooting Storage

#### Lỗi: "Bucket not found" hoặc "The resource was not found"
→ **Bucket chưa được tạo!** Vào Storage trong Dashboard và tạo bucket `g2b`

#### Lỗi: "new row violates RLS policy" 
→ Chạy lại SQL policies ở Bước 2

#### Lỗi: ConvertAPI "401 Unauthorized"
→ Kiểm tra VITE_CONVERT_API_SECRET trong file .env
→ Đăng ký tài khoản mới tại https://www.convertapi.com/a/auth

#### Lỗi: "Failed to fetch" khi download từ ConvertAPI
→ CORS issue - ConvertAPI URLs chỉ valid trong thời gian ngắn

#### Images không hiển thị sau khi import
1. Kiểm tra bucket `g2b` có tồn tại trong Storage
2. Kiểm tra bucket có được set public
3. Kiểm tra URL trong console log có đúng format không
