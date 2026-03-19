import { useState, useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { getSupabaseErrorMessage } from '@/lib/utils'
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

export function NewSiteModal({ open, clientId, clientName, onSuccess, onCancel }: NewSiteModalProps) {
  // Site fields
  const [siteName, setSiteName] = useState('')
  const [propertyType, setPropertyType] = useState<PropertyType | ''>('')
  const [address, setAddress] = useState('')
  const [city, setCity] = useState('')
  const [state, setState] = useState('CA')
  const [zip, setZip] = useState('')
  const [countyId, setCountyId] = useState('')
  const [acreage, setAcreage] = useState('')
  const [siteNotes, setSiteNotes] = useState('')

  // County search
  const [counties, setCounties] = useState<County[]>([])
  const [countySearch, setCountySearch] = useState('')
  const [showCountyDropdown, setShowCountyDropdown] = useState(false)
  const [selectedCounty, setSelectedCounty] = useState<County | null>(null)
  const countyRef = useRef<HTMLDivElement>(null)

  // UI state
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Reset state when modal opens
  useEffect(() => {
    if (open) {
      setSiteName('')
      setPropertyType('')
      setAddress('')
      setCity('')
      setState('CA')
      setZip('')
      setCountyId('')
      setAcreage('')
      setSiteNotes('')
      setCountySearch('')
      setSelectedCounty(null)
      setError(null)
      setSaving(false)
    }
  }, [open])

  // Fetch counties once when modal opens
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

  // Close county dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (countyRef.current && !countyRef.current.contains(e.target as Node)) {
        setShowCountyDropdown(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const filteredCounties = counties.filter((c) =>
    c.name.toLowerCase().includes(countySearch.toLowerCase())
  )

  async function handleSubmit() {
    if (!siteName.trim()) {
      setError('Site name is required.')
      return
    }
    if (!propertyType) {
      setError('Property type is required.')
      return
    }
    if (!countyId) {
      setError('County is required.')
      return
    }

    setSaving(true)
    setError(null)

    const { data, error: err } = await supabase
      .from('sites')
      .insert({
        client_id: clientId,
        name: siteName.trim(),
        property_type: propertyType as PropertyType,
        address_line: address || '',
        city: city || '',
        state: state || 'CA',
        zip: zip || '',
        county_id: countyId,
        total_acres: acreage ? parseFloat(acreage) : null,
        notes: siteNotes || null,
        is_active: true,
      })
      .select('*, county:counties(*)')
      .single()

    setSaving(false)

    if (err) {
      setError(getSupabaseErrorMessage(err))
      return
    }

    onSuccess(data as Site)
  }

  function selectCounty(county: County) {
    setCountyId(county.id)
    setSelectedCounty(county)
    setCountySearch(county.name)
    setShowCountyDropdown(false)
  }

  const selectClasses =
    'w-full rounded-lg border border-surface-border bg-surface-raised px-3 py-2 text-sm min-h-[44px] transition-colors focus:outline-none focus:ring-2 focus:ring-brand-green/30 focus:border-brand-green'

  return (
    <Modal open={open} onClose={onCancel} title="New Site">
      <div className="space-y-3">
        {/* Client context header */}
        <div className="rounded-lg bg-surface-raised border border-surface-border px-3 py-2 text-sm">
          <span className="text-[var(--color-text-muted)]">Client:</span>{' '}
          <span className="font-medium">{clientName}</span>
        </div>

        <Input
          label="Site Name *"
          value={siteName}
          onChange={(e) => setSiteName(e.target.value)}
          placeholder="e.g. Stockton Lot A"
          autoFocus
        />

        <div>
          <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-1">
            Property Type *
          </label>
          <select
            value={propertyType}
            onChange={(e) => setPropertyType(e.target.value as PropertyType)}
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
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          placeholder="Street address"
        />

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <Input
            label="City"
            value={city}
            onChange={(e) => setCity(e.target.value)}
          />
          <Input
            label="State"
            value={state}
            onChange={(e) => setState(e.target.value)}
          />
          <Input
            label="ZIP"
            value={zip}
            onChange={(e) => setZip(e.target.value)}
          />
        </div>

        {/* Searchable county dropdown */}
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
                  setSelectedCounty(null)
                  setCountyId('')
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
          {/* Unlicensed county warning */}
          {selectedCounty && !selectedCounty.is_licensed && (
            <div className="mt-1 rounded-lg border border-yellow-200 bg-yellow-50 px-3 py-2 text-sm text-yellow-700">
              Chem-Weed is not currently licensed in {selectedCounty.name}. Confirm before proceeding.
            </div>
          )}
        </div>

        <Input
          label="Acreage"
          type="number"
          value={acreage}
          onChange={(e) => setAcreage(e.target.value)}
          placeholder="Optional"
          min="0"
          step="0.01"
        />

        <div>
          <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-1">Site Notes</label>
          <textarea
            value={siteNotes}
            onChange={(e) => setSiteNotes(e.target.value)}
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
