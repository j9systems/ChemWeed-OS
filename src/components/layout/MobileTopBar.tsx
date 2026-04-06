import { useState, useRef, useEffect } from 'react'
import { NavLink } from 'react-router'
import { Menu, X, User } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { NAV_ITEMS } from '@/lib/navigation'
import { cn } from '@/lib/utils'

const MAX_BOTTOM_NAV_ITEMS = 6

export function MobileTopBar() {
  const { role, teamMember } = useAuth()
  const [open, setOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  const visibleItems = NAV_ITEMS.filter((item) => role && item.roles.includes(role))
  const overflowItems = visibleItems.slice(MAX_BOTTOM_NAV_ITEMS)

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    if (open) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [open])

  return (
    <header className="md:hidden fixed top-0 left-0 right-0 z-40 bg-white border-b border-surface-border pt-[env(safe-area-inset-top)]">
      <div className="flex items-center justify-between h-12 px-4">
        <img
          src="https://res.cloudinary.com/duy32f0q4/image/upload/q_auto/f_auto/v1775451528/qt_q_95_-_Edited_bgoifl.png"
          alt="ChemWeed"
          className="h-7 w-auto"
        />

        <div ref={menuRef} className="relative">
          <button
            onClick={() => setOpen((v) => !v)}
            className="flex items-center justify-center rounded-lg p-2 min-h-[44px] min-w-[44px] text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors"
            aria-label={open ? 'Close menu' : 'Open menu'}
          >
            {open ? <X size={22} /> : <Menu size={22} />}
          </button>

          {open && (
            <div className="absolute right-0 top-full mt-1 w-56 rounded-lg border border-surface-border bg-white shadow-lg py-1">
              {overflowItems.map((item) => (
                <NavLink
                  key={item.path}
                  to={item.path}
                  onClick={() => setOpen(false)}
                  className={({ isActive }) =>
                    cn(
                      'flex items-center gap-3 px-4 py-3 text-sm transition-colors',
                      isActive
                        ? 'text-brand-green font-bold bg-brand-green/5'
                        : 'text-[var(--color-text-primary)] hover:bg-surface',
                    )
                  }
                >
                  <item.icon size={20} />
                  {item.label}
                </NavLink>
              ))}

              {overflowItems.length > 0 && (
                <div className="my-1 border-t border-surface-border" />
              )}

              <NavLink
                to={teamMember ? `/team/${teamMember.id}` : '/team'}
                onClick={() => setOpen(false)}
                className={({ isActive }) =>
                  cn(
                    'flex items-center gap-3 px-4 py-3 text-sm transition-colors',
                    isActive
                      ? 'text-brand-green font-bold bg-brand-green/5'
                      : 'text-[var(--color-text-primary)] hover:bg-surface',
                  )
                }
              >
                <User size={20} />
                My Profile
              </NavLink>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
