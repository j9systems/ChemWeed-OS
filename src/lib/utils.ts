export function cn(...classes: (string | boolean | undefined | null)[]): string {
  return classes.filter(Boolean).join(' ')
}

/**
 * Parse a date-only string (YYYY-MM-DD) into a Date in local time.
 * new Date("2026-04-11") parses as UTC midnight, which shifts to the
 * previous day in US Pacific and other negative-offset timezones.
 * This helper avoids that by constructing via year/month/day parts.
 */
export function parseLocalDate(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number)
  return new Date(y!, m! - 1, d)
}

export function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '—'
  const d = dateStr.length === 10 ? parseLocalDate(dateStr) : new Date(dateStr)
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

export function formatDateTime(dateStr: string | null | undefined): string {
  if (!dateStr) return '—'
  const d = dateStr.length === 10 ? parseLocalDate(dateStr) : new Date(dateStr)
  return d.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

/** Return today's date as YYYY-MM-DD in the America/Los_Angeles timezone. */
export function todayPacific(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Los_Angeles' })
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
  // One-time WOs have no period info — always actionable.
  if (wo.period_year == null && wo.period_month == null) return true

  const now = new Date()
  const currentYear = now.getFullYear()
  const currentMonth = now.getMonth() + 1 // 1-indexed

  // Annual WOs set period_year but leave period_month null.
  // Without this branch every year of a multi-year contract surfaces at once.
  if (wo.period_month == null) {
    return (wo.period_year ?? currentYear) <= currentYear
  }

  // Monthly / weekly seasonal: surface only the current and next month.
  const nextMonth = currentMonth === 12 ? 1 : currentMonth + 1
  const nextMonthYear = currentMonth === 12 ? currentYear + 1 : currentYear

  const woPeriod = (wo.period_year ?? currentYear) * 100 + wo.period_month
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
