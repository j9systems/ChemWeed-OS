import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import type { Client } from '@/types/database'

interface ClientWithSiteCount extends Client {
  site_count: number
}

export function useClients() {
  const [clients, setClients] = useState<ClientWithSiteCount[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetch = useCallback(async () => {
    setIsLoading(true)
    setError(null)

    const { data, error: err } = await supabase
      .from('clients')
      .select('*, sites(count)')
      .eq('is_active', true)
      .order('name')

    if (err) {
      setError(err.message)
    } else {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Supabase aggregate query returns untyped shape
      const rows = (data ?? []) as any[]
      const mapped: ClientWithSiteCount[] = rows.map((c) => ({
        ...c,
        site_count: c.sites?.[0]?.count ?? 0,
      }))
      setClients(mapped)
    }
    setIsLoading(false)
  }, [])

  useEffect(() => { fetch() }, [fetch])

  return { clients, isLoading, error, refetch: fetch }
}

export function useClient(id: string | undefined) {
  const [client, setClient] = useState<Client | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetch = useCallback(async () => {
    if (!id) return
    setIsLoading(true)
    setError(null)

    const { data, error: err } = await supabase
      .from('clients')
      .select('*')
      .eq('id', id)
      .single()

    if (err) {
      setError(err.message)
    } else {
      setClient(data as Client)
    }
    setIsLoading(false)
  }, [id])

  useEffect(() => { fetch() }, [fetch])

  return { client, isLoading, error, refetch: fetch }
}
