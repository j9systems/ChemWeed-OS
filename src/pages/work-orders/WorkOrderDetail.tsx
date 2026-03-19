import { useState } from 'react'
import { useParams, Link } from 'react-router'
import { ArrowLeft, Edit, Play, CheckCircle, MapPin } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { useWorkOrder } from '@/hooks/useWorkOrders'
import { useWorkOrderMaterials } from '@/hooks/useWorkOrderMaterials'
import { useWorkOrderCharges } from '@/hooks/useWorkOrderCharges'
import { useSiteProfile } from '@/hooks/useSiteProfile'
import { canEdit, canCompleteField } from '@/lib/roles'
import { supabase } from '@/lib/supabase'
import { getSupabaseErrorMessage } from '@/lib/utils'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'
import { ErrorMessage } from '@/components/ui/ErrorMessage'
import { TabBar } from './components/TabBar'
import { SiteInfoCard } from './components/SiteInfoCard'
import { DetailsTab } from './tabs/DetailsTab'
import { EstimateTab } from './tabs/EstimateTab'
import { ScheduleTab } from './tabs/ScheduleTab'
import { FieldTab } from './tabs/FieldTab'
import { NotesTab } from './tabs/NotesTab'
import { InvoiceTab } from './tabs/InvoiceTab'

const TABS = [
  { key: 'details', label: 'Details' },
  { key: 'estimate', label: 'Estimate' },
  { key: 'schedule', label: 'Schedule' },
  { key: 'field', label: 'Field' },
  { key: 'notes', label: 'Notes' },
  { key: 'invoice', label: 'Invoice' },
]

export function WorkOrderDetail() {
  const { id } = useParams<{ id: string }>()
  const { role, user } = useAuth()
  const { workOrder, isLoading, error, refetch } = useWorkOrder(id)
  const { materials } = useWorkOrderMaterials(id)
  const { charges } = useWorkOrderCharges(id)
  const { weedProfile, observationLogs, refetch: refetchSiteProfile } = useSiteProfile(workOrder?.site_id)
  const [updating, setUpdating] = useState(false)
  const [activeTab, setActiveTab] = useState('details')
  const [siteInfoOpen, setSiteInfoOpen] = useState(false)

  if (isLoading) return <LoadingSpinner />
  if (error) return <ErrorMessage message={error} onRetry={refetch} />
  if (!workOrder) return <ErrorMessage message="Work order not found." />

  async function updateStatus(newStatus: 'in_progress' | 'completed') {
    if (!workOrder) return
    setUpdating(true)
    const updates: Record<string, unknown> = { status: newStatus }
    if (newStatus === 'completed') {
      updates.completion_date = new Date().toISOString().split('T')[0]
    }
    const { error: err } = await supabase
      .from('work_orders')
      .update(updates)
      .eq('id', workOrder.id)

    if (err) {
      alert(getSupabaseErrorMessage(err))
    } else {
      refetch()
    }
    setUpdating(false)
  }

  return (
    <div>
      {/* Back link */}
      <Link to="/work-orders" className="inline-flex items-center gap-1 text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] mb-4">
        <ArrowLeft size={16} />
        Back to Work Orders
      </Link>

      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold">{workOrder.client?.name} — {workOrder.site?.name}</h1>
        </div>
        <Badge status={workOrder.status} />
      </div>

      {/* Actions */}
      <div className="flex flex-wrap gap-2 mb-4">
        {canEdit(role) && (
          <Button variant="secondary" size="sm">
            <Edit size={16} />
            Edit
          </Button>
        )}
        {workOrder.status === 'scheduled' && canCompleteField(role) && (
          <Button size="sm" onClick={() => updateStatus('in_progress')} disabled={updating}>
            <Play size={16} />
            Start Job
          </Button>
        )}
        {workOrder.status === 'in_progress' && canCompleteField(role) && (
          <Link to={`/work-orders/${workOrder.id}/complete`}>
            <Button size="sm">
              <CheckCircle size={16} />
              Complete Job
            </Button>
          </Link>
        )}
      </div>

      {/* Site Info Card (collapsible) */}
      {workOrder.site ? (
        <SiteInfoCard
          site={workOrder.site}
          weedProfile={weedProfile}
          observationLogs={observationLogs}
          isOpen={siteInfoOpen}
          onToggle={() => setSiteInfoOpen(!siteInfoOpen)}
          role={role}
          userId={user?.id}
          refetchSiteProfile={refetchSiteProfile}
        />
      ) : (
        <div className="mb-4 rounded-lg border border-surface-border bg-surface-raised p-4 flex items-center gap-3 text-[var(--color-text-muted)]">
          <MapPin size={20} />
          <span className="text-sm">No site address available</span>
        </div>
      )}

      {/* Tab Bar */}
      <TabBar tabs={TABS} activeTab={activeTab} onChange={setActiveTab} />

      {/* Tab Content */}
      {activeTab === 'details' && <DetailsTab workOrder={workOrder} />}
      {activeTab === 'estimate' && <EstimateTab materials={materials} charges={charges} weedProfile={weedProfile} />}
      {activeTab === 'schedule' && <ScheduleTab workOrder={workOrder} />}
      {activeTab === 'field' && (
        <FieldTab
          workOrder={workOrder}
          materials={materials}
          role={role}
          siteId={workOrder.site_id}
          userId={user?.id}
          refetchSiteProfile={refetchSiteProfile}
        />
      )}
      {activeTab === 'notes' && <NotesTab workOrder={workOrder} />}
      {activeTab === 'invoice' && <InvoiceTab workOrder={workOrder} charges={charges} />}
    </div>
  )
}
