import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

export interface DashboardStats {
  activeAgreements: number
  pendingSignatures: number
  awaitingSend: number
  activeClients: number
}

export interface AttentionProposal {
  id: string
  agreement_number: string | null
  signing_status: string | null
  created_at: string
  signing_completed_at: string | null
  client: { name: string } | null
  site: { address_line: string; city: string } | null
}

export interface ActivityItem {
  id: string
  activity_type: string
  title: string
  description: string | null
  created_at: string
  agreement_id: string | null
  agreement: {
    agreement_number: string | null
    client: { name: string } | null
  } | null
}

interface DashboardData {
  stats: DashboardStats
  proposals: AttentionProposal[]
  activities: ActivityItem[]
}

interface DashboardState {
  data: DashboardData | null
  isLoading: boolean
  errors: { stats?: string; proposals?: string; activities?: string }
  refetch: () => void
}

async function fetchStats(): Promise<DashboardStats> {
  // Note: pendingSignatures and awaitingSend intentionally exclude signing_status='externally_signed'.
  // Externally signed contracts are already-signed imports and never need a signing action.
  // They DO count toward activeAgreements via their agreement_status='active'.
  const [activeRes, pendingRes, awaitingRes, clientsRes] = await Promise.all([
    supabase
      .from('service_agreements')
      .select('id', { count: 'exact', head: true })
      .eq('agreement_status', 'active'),
    supabase
      .from('service_agreements')
      .select('id', { count: 'exact', head: true })
      .in('signing_status', ['created', 'sent', 'pending']),
    supabase
      .from('service_agreements')
      .select('id', { count: 'exact', head: true })
      .eq('signing_status', 'not_sent'),
    supabase
      .from('clients')
      .select('id', { count: 'exact', head: true })
      .eq('is_active', true),
  ])

  return {
    activeAgreements: activeRes.count ?? 0,
    pendingSignatures: pendingRes.count ?? 0,
    awaitingSend: awaitingRes.count ?? 0,
    activeClients: clientsRes.count ?? 0,
  }
}

async function fetchProposals(): Promise<AttentionProposal[]> {
  const { data, error } = await supabase
    .from('service_agreements')
    .select('id, agreement_number, signing_status, signing_completed_at, created_at, client:clients(name), site:sites(address_line, city)')
    .in('signing_status', ['not_sent', 'created', 'sent', 'pending'])
    .order('created_at', { ascending: true })
    .limit(10)

  if (error) throw error
  return (data ?? []) as unknown as AttentionProposal[]
}

async function fetchActivities(): Promise<ActivityItem[]> {
  const { data, error } = await supabase
    .from('activities')
    .select('id, activity_type, title, description, created_at, agreement_id, agreement:service_agreements(agreement_number, client:clients(name))')
    .order('created_at', { ascending: false })
    .limit(15)

  if (error) throw error
  return (data ?? []) as unknown as ActivityItem[]
}

export function useDashboard(): DashboardState {
  const [data, setData] = useState<DashboardData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [errors, setErrors] = useState<{ stats?: string; proposals?: string; activities?: string }>({})

  const load = useCallback(async () => {
    setIsLoading(true)
    setErrors({})

    const results = await Promise.allSettled([
      fetchStats(),
      fetchProposals(),
      fetchActivities(),
    ])

    const newErrors: typeof errors = {}

    const stats = results[0].status === 'fulfilled'
      ? results[0].value
      : (() => { newErrors.stats = (results[0].reason as Error).message; return { activeAgreements: 0, pendingSignatures: 0, awaitingSend: 0, activeClients: 0 } })()

    const proposals = results[1].status === 'fulfilled'
      ? results[1].value
      : (() => { newErrors.proposals = (results[1].reason as Error).message; return [] })()

    const activities = results[2].status === 'fulfilled'
      ? results[2].value
      : (() => { newErrors.activities = (results[2].reason as Error).message; return [] })()

    setData({ stats, proposals, activities })
    setErrors(newErrors)
    setIsLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  return { data, isLoading, errors, refetch: load }
}
