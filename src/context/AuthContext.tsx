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
  signIn: (email: string, password: string) => Promise<{ error: string | null }>
  signOut: () => Promise<void>
}

export const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [teamMember, setTeamMember] = useState<TeamMember | null>(null)
  const [role, setRole] = useState<Role | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const resolveTeamMember = useCallback(async (userId: string) => {
    const { data, error } = await supabase
      .from('team')
      .select('*')
      .eq('user_id', userId)
      .single()

    if (error || !data) {
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
      if (currentUser) {
        resolveTeamMember(currentUser.id).finally(() => setIsLoading(false))
      } else {
        setIsLoading(false)
      }
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      const currentUser = session?.user ?? null
      setUser(currentUser)
      if (currentUser) {
        resolveTeamMember(currentUser.id)
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
    <AuthContext.Provider value={{ user, teamMember, role, isLoading, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}
