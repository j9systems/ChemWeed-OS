import { useState, useEffect } from 'react'
import { Bug, Lightbulb, Trash2, ExternalLink } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { useAuth } from '@/hooks/useAuth'
import { supabase } from '@/lib/supabase'
import { getSupabaseErrorMessage } from '@/lib/utils'
import type { FeedbackItem, FeedbackPriority, FeedbackStatus } from '@/types/database'

interface FeedbackDetailModalProps {
  open: boolean
  item: FeedbackItem | null
  submitterName?: string
  onClose: () => void
  onUpdated: () => void
  onDeleted: () => void
}

export function FeedbackDetailModal({
  open, item, submitterName, onClose, onUpdated, onDeleted,
}: FeedbackDetailModalProps) {
  const { user } = useAuth()
  const [status, setStatus] = useState<FeedbackStatus>('open')
  const [priority, setPriority] = useState<FeedbackPriority>('medium')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [confirmingDelete, setConfirmingDelete] = useState(false)

  useEffect(() => {
    if (item) {
      setStatus(item.status)
      setPriority(item.priority)
      setError(null)
      setConfirmingDelete(false)
    }
  }, [item])

  if (!item) return null

  const isSubmitter = user?.id === item.submitted_by
  const dirty = status !== item.status || priority !== item.priority

  async function handleSave() {
    if (!item) return
    setSaving(true)
    setError(null)
    const { error: err } = await supabase
      .from('feedback_items')
      .update({ status, priority })
      .eq('id', item.id)
    if (err) {
      setError(getSupabaseErrorMessage(err))
      setSaving(false)
      return
    }
    setSaving(false)
    onUpdated()
  }

  async function handleDelete() {
    if (!item) return
    setSaving(true)
    setError(null)
    const { error: err } = await supabase.from('feedback_items').delete().eq('id', item.id)
    if (err) {
      setError(getSupabaseErrorMessage(err))
      setSaving(false)
      return
    }
    setSaving(false)
    onDeleted()
  }

  return (
    <Modal open={open} onClose={onClose} title={item.title}>
      <div className="space-y-4">
        <div className="flex flex-wrap gap-2 text-xs">
          <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-medium ${
            item.type === 'bug' ? 'bg-red-50 text-red-800' : 'bg-amber-50 text-amber-800'
          }`}>
            {item.type === 'bug' ? <Bug size={12} /> : <Lightbulb size={12} />}
            {item.type === 'bug' ? 'Bug' : 'Feature'}
          </span>
          <span className="inline-flex items-center rounded-full px-2 py-0.5 font-medium bg-gray-100 text-gray-700">
            Submitted by {submitterName ?? 'Unknown'}
          </span>
          <span className="inline-flex items-center rounded-full px-2 py-0.5 font-medium bg-gray-100 text-gray-700">
            {new Date(item.created_at).toLocaleString()}
          </span>
          {item.resolved_at && (
            <span className="inline-flex items-center rounded-full px-2 py-0.5 font-medium bg-green-50 text-green-800">
              Resolved {new Date(item.resolved_at).toLocaleString()}
            </span>
          )}
        </div>

        {item.description && (
          <div>
            <h3 className="text-sm font-semibold mb-1">Description</h3>
            <p className="text-sm whitespace-pre-wrap">{item.description}</p>
          </div>
        )}

        {item.attachments && item.attachments.length > 0 && (
          <div>
            <h3 className="text-sm font-semibold mb-2">Attachments</h3>
            <ul className="space-y-2">
              {item.attachments.map((a) => {
                const isImage = a.mime_type?.startsWith('image/')
                return (
                  <li key={a.id} className="rounded-lg border border-surface-border p-2">
                    {isImage ? (
                      <a href={a.url} target="_blank" rel="noopener noreferrer">
                        <img src={a.url} alt={a.filename ?? ''} className="max-h-48 rounded" />
                      </a>
                    ) : (
                      <a
                        href={a.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-sm text-brand-green underline"
                      >
                        <ExternalLink size={14} />
                        {a.filename ?? 'attachment'}
                      </a>
                    )}
                  </li>
                )
              })}
            </ul>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium mb-1">Status</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as FeedbackStatus)}
              className="w-full rounded-lg border border-surface-border bg-white px-3 py-2 text-sm min-h-[44px]"
            >
              <option value="open">Open</option>
              <option value="in_progress">In Progress</option>
              <option value="resolved">Resolved</option>
              <option value="closed">Closed</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Priority</label>
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value as FeedbackPriority)}
              className="w-full rounded-lg border border-surface-border bg-white px-3 py-2 text-sm min-h-[44px]"
            >
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
            </select>
          </div>
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="flex items-center justify-between pt-2">
          <div>
            {isSubmitter && !confirmingDelete && (
              <button
                type="button"
                onClick={() => setConfirmingDelete(true)}
                className="inline-flex items-center gap-1 text-sm text-red-600 hover:text-red-700"
              >
                <Trash2 size={14} /> Delete
              </button>
            )}
            {confirmingDelete && (
              <div className="flex items-center gap-2">
                <span className="text-sm text-red-700">Delete permanently?</span>
                <Button variant="secondary" size="sm" onClick={() => setConfirmingDelete(false)} disabled={saving}>
                  Cancel
                </Button>
                <Button size="sm" onClick={handleDelete} disabled={saving} className="bg-red-600 hover:bg-red-700 text-white">
                  Confirm
                </Button>
              </div>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" onClick={onClose} disabled={saving}>Close</Button>
            <Button size="sm" onClick={handleSave} disabled={!dirty || saving}>
              {saving ? 'Saving...' : 'Save'}
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  )
}
