export type UserRole = 'admin' | 'manager' | 'user'
export type UserStatus = 'active' | 'inactive' | 'suspended'

export interface UserProfile {
  id: string
  email: string
  full_name: string | null
  avatar_url: string | null
  phone: string | null
  role: UserRole
  status: UserStatus
  created_at: string
  updated_at: string
}

export interface UpdateUserProfile {
  full_name?: string
  avatar_url?: string
  phone?: string
}

// Database types for Supabase
export interface Database {
  public: {
    Tables: {
      users: {
        Row: UserProfile
        Insert: Omit<UserProfile, 'created_at' | 'updated_at'> & {
          created_at?: string
          updated_at?: string
        }
        Update: Partial<Omit<UserProfile, 'id' | 'email' | 'created_at' | 'updated_at'>>
      }
    }
  }
}
