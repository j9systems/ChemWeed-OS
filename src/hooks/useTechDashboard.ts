import { useState, useEffect, useCallback, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import { useMyWorkOrders } from '@/hooks/useWorkOrders'
import { todayPacific } from '@/lib/utils'
import type { WorkOrder } from '@/types/database'

interface TechDashboardData {
  todayJobs: WorkOrder[]
  upcomingJobs: WorkOrder[]
  needsReportCount: number
  isLoading: boolean
  error: string | null
  refetch: () => void
}

export function useTechDashboard(teamMemberId: string | undefined): TechDashboardData {
  const { workOrders, isLoading: woLoading, error: woError, refetch: woRefetch } = useMyWorkOrders(teamMemberId)
  const [needsReportCount, setNeedsReportCount] = useState(0)
  const [countLoading, setCountLoading] = useState(false)
  const [countError, setCountError] = useState<string | null>(null)

  const todayStr = todayPacific()

  const { todayJobs, upcomingJobs } = useMemo(() => {
    const today: WorkOrder[] = []
    const upcoming: WorkOrder[] = []

    const fourteenDaysLater = new Date()
    fourteenDaysLater.setDate(fourteenDaysLater.getDate() + 14)
    const fourteenDaysStr = fourteenDaysLater.toLocaleDateString('en-CA', { timeZone: 'America/Los_Angeles' })

    for (const wo of workOrders) {
      if (
        (wo.status === 'scheduled' || wo.status === 'in_progress') &&
        wo.scheduled_date === todayStr
      ) {
        today.push(wo)
      } else if (
        wo.status === 'scheduled' &&
        wo.scheduled_date &&
        wo.scheduled_date > todayStr &&
        wo.scheduled_date <= fourteenDaysStr
      ) {
        upcoming.push(wo)
      }
    }

    return { todayJobs: today, upcomingJobs: upcoming }
  }, [workOrders, todayStr])

  const fetchNeedsReport = useCallback(async () => {
    if (!teamMemberId) return
    setCountLoading(true)
    setCountError(null)

    // Get completed work order IDs assigned to this team member
    const { data: crewRows, error: crewErr } = await supabase
      .from('work_order_crew')
      .select('work_order_id')
      .eq('team_member_id', teamMemberId)

    if (crewErr) {
      setCountError(crewErr.message)
      setCountLoading(false)
      return
    }

    const woIds = (crewRows ?? []).map((r: { work_order_id: string }) => r.work_order_id)
    if (woIds.length === 0) {
      setNeedsReportCount(0)
      setCountLoading(false)
      return
    }

    // Get completed work orders
    const { data: completedWOs, error: woErr } = await supabase
      .from('work_orders')
      .select('id')
      .in('id', woIds)
      .eq('status', 'completed')

    if (woErr) {
      setCountError(woErr.message)
      setCountLoading(false)
      return
    }

    const completedIds = (completedWOs ?? []).map((wo: { id: string }) => wo.id)
    if (completedIds.length === 0) {
      setNeedsReportCount(0)
      setCountLoading(false)
      return
    }

    // Get field completions for these work orders
    const { data: fieldLogs, error: flErr } = await supabase
      .from('field_completions')
      .select('work_order_id')
      .in('work_order_id', completedIds)

    if (flErr) {
      setCountError(flErr.message)
      setCountLoading(false)
      return
    }

    const loggedIds = new Set((fieldLogs ?? []).map((fl: { work_order_id: string }) => fl.work_order_id))
    const missingCount = completedIds.filter((id: string) => !loggedIds.has(id)).length
    setNeedsReportCount(missingCount)
    setCountLoading(false)
  }, [teamMemberId])

  useEffect(() => { fetchNeedsReport() }, [fetchNeedsReport])

  const refetch = useCallback(() => {
    woRefetch()
    fetchNeedsReport()
  }, [woRefetch, fetchNeedsReport])

  return {
    todayJobs,
    upcomingJobs,
    needsReportCount,
    isLoading: woLoading || countLoading,
    error: woError || countError,
    refetch,
  }
}
