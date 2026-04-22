import { useState, useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { getSupabaseErrorMessage } from '@/lib/utils'
import { useUnsavedChanges } from '@/hooks/useUnsavedChanges'
import { useFormDraft } from '@/hooks/useFormDraft'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import type { Site, County, PropertyType } from '@/types/database'

interface NewSiteModalProps {
  open: boolean
  clientId: string
  clientName: string
  onSuccess: (site: Site) => void
  onCancel: () => void
}

interface NewSiteForm {
  siteName: string
  propertyType: PropertyType | ''
  address: string
  city: string
  state: string
  zip: string
  countyId: string
  acreage: string
  siteNotes: string
}

const EMPTY_FORM: NewSiteForm = {
  siteName: '',
  propertyType: '',
  address: '',
  city: '',
  state: 'CA',
  zip: '',
  countyId: '',
  acreage: '',
  siteNotes: '',
}

export function NewSiteModal({ open, clientId, clientName, onSuccess, onCancel }: NewSiteModalProps) {
  const draftKey = `new_site__${clientId}`
  const [form, setForm, clearForm] = useFormDraft<NewSiteForm>(draftKey, EMPTY_FORM)

  const [draftNotice, setDraftNotice] = useState<boolean>(() => {
    try { return localStorage.getItem(`draft__${draftKey}`) !== null } catch { return false }
  })

  // UI-only state (not persisted across reloads)
  const [counties, setCounties] = useState<County[]>([])
  const [countySearch, setCountySearch] = useState('')
  const [showCountyDropdown, setShowCountyDropdown] = useState(false)
  const countyRef = useRef<HTMLDivElement>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isDirty = JSON.stringify(form) !== JSON.stringify(EMPTY_FORM)
  useUnsavedChanges(isDirty)

  function update<K extends keyof NewSiteForm>(key: K, value: NewSiteForm[K]) {
    setForm({ ...form, [key]: value })
  }

  useEffect(() => {
    if (!open) return
    supabase
      .from('counties')
      .select('*')
      .order('name')
      .then(({ data }) => {
        if (data) setCounties(data as County[])
      })
  }, [open])

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (countyRef.current && !countyRef.current.contains(e.target as Node)) {
        setShowCountyDropdown(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  // Keep the search input synced with the selected county when counties load.
  useEffect(() => {
    if (!form.countyId || countySearch) return
    const selected = counties.find((c) => c.id === form.countyId)
    if (selected) setCountySearch(selected.name)
  }, [counties, form.countyId, countySearch])

  const selectedCounty = counties.find((c) => c.id === form.countyId) ?? null
  const filteredCounties = counties.filter((c) =>
    c.name.toLowerCase().includes(countySearch.toLowerCase())
  )

  async function handleSubmit() {
    if (!form.siteName.trim()) {
      setError('Site name is required.')
      return
    }
    if (!form.propertyType) {
      setError('Property type is required.')
      return
    }
    if (!form.countyId) {
      setError('County is required.')
      return
    }

    setSaving(true)
    setError(null)

    const { data, error: err } = await supabase
      .from('sites')
      .insert({
        client_id: clientId,
        name: form.siteName.trim(),
        property_type: form.propertyType as PropertyType,
        address_line: form.address || '',
        city: form.city || '',
        state: form.state || 'CA',
        zip: form.zip || '',
        county_id: form.countyId,
        total_acres: form.acreage ? parseFloat(form.acreage) : null,
        notes: form.siteNotes || null,
        is_active: true,
      })
      .select('*, county:counties(*)')
      .single()

    setSaving(false)

    if (err) {
      setError(getSupabaseErrorMessage(err))
      return
    }

    clearForm()
    setDraftNotice(false)
    setCountySearch('')
    onSuccess(data as Site)
  }

  function selectCounty(county: County) {
    update('countyId', county.id)
    setCountySearch(county.name)
    setShowCountyDropdown(false)
  }

  const selectClasses =
    'w-full rounded-lg border border-surface-border bg-surface-raised px-3 py-2 text-sm min-h-[44px] transition-colors focus:outline-none focus:ring-2 focus:ring-brand-green/30 focus:border-brand-green'

  return (
    <Modal open={open} onClose={onCancel} title="New Site">
      <div className="space-y-3">
        {draftNotice && (
          <div className="flex items-center justify-between text-sm text-[var(--color-text-muted)]">
            <span>Draft restored.</span>
            <button
              type="button"
              onClick={() => { clearForm(); setDraftNotice(false); setCountySearch('') }}
              className="ml-2 hover:text-[var(--color-text-primary)]"
            >
              &times;
            </button>
          </div>
        )}
        <div className="rounded-lg bg-surface-raised border border-surface-border px-3 py-2 text-sm">
          <span className="text-[var(--color-text-muted)]">Client:</span>{' '}
          <span className="font-medium">{clientName}</span>
        </div>

        <Input
          label="Site Name *"
          value={form.siteName}
          onChange={(e) => update('siteName', e.target.value)}
          placeholder="e.g. Stockton Lot A"
          autoFocus
        />

        <div>
          <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-1">
            Property Type *
          </label>
          <select
            value={form.propertyType}
            onChange={(e) => update('propertyType', e.target.value as PropertyType)}
            className={selectClasses}
            required
          >
            <option value="">Select type...</option>
            <option value="commercial">Commercial</option>
            <option value="government">Government</option>
            <option value="residential">Residential</option>
          </select>
        </div>

        <Input
          label="Address"
          value={form.address}
          onChange={(e) => update('address', e.target.value)}
          placeholder="Street address"
        />

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <Input label="City" value={form.city} onChange={(e) => update('city', e.target.value)} />
          <Input label="State" value={form.state} onChange={(e) => update('state', e.target.value)} />
          <Input label="ZIP" value={form.zip} onChange={(e) => update('zip', e.target.value)} />
        </div>

        <div ref={countyRef}>
          <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-1">
            County *
          </label>
          <div className="relative">
            <input
              type="text"
              value={countySearch}
              onChange={(e) => {
                setCountySearch(e.target.value)
                setShowCountyDropdown(true)
                if (selectedCounty && e.target.value !== selectedCounty.name) {
                  update('countyId', '')
                }
              }}
              onFocus={() => setShowCountyDropdown(true)}
              placeholder="Search county..."
              className={selectClasses}
            />
            {showCountyDropdown && filteredCounties.length > 0 && (
              <ul className="absolute z-20 mt-1 max-h-40 w-full overflow-auto rounded-lg border border-surface-border bg-white shadow-lg">
                {filteredCounties.map((c) => (
                  <li key={c.id}>
                    <button
                      type="button"
                      onClick={() => selectCounty(c)}
                      className="w-full px-3 py-2 text-left text-sm hover:bg-surface-raised flex items-center justify-between"
                    >
                      <span>{c.name}</span>
                      {!c.is_licensed && (
                        <span className="text-xs text-yellow-600 ml-2">Unlicensed</span>
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
          {selectedCounty && !selectedCounty.is_licensed && (
            <div className="mt-1 rounded-lg border border-yellow-200 bg-yellow-50 px-3 py-2 text-sm text-yellow-700">
              Chem-Weed is not currently licensed in {selectedCounty.name}. Confirm before proceeding.
            </div>
          )}
        </div>

        <Input
          label="Acreage"
          type="number"
          value={form.acreage}
          onChange={(e) => update('acreage', e.target.value)}
          placeholder="Optional"
          min="0"
          step="0.01"
        />

        <div>
          <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-1">Site Notes</label>
          <textarea
            value={form.siteNotes}
            onChange={(e) => update('siteNotes', e.target.value)}
            rows={2}
            className="w-full rounded-lg border border-surface-border bg-surface-raised px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-green/30 focus:border-brand-green"
            placeholder="Optional notes..."
          />
        </div>

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        )}

        <div className="flex items-center justify-between pt-2">
          <button
            type="button"
            onClick={onCancel}
            className="text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] underline"
          >
            Cancel
          </button>
          <Button onClick={handleSubmit} disabled={saving}>
            {saving ? 'Saving...' : 'Save Site'}
          </Button>
        </div>
      </div>
    </Modal>
  )
}
