import { useState, useRef, useEffect, useCallback } from 'react'
import { MoreHorizontal } from 'lucide-react'

interface Tab {
  key: string
  label: string
}

interface TabBarProps {
  tabs: Tab[]
  activeTab: string
  onChange: (key: string) => void
}

export function TabBar({ tabs, activeTab, onChange }: TabBarProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const measureRef = useRef<HTMLDivElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const [visibleCount, setVisibleCount] = useState(tabs.length)
  const [menuOpen, setMenuOpen] = useState(false)

  const recalculate = useCallback(() => {
    const container = containerRef.current
    const measure = measureRef.current
    if (!container || !measure) return

    const moreButtonWidth = 48
    const available = container.offsetWidth
    const buttons = measure.querySelectorAll('button')
    let total = 0
    let count = 0

    for (const btn of buttons) {
      total += btn.offsetWidth
      if (total > available - moreButtonWidth && count < tabs.length) {
        break
      }
      count++
    }

    // If all tabs fit without the more button, show them all
    if (total <= available) {
      setVisibleCount(tabs.length)
    } else {
      setVisibleCount(Math.max(count, 1))
    }
  }, [tabs])

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const observer = new ResizeObserver(recalculate)
    observer.observe(container)
    return () => observer.disconnect()
  }, [recalculate])

  // Close menu on outside click
  useEffect(() => {
    if (!menuOpen) return
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [menuOpen])

  const visibleTabs = tabs.slice(0, visibleCount)
  const overflowTabs = tabs.slice(visibleCount)
  const activeInOverflow = overflowTabs.some((t) => t.key === activeTab)

  const tabClassName = (isActive: boolean) =>
    `min-h-[44px] px-4 text-sm font-medium whitespace-nowrap transition-colors ${
      isActive
        ? 'border-b-2 border-[#2a6b2a] text-[#2a6b2a]'
        : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]'
    }`

  return (
    <nav ref={containerRef} className="relative flex items-center px-4 pt-2">
      {/* Hidden measurement row */}
      <div ref={measureRef} className="absolute invisible flex pointer-events-none" aria-hidden="true">
        {tabs.map((tab) => (
          <button key={tab.key} className="px-4 text-sm font-medium whitespace-nowrap">
            {tab.label}
          </button>
        ))}
      </div>

      {/* Visible tabs */}
      {visibleTabs.map((tab) => (
        <button
          key={tab.key}
          onClick={() => onChange(tab.key)}
          className={tabClassName(activeTab === tab.key)}
        >
          {tab.label}
        </button>
      ))}

      {/* Overflow menu */}
      {overflowTabs.length > 0 && (
        <div className="relative ml-auto" ref={menuRef}>
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className={`min-h-[44px] px-3 text-sm font-medium transition-colors ${
              activeInOverflow
                ? 'border-b-2 border-[#2a6b2a] text-[#2a6b2a]'
                : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]'
            }`}
            aria-label="More tabs"
          >
            <MoreHorizontal size={18} />
          </button>
          {menuOpen && (
            <div className="absolute right-0 top-full mt-1 min-w-[140px] bg-surface-raised shadow-card rounded-lg py-1 z-50 border border-surface-border">
              {overflowTabs.map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => {
                    onChange(tab.key)
                    setMenuOpen(false)
                  }}
                  className={`block w-full text-left px-4 py-2 text-sm transition-colors ${
                    activeTab === tab.key
                      ? 'text-[#2a6b2a] font-medium bg-[#2a6b2a]/5'
                      : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:bg-surface/50'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </nav>
  )
}
