import { useState, type FormEvent } from 'react'
import { Bug, Lightbulb, Upload, X } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { useAuth } from '@/hooks/useAuth'
import { supabase } from '@/lib/supabase'
import { getSupabaseErrorMessage } from '@/lib/utils'
import type { FeedbackPriority, FeedbackType } from '@/types/database'

interface FeedbackFormModalProps {
  open: boolean
  onClose: () => void
  onSubmitted: () => void
}

interface PendingFile {
  file: File
  previewUrl: string
}

export function FeedbackFormModal({ open, onClose, onSubmitted }: FeedbackFormModalProps) {
  const { user } = useAuth()
  const [type, setType] = useState<FeedbackType>('bug')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [priority, setPriority] = useState<FeedbackPriority>('medium')
  const [files, setFiles] = useState<PendingFile[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function reset() {
    setType('bug')
    setTitle('')
    setDescription('')
    setPriority('medium')
    files.forEach((f) => URL.revokeObjectURL(f.previewUrl))
    setFiles([])
    setError(null)
  }

  function handleClose() {
    reset()
    onClose()
  }

  function handleFilePick(e: React.ChangeEvent<HTMLInputElement>) {
    const picked = Array.from(e.target.files ?? [])
    setFiles((prev) => [
      ...prev,
      ...picked.map((file) => ({ file, previewUrl: URL.createObjectURL(file) })),
    ])
    e.target.value = ''
  }

  function removeFile(idx: number) {
    setFiles((prev) => {
      const next = [...prev]
      const [removed] = next.splice(idx, 1)
      if (removed) URL.revokeObjectURL(removed.previewUrl)
      return next
    })
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!title.trim()) {
      setError('Title is required.')
      return
    }
    if (!user) {
      setError('You must be signed in to submit feedback.')
      return
    }

    setSubmitting(true)
    setError(null)

    const { data: inserted, error: insertErr } = await supabase
      .from('feedback_items')
      .insert({
        type,
        title: title.trim(),
        description: description.trim() || null,
        priority,
        status: 'open',
        submitted_by: user.id,
        notify_on_resolve: true,
      })
      .select('id')
      .single()

    if (insertErr || !inserted) {
      setError(getSupabaseErrorMessage(insertErr ?? new Error('Insert failed')))
      setSubmitting(false)
      return
    }

    for (const pending of files) {
      const ext = pending.file.name.split('.').pop() ?? 'bin'
      const path = `${inserted.id}/${crypto.randomUUID()}.${ext}`

      const { error: uploadErr } = await supabase.storage
        .from('feedback-attachments')
        .upload(path, pending.file, { contentType: pending.file.type || undefined })

      if (uploadErr) {
        setError(`Saved feedback but failed to upload "${pending.file.name}": ${uploadErr.message}`)
        continue
      }

      const { data: urlData } = supabase.storage
        .from('feedback-attachments')
        .getPublicUrl(path)

      const { error: attachErr } = await supabase.from('feedback_attachments').insert({
        feedback_item_id: inserted.id,
        url: urlData.publicUrl,
        filename: pending.file.name,
        mime_type: pending.file.type || null,
        uploaded_by: user.id,
      })

      if (attachErr) {
        setError(`Saved feedback but failed to record "${pending.file.name}": ${attachErr.message}`)
      }
    }

    setSubmitting(false)
    reset()
    onSubmitted()
    onClose()
  }

  return (
    <Modal open={open} onClose={handleClose} title="Submit Feedback">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">Type</label>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setType('bug')}
              className={`flex-1 inline-flex items-center justify-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                type === 'bug'
                  ? 'bg-red-50 text-red-800 border-red-200'
                  : 'bg-gray-50 text-gray-700 border-gray-200'
              }`}
            >
              <Bug size={16} /> Bug
            </button>
            <button
              type="button"
              onClick={() => setType('feature')}
              className={`flex-1 inline-flex items-center justify-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                type === 'feature'
                  ? 'bg-amber-50 text-amber-800 border-amber-200'
                  : 'bg-gray-50 text-gray-700 border-gray-200'
              }`}
            >
              <Lightbulb size={16} /> Feature Request
            </button>
          </div>
        </div>

        <Input
          label="Title *"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={type === 'bug' ? 'Short description of what went wrong' : 'Short summary of the request'}
        />

        <div>
          <label className="block text-sm font-medium mb-1">Description</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={5}
            placeholder={type === 'bug'
              ? 'Steps to reproduce, what you expected, what actually happened.'
              : 'What would this enable? Who benefits? Any context.'}
            className="w-full rounded-lg border border-surface-border bg-surface-raised px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-green/30 focus:border-brand-green"
          />
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

        <div>
          <label className="block text-sm font-medium mb-1">Attachments</label>
          <label className="inline-flex items-center gap-2 rounded-lg border border-surface-border bg-white px-3 py-2 text-sm cursor-pointer hover:bg-surface-raised">
            <Upload size={16} />
            Add screenshots or files
            <input
              type="file"
              multiple
              accept="image/*,application/pdf,video/*"
              onChange={handleFilePick}
              className="hidden"
            />
          </label>
          {files.length > 0 && (
            <ul className="mt-2 space-y-1">
              {files.map((f, idx) => (
                <li key={idx} className="flex items-center justify-between text-sm bg-surface-raised rounded px-2 py-1">
                  <span className="truncate">{f.file.name}</span>
                  <button
                    type="button"
                    onClick={() => removeFile(idx)}
                    className="ml-2 p-1 text-[var(--color-text-muted)] hover:text-red-600"
                  >
                    <X size={14} />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="secondary" size="sm" onClick={handleClose} disabled={submitting}>Cancel</Button>
          <Button size="sm" type="submit" disabled={submitting}>
            {submitting ? 'Submitting...' : 'Submit'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
