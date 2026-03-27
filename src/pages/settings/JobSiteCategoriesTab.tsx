import { useState, useEffect, useCallback } from 'react'
import { Plus, AlertTriangle } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import type { JobSiteCategory } from '@/types/database'
import { cn } from '@/lib/utils'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'
import { Toast } from '@/components/ui/Toast'

const emptyCategory: Partial<JobSiteCategory> = {
  name: '',
  requires_annual_report: false,
  is_active: true,
  notes: '',
}

export function JobSiteCategoriesTab() {
  const [categories, setCategories] = useState<JobSiteCategory[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [editing, setEditing] = useState<Partial<JobSiteCategory> | null>(null)
  const [isNew, setIsNew] = useState(false)
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)

  const fetch = useCallback(async () => {
    const { data, error } = await supabase.from('job_site_categories').select('*').order('name')
    if (error) setToast({ message: error.message, type: 'error' })
    else setCategories(data as JobSiteCategory[])
    setIsLoading(false)
  }, [])

  useEffect(() => { fetch() }, [fetch])

  const handleSave = async () => {
    if (!editing?.name?.trim()) return
    setSaving(true)

    const payload = {
      name: editing.name.trim(),
      requires_annual_report: editing.requires_annual_report ?? false,
      is_active: editing.is_active ?? true,
      notes: editing.notes || null,
    }

    let error
    if (isNew) {
      ({ error } = await supabase.from('job_site_categories').insert(payload))
    } else {
      ({ error } = await supabase.from('job_site_categories').update(payload).eq('id', editing.id!))
    }

    setSaving(false)
    if (error) {
      setToast({ message: error.message, type: 'error' })
    } else {
      setToast({ message: isNew ? 'Category added' : 'Category updated', type: 'success' })
      setEditing(null)
      fetch()
    }
  }

  const toggleActive = async (cat: JobSiteCategory) => {
    const { error } = await supabase.from('job_site_categories').update({ is_active: !cat.is_active }).eq('id', cat.id)
    if (error) setToast({ message: error.message, type: 'error' })
    else {
      setToast({ message: `${cat.name} ${!cat.is_active ? 'activated' : 'deactivated'}`, type: 'success' })
      fetch()
    }
  }

  if (isLoading) return <LoadingSpinner />

  return (
    <>
      <Card>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Job Site Categories</h2>
          <Button size="sm" onClick={() => { setEditing({ ...emptyCategory }); setIsNew(true) }}>
            <Plus size={16} /> Add Category
          </Button>
        </div>

        <div className="space-y-1">
          {categories.map((cat) => (
            <div
              key={cat.id}
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-surface/50 cursor-pointer"
              onClick={() => { setEditing({ ...cat }); setIsNew(false) }}
            >
              <span className="flex-1 text-sm font-medium">{cat.name}</span>
              {cat.requires_annual_report && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800">
                  <AlertTriangle size={12} />
                  Annual Report
                </span>
              )}
              <button
                onClick={(e) => { e.stopPropagation(); toggleActive(cat) }}
                className={cn(
                  'inline-block px-2 py-0.5 rounded-full text-xs font-medium transition-colors',
                  cat.is_active ? 'bg-green-100 text-green-800 hover:bg-green-200' : 'bg-gray-100 text-gray-600 hover:bg-gray-200',
                )}
              >
                {cat.is_active ? 'Active' : 'Inactive'}
              </button>
            </div>
          ))}
          {categories.length === 0 && (
            <p className="py-8 text-center text-[var(--color-text-muted)] text-sm">No categories configured</p>
          )}
        </div>
      </Card>

      <Modal
        open={editing !== null}
        onClose={() => setEditing(null)}
        title={isNew ? 'Add Category' : 'Edit Category'}
      >
        {editing && (
          <div className="space-y-4">
            <Input
              label="Name"
              value={editing.name ?? ''}
              onChange={(e) => setEditing({ ...editing, name: e.target.value })}
            />
            <div>
              <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-1">Notes</label>
              <textarea
                className="w-full rounded-lg border border-surface-border bg-surface-raised px-3 py-2 text-sm min-h-[80px] focus:outline-none focus:ring-2 focus:ring-brand-green/30 focus:border-brand-green"
                value={editing.notes ?? ''}
                onChange={(e) => setEditing({ ...editing, notes: e.target.value })}
              />
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="cat-annual-report"
                checked={editing.requires_annual_report ?? false}
                onChange={(e) => setEditing({ ...editing, requires_annual_report: e.target.checked })}
                className="rounded border-surface-border h-4 w-4 accent-amber-600"
              />
              <label htmlFor="cat-annual-report" className="text-sm font-medium text-amber-800">
                Requires Annual Report
              </label>
              <span className="text-xs text-[var(--color-text-muted)]">(compliance)</span>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="cat-active"
                checked={editing.is_active ?? true}
                onChange={(e) => setEditing({ ...editing, is_active: e.target.checked })}
                className="rounded border-surface-border h-4 w-4 accent-brand-green"
              />
              <label htmlFor="cat-active" className="text-sm">Active</label>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="secondary" onClick={() => setEditing(null)}>Cancel</Button>
              <Button onClick={handleSave} disabled={saving || !editing.name?.trim()}>
                {saving ? 'Saving...' : 'Save'}
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </>
  )
}
