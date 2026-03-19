import { NavLink } from 'react-router'
import { useAuth } from '@/hooks/useAuth'
import { NAV_ITEMS } from '@/lib/navigation'
import { cn } from '@/lib/utils'

export function BottomNav() {
  const { role } = useAuth()

  const visibleItems = NAV_ITEMS.filter((item) => role && item.roles.includes(role))

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 border-t border-surface-border bg-white pb-[env(safe-area-inset-bottom)]">
      <div className="flex items-center justify-around">
        {visibleItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) =>
              cn(
                'flex flex-col items-center justify-center gap-0.5 py-2 px-3 min-h-[56px] min-w-[56px] text-xs font-medium transition-colors',
                isActive
                  ? 'text-brand-green'
                  : 'text-[var(--color-text-muted)]',
              )
            }
          >
            <item.icon size={22} />
            <span>{item.label}</span>
          </NavLink>
        ))}
      </div>
    </nav>
  )
}
