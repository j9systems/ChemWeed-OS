import type { Role } from '@/types/database'

export function canEdit(role: Role | null): boolean {
  return role === 'admin' || role === 'manager'
}

export function canCompleteField(role: Role | null): boolean {
  return role === 'admin' || role === 'tech'
}

export function canViewClients(role: Role | null): boolean {
  return role === 'admin' || role === 'manager'
}
