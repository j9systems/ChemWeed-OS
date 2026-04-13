import { useState, useEffect, useCallback } from 'react'
import { Plus, Pencil, FileText } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import type { AppSettings, ProposalBoilerplateTemplate } from '@/types/database'
import { cn } from '@/lib/utils'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'
import { Toast } from '@/components/ui/Toast'

const emptyTemplate: Partial<ProposalBoilerplateTemplate> = {
  name: '',
  body: '',
  is_default: false,
  is_active: true,
  sort_order: 0,
}

export function EstimateDefaultsTab() {
  const [settings, setSettings] = useState<AppSettings | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)

  // Boilerplate templates state
  const [templates, setTemplates] = useState<ProposalBoilerplateTemplate[]>([])
  const [templatesLoading, setTemplatesLoading] = useState(true)
  const [editingTemplate, setEditingTemplate] = useState<Partial<ProposalBoilerplateTemplate> | null>(null)
  const [isNewTemplate, setIsNewTemplate] = useState(false)
  const [savingTemplate, setSavingTemplate] = useState(false)
  const [deletingTemplate, setDeletingTemplate] = useState(false)
  const [templateUsageCounts, setTemplateUsageCounts] = useState<Record<string, number>>({})

  const fetch = useCallback(async () => {
    const { data, error } = await supabase.from('app_settings').select('*').eq('id', 1).single()
    if (error) setToast({ message: error.message, type: 'error' })
    else setSettings(data as AppSettings)
    setIsLoading(false)
  }, [])

  const fetchTemplates = useCallback(async () => {
    const { data, error } = await supabase
      .from('proposal_boilerplate_templates')
      .select('*')
      .order('sort_order')
      .order('name')
    if (error) {
      setToast({ message: error.message, type: 'error' })
    } else {
      setTemplates(data as ProposalBoilerplateTemplate[])
      // Fetch usage counts for all templates
      const counts: Record<string, number> = {}
      for (const tpl of (data ?? [])) {
        const { count } = await supabase
          .from('service_agreements')
          .select('id', { count: 'exact', head: true })
          .eq('boilerplate_template_id', tpl.id)
        counts[tpl.id] = count ?? 0
      }
      setTemplateUsageCounts(counts)
    }
    setTemplatesLoading(false)
  }, [])

  useEffect(() => { fetch() }, [fetch])
  useEffect(() => { fetchTemplates() }, [fetchTemplates])

  const handleSave = async () => {
    if (!settings) return
    setSaving(true)

    const { error } = await supabase.from('app_settings').upsert({
      id: 1,
      default_tank_size_gal: settings.default_tank_size_gal,
      minimum_job_charge: settings.minimum_job_charge,
      default_overhead_margin_pct: settings.default_overhead_margin_pct,
    })

    setSaving(false)
    if (error) {
      setToast({ message: error.message, type: 'error' })
    } else {
      setToast({ message: 'Estimate defaults saved', type: 'success' })
    }
  }

  const handleSaveTemplate = async () => {
    if (!editingTemplate?.name?.trim()) return
    setSavingTemplate(true)

    // If setting as default, unset existing default first
    if (editingTemplate.is_default) {
      await supabase
        .from('proposal_boilerplate_templates')
        .update({ is_default: false })
        .eq('is_default', true)
    }

    const payload = {
      name: editingTemplate.name.trim(),
      body: editingTemplate.body ?? '',
      is_default: editingTemplate.is_default ?? false,
      is_active: editingTemplate.is_active ?? true,
      sort_order: editingTemplate.sort_order ?? 0,
    }

    let error
    if (isNewTemplate) {
      ({ error } = await supabase.from('proposal_boilerplate_templates').insert(payload))
    } else {
      ({ error } = await supabase.from('proposal_boilerplate_templates').update(payload).eq('id', editingTemplate.id!))
    }

    setSavingTemplate(false)
    if (error) {
      setToast({ message: error.message, type: 'error' })
    } else {
      setToast({ message: isNewTemplate ? 'Template added' : 'Template updated', type: 'success' })
      setEditingTemplate(null)
      fetchTemplates()
    }
  }

  const handleDeleteTemplate = async () => {
    if (!editingTemplate?.id) return
    const usageCount = templateUsageCounts[editingTemplate.id] ?? 0
    if (usageCount > 0) return

    setDeletingTemplate(true)
    const { error } = await supabase
      .from('proposal_boilerplate_templates')
      .delete()
      .eq('id', editingTemplate.id)

    setDeletingTemplate(false)
    if (error) {
      setToast({ message: error.message, type: 'error' })
    } else {
      setToast({ message: 'Template deleted', type: 'success' })
      setEditingTemplate(null)
      fetchTemplates()
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
          <div>
            <Input
              label="Default overhead margin %"
              type="number"
              step="0.5"
              min="0"
              max="100"
              value={settings?.default_overhead_margin_pct ?? ''}
              onChange={(e) => setSettings(s => s ? { ...s, default_overhead_margin_pct: e.target.value ? Number(e.target.value) : null } : s)}
              placeholder="35"
            />
            <p className="text-xs text-[var(--color-text-muted)] mt-1">
              Applied on top of chemical cost to account for labor, insurance, and operational overhead. Can be overridden per job.
            </p>
          </div>

          <div className="pt-4">
            <Button onClick={handleSave} disabled={saving}>
              {saving ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>
        </div>
      </Card>

      {/* Boilerplate Templates */}
      <Card className="mt-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <FileText size={20} className="text-[#2a6b2a]" />
            <h2 className="text-lg font-semibold">Boilerplate Templates</h2>
          </div>
          <Button
            size="sm"
            onClick={() => { setEditingTemplate({ ...emptyTemplate }); setIsNewTemplate(true) }}
          >
            <Plus size={16} /> Add Template
          </Button>
        </div>
        <p className="text-sm text-[var(--color-text-muted)] mb-4">
          Reusable paragraphs that appear above line items on proposal PDFs. Select one per agreement.
        </p>

        {templatesLoading ? (
          <LoadingSpinner />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-surface-border text-left text-[var(--color-text-muted)]">
                  <th className="pb-2 pr-4 font-medium">Name</th>
                  <th className="pb-2 pr-4 font-medium">Preview</th>
                  <th className="pb-2 pr-4 font-medium">Status</th>
                  <th className="pb-2 font-medium w-10"></th>
                </tr>
              </thead>
              <tbody>
                {templates.map((t) => (
                  <tr
                    key={t.id}
                    className="border-b border-surface-border/50 hover:bg-surface/50 cursor-pointer"
                    onClick={() => { setEditingTemplate({ ...t }); setIsNewTemplate(false) }}
                  >
                    <td className="py-3 pr-4 font-medium">
                      <span className="flex items-center gap-2">
                        {t.name}
                        {t.is_default && (
                          <span className="inline-block px-2 py-0.5 rounded-full text-xs font-medium bg-[#2a6b2a]/10 text-[#2a6b2a]">
                            Default
                          </span>
                        )}
                      </span>
                    </td>
                    <td className="py-3 pr-4 text-[var(--color-text-muted)] max-w-[300px] truncate">
                      {t.body ? (t.body.length > 80 ? t.body.slice(0, 80) + '...' : t.body) : '—'}
                    </td>
                    <td className="py-3 pr-4">
                      <span className={cn(
                        'inline-block px-2 py-0.5 rounded-full text-xs font-medium',
                        t.is_active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600',
                      )}>
                        {t.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="py-3">
                      <Pencil size={14} className="text-[var(--color-text-muted)]" />
                    </td>
                  </tr>
                ))}
                {templates.length === 0 && (
                  <tr><td colSpan={4} className="py-8 text-center text-[var(--color-text-muted)]">No boilerplate templates configured</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Edit Template Modal */}
      <Modal
        open={editingTemplate !== null}
        onClose={() => setEditingTemplate(null)}
        title={isNewTemplate ? 'Add Template' : 'Edit Template'}
      >
        {editingTemplate && (
          <div className="space-y-4">
            <Input
              label="Name"
              value={editingTemplate.name ?? ''}
              onChange={(e) => setEditingTemplate({ ...editingTemplate, name: e.target.value })}
              placeholder='e.g. "Spray - Seasonal", "Mow + Spray Combo"'
            />
            <div>
              <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-1">Body</label>
              <textarea
                className="w-full rounded-lg border border-surface-border bg-surface-raised px-3 py-2 text-sm min-h-[120px] focus:outline-none focus:ring-2 focus:ring-brand-green/30 focus:border-brand-green"
                rows={5}
                value={editingTemplate.body ?? ''}
                onChange={(e) => setEditingTemplate({ ...editingTemplate, body: e.target.value })}
                placeholder="The full boilerplate paragraph that appears above line items on the proposal PDF..."
              />
            </div>
            <Input
              label="Sort Order"
              type="number"
              value={editingTemplate.sort_order ?? 0}
              onChange={(e) => setEditingTemplate({ ...editingTemplate, sort_order: e.target.value ? Number(e.target.value) : 0 })}
            />
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="tpl-default"
                  checked={editingTemplate.is_default ?? false}
                  onChange={(e) => setEditingTemplate({ ...editingTemplate, is_default: e.target.checked })}
                  className="rounded border-surface-border h-4 w-4 accent-brand-green"
                />
                <label htmlFor="tpl-default" className="text-sm">Use as default for new agreements</label>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="tpl-active"
                  checked={editingTemplate.is_active ?? true}
                  onChange={(e) => setEditingTemplate({ ...editingTemplate, is_active: e.target.checked })}
                  className="rounded border-surface-border h-4 w-4 accent-brand-green"
                />
                <label htmlFor="tpl-active" className="text-sm">Active</label>
              </div>
            </div>
            <div className="flex justify-between items-center pt-2">
              <div>
                {!isNewTemplate && (() => {
                  const usageCount = templateUsageCounts[editingTemplate.id!] ?? 0
                  return usageCount > 0 ? (
                    <span className="text-xs text-[var(--color-text-muted)]" title={`In use by ${usageCount} agreement${usageCount === 1 ? '' : 's'}`}>
                      In use by {usageCount} agreement{usageCount === 1 ? '' : 's'}
                    </span>
                  ) : (
                    <Button
                      variant="danger"
                      size="sm"
                      onClick={handleDeleteTemplate}
                      disabled={deletingTemplate}
                    >
                      {deletingTemplate ? 'Deleting...' : 'Delete'}
                    </Button>
                  )
                })()}
              </div>
              <div className="flex gap-2">
                <Button variant="secondary" onClick={() => setEditingTemplate(null)}>Cancel</Button>
                <Button onClick={handleSaveTemplate} disabled={savingTemplate || !editingTemplate.name?.trim()}>
                  {savingTemplate ? 'Saving...' : 'Save'}
                </Button>
              </div>
            </div>
          </div>
        )}
      </Modal>

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </>
  )
}
