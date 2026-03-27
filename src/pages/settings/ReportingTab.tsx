import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import type { AppSettings } from '@/types/database'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'
import { Toast } from '@/components/ui/Toast'

export function ReportingTab() {
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
      county_report_due_day: settings.county_report_due_day,
      county_report_reminder_days_before: settings.county_report_reminder_days_before,
      no_activity_report_template: settings.no_activity_report_template,
    })

    setSaving(false)
    if (error) {
      setToast({ message: error.message, type: 'error' })
    } else {
      setToast({ message: 'Reporting settings saved', type: 'success' })
    }
  }

  if (isLoading) return <LoadingSpinner />

  return (
    <>
      <Card>
        <h2 className="text-lg font-semibold mb-1">Reporting</h2>
        <p className="text-sm text-[var(--color-text-muted)] mb-6">
          Configure county compliance reporting schedule and templates.
        </p>

        <div className="max-w-lg space-y-4">
          <div>
            <Input
              label="County Report Due Day (1-28)"
              type="number"
              min={1}
              max={28}
              value={settings?.county_report_due_day ?? ''}
              onChange={(e) => setSettings(s => s ? { ...s, county_report_due_day: e.target.value ? Number(e.target.value) : null } : s)}
              placeholder="10"
            />
            <p className="text-xs text-[var(--color-text-muted)] mt-1">
              Reports are due to each registered county by the 10th of the following month. Adjust only if your submission schedule changes.
            </p>
          </div>

          <Input
            label="Reminder Lead Time (days before due date)"
            type="number"
            min={0}
            value={settings?.county_report_reminder_days_before ?? ''}
            onChange={(e) => setSettings(s => s ? { ...s, county_report_reminder_days_before: e.target.value ? Number(e.target.value) : null } : s)}
            placeholder="3"
          />

          <div>
            <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-1">
              No-Activity Report Template
            </label>
            <textarea
              className="w-full rounded-lg border border-surface-border bg-surface-raised px-3 py-2 text-sm min-h-[160px] focus:outline-none focus:ring-2 focus:ring-brand-green/30 focus:border-brand-green"
              value={settings?.no_activity_report_template ?? ''}
              onChange={(e) => setSettings(s => s ? { ...s, no_activity_report_template: e.target.value } : s)}
              placeholder="Letter template sent to counties when no chemicals were used that month..."
            />
            <p className="text-xs text-[var(--color-text-muted)] mt-1">
              This template is used when generating reports for months with no chemical applications.
            </p>
          </div>

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
