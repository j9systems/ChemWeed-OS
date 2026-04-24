import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import type { ClientContact } from '@/types/database'

export function useClientContacts(clientId: string | undefined) {
  const [contacts, setContacts] = useState<ClientContact[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetch = useCallback(async () => {
    if (!clientId) { setIsLoading(false); return }
    setIsLoading(true)
    setError(null)
    const { data, error: err } = await supabase
      .from('client_contacts')
      .select('*')
      .eq('client_id', clientId)
      .order('is_primary', { ascending: false })
      .order('is_billing', { ascending: false })
      .order('name')
    if (err) setError(err.message)
    else setContacts((data ?? []) as ClientContact[])
    setIsLoading(false)
  }, [clientId])

  useEffect(() => { fetch() }, [fetch])

  return { contacts, isLoading, error, refetch: fetch }
}
