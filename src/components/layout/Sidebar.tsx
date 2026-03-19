import { NavLink } from 'react-router'
import { LogOut } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { NAV_ITEMS } from '@/lib/navigation'
import { cn } from '@/lib/utils'

export function Sidebar() {
  const { role, teamMember, signOut } = useAuth()

  const visibleItems = NAV_ITEMS.filter((item) => role && item.roles.includes(role))

  return (
    <aside className="hidden md:flex md:flex-col md:w-64 border-r border-surface-border bg-white">
      <div className="flex items-center gap-2 px-6 py-5 border-b border-surface-border">
        <div className="h-8 w-8 rounded-lg bg-brand-green flex items-center justify-center">
          <span className="text-white font-bold text-sm">CW</span>
        </div>
        <span className="font-semibold text-lg">ChemWeed</span>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-1">
        {visibleItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 px-3 py-2.5 text-sm transition-colors',
                isActive
                  ? 'font-bold text-brand-green border-r-[3px] border-brand-green'
                  : 'font-medium text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]',
              )
            }
          >
            <item.icon size={20} />
            {item.label}
          </NavLink>
        ))}
      </nav>

      <div className="border-t border-surface-border px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="min-w-0">
            <p className="text-sm font-medium truncate">
              {teamMember ? `${teamMember.first_name} ${teamMember.last_name}` : 'User'}
            </p>
            <p className="text-xs text-[var(--color-text-muted)] capitalize">{role}</p>
          </div>
          <button
            onClick={signOut}
            className="rounded-lg p-2 text-[var(--color-text-muted)] hover:bg-surface-raised min-h-[44px] min-w-[44px] flex items-center justify-center"
          >
            <LogOut size={18} />
          </button>
        </div>
      </div>
    </aside>
  )
}
