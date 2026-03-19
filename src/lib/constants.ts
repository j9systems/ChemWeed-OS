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

export const STATUS_COLORS: Record<WorkOrderStatus, { bg: string; text: string }> = {
  draft: { bg: 'bg-zinc-100', text: 'text-zinc-700' },
  scheduled: { bg: 'bg-blue-100', text: 'text-blue-700' },
  in_progress: { bg: 'bg-amber-100', text: 'text-amber-700' },
  completed: { bg: 'bg-green-100', text: 'text-green-700' },
  invoiced: { bg: 'bg-[#2a6b2a]/10', text: 'text-[#2a6b2a]' },
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

export const PROPERTY_TYPES = [
  { value: 'commercial', label: 'Commercial' },
  { value: 'government', label: 'Government' },
  { value: 'residential', label: 'Residential' },
]
