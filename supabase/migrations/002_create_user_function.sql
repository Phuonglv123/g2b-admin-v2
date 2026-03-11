-- =============================================
-- Create User Function for Admin
-- This function allows admins to create new users
-- =============================================

-- Function to create a new user (Admin only)
CREATE OR REPLACE FUNCTION public.create_user(
  p_email TEXT,
  p_password TEXT,
  p_full_name TEXT DEFAULT NULL,
  p_phone TEXT DEFAULT NULL,
  p_role TEXT DEFAULT 'user',
  p_status TEXT DEFAULT 'active'
)
RETURNS JSON AS $$
DECLARE
  v_user_id UUID;
  v_result JSON;
BEGIN
  -- Check if the caller is an admin
  IF NOT EXISTS (
    SELECT 1 FROM public.users 
    WHERE id = auth.uid() AND role = 'admin'
  ) THEN
    RAISE EXCEPTION 'Only admins can create users';
  END IF;

  -- Validate role
  IF p_role NOT IN ('admin', 'manager', 'user') THEN
    RAISE EXCEPTION 'Invalid role. Must be: admin, manager, or user';
  END IF;

  -- Validate status
  IF p_status NOT IN ('active', 'inactive', 'suspended') THEN
    RAISE EXCEPTION 'Invalid status. Must be: active, inactive, or suspended';
  END IF;

  -- Validate email format
  IF p_email !~ '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$' THEN
    RAISE EXCEPTION 'Invalid email format';
  END IF;

  -- Check if email already exists
  IF EXISTS (SELECT 1 FROM auth.users WHERE email = p_email) THEN
    RAISE EXCEPTION 'Email already exists';
  END IF;

  -- Create user in auth.users
  INSERT INTO auth.users (
    instance_id,
    id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    confirmation_token,
    recovery_token,
    email_change_token_new,
    email_change,
    raw_app_meta_data,
    raw_user_meta_data,
    created_at,
    updated_at,
    confirmation_sent_at
  ) VALUES (
    '00000000-0000-0000-0000-000000000000',
    gen_random_uuid(),
    'authenticated',
    'authenticated',
    p_email,
    crypt(p_password, gen_salt('bf')),
    NOW(),
    '',
    '',
    '',
    '',
    jsonb_build_object('provider', 'email', 'providers', ARRAY['email']),
    jsonb_build_object('full_name', p_full_name, 'phone', p_phone),
    NOW(),
    NOW(),
    NOW()
  ) RETURNING id INTO v_user_id;

  -- Create user profile in public.users
  -- The trigger will handle this automatically, but we'll update the additional fields
  UPDATE public.users 
  SET 
    full_name = COALESCE(p_full_name, full_name),
    phone = p_phone,
    role = p_role,
    status = p_status
  WHERE id = v_user_id;

  -- Return success response
  v_result := json_build_object(
    'success', true,
    'user_id', v_user_id,
    'email', p_email,
    'full_name', p_full_name,
    'role', p_role,
    'status', p_status,
    'message', 'User created successfully'
  );

  RETURN v_result;

EXCEPTION
  WHEN OTHERS THEN
    -- Return error response
    v_result := json_build_object(
      'success', false,
      'error', SQLERRM,
      'message', 'Failed to create user'
    );
    RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to update user (Admin only)
CREATE OR REPLACE FUNCTION public.update_user(
  p_user_id UUID,
  p_full_name TEXT DEFAULT NULL,
  p_phone TEXT DEFAULT NULL,
  p_role TEXT DEFAULT NULL,
  p_status TEXT DEFAULT NULL
)
RETURNS JSON AS $$
DECLARE
  v_result JSON;
BEGIN
  -- Check if the caller is an admin
  IF NOT EXISTS (
    SELECT 1 FROM public.users 
    WHERE id = auth.uid() AND role = 'admin'
  ) THEN
    RAISE EXCEPTION 'Only admins can update users';
  END IF;

  -- Validate role if provided
  IF p_role IS NOT NULL AND p_role NOT IN ('admin', 'manager', 'user') THEN
    RAISE EXCEPTION 'Invalid role. Must be: admin, manager, or user';
  END IF;

  -- Validate status if provided
  IF p_status IS NOT NULL AND p_status NOT IN ('active', 'inactive', 'suspended') THEN
    RAISE EXCEPTION 'Invalid status. Must be: active, inactive, or suspended';
  END IF;

  -- Check if user exists
  IF NOT EXISTS (SELECT 1 FROM public.users WHERE id = p_user_id) THEN
    RAISE EXCEPTION 'User not found';
  END IF;

  -- Update user profile
  UPDATE public.users 
  SET 
    full_name = COALESCE(p_full_name, full_name),
    phone = COALESCE(p_phone, phone),
    role = COALESCE(p_role, role),
    status = COALESCE(p_status, status)
  WHERE id = p_user_id;

  -- Return success response
  v_result := json_build_object(
    'success', true,
    'user_id', p_user_id,
    'message', 'User updated successfully'
  );

  RETURN v_result;

