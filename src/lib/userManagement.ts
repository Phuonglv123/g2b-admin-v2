import { supabase } from './supabase'
import type { UserProfile } from '@/types/user'

// =============================================
// User Management Functions
// These functions call Supabase RPC functions
// =============================================

export interface CreateUserParams {
  email: string
  password: string
  full_name?: string
  phone?: string
  role?: 'admin' | 'manager' | 'user'
  status?: 'active' | 'inactive' | 'suspended'
}

export interface UpdateUserParams {
  user_id: string
  full_name?: string
  phone?: string
  role?: 'admin' | 'manager' | 'user'
  status?: 'active' | 'inactive' | 'suspended'
}

export interface UserResponse {
  success: boolean
  user_id?: string
  email?: string
  full_name?: string
  role?: string
  status?: string
  error?: string
  message: string
}

/**
 * Create a new user (Admin only)
 */
export async function createUser(params: CreateUserParams): Promise<UserResponse> {
  try {
    const { data, error } = await supabase.rpc('create_user', {
      p_email: params.email,
      p_password: params.password,
      p_full_name: params.full_name || null,
      p_phone: params.phone || null,
      p_role: params.role || 'user',
      p_status: params.status || 'active',
    })

    if (error) {
      console.error('Create user error:', error)
      return {
        success: false,
        message: error.message,
        error: error.message,
      }
    }

    return data as UserResponse
  } catch (error) {
    console.error('Create user exception:', error)
    return {
      success: false,
      message: 'Failed to create user',
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

/**
 * Update an existing user (Admin only)
 */
export async function updateUser(params: UpdateUserParams): Promise<UserResponse> {
  try {
    const { data, error } = await supabase.rpc('update_user', {
      p_user_id: params.user_id,
      p_full_name: params.full_name || null,
      p_phone: params.phone || null,
      p_role: params.role || null,
      p_status: params.status || null,
    })

    if (error) {
      console.error('Update user error:', error)
      return {
        success: false,
        message: error.message,
        error: error.message,
      }
    }

    return data as UserResponse
  } catch (error) {
    console.error('Update user exception:', error)
    return {
      success: false,
      message: 'Failed to update user',
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

/**
 * Delete a user (Admin only)
 */
export async function deleteUser(userId: string): Promise<UserResponse> {
  try {
    const { data, error } = await supabase.rpc('delete_user', {
      p_user_id: userId,
    })

    if (error) {
      console.error('Delete user error:', error)
      return {
        success: false,
        message: error.message,
        error: error.message,
      }
    }

    return data as UserResponse
  } catch (error) {
    console.error('Delete user exception:', error)
    return {
      success: false,
      message: 'Failed to delete user',
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

/**
 * Reset user password (Admin only)
 */
export async function resetUserPassword(
  userId: string,
  newPassword: string
): Promise<UserResponse> {
  try {
    const { data, error } = await supabase.rpc('reset_user_password', {
      p_user_id: userId,
      p_new_password: newPassword,
    })

    if (error) {
      console.error('Reset password error:', error)
      return {
        success: false,
        message: error.message,
        error: error.message,
      }
    }

    return data as UserResponse
  } catch (error) {
    console.error('Reset password exception:', error)
    return {
      success: false,
      message: 'Failed to reset password',
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

/**
 * Get all users (Admin only)
 */
export async function getAllUsers(): Promise<{
  success: boolean
  users?: UserProfile[]
  error?: string
}> {
  try {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Get users error:', error)
      return {
        success: false,
        error: error.message,
      }
    }

    return {
      success: true,
      users: data as UserProfile[],
    }
  } catch (error) {
    console.error('Get users exception:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

/**
 * Get user by ID
 */
export async function getUserById(userId: string): Promise<{
  success: boolean
  user?: UserProfile
  error?: string
}> {
  try {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .single()

    if (error) {
      console.error('Get user error:', error)
      return {
        success: false,
        error: error.message,
      }
    }

    return {
      success: true,
      user: data as UserProfile,
    }
  } catch (error) {
    console.error('Get user exception:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

/**
 * Get current user profile
 */
export async function getCurrentUserProfile(): Promise<{
  success: boolean
  user?: UserProfile
  error?: string
}> {
  try {
    const { data: { user: authUser } } = await supabase.auth.getUser()
    
    if (!authUser) {
      return {
        success: false,
        error: 'Not authenticated',
      }
    }

    return getUserById(authUser.id)
  } catch (error) {
    console.error('Get current user exception:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}
