import { createContext, useState, useEffect, useCallback, type ReactNode } from 'react'
import type { User } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import type { Role, TeamMember } from '@/types/database'
import { getSupabaseErrorMessage } from '@/lib/utils'

export interface AuthContextValue {
  user: User | null
  teamMember: TeamMember | null
  role: Role | null
  isLoading: boolean
  teamError: string | null
  signIn: (email: string, password: string) => Promise<{ error: string | null }>
  signOut: () => Promise<void>
}

export const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [teamMember, setTeamMember] = useState<TeamMember | null>(null)
  const [role, setRole] = useState<Role | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [teamError, setTeamError] = useState<string | null>(null)

  const resolveTeamMember = useCallback(async (email: string) => {
    setTeamError(null)
    const { data, error } = await supabase
      .from('team')
      .select('*')
      .eq('email', email)
      .single()

    if (error) {
      const msg = error.code === 'PGRST116'
        ? `No team record found for email: ${email}. Check that the team table has a row where email matches this auth user's email.`
        : `Team lookup failed: ${error.message} (code: ${error.code})`
      console.error(msg, error)
      setTeamError(msg)
      setTeamMember(null)
      setRole(null)
      return
    }

    if (!data) {
      setTeamError(`Query returned no data for email: ${email}`)
      setTeamMember(null)
      setRole(null)
      return
    }

    setTeamMember(data as TeamMember)
    setRole((data as TeamMember).role)
  }, [])

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      const currentUser = session?.user ?? null
      setUser(currentUser)
      if (currentUser?.email) {
        resolveTeamMember(currentUser.email).finally(() => setIsLoading(false))
      } else {
        setIsLoading(false)
      }
    }).catch(() => {
      setIsLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      const currentUser = session?.user ?? null
      setUser(currentUser)
      if (currentUser?.email) {
        resolveTeamMember(currentUser.email)
      } else {
        setTeamMember(null)
        setRole(null)
      }
    })

    return () => subscription.unsubscribe()
  }, [resolveTeamMember])

  const signIn = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      return { error: getSupabaseErrorMessage(error) }
    }
    return { error: null }
  }, [])

  const signOut = useCallback(async () => {
    await supabase.auth.signOut()
    setUser(null)
    setTeamMember(null)
    setRole(null)
  }, [])

  return (
    <AuthContext.Provider value={{ user, teamMember, role, isLoading, teamError, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}
