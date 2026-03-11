import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.replace(/\/$/, '') // Remove trailing slash
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables. Please check your .env file.')
}

console.log('Supabase URL:', supabaseUrl)

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
    flowType: 'pkce',
    storage: window.localStorage,
    storageKey: 'mediaflow-auth',
  },
  global: {
    headers: {
      'X-Client-Info': 'mediaflow-admin',
    },
  },
})

// Helper function to check and refresh session
export const checkSession = async () => {
  try {
    const { data: { session }, error } = await supabase.auth.getSession()
    
    if (error) {
      console.error('Session check error:', error)
      return null
    }

    // If session exists, check if it's expired
    if (session) {
      const expiresAt = session.expires_at
      const now = Math.floor(Date.now() / 1000)
      
      // If session expires in less than 5 minutes, refresh it
      if (expiresAt && expiresAt - now < 300) {
        console.log('Session expiring soon, refreshing...')
        const { data: { session: newSession }, error: refreshError } = await supabase.auth.refreshSession()
        
        if (refreshError) {
          console.error('Session refresh error:', refreshError)
          return null
        }
        
        return newSession
      }
      
      return session
    }
    
    return null
  } catch (error) {
    console.error('Session check exception:', error)
    return null
  }
}

// Auto check session every 5 minutes
if (typeof window !== 'undefined') {
  setInterval(() => {
    checkSession()
  }, 5 * 60 * 1000) // 5 minutes
}