EXCEPTION
  WHEN OTHERS THEN
    v_result := json_build_object(
      'success', false,
      'error', SQLERRM,
      'message', 'Failed to update user'
    );
    RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to delete user (Admin only)
CREATE OR REPLACE FUNCTION public.delete_user(
  p_user_id UUID
)
RETURNS JSON AS $$
DECLARE
  v_result JSON;
BEGIN
  -- Check if the caller is an admin
  IF NOT EXISTS (
    SELECT 1 FROM public.users 
    WHERE id = auth.uid() AND role = 'admin'
  ) THEN
    RAISE EXCEPTION 'Only admins can delete users';
  END IF;

  -- Prevent admin from deleting themselves
  IF p_user_id = auth.uid() THEN
    RAISE EXCEPTION 'Cannot delete your own account';
  END IF;

  -- Check if user exists
  IF NOT EXISTS (SELECT 1 FROM public.users WHERE id = p_user_id) THEN
    RAISE EXCEPTION 'User not found';
  END IF;

  -- Delete user from auth.users (cascade will delete from public.users)
  DELETE FROM auth.users WHERE id = p_user_id;

  -- Return success response
  v_result := json_build_object(
    'success', true,
    'user_id', p_user_id,
    'message', 'User deleted successfully'
  );

  RETURN v_result;

EXCEPTION
  WHEN OTHERS THEN
    v_result := json_build_object(
      'success', false,
      'error', SQLERRM,
      'message', 'Failed to delete user'
    );
    RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to reset user password (Admin only)
CREATE OR REPLACE FUNCTION public.reset_user_password(
  p_user_id UUID,
  p_new_password TEXT
)
RETURNS JSON AS $$
DECLARE
  v_result JSON;
BEGIN
  -- Check if the caller is an admin
  IF NOT EXISTS (
    SELECT 1 FROM public.users 
    WHERE id = auth.uid() AND role = 'admin'
  ) THEN
    RAISE EXCEPTION 'Only admins can reset passwords';
  END IF;

  -- Check if user exists
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = p_user_id) THEN
    RAISE EXCEPTION 'User not found';
  END IF;

  -- Validate password length
  IF LENGTH(p_new_password) < 6 THEN
    RAISE EXCEPTION 'Password must be at least 6 characters';
  END IF;

  -- Update password
  UPDATE auth.users 
  SET 
    encrypted_password = crypt(p_new_password, gen_salt('bf')),
    updated_at = NOW()
  WHERE id = p_user_id;

  -- Return success response
  v_result := json_build_object(
    'success', true,
    'user_id', p_user_id,
    'message', 'Password reset successfully'
  );

  RETURN v_result;

EXCEPTION
  WHEN OTHERS THEN
    v_result := json_build_object(
      'success', false,
      'error', SQLERRM,
      'message', 'Failed to reset password'
    );
    RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions to authenticated users (functions have their own security checks)
GRANT EXECUTE ON FUNCTION public.create_user TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_user TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_user TO authenticated;
GRANT EXECUTE ON FUNCTION public.reset_user_password TO authenticated;

-- =============================================
-- Usage Examples:
-- =============================================

-- Create a new user
-- SELECT public.create_user(
--   'john.doe@example.com',
--   'SecurePass123',
--   'John Doe',
--   '+1234567890',
--   'user',
--   'active'
-- );

-- Update a user
-- SELECT public.update_user(
--   'user-uuid-here',
--   'John Smith',
--   '+0987654321',
--   'manager',
--   'active'
-- );

-- Delete a user
-- SELECT public.delete_user('user-uuid-here');

-- Reset user password
-- SELECT public.reset_user_password('user-uuid-here', 'NewPassword123');

-- =============================================
