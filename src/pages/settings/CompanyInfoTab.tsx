import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import type { CompanySettings } from '@/types/database'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'
import { Toast } from '@/components/ui/Toast'

export function CompanyInfoTab() {
  const [settings, setSettings] = useState<CompanySettings | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)

  const fetch = useCallback(async () => {
    const { data, error } = await supabase.from('company_settings').select('*').eq('id', 1).single()
    if (error && error.code !== 'PGRST116') {
      setToast({ message: error.message, type: 'error' })
    } else {
      setSettings((data as CompanySettings) ?? {
        id: 1,
        business_name: null,
        address: null,
        phone: null,
        email: null,
        license_number: null,
        logo_url: null,
        default_proposal_terms: null,
        default_invoice_terms: null,
      })
    }
    setIsLoading(false)
  }, [])

  useEffect(() => { fetch() }, [fetch])

  const handleSave = async () => {
    if (!settings) return
    setSaving(true)

    const { error } = await supabase.from('company_settings').upsert({
      id: 1,
      business_name: settings.business_name || null,
      address: settings.address || null,
      phone: settings.phone || null,
      email: settings.email || null,
      license_number: settings.license_number || null,
      logo_url: settings.logo_url || null,
      default_proposal_terms: settings.default_proposal_terms || null,
      default_invoice_terms: settings.default_invoice_terms || null,
    })

    setSaving(false)
    if (error) {
      setToast({ message: error.message, type: 'error' })
    } else {
      setToast({ message: 'Company info saved', type: 'success' })
    }
  }

  if (isLoading) return <LoadingSpinner />

  return (
    <>
      <Card>
        <h2 className="text-lg font-semibold mb-6">Company Info</h2>

        <div className="max-w-lg space-y-4">
          <Input
            label="Business Name"
            value={settings?.business_name ?? ''}
            onChange={(e) => setSettings(s => s ? { ...s, business_name: e.target.value } : s)}
          />
          <Input
            label="Address"
            value={settings?.address ?? ''}
            onChange={(e) => setSettings(s => s ? { ...s, address: e.target.value } : s)}
          />
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Phone"
              value={settings?.phone ?? ''}
              onChange={(e) => setSettings(s => s ? { ...s, phone: e.target.value } : s)}
            />
            <Input
              label="Email"
              type="email"
              value={settings?.email ?? ''}
              onChange={(e) => setSettings(s => s ? { ...s, email: e.target.value } : s)}
            />
          </div>
          <Input
            label="License Number"
            value={settings?.license_number ?? ''}
            onChange={(e) => setSettings(s => s ? { ...s, license_number: e.target.value } : s)}
          />
          <Input
            label="Logo URL"
            value={settings?.logo_url ?? ''}
            onChange={(e) => setSettings(s => s ? { ...s, logo_url: e.target.value } : s)}
            placeholder="https://..."
          />
          <div>
            <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-1">
              Default Proposal Terms
            </label>
            <textarea
              className="w-full rounded-lg border border-surface-border bg-surface-raised px-3 py-2 text-sm min-h-[120px] focus:outline-none focus:ring-2 focus:ring-brand-green/30 focus:border-brand-green"
              value={settings?.default_proposal_terms ?? ''}
              onChange={(e) => setSettings(s => s ? { ...s, default_proposal_terms: e.target.value } : s)}
              placeholder="Terms and conditions for proposals..."
            />
          </div>
          <Input
            label="Default Invoice Terms"
            value={settings?.default_invoice_terms ?? ''}
            onChange={(e) => setSettings(s => s ? { ...s, default_invoice_terms: e.target.value } : s)}
            placeholder="e.g. Net 30"
          />

          <div className="pt-4">
            <Button onClick={handleSave} disabled={saving}>
              {saving ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>
        </div>
      </Card>

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </>
  )
}
