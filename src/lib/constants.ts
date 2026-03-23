import type { Role, WorkOrderStatus, WindDirection } from '@/types/database'

export const ROLES: Record<Role, string> = {
  admin: 'Admin',
  manager: 'Manager',
  tech: 'Technician',
  pca: 'PCA',
}

export const WORK_ORDER_STATUSES: Record<WorkOrderStatus, string> = {
  draft: 'Draft',
  scheduled: 'Scheduled',
  in_progress: 'In Progress',
  completed: 'Completed',
  invoiced: 'Invoiced',
}

export const STATUS_COLORS: Record<WorkOrderStatus, { bg: string; text: string; border: string }> = {
  draft: { bg: 'bg-[#2a6b2a]/10', text: 'text-[#2a6b2a]', border: 'border-l-[#2a6b2a]/40' },
  scheduled: { bg: 'bg-orange-100', text: 'text-orange-800', border: 'border-l-orange-400' },
  in_progress: { bg: 'bg-emerald-100', text: 'text-emerald-800', border: 'border-l-emerald-500' },
  completed: { bg: 'bg-green-100', text: 'text-green-800', border: 'border-l-green-500' },
  invoiced: { bg: 'bg-[#2a6b2a]/15', text: 'text-[#2a6b2a]', border: 'border-l-[#2a6b2a]' },
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

export const URGENCY_COLORS: Record<string, { bg: string; text: string; border: string; selectedBg: string; selectedText: string; selectedBorder: string }> = {
  emergency: { bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200', selectedBg: 'bg-red-600', selectedText: 'text-white', selectedBorder: 'border-red-600' },
  '7_day': { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200', selectedBg: 'bg-amber-500', selectedText: 'text-white', selectedBorder: 'border-amber-500' },
  flexible: { bg: 'bg-sky-50', text: 'text-sky-700', border: 'border-sky-200', selectedBg: 'bg-sky-600', selectedText: 'text-white', selectedBorder: 'border-sky-600' },
}

export const PROPERTY_TYPES = [
  { value: 'commercial', label: 'Commercial' },
  { value: 'government', label: 'Government' },
  { value: 'residential', label: 'Residential' },
]
