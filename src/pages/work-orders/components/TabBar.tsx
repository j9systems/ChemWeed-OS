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
  return (
    <nav className="flex overflow-x-auto border-b border-surface-border mx-4" style={{ WebkitOverflowScrolling: 'touch' }}>
      {tabs.map((tab) => (
        <button
          key={tab.key}
          onClick={() => onChange(tab.key)}
          className={`min-h-[44px] px-4 text-sm font-medium whitespace-nowrap transition-colors ${
            activeTab === tab.key
              ? 'border-b-2 border-[#2a6b2a] text-[#2a6b2a]'
              : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]'
          }`}
        >
          {tab.label}
        </button>
      ))}
    </nav>
  )
}
