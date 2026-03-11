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
