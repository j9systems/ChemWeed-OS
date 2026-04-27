import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import type { FeedbackItem, FeedbackStatus, FeedbackType } from '@/types/database'

export interface FeedbackFilters {
  status?: FeedbackStatus | 'all'
  type?: FeedbackType | 'all'
  submittedBy?: string
}

export function useFeedbackItems(filters?: FeedbackFilters) {
  const [items, setItems] = useState<FeedbackItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetch = useCallback(async () => {
    setIsLoading(true)
    setError(null)

    let query = supabase
      .from('feedback_items')
      .select('*, attachments:feedback_attachments(*)')
      .order('created_at', { ascending: false })

    if (filters?.status && filters.status !== 'all') {
      query = query.eq('status', filters.status)
    }
    if (filters?.type && filters.type !== 'all') {
      query = query.eq('type', filters.type)
    }
    if (filters?.submittedBy) {
      query = query.eq('submitted_by', filters.submittedBy)
    }

    const { data, error: err } = await query
    if (err) setError(err.message)
    else setItems((data ?? []) as FeedbackItem[])
    setIsLoading(false)
  }, [filters?.status, filters?.type, filters?.submittedBy])

  useEffect(() => { fetch() }, [fetch])

  return { items, isLoading, error, refetch: fetch }
}

export function useFeedbackItem(id: string | undefined) {
  const [item, setItem] = useState<FeedbackItem | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetch = useCallback(async () => {
    if (!id) { setIsLoading(false); return }
    setIsLoading(true)
    setError(null)
    const { data, error: err } = await supabase
      .from('feedback_items')
      .select('*, attachments:feedback_attachments(*)')
      .eq('id', id)
      .single()
    if (err) setError(err.message)
    else setItem(data as FeedbackItem)
    setIsLoading(false)
  }, [id])

  useEffect(() => { fetch() }, [fetch])

  return { item, isLoading, error, refetch: fetch }
}
