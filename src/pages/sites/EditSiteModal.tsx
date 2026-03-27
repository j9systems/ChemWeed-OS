import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { getSupabaseErrorMessage } from '@/lib/utils'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import type { Site, PropertyType } from '@/types/database'

interface EditSiteModalProps {
  open: boolean
  site: Site
  onSuccess: () => void
  onCancel: () => void
}

export function EditSiteModal({ open, site, onSuccess, onCancel }: EditSiteModalProps) {
  const [address, setAddress] = useState('')
  const [city, setCity] = useState('')
  const [state, setState] = useState('')
  const [zip, setZip] = useState('')
  const [propertyType, setPropertyType] = useState<PropertyType | ''>('')
  const [acreage, setAcreage] = useState('')
  const [notes, setNotes] = useState('')

  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (open) {
      setAddress(site.address_line ?? '')
      setCity(site.city ?? '')
      setState(site.state ?? '')
      setZip(site.zip ?? '')
      setPropertyType(site.property_type ?? '')
      setAcreage(site.total_acres != null ? String(site.total_acres) : '')
      setNotes(site.notes ?? '')
      setError(null)
      setSaving(false)
    }
  }, [open, site])

  async function handleSubmit() {
    setSaving(true)
    setError(null)

    const { error: err } = await supabase
      .from('sites')
      .update({
        address_line: address.trim(),
        city: city.trim(),
        state: state.trim(),
        zip: zip.trim(),
        property_type: propertyType || null,
        total_acres: acreage ? parseFloat(acreage) : null,
        notes: notes.trim() || null,
      })
      .eq('id', site.id)

    setSaving(false)

    if (err) {
      setError(getSupabaseErrorMessage(err))
      return
    }

    onSuccess()
  }

  const selectClasses =
    'w-full rounded-lg border border-surface-border bg-surface-raised px-3 py-2 text-sm min-h-[44px] transition-colors focus:outline-none focus:ring-2 focus:ring-brand-green/30 focus:border-brand-green'

  return (
    <Modal open={open} onClose={onCancel} title="Edit Site Details">
      <div className="space-y-3">
        <Input
          label="Address"
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          placeholder="Street address"
          autoFocus
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

        <div>
          <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-1">
            Property Type
          </label>
          <select
            value={propertyType}
            onChange={(e) => setPropertyType(e.target.value as PropertyType)}
            className={selectClasses}
          >
            <option value="">None</option>
            <option value="commercial">Commercial</option>
            <option value="government">Government</option>
            <option value="residential">Residential</option>
          </select>
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
          <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-1">Notes</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
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
            {saving ? 'Saving...' : 'Save Changes'}
          </Button>
        </div>
      </div>
    </Modal>
  )
}
