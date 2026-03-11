/**
 * Session Management Utilities
 * Helper functions to manage authentication sessions
 */

import { supabase } from './supabase'

/**
 * Clear all auth-related data from localStorage
 */
export const clearAuthStorage = () => {
  const keysToRemove: string[] = []
  
  // Find all keys that contain 'auth' or 'supabase'
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i)
    if (key && (key.includes('auth') || key.includes('supabase') || key.includes('mediaflow'))) {
      keysToRemove.push(key)
    }
  }
  
  // Remove all auth-related keys
  keysToRemove.forEach(key => localStorage.removeItem(key))
  
  console.log('Cleared auth storage:', keysToRemove)
}

/**
 * Check if the current session is valid
 */
export const isSessionValid = async (): Promise<boolean> => {
  try {
    const { data: { session }, error } = await supabase.auth.getSession()
    
    if (error || !session) {
      return false
    }
    
    const expiresAt = session.expires_at
    const now = Math.floor(Date.now() / 1000)
    
    // Check if session is expired
    return expiresAt ? expiresAt > now : false
  } catch (error) {
    console.error('Session validation error:', error)
    return false
  }
}

/**
 * Refresh the current session
 */
export const refreshSession = async () => {
  try {
    const { data: { session }, error } = await supabase.auth.refreshSession()
    
    if (error) {
      console.error('Session refresh error:', error)
      return null
    }
    
    return session
  } catch (error) {
    console.error('Session refresh exception:', error)
    return null
  }
}

/**
 * Sign out and clear all session data
 */
export const signOutAndClear = async () => {
  try {
    await supabase.auth.signOut()
    clearAuthStorage()
    window.location.href = '/login'
  } catch (error) {
    console.error('Sign out error:', error)
    // Force clear even if signOut fails
    clearAuthStorage()
    window.location.href = '/login'
  }
}

/**
 * Check and handle expired sessions
 */
export const checkAndHandleExpiredSession = async () => {
  const isValid = await isSessionValid()
  
  if (!isValid) {
    console.log('Session expired or invalid, signing out...')
    await signOutAndClear()
    return false
  }
  
  return true
}
