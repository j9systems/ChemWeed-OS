import type { WorkOrder } from '@/types/database'

interface NotesTabProps {
  workOrder: WorkOrder
}

export function NotesTab({ workOrder }: NotesTabProps) {
  const hasAny = workOrder.notes_client || workOrder.notes_internal || workOrder.notes_technician

  if (!hasAny) {
    return (
      <div>
        <p className="text-sm text-[var(--color-text-muted)]">No notes for this work order.</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-sm font-semibold mb-2">Client Notes</h2>
        <p className="text-sm whitespace-pre-wrap">{workOrder.notes_client || <span className="text-[var(--color-text-muted)]">—</span>}</p>
      </div>
      <div className="border-t border-surface-border pt-4">
        <h2 className="text-sm font-semibold mb-2">Internal Notes</h2>
        <p className="text-sm whitespace-pre-wrap">{workOrder.notes_internal || <span className="text-[var(--color-text-muted)]">—</span>}</p>
      </div>
      <div className="border-t border-surface-border pt-4">
        <h2 className="text-sm font-semibold mb-2">Tech Instructions</h2>
        <p className="text-sm whitespace-pre-wrap">{workOrder.notes_technician || <span className="text-[var(--color-text-muted)]">—</span>}</p>
      </div>
    </div>
  )
}
