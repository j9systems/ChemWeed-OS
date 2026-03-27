import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import type { AppSettings } from '@/types/database'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'
import { Toast } from '@/components/ui/Toast'

export function EstimateDefaultsTab() {
  const [settings, setSettings] = useState<AppSettings | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)

  const fetch = useCallback(async () => {
    const { data, error } = await supabase.from('app_settings').select('*').eq('id', 1).single()
    if (error) setToast({ message: error.message, type: 'error' })
    else setSettings(data as AppSettings)
    setIsLoading(false)
  }, [])

  useEffect(() => { fetch() }, [fetch])

  const handleSave = async () => {
    if (!settings) return
    setSaving(true)

    const { error } = await supabase.from('app_settings').upsert({
      id: 1,
      default_tank_size_gal: settings.default_tank_size_gal,
      minimum_job_charge: settings.minimum_job_charge,
    })

    setSaving(false)
    if (error) {
      setToast({ message: error.message, type: 'error' })
    } else {
      setToast({ message: 'Estimate defaults saved', type: 'success' })
    }
  }

  if (isLoading) return <LoadingSpinner />

  return (
    <>
      <Card>
        <h2 className="text-lg font-semibold mb-1">Estimate Defaults</h2>
        <p className="text-sm text-[var(--color-text-muted)] mb-6">
          System-wide defaults that can be overridden per job.
        </p>

        <div className="max-w-md space-y-4">
          <Input
            label="Default Tank Size (gallons)"
            type="number"
            value={settings?.default_tank_size_gal ?? ''}
            onChange={(e) => setSettings(s => s ? { ...s, default_tank_size_gal: e.target.value ? Number(e.target.value) : null } : s)}
            placeholder="100"
          />
          <Input
            label="Minimum Job Charge ($)"
            type="number"
            step="0.01"
            value={settings?.minimum_job_charge ?? ''}
            onChange={(e) => setSettings(s => s ? { ...s, minimum_job_charge: e.target.value ? Number(e.target.value) : null } : s)}
            placeholder="Leave blank if none"
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
