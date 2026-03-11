# Hướng Dẫn Quản Lý User với Supabase

## 📋 Tổng Quan

Hệ thống bao gồm các SQL functions để quản lý users trên Supabase, giúp admin dễ dàng tạo, cập nhật, xóa và reset password cho users.

## 🚀 Cài Đặt

### Bước 1: Chạy Migration Scripts

Chạy các file SQL theo thứ tự trong Supabase SQL Editor:

1. **001_create_users_table.sql** - Tạo bảng users và các triggers
2. **002_create_user_function.sql** - Tạo các functions quản lý user

```sql
-- Chạy trong Supabase Dashboard > SQL Editor
-- Copy nội dung từng file và execute
```

### Bước 2: Tạo Admin Account Đầu Tiên

Có 2 cách để tạo admin account đầu tiên:

#### Cách 1: Qua Supabase Dashboard (Khuyến nghị)

1. Vào **Supabase Dashboard** > **Authentication** > **Users**
2. Click **"Add User"** > **"Create New User"**
3. Nhập thông tin:
   - Email: `admin@mediaflow.com`
   - Password: `Admin@123456`
   - ✅ Check **"Auto Confirm User"**
4. Click **"Create User"**
5. Sau đó chạy SQL để set role admin:

```sql
UPDATE public.users 
SET role = 'admin', full_name = 'Administrator'
WHERE email = 'admin@mediaflow.com';
```

#### Cách 2: Qua SQL (Nếu function đã được tạo)

```sql
-- Tạm thời bypass admin check để tạo admin đầu tiên
-- Cách này cần modify function hoặc chạy trực tiếp SQL
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
  '{"provider":"email","providers":["email"]}',
  '{"full_name":"Administrator"}',
  NOW(),
  NOW()
);
```

## 📚 SQL Functions

### 1. create_user() - Tạo User Mới

**Chỉ admin mới có quyền gọi function này**

```sql
SELECT public.create_user(
  p_email := 'john.doe@example.com',
  p_password := 'SecurePass123',
  p_full_name := 'John Doe',
  p_phone := '+1234567890',
  p_role := 'user',           -- 'admin' | 'manager' | 'user'
  p_status := 'active'        -- 'active' | 'inactive' | 'suspended'
);
```

**Kết quả trả về:**
```json
{
  "success": true,
  "user_id": "uuid-here",
  "email": "john.doe@example.com",
  "full_name": "John Doe",
  "role": "user",
  "status": "active",
  "message": "User created successfully"
}
```

### 2. update_user() - Cập Nhật User

```sql
SELECT public.update_user(
  p_user_id := 'user-uuid-here',
  p_full_name := 'John Smith',
  p_phone := '+0987654321',
  p_role := 'manager',
  p_status := 'active'
);
```

### 3. delete_user() - Xóa User

```sql
SELECT public.delete_user(
  p_user_id := 'user-uuid-here'
);
```

**Lưu ý:** Không thể xóa chính mình

### 4. reset_user_password() - Reset Mật Khẩu

```sql
SELECT public.reset_user_password(
  p_user_id := 'user-uuid-here',
  p_new_password := 'NewPassword123'
);
```

## 💻 Sử Dụng Trong Frontend

### Import Functions

```typescript
import {
  createUser,
  updateUser,
  deleteUser,
  resetUserPassword,
  getAllUsers,
  getUserById,
  getCurrentUserProfile,
} from '@/lib/userManagement'
```

### 1. Tạo User Mới

```typescript
const result = await createUser({
  email: 'john.doe@example.com',
  password: 'SecurePass123',
  full_name: 'John Doe',
  phone: '+1234567890',
  role: 'user',
  status: 'active',
})

if (result.success) {
  console.log('User created:', result.user_id)
} else {
  console.error('Error:', result.message)
}
```

### 2. Cập Nhật User

```typescript
const result = await updateUser({
  user_id: 'uuid-here',
  full_name: 'John Smith',
  phone: '+0987654321',
  role: 'manager',
  status: 'active',
})
```

### 3. Xóa User

```typescript
const result = await deleteUser('user-uuid-here')

if (result.success) {
  console.log('User deleted successfully')
}
```

### 4. Reset Password

