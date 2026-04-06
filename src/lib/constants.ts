import type { Role, AgreementStatus, WorkOrderStatus, WindDirection, FrequencyType } from '@/types/database'

export const ROLES: Record<Role, string> = {
  admin: 'Admin',
  manager: 'Manager',
  technician: 'Technician',
  pca: 'PCA',
}

export const AGREEMENT_STATUSES: Record<AgreementStatus, string> = {
  draft: 'Draft',
  active: 'Active',
  completed: 'Completed',
  cancelled: 'Cancelled',
}

export const WORK_ORDER_STATUSES: Record<WorkOrderStatus, string> = {
  unscheduled: 'Unscheduled',
  tentative: 'Tentative',
  scheduled: 'Scheduled',
  in_progress: 'In Progress',
  completed: 'Completed',
  cancelled: 'Cancelled',
}

export const AGREEMENT_STATUS_COLORS: Record<AgreementStatus, { bg: string; text: string; border: string }> = {
  draft: { bg: 'bg-gray-100', text: 'text-gray-500', border: 'border-l-gray-300' },
  active: { bg: 'bg-emerald-100', text: 'text-emerald-800', border: 'border-l-emerald-500' },
  completed: { bg: 'bg-green-100', text: 'text-green-800', border: 'border-l-green-500' },
  cancelled: { bg: 'bg-red-100', text: 'text-red-700', border: 'border-l-red-400' },
}

export const WO_STATUS_COLORS: Record<WorkOrderStatus, { bg: string; text: string; border: string }> = {
  unscheduled: { bg: 'bg-gray-100', text: 'text-gray-600', border: 'border-l-gray-400' },
  tentative: { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-l-amber-400' },
  scheduled: { bg: 'bg-blue-100', text: 'text-blue-800', border: 'border-l-blue-500' },
  in_progress: { bg: 'bg-emerald-100', text: 'text-emerald-800', border: 'border-l-emerald-500' },
  completed: { bg: 'bg-green-100', text: 'text-green-800', border: 'border-l-green-500' },
  cancelled: { bg: 'bg-red-100', text: 'text-red-700', border: 'border-l-red-400' },
}

export const FREQUENCY_LABELS: Record<FrequencyType, string> = {
  one_time: 'One-time',
  annual: 'Annual',
  monthly_seasonal: 'Monthly',
  weekly_seasonal: 'Weekly',
}

export const MONTH_NAMES = [
  'Jan','Feb','Mar','Apr','May','Jun',
  'Jul','Aug','Sep','Oct','Nov','Dec',
]

export function formatPeriodLabel(wo: { period_month?: number | null; period_year?: number | null; period_week?: number | null }): string {
  if (!wo.period_month && !wo.period_year) return 'One-time'
  const month = wo.period_month ? MONTH_NAMES[wo.period_month - 1] : ''
  const year = wo.period_year ? String(wo.period_year) : ''
  const week = wo.period_week ? ` – Week ${wo.period_week}` : ''
  return `${month} ${year}${week}`.trim()
}

export const WIND_DIRECTIONS: WindDirection[] = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW']

export const FREQUENCY_TYPES = [
  'Type 1',
  'Type 2',
  'Type 3',
  'Type 4',
  'Type 6',
  'Type 12',
]

interface UrgencyColor { bg: string; text: string; border: string; selectedBg: string; selectedText: string; selectedBorder: string }

const URGENCY_FALLBACK: UrgencyColor = { bg: 'bg-sky-50', text: 'text-sky-700', border: 'border-sky-200', selectedBg: 'bg-sky-600', selectedText: 'text-white', selectedBorder: 'border-sky-600' }

const URGENCY_COLORS_MAP: Record<string, UrgencyColor> = {
  emergency: { bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200', selectedBg: 'bg-red-600', selectedText: 'text-white', selectedBorder: 'border-red-600' },
  '7_day': { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200', selectedBg: 'bg-amber-500', selectedText: 'text-white', selectedBorder: 'border-amber-500' },
  flexible: URGENCY_FALLBACK,
}

export function getUrgencyColors(key: string): UrgencyColor {
  return URGENCY_COLORS_MAP[key] ?? URGENCY_FALLBACK
}

// ---------------------------------------------------------------------------
// Service-type color map – used for card left-border accent & service pill.
// Add new entries here as service types are created.
// ---------------------------------------------------------------------------
export interface ServiceColor { border: string; bg: string; text: string }

const SERVICE_COLOR_PALETTE: ServiceColor[] = [
  { border: '#2563eb', bg: 'bg-blue-50',    text: 'text-blue-700' },    // 0
  { border: '#d97706', bg: 'bg-amber-50',   text: 'text-amber-700' },   // 1
  { border: '#0891b2', bg: 'bg-cyan-50',    text: 'text-cyan-700' },    // 2
  { border: '#7c3aed', bg: 'bg-violet-50',  text: 'text-violet-700' },  // 3
  { border: '#059669', bg: 'bg-emerald-50', text: 'text-emerald-700' }, // 4
  { border: '#dc2626', bg: 'bg-red-50',     text: 'text-red-700' },     // 5
  { border: '#db2777', bg: 'bg-pink-50',    text: 'text-pink-700' },    // 6
  { border: '#4f46e5', bg: 'bg-indigo-50',  text: 'text-indigo-700' },  // 7
  { border: '#ca8a04', bg: 'bg-yellow-50',  text: 'text-yellow-700' },  // 8
  { border: '#0d9488', bg: 'bg-teal-50',    text: 'text-teal-700' },    // 9
]

const SERVICE_NAME_COLOR_MAP: Record<string, number> = {
  'Bare Ground Treatment': 0,
  'Cleanup': 1,
  'Aquatic Herbicide Application': 2,
  'Weed Abatement': 3,
  'Vegetation Management': 4,
  'Pre-Emergent Application': 5,
  'Right-of-Way Spraying': 6,
  'Soil Sterilization': 7,
  'Brush Control': 8,
  'Industrial Weed Control': 9,
}

const SERVICE_FALLBACK: ServiceColor = { border: '#6b7280', bg: 'bg-gray-100', text: 'text-gray-700' }

/** Simple hash to deterministically pick a colour for unknown service names. */
function hashIndex(s: string): number {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0
  return Math.abs(h) % SERVICE_COLOR_PALETTE.length
}

export function getServiceColor(name: string | undefined): ServiceColor {
  if (!name) return SERVICE_FALLBACK
  const idx = SERVICE_NAME_COLOR_MAP[name]
  if (idx !== undefined) return SERVICE_COLOR_PALETTE[idx]!
  return SERVICE_COLOR_PALETTE[hashIndex(name)]!
}

export const PROPERTY_TYPES = [
  { value: 'commercial', label: 'Commercial' },
  { value: 'government', label: 'Government' },
  { value: 'residential', label: 'Residential' },
]
