import { Home, FileText, ClipboardList, CalendarDays, Building2, Users, Settings, type LucideIcon } from 'lucide-react'
import type { Role } from '@/types/database'

export interface NavItem {
  label: string
  path: string
  icon: LucideIcon
  roles: Role[]
}

export const NAV_ITEMS: NavItem[] = [
  { label: 'Home', path: '/dashboard', icon: Home, roles: ['admin', 'manager', 'technician', 'pca'] },
  { label: 'Agreements', path: '/agreements', icon: FileText, roles: ['admin', 'manager', 'technician', 'pca'] },
  { label: 'Work Orders', path: '/work-orders', icon: ClipboardList, roles: ['admin', 'manager', 'technician', 'pca'] },
  { label: 'Schedule', path: '/schedule', icon: CalendarDays, roles: ['admin', 'manager', 'technician', 'pca'] },
  { label: 'Clients', path: '/clients', icon: Building2, roles: ['admin', 'manager'] },
  { label: 'Team', path: '/team', icon: Users, roles: ['admin', 'manager'] },
  { label: 'Settings', path: '/settings', icon: Settings, roles: ['admin', 'manager'] },
]