```typescript
const result = await resetUserPassword(
  'user-uuid-here',
  'NewPassword123'
)
```

### 5. Lấy Tất Cả Users

```typescript
const { success, users, error } = await getAllUsers()

if (success && users) {
  console.log('Total users:', users.length)
  users.forEach(user => {
    console.log(user.email, user.role, user.status)
  })
}
```

### 6. Lấy User Theo ID

```typescript
const { success, user, error } = await getUserById('uuid-here')
```

### 7. Lấy Profile Của User Hiện Tại

```typescript
const { success, user, error } = await getCurrentUserProfile()
```

## 🔐 Bảo Mật

### Row Level Security (RLS)

Các policy đã được thiết lập:

1. ✅ Users chỉ xem được profile của mình
2. ✅ Users chỉ cập nhật được profile của mình
3. ✅ Admin xem được tất cả users
4. ✅ Admin cập nhật được tất cả users
5. ✅ Các functions chỉ admin mới gọi được

### Validation

Functions tự động validate:
- ✅ Email format
- ✅ Email unique (không trùng)
- ✅ Role (admin, manager, user)
- ✅ Status (active, inactive, suspended)
- ✅ Password length (tối thiểu 6 ký tự)
- ✅ Admin check (chỉ admin gọi được functions)
- ✅ Prevent self-deletion

## 🧪 Testing

### Test Tạo User

```typescript
// Test trong React component hoặc console
const testCreateUser = async () => {
  const result = await createUser({
    email: 'test@example.com',
    password: 'Test123456',
    full_name: 'Test User',
    role: 'user',
  })
  console.log(result)
}
```

### Test SQL Trực Tiếp

```sql
-- Test trong Supabase SQL Editor
-- Đăng nhập bằng admin account trước

SELECT public.create_user(
  'test@example.com',
  'Test123456',
  'Test User',
  NULL,
  'user',
  'active'
);
```

## 🐛 Troubleshooting

### Lỗi: "Only admins can create users"

**Nguyên nhân:** User hiện tại không có role admin

**Giải pháp:**
```sql
-- Check role của user hiện tại
SELECT id, email, role FROM public.users WHERE id = auth.uid();

-- Nếu cần, update role thành admin
UPDATE public.users SET role = 'admin' WHERE email = 'your-email@example.com';
```

### Lỗi: "Email already exists"

**Nguyên nhân:** Email đã được sử dụng

**Giải pháp:** Sử dụng email khác hoặc xóa user cũ

### Lỗi: "Invalid role" hoặc "Invalid status"

**Nguyên nhân:** Giá trị không hợp lệ

**Giải pháp:** Sử dụng đúng giá trị:
- Role: `'admin'`, `'manager'`, `'user'`
- Status: `'active'`, `'inactive'`, `'suspended'`

## 📊 Database Schema

```sql
-- public.users table
{
  id: UUID (PK, FK -> auth.users.id),
  email: TEXT (UNIQUE),
  full_name: TEXT,
  avatar_url: TEXT,
  phone: TEXT,
  role: TEXT ('admin' | 'manager' | 'user'),
  status: TEXT ('active' | 'inactive' | 'suspended'),
  created_at: TIMESTAMPTZ,
  updated_at: TIMESTAMPTZ
}
```

## 🎯 Best Practices

1. **Luôn validate input** trước khi gọi functions
2. **Handle errors properly** và hiển thị message cho user
3. **Không hardcode passwords** trong code
4. **Sử dụng environment variables** cho sensitive data
5. **Log errors** để debug dễ dàng
6. **Test thoroughly** trước khi deploy
7. **Backup database** thường xuyên

## 📝 Notes

- Functions sử dụng `SECURITY DEFINER` nên cần cẩn thận với permissions
- Passwords được hash bằng bcrypt (`crypt()` function)
- Trigger tự động tạo profile khi user signup
- Trigger tự động update `updated_at` timestamp
- Cascade delete: xóa auth.users sẽ tự động xóa public.users

## 🔗 Tài Liệu Tham Khảo

- [Supabase Auth Documentation](https://supabase.com/docs/guides/auth)
- [PostgreSQL Functions](https://www.postgresql.org/docs/current/sql-createfunction.html)
- [Row Level Security](https://supabase.com/docs/guides/auth/row-level-security)
