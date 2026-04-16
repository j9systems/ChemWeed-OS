import { useState, useEffect, useRef, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { getSupabaseErrorMessage } from '@/lib/utils'
import { useUnsavedChanges } from '@/hooks/useUnsavedChanges'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import type { Client, Site, County, PropertyType } from '@/types/database'

interface NewClientModalProps {
  open: boolean
  initialClientName: string
  onSuccess: (client: Client, site: Site) => void
  onCancel: () => void
}

export function NewClientModal({ open, initialClientName, onSuccess, onCancel }: NewClientModalProps) {
  // Step tracking
  const [step, setStep] = useState<1 | 2>(1)
  const [createdClient, setCreatedClient] = useState<Client | null>(null)

  // Step 1 — Client fields
  const [name, setName] = useState(initialClientName)
  const [billingContact, setBillingContact] = useState('')
  const [billingPhone, setBillingPhone] = useState('')
  const [billingEmail, setBillingEmail] = useState('')
  const [billingAddress, setBillingAddress] = useState('')
  const [billingCity, setBillingCity] = useState('')
  const [billingState, setBillingState] = useState('CA')
  const [billingZip, setBillingZip] = useState('')
  const [poRequired, setPoRequired] = useState(false)
  const [paymentMethod, setPaymentMethod] = useState('')
  const [clientNotes, setClientNotes] = useState('')

  // Step 2 — Site fields
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

  // Dirty when any field has been filled in (step 1 fields or step 2 fields)
  const isDirty = step === 1
    ? (name !== initialClientName || billingContact !== '' || billingPhone !== '' ||
       billingEmail !== '' || billingAddress !== '' || billingCity !== '' ||
       billingState !== 'CA' || billingZip !== '' || poRequired !== false ||
       paymentMethod !== '' || clientNotes !== '')
    : (siteName !== '' || propertyType !== '' || address !== '' || city !== '' ||
       state !== 'CA' || zip !== '' || countyId !== '' || acreage !== '' || siteNotes !== '')
  useUnsavedChanges(isDirty)

  // Reset state when modal opens
  useEffect(() => {
    if (open) {
      setStep(1)
      setCreatedClient(null)
      setName(initialClientName)
      setBillingContact('')
      setBillingPhone('')
      setBillingEmail('')
      setBillingAddress('')
      setBillingCity('')
      setBillingState('CA')
      setBillingZip('')
      setPoRequired(false)
      setPaymentMethod('')
      setClientNotes('')
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
  }, [open, initialClientName])

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

  const handleCancel = useCallback(async () => {
    if (createdClient) {
      const confirmed = window.confirm('Discard new client?')
      if (!confirmed) return
      await supabase.from('clients').delete().eq('id', createdClient.id)
    }
    onCancel()
  }, [createdClient, onCancel])

  async function handleStep1Submit() {
    if (!name.trim()) {
      setError('Client name is required.')
      return
    }

    setSaving(true)
    setError(null)

    const { data, error: err } = await supabase
      .from('clients')
      .insert({
        name: name.trim(),
        billing_contact: billingContact || null,
        billing_phone: billingPhone || null,
        billing_email: billingEmail || null,
        billing_address: billingAddress || null,
        billing_city: billingCity || null,
        billing_state: billingState || 'CA',
        billing_zip: billingZip || null,
        po_required: poRequired,
        payment_method: paymentMethod || null,
        notes: clientNotes || null,
        is_active: true,
      })
      .select()
      .single()

    setSaving(false)

    if (err) {
      setError(getSupabaseErrorMessage(err))
      return
    }

    setCreatedClient(data as Client)
    setError(null)
    setStep(2)
  }

  async function handleStep2Submit() {
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
        client_id: createdClient!.id,
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

    onSuccess(createdClient!, data as Site)
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
    <Modal open={open} onClose={handleCancel} title={step === 1 ? 'New Client' : 'First Site'}>
      {/* Step indicator */}
      <div className="flex items-center justify-center gap-2 mb-4 text-sm text-[var(--color-text-muted)]">
        <span
          className={step === 1 ? 'font-semibold text-[var(--color-text-primary)]' : ''}
        >
          Step 1
        </span>
        <span>→</span>
        <span
          className={step === 2 ? 'font-semibold text-[var(--color-text-primary)]' : ''}
        >
          Step 2
        </span>
        <span className="ml-2 text-xs">({step} of 2)</span>
      </div>

      {step === 1 && (
        <div className="space-y-3">
          <Input
            label="Client Name *"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Valley Ag Services"
            autoFocus
          />
          <Input
            label="Billing Contact"
            value={billingContact}
            onChange={(e) => setBillingContact(e.target.value)}
            placeholder="Contact name"
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input
              label="Billing Phone"
              value={billingPhone}
              onChange={(e) => setBillingPhone(e.target.value)}
              placeholder="(555) 123-4567"
              type="tel"
            />
            <Input
              label="Billing Email"
              value={billingEmail}
              onChange={(e) => setBillingEmail(e.target.value)}
              placeholder="billing@example.com"
              type="email"
            />
          </div>
          {/* Billing Address */}
          <div className="pt-2">
            <p className="text-sm font-semibold text-[var(--color-text-primary)] mb-2">Billing Address</p>
            <div className="space-y-3">
              <Input
                label="Street Address"
                value={billingAddress}
                onChange={(e) => setBillingAddress(e.target.value)}
                placeholder="123 Main St"
              />
              <div className="grid grid-cols-3 gap-3">
                <Input
                  label="City"
                  value={billingCity}
                  onChange={(e) => setBillingCity(e.target.value)}
                />
                <Input
                  label="State"
                  value={billingState}
                  onChange={(e) => setBillingState(e.target.value)}
                />
                <Input
                  label="ZIP"
                  value={billingZip}
                  onChange={(e) => setBillingZip(e.target.value)}
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="flex items-center gap-2 min-h-[44px]">
              <input
                type="checkbox"
                id="po-required"
                checked={poRequired}
                onChange={(e) => setPoRequired(e.target.checked)}
                className="h-4 w-4 rounded border-surface-border text-brand-green focus:ring-brand-green/30"
              />
              <label htmlFor="po-required" className="text-sm font-medium text-[var(--color-text-primary)]">
                PO Required
              </label>
            </div>
            <Input
              label="Payment Method"
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value)}
              placeholder="e.g. Net 30, Credit Card"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-1">Notes</label>
            <textarea
              value={clientNotes}
              onChange={(e) => setClientNotes(e.target.value)}
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
              onClick={handleCancel}
              className="text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] underline"
            >
              Cancel
            </button>
            <Button onClick={handleStep1Submit} disabled={saving}>
              {saving ? 'Saving...' : 'Next →'}
            </Button>
          </div>
        </div>
      )}

      {step === 2 && createdClient && (
        <div className="space-y-3">
          {/* Client context header */}
          <div className="rounded-lg bg-surface-raised border border-surface-border px-3 py-2 text-sm">
            <span className="text-[var(--color-text-muted)]">Client:</span>{' '}
            <span className="font-medium">{createdClient.name}</span>
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
              onClick={handleCancel}
              className="text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] underline"
            >
              Cancel
            </button>
            <Button onClick={handleStep2Submit} disabled={saving}>
              {saving ? 'Saving...' : 'Save Client & Site'}
            </Button>
          </div>
        </div>
      )}
    </Modal>
  )
}
