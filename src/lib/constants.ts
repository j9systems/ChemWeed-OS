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
  draft: { bg: 'bg-[#8fbc8f]/20', text: 'text-[#2d5a2d]' },
  scheduled: { bg: 'bg-amber-100', text: 'text-amber-800' },
  in_progress: { bg: 'bg-brand-green-light/20', text: 'text-brand-green-dark' },
  completed: { bg: 'bg-brand-green/15', text: 'text-brand-green-dark' },
  invoiced: { bg: 'bg-brand-green-dark/15', text: 'text-brand-green-dark' },
}

export const STATUS_BORDER_COLORS: Record<WorkOrderStatus, string> = {
  draft: 'border-l-[#8fbc8f]',
  scheduled: 'border-l-amber-500',
  in_progress: 'border-l-brand-green-light',
  completed: 'border-l-brand-green',
  invoiced: 'border-l-brand-green-dark',
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
