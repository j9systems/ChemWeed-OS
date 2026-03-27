import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import type { County } from '@/types/database'
import { cn } from '@/lib/utils'
import { Card } from '@/components/ui/Card'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'
import { Toast } from '@/components/ui/Toast'

export function CountiesTab() {
  const [counties, setCounties] = useState<County[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editValues, setEditValues] = useState<Partial<County>>({})
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)

  const fetch = useCallback(async () => {
    const { data, error } = await supabase.from('counties').select('*').order('name')
    if (error) setToast({ message: error.message, type: 'error' })
    else setCounties(data as County[])
    setIsLoading(false)
  }, [])

  useEffect(() => { fetch() }, [fetch])

  const startEdit = (county: County) => {
    setEditingId(county.id)
    setEditValues({
      is_licensed: county.is_licensed,
      report_recipient: county.report_recipient,
      notes: county.notes,
    })
  }

  const handleSave = async (id: string) => {
    setSaving(true)
    const { error } = await supabase.from('counties').update({
      is_licensed: editValues.is_licensed,
      report_recipient: editValues.report_recipient || null,
      notes: editValues.notes || null,
    }).eq('id', id)

    setSaving(false)
    if (error) {
      setToast({ message: error.message, type: 'error' })
    } else {
      setToast({ message: 'County updated', type: 'success' })
      setEditingId(null)
      fetch()
    }
  }

  const toggleLicensed = async (county: County) => {
    const { error } = await supabase.from('counties').update({
      is_licensed: !county.is_licensed,
    }).eq('id', county.id)

    if (error) {
      setToast({ message: error.message, type: 'error' })
    } else {
      setToast({ message: `${county.name} ${!county.is_licensed ? 'licensed' : 'unlicensed'}`, type: 'success' })
      fetch()
    }
  }

  if (isLoading) return <LoadingSpinner />

  const licensed = counties.filter(c => c.is_licensed)
  const unlicensed = counties.filter(c => !c.is_licensed)

  const renderRow = (county: County) => {
    const isEditing = editingId === county.id
    return (
      <tr key={county.id} className="border-b border-surface-border/50">
        <td className="py-3 pr-4 font-medium">{county.name}</td>
        <td className="py-3 pr-4">
          <button
            onClick={(e) => { e.stopPropagation(); toggleLicensed(county) }}
            className={cn(
              'inline-block px-2 py-0.5 rounded-full text-xs font-medium cursor-pointer transition-colors',
              county.is_licensed ? 'bg-green-100 text-green-800 hover:bg-green-200' : 'bg-gray-100 text-gray-600 hover:bg-gray-200',
            )}
          >
            {county.is_licensed ? 'Yes' : 'No'}
          </button>
        </td>
        <td className="py-3 pr-4">
          {isEditing ? (
            <input
              className="w-full rounded border border-surface-border bg-surface-raised px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-brand-green/30"
              value={editValues.report_recipient ?? ''}
              onChange={(e) => setEditValues({ ...editValues, report_recipient: e.target.value })}
              placeholder="Email or name"
            />
          ) : (
            <span
              className="cursor-pointer hover:text-brand-green"
              onClick={() => startEdit(county)}
            >
              {county.report_recipient || <span className="text-[var(--color-text-muted)]">—</span>}
            </span>
          )}
        </td>
        <td className="py-3">
          {isEditing ? (
            <div className="flex items-center gap-2">
              <input
                className="flex-1 rounded border border-surface-border bg-surface-raised px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-brand-green/30"
                value={editValues.notes ?? ''}
                onChange={(e) => setEditValues({ ...editValues, notes: e.target.value })}
                placeholder="Notes"
              />
              <button
                onClick={() => handleSave(county.id)}
                disabled={saving}
                className="text-xs font-medium text-brand-green hover:text-brand-green-dark"
              >
                Save
              </button>
              <button
                onClick={() => setEditingId(null)}
                className="text-xs font-medium text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]"
              >
                Cancel
              </button>
            </div>
          ) : (
            <span
              className="cursor-pointer hover:text-brand-green"
              onClick={() => startEdit(county)}
            >
              {county.notes || <span className="text-[var(--color-text-muted)]">—</span>}
            </span>
          )}
        </td>
      </tr>
    )
  }

  return (
    <>
      <Card>
        <h2 className="text-lg font-semibold mb-1">Counties</h2>
        <p className="text-sm text-[var(--color-text-muted)] mb-4">
          Click any field to edit. Toggle the licensed status directly.
        </p>

        {licensed.length > 0 && (
          <>
            <h3 className="text-sm font-medium text-brand-green mb-2 mt-4">Licensed Counties</h3>
            <div className="overflow-x-auto mb-6">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-surface-border text-left text-[var(--color-text-muted)]">
                    <th className="pb-2 pr-4 font-medium">County</th>
                    <th className="pb-2 pr-4 font-medium">Licensed</th>
                    <th className="pb-2 pr-4 font-medium">Report Recipient</th>
                    <th className="pb-2 font-medium">Notes</th>
                  </tr>
                </thead>
                <tbody>{licensed.map(renderRow)}</tbody>
              </table>
            </div>
          </>
        )}

        {unlicensed.length > 0 && (
          <>
            <h3 className="text-sm font-medium text-[var(--color-text-muted)] mb-2 mt-4">Unlicensed Counties</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-surface-border text-left text-[var(--color-text-muted)]">
                    <th className="pb-2 pr-4 font-medium">County</th>
                    <th className="pb-2 pr-4 font-medium">Licensed</th>
                    <th className="pb-2 pr-4 font-medium">Report Recipient</th>
                    <th className="pb-2 font-medium">Notes</th>
                  </tr>
                </thead>
                <tbody>{unlicensed.map(renderRow)}</tbody>
              </table>
            </div>
          </>
        )}
      </Card>

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </>
  )
}
