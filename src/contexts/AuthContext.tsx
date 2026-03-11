/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import type { User, Session } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import { clearAuthStorage } from '@/lib/sessionManager'
import type { UserProfile } from '@/types/user'

interface AuthContextType {
  user: User | null
  profile: UserProfile | null
  session: Session | null
  loading: boolean
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>
  signUp: (email: string, password: string, fullName?: string) => Promise<{ error: Error | null }>
  signOut: () => Promise<void>
  refreshProfile: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

interface AuthProviderProps {
  children: ReactNode
}

export const AuthProvider = ({ children }: AuthProviderProps) => {
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)

  // Fetch user profile from users table
  const fetchProfile = async (userId: string) => {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .single()

    if (error) {
      console.error('Error fetching profile:', error)
      return null
    }
    return data as UserProfile
  }

  const refreshProfile = async () => {
    if (user) {
      const profileData = await fetchProfile(user.id)
      setProfile(profileData)
    }
  }

  useEffect(() => {
    // Set a timeout to prevent infinite loading
    const loadingTimeout = setTimeout(() => {
      console.log('Loading timeout - forcing loading false')
      setLoading(false)
    }, 5000) // 5 seconds timeout

    // Get initial session
    supabase.auth.getSession()
      .then(({ data: { session }, error }) => {
        if (error) {
          console.error('Error getting session:', error)
          setSession(null)
          setUser(null)
          setProfile(null)
          setLoading(false)
          return
        }

        setSession(session)
        setUser(session?.user ?? null)
        setLoading(false)
        clearTimeout(loadingTimeout)

        if (session?.user) {
          fetchProfile(session.user.id)
            .then((profileData) => setProfile(profileData))
            .catch((error) => {
              console.error('Error fetching profile:', error)
              setProfile(null)
            })
        } else {
          setProfile(null)
        }
      })
      .catch((error) => {
        console.error('Session error:', error)
        setSession(null)
        setUser(null)
        setProfile(null)
        setLoading(false)
        clearTimeout(loadingTimeout)
      })

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      console.log('Auth state changed:', event, session?.user?.email)
      
      // Handle different auth events
      if (event === 'SIGNED_OUT') {
        setSession(null)
        setUser(null)
        setProfile(null)
        setLoading(false)
        clearAuthStorage()
        return
      }

      if (event === 'TOKEN_REFRESHED') {
        console.log('Token refreshed successfully')
      }

      setSession(session)
      setUser(session?.user ?? null)
      setLoading(false)

      if (session?.user) {
        fetchProfile(session.user.id)
          .then((profileData) => setProfile(profileData))
          .catch((error) => {
            console.error('Error fetching profile:', error)
            setProfile(null)
          })
      } else {
        setProfile(null)
      }
    })

    return () => {
      subscription.unsubscribe()
      clearTimeout(loadingTimeout)
    }
  }, [])

  const signIn = async (email: string, password: string) => {
    console.log('Attempting sign in for:', email)
    
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })
      
      console.log('Sign in result:', { data, error })
      
      if (error) {
        return { error }
      }
      
      if (data.session) {
        // Manually update state immediately for faster UI response
        setSession(data.session)
        setUser(data.session.user)
        
        // Fetch profile
        if (data.session.user) {
          try {
            const profileData = await fetchProfile(data.session.user.id)
            setProfile(profileData)
          } catch (profileError) {
            console.error('Error fetching profile after login:', profileError)
            // Still allow login even if profile fetch fails
            // Profile will be fetched again by onAuthStateChange
          }
        }
      }
      
      return { error: null }
    } catch (err) {
      console.error('Sign in exception:', err)
      return { error: err as Error }
    }
  }

  const signUp = async (email: string, password: string, fullName?: string) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName || '',
        },
      },
    })
    return { error }
  }

  const signOut = async () => {
    try {
      await supabase.auth.signOut()
      clearAuthStorage()
      setUser(null)
      setProfile(null)
      setSession(null)
    } catch (error) {
      console.error('Sign out error:', error)
      // Force clear even on error
      clearAuthStorage()
      setUser(null)
      setProfile(null)
      setSession(null)
    }
  }

  const value = {
    user,
    profile,
    session,
    loading,
    signIn,
    signUp,
    signOut,
    refreshProfile,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
