import { useState } from 'react'
import { Settings, Beaker, MapPin, FolderTree, Calculator, FileText, Building, Truck } from 'lucide-react'
import { cn } from '@/lib/utils'
import { ServicesTab } from './ServicesTab'
import { ChemicalsTab } from './ChemicalsTab'
import { CountiesTab } from './CountiesTab'
import { JobSiteCategoriesTab } from './JobSiteCategoriesTab'
import { EstimateDefaultsTab } from './EstimateDefaultsTab'
import { ReportingTab } from './ReportingTab'
import { CompanyInfoTab } from './CompanyInfoTab'
import { VehiclesTab } from './VehiclesTab'

const TABS = [
  { key: 'services', label: 'Services', icon: Settings },
  { key: 'chemicals', label: 'Chemicals', icon: Beaker },
  { key: 'counties', label: 'Counties', icon: MapPin },
  { key: 'categories', label: 'Job Site Categories', icon: FolderTree },
  { key: 'estimates', label: 'Estimate Defaults', icon: Calculator },
  { key: 'reporting', label: 'Reporting', icon: FileText },
  { key: 'company', label: 'Company Info', icon: Building },
  { key: 'vehicles', label: 'Vehicles', icon: Truck },
] as const

type TabKey = (typeof TABS)[number]['key']

export function SettingsPage() {
  const [activeTab, setActiveTab] = useState<TabKey>('services')

  return (
    <div className="p-4 md:p-6">
      <h1 className="text-2xl font-bold text-[var(--color-text-primary)] mb-6">Settings</h1>
      <div className="flex flex-col md:flex-row gap-6">
        {/* Tab Navigation */}
        <nav className="md:w-56 flex-shrink-0">
          <div className="flex md:flex-col gap-1 overflow-x-auto md:overflow-x-visible pb-2 md:pb-0">
            {TABS.map((tab) => {
              const Icon = tab.icon
              return (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={cn(
                    'flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors min-h-[40px]',
                    activeTab === tab.key
                      ? 'bg-brand-green text-white'
                      : 'text-[var(--color-text-muted)] hover:bg-surface-raised hover:text-[var(--color-text-primary)]',
                  )}
                >
                  <Icon size={16} />
                  {tab.label}
                </button>
              )
            })}
          </div>
        </nav>

        {/* Tab Content */}
        <div className="flex-1 min-w-0">
          {activeTab === 'services' && <ServicesTab />}
          {activeTab === 'chemicals' && <ChemicalsTab />}
          {activeTab === 'counties' && <CountiesTab />}
          {activeTab === 'categories' && <JobSiteCategoriesTab />}
          {activeTab === 'estimates' && <EstimateDefaultsTab />}
          {activeTab === 'reporting' && <ReportingTab />}
          {activeTab === 'company' && <CompanyInfoTab />}
          {activeTab === 'vehicles' && <VehiclesTab />}
        </div>
      </div>
    </div>
  )
}
