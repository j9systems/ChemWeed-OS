export function cn(...classes: (string | boolean | undefined | null)[]): string {
  return classes.filter(Boolean).join(' ')
}

export function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

export function formatDateTime(dateStr: string | null | undefined): string {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(amount)
}

/**
 * Returns true if a work order's period is actionable:
 * - One-time (no period): always actionable
 * - Period is current month or earlier: actionable
 * - Period is exactly next calendar month: actionable
 * - Period is further in the future: not actionable yet
 */
export function isWorkOrderActionable(wo: { period_year: number | null; period_month: number | null }): boolean {
  if (wo.period_year == null || wo.period_month == null) return true // one-time or annual

  const now = new Date()
  const currentYear = now.getFullYear()
  const currentMonth = now.getMonth() + 1 // 1-indexed

  // Next month, handling year rollover
  const nextMonth = currentMonth === 12 ? 1 : currentMonth + 1
  const nextMonthYear = currentMonth === 12 ? currentYear + 1 : currentYear

  const woPeriod = wo.period_year * 100 + wo.period_month
  const nextPeriod = nextMonthYear * 100 + nextMonth

  return woPeriod <= nextPeriod
}

export function getSupabaseErrorMessage(error: { message: string; code?: string }): string {
  const messages: Record<string, string> = {
    'Invalid login credentials': 'Invalid email or password.',
    'Email not confirmed': 'Please confirm your email before signing in.',
    'User not found': 'No account found with this email.',
  }
  return messages[error.message] ?? error.message
}
