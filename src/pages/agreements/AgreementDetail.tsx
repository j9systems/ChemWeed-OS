import { useState, useEffect } from 'react'
import { useParams, Link, useNavigate, useSearchParams } from 'react-router'
import { ArrowLeft, Edit, CheckCircle, FileText, Phone, MessageSquare, Mail, Navigation, Trash2, Copy, Check, Download, Send, RefreshCw, Upload } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { useServiceAgreement } from '@/hooks/useServiceAgreement'
import { useServiceAgreementMaterials } from '@/hooks/useServiceAgreementMaterials'
import { useSiteProfile } from '@/hooks/useSiteProfile'
import { useSitePhotos } from '@/hooks/useSitePhotos'
import { useFieldLogPhotos } from '@/hooks/useFieldLogPhotos'
import { useWorkOrders } from '@/hooks/useWorkOrders'
import { canEdit } from '@/lib/roles'
import { supabase } from '@/lib/supabase'
import { formatDate, formatCurrency, getSupabaseErrorMessage } from '@/lib/utils'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'
import { ErrorMessage } from '@/components/ui/ErrorMessage'
import { Card } from '@/components/ui/Card'
import { TabBar } from '@/pages/work-orders/components/TabBar'
import { SiteInfoCard } from '@/pages/work-orders/components/SiteInfoCard'
import { MaterialsSection, type MaterialRow } from '@/components/work-orders/MaterialsSection'
import { AgreementLineItemsSection, type LineItemRow, rowTotal } from '@/components/agreements/AgreementLineItemsSection'
import { AGREEMENT_STATUSES, getUrgencyColors, getServiceColor, formatPeriodLabel, FREQUENCY_LABELS } from '@/lib/constants'
import { useFormDraft } from '@/hooks/useFormDraft'
import { EditAgreementModal } from '@/components/agreements/EditAgreementModal'
import { GenerateProposalModal } from '@/components/agreements/GenerateProposalModal'
import { SendProposalModal } from '@/components/agreements/SendProposalModal'
import { SigningStatusBadge } from '@/components/SigningStatusBadge'
import { Modal } from '@/components/ui/Modal'
import type { ServiceAgreement, ServiceAgreementLineItem, ServiceAgreementMaterial, WorkOrder } from '@/types/database'

const TABS = [
  { key: 'details', label: 'Details' },
  { key: 'estimate', label: 'Estimate' },
  { key: 'schedule', label: 'Schedule' },
  { key: 'work_orders', label: 'Jobs' },
  { key: 'notes', label: 'Notes' },
]

function buildNavigationUrl(agreement: ServiceAgreement) {
  const site = agreement.site
  if (!site) return null
  if (site.latitude != null && site.longitude != null) {
    return `https://www.google.com/maps/dir/?api=1&destination=${site.latitude},${site.longitude}`
  }
  const addr = [site.address_line, site.city, site.state, site.zip].filter(Boolean).join(', ')
  if (!addr) return null
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(addr)}`
}

function ActionButton({ href, icon, label }: { href: string | null; icon: React.ReactNode; label: string }) {
  if (!href) {
    return (
      <span className="inline-flex flex-col items-center gap-1 rounded-lg px-3 py-2 text-[var(--color-text-muted)] opacity-40 cursor-not-allowed">
        {icon}
        <span className="text-[10px]">{label}</span>
      </span>
    )
  }
  return (
    <a href={href} className="inline-flex flex-col items-center gap-1 rounded-lg px-3 py-2 text-[var(--color-text-muted)] hover:bg-surface hover:text-[var(--color-text-primary)] transition-colors">
      {icon}
      <span className="text-[10px]">{label}</span>
    </a>
  )
}

function DetailsSection({ agreement, lineItems }: { agreement: ServiceAgreement; lineItems: ServiceAgreementLineItem[] }) {
  const phone = agreement.client?.billing_phone
  const email = agreement.client?.billing_email
  const navUrl = buildNavigationUrl(agreement)

  return (
    <div>
      <div className="flex items-center gap-1 mb-4 border-b border-surface-border pb-3">
        <ActionButton href={phone ? `tel:${phone}` : null} icon={<Phone size={18} />} label="Call" />
        <ActionButton href={phone ? `sms:${phone}` : null} icon={<MessageSquare size={18} />} label="Text" />
        <ActionButton href={email ? `mailto:${email}` : null} icon={<Mail size={18} />} label="Email" />
        <ActionButton href={navUrl} icon={<Navigation size={18} />} label="Navigate" />
      </div>

      <h2 className="text-sm font-semibold mb-3">Details</h2>
      <dl className="flex flex-wrap gap-x-6 gap-y-3 text-sm">
        <DetailItem label="Client">{agreement.client?.name ?? '—'}</DetailItem>
        <DetailItem label="Site">{agreement.site?.name ?? '—'}</DetailItem>
        <DetailItem label="Status">{AGREEMENT_STATUSES[agreement.agreement_status]}</DetailItem>
        <DetailItem label="Urgency">
          {agreement.urgency_level ? (
            <span className={`inline-block rounded-full px-3 py-0.5 text-xs font-medium border ${
              (() => {
                const c = getUrgencyColors(agreement.urgency_level.key)
                return `${c.selectedBg} ${c.selectedText} ${c.selectedBorder}`
              })()
            }`}>
              {agreement.urgency_level.label}
            </span>
          ) : '—'}
        </DetailItem>
        <DetailItem label="Service Type">
          {(() => {
            const names = new Set<string>()
            for (const li of lineItems) {
              if (li.service_type?.name) names.add(li.service_type.name)
            }
            if (names.size === 0 && agreement.service_type?.name) names.add(agreement.service_type.name)
            if (names.size === 0) return '—'
            return (
              <span className="inline-flex flex-wrap gap-1">
                {Array.from(names).map((name) => {
                  const sc = getServiceColor(name)
                  return (
                    <span key={name} className={`inline-block rounded-md px-2 py-0.5 text-xs font-semibold ${sc.bg} ${sc.text}`}>
                      {name}
                    </span>
                  )
                })}
              </span>
            )
          })()}
        </DetailItem>
        <DetailItem label="Proposed Start">{formatDate(agreement.proposed_start_date)}</DetailItem>
        {agreement.contract_start_date && (
          <DetailItem label="Contract Start">{formatDate(agreement.contract_start_date)}</DetailItem>
        )}
        {agreement.contract_end_date && (
          <DetailItem label="Contract End">{formatDate(agreement.contract_end_date)}</DetailItem>
        )}
        {agreement.contract_value != null && (
          <DetailItem label="Contract Value">{formatCurrency(agreement.contract_value)}</DetailItem>
        )}
        {agreement.billing_method && (
          <DetailItem label="Billing Method">{agreement.billing_method.replace('_', ' ')}</DetailItem>
        )}
        <DetailItem label="PCA">
          {agreement.pca ? `${agreement.pca.first_name} ${agreement.pca.last_name}` : '—'}
        </DetailItem>
        <DetailItem label="Sales Rep">
          {agreement.sales_rep ? `${agreement.sales_rep.first_name} ${agreement.sales_rep.last_name}` : '—'}
        </DetailItem>
        <DetailItem label="PO Number">{agreement.po_number ?? '—'}</DetailItem>
        <DetailItem label="Agreement Text">
          {agreement.boilerplate_template?.name ?? '—'}
        </DetailItem>
        <div className="w-full">
          <DetailItem label="Reason / Scope">
            <span className="whitespace-pre-wrap">{agreement.reason ?? '—'}</span>
          </DetailItem>
        </div>
      </dl>
    </div>
  )
}

interface EstimateSectionProps {
  lineItems: ServiceAgreementLineItem[]
  materials: ServiceAgreementMaterial[]
  agreementId: string
  agreementStatus: ServiceAgreement['agreement_status']
  signingStatus?: string | null
  clientSigningUrl?: string | null
  signedPdfUrl?: string | null
  signingCompletedAt?: string | null
  totalAcres?: number | null
  clientContact: string | null
  clientEmail: string | null
  clientPhone: string | null
  clientName: string
  boilerplateTemplateId: string | null
  boilerplateTemplateName: string | null
  boilerplateTemplateBody: string | null
  refetchLineItems: () => void
  refetchMaterials: () => void
}

interface BoilerplateTemplateOption {
  id: string
  name: string
  body: string
  is_default: boolean
}

function toMaterialRows(materials: ServiceAgreementMaterial[]): MaterialRow[] {
  return materials.map((m) => ({
    chemical_id: m.chemical_id ?? '',
    recommended_amount: m.recommended_amount != null ? String(m.recommended_amount) : '',
    recommended_unit: m.recommended_unit ?? '',
    chemical: m.chemical ?? undefined,
  }))
}

function toLineItemRows(items: ServiceAgreementLineItem[]): LineItemRow[] {
  return items.map((c) => ({
    is_manual_override: c.is_manual_override,
    service_type_id: c.service_type_id ?? '',
    service_type: c.service_type ?? undefined,
    acreage: c.acreage != null ? String(c.acreage) : '',
    hours: c.hours != null ? String(c.hours) : '',
    unit_rate: c.unit_rate != null ? String(c.unit_rate) : '',
    description: c.description ?? '',
    amount: c.amount != null ? String(c.amount) : '',
    line_items: Array.isArray(c.line_items) ? c.line_items : [],
    frequency: c.frequency ?? 'one_time',
    season_start_month: c.season_start_month ?? 2,
    season_end_month: c.season_end_month ?? 9,
  }))
}

interface ExternalContractPanelProps {
  agreementId: string
  signedPdfUrl: string | null
  onUploaded: () => void
}

function ExternalContractPanel({ agreementId, signedPdfUrl, onUploaded }: ExternalContractPanelProps) {
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    if (file.type !== 'application/pdf') { setUploadError('File must be a PDF.'); return }
    if (file.size > 10 * 1024 * 1024) { setUploadError('File must be under 10 MB.'); return }

    setUploading(true)
    setUploadError(null)

    const path = `external/${agreementId}.pdf`
    const { error: uploadErr } = await supabase.storage
      .from('agreement-pdfs')
      .upload(path, file, { upsert: true, contentType: 'application/pdf' })

    if (uploadErr) {
      setUploadError(`Upload failed: ${uploadErr.message}`)
      setUploading(false)
      return
    }

    const { data: urlData } = supabase.storage.from('agreement-pdfs').getPublicUrl(path)
    const publicUrl = `${urlData.publicUrl}?t=${Date.now()}`

    const { error: updateErr } = await supabase
      .from('service_agreements')
      .update({ signed_pdf_url: publicUrl })
      .eq('id', agreementId)

    setUploading(false)
    if (updateErr) {
      setUploadError(getSupabaseErrorMessage(updateErr))
      return
    }
    onUploaded()
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 space-y-3">
      <div className="flex items-center gap-2">
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-700">
          External Contract
        </span>
        <span className="text-xs text-[var(--color-text-muted)]">
          Signed outside ChemWeed-OS. No proposal email will be sent.
        </span>
      </div>

      {signedPdfUrl ? (
        <div className="flex flex-wrap items-center gap-3">
          <a
            href={signedPdfUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-sm text-brand-green hover:underline"
          >
            <Download size={14} />
            Download Signed PDF
          </a>
          <label className="inline-flex items-center gap-1 text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] cursor-pointer">
            <Upload size={14} />
            {uploading ? 'Uploading...' : 'Replace PDF'}
            <input
              type="file"
              accept="application/pdf"
              className="hidden"
              disabled={uploading}
              onChange={handleUpload}
            />
          </label>
        </div>
      ) : (
        <label className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-white cursor-pointer transition-colors disabled:opacity-50 w-fit"
          style={{ backgroundColor: '#2a6b2a' }}
        >
          <Upload size={14} />
          {uploading ? 'Uploading...' : 'Upload Signed PDF'}
          <input
            type="file"
            accept="application/pdf"
            className="hidden"
            disabled={uploading}
            onChange={handleUpload}
          />
        </label>
      )}

      {uploadError && <p className="text-sm text-red-600">{uploadError}</p>}
    </div>
  )
}

function EstimateSection({ lineItems, materials, agreementId, agreementStatus, signingStatus, clientSigningUrl, signedPdfUrl, signingCompletedAt, totalAcres, clientContact, clientEmail, clientPhone, clientName, boilerplateTemplateId, refetchLineItems, refetchMaterials }: EstimateSectionProps) {
  const { role } = useAuth()
  const [editing, setEditing] = useState(false)
  const [materialRows, setMaterialRows] = useState<MaterialRow[]>(() => toMaterialRows(materials))
  const draftKey = `line_item_draft__${agreementId}`
  const [liRows, setLiRows, clearLiDraft] = useFormDraft<LineItemRow[]>(draftKey, toLineItemRows(lineItems))
  const [draftNotice, setDraftNotice] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [generating, setGenerating] = useState(false)
  const [generateError, setGenerateError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [proposalModalOpen, setProposalModalOpen] = useState(false)
  const [sendModalOpen, setSendModalOpen] = useState(false)
  const [localSigningStatus, setLocalSigningStatus] = useState<string | null | undefined>(signingStatus)
  const [emailSentTo, setEmailSentTo] = useState<string | null>(null)
  const [boilerplateTemplates, setBoilerplateTemplates] = useState<BoilerplateTemplateOption[]>([])
  const [selectedBoilerplateId, setSelectedBoilerplateId] = useState<string>(boilerplateTemplateId ?? '')
  const [savingBoilerplate, setSavingBoilerplate] = useState(false)
  const [confirmRecreate, setConfirmRecreate] = useState(false)
  const [clearing, setClearing] = useState(false)

  useEffect(() => {
    supabase
      .from('proposal_boilerplate_templates')
      .select('id, name, body, is_default')
      .eq('is_active', true)
      .order('sort_order')
      .order('name')
      .then(({ data }) => {
        if (data) setBoilerplateTemplates(data)
      })
  }, [])

  useEffect(() => {
    setSelectedBoilerplateId(boilerplateTemplateId ?? '')
  }, [boilerplateTemplateId])

  async function handleBoilerplateChange(templateId: string) {
    setSelectedBoilerplateId(templateId)
    setSavingBoilerplate(true)
    const { error: bpErr } = await supabase
      .from('service_agreements')
      .update({ boilerplate_template_id: templateId || null })
      .eq('id', agreementId)
    setSavingBoilerplate(false)
    if (bpErr) {
      setError(getSupabaseErrorMessage(bpErr))
      return
    }
    refetchLineItems()
  }

  const selectedBoilerplate = boilerplateTemplates.find((t) => t.id === selectedBoilerplateId)

  const boilerplateBlock = (
    <div className="mb-6">
      <div className="flex items-center justify-between mb-2">
        <label className="text-sm font-semibold text-[var(--color-text-primary)]">Agreement Text</label>
        {savingBoilerplate && <span className="text-xs text-[var(--color-text-muted)]">Saving...</span>}
      </div>
      <select
        value={selectedBoilerplateId}
        onChange={(e) => handleBoilerplateChange(e.target.value)}
        disabled={!canEdit(role)}
        className="w-full rounded-lg border border-surface-border bg-surface-raised px-3 py-2 text-sm min-h-[44px]"
      >
        <option value="">None selected</option>
        {boilerplateTemplates.map((t) => (
          <option key={t.id} value={t.id}>
            {t.name}{t.is_default ? ' (default)' : ''}
          </option>
        ))}
      </select>
      {selectedBoilerplate && (
        <div className="mt-2 rounded-lg bg-gray-50 border border-gray-200 px-3 py-2 text-xs text-gray-600 max-h-24 overflow-y-auto whitespace-pre-wrap">
          {selectedBoilerplate.body}
        </div>
      )}
      <p className="text-xs text-[var(--color-text-muted)] mt-1">
        This text appears above line items on the proposal PDF. Manage templates in Settings → Estimate Defaults.
      </p>
    </div>
  )

  // Sync localSigningStatus when prop changes (e.g. after refetch)
  if (signingStatus !== undefined && signingStatus !== localSigningStatus && localSigningStatus !== 'sent') {
    setLocalSigningStatus(signingStatus)
  }

  const total = lineItems.reduce((sum, li) => sum + (li.amount ?? 0), 0)
  const isDraft = agreementStatus === 'draft'
  const isExternallySigned = localSigningStatus === 'externally_signed'
  const canEditLineItems = isDraft || isExternallySigned
  const hasSigningUrl = !!clientSigningUrl

  const documentName = `Proposal - ${clientName} - ${formatDate(new Date().toISOString())}`

  function handleEdit() {
    setMaterialRows(toMaterialRows(materials))
    const hasDraft = localStorage.getItem(`draft__${draftKey}`) !== null
    if (hasDraft) {
      setDraftNotice(true)
    } else {
      setLiRows(toLineItemRows(lineItems))
      // setLiRows writes to localStorage; remove since this is just initialization
      try { localStorage.removeItem(`draft__${draftKey}`) } catch { /* ignore */ }
    }
    setEditing(true)
    setError(null)
  }

  function handleCancel() {
    clearLiDraft()
    setDraftNotice(false)
    setEditing(false)
    setError(null)
  }

  function copyToClipboard(text: string) {
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  async function handleGenerateProposal(signerName: string, signerEmail: string) {
    setGenerating(true)
    setGenerateError(null)

    const { data, error } = await supabase.functions.invoke('generate-proposal', {
      body: { agreement_id: agreementId, signer_name: signerName, signer_email: signerEmail },
    })

    if (error || !data?.success) {
      setGenerateError(data?.error ?? error?.message ?? 'Failed to generate proposal')
      setGenerating(false)
      return
    }

    setProposalModalOpen(false)
    setGenerating(false)
    refetchLineItems()
  }

  async function handleRecreateProposal() {
    setClearing(true)
    setConfirmRecreate(false)

    const { error: clearErr } = await supabase
      .from('service_agreements')
      .update({
        signing_session_id: null,
        signing_status: null,
        client_signing_url: null,
        proposal_pdf_url: null,
        signed_pdf_url: null,
        signing_completed_at: null,
      })
      .eq('id', agreementId)

    if (clearErr) {
      setError(`Failed to clear proposal: ${clearErr.message}`)
      setClearing(false)
      return
    }

    setLocalSigningStatus(null)
    setClearing(false)

    refetchLineItems()

    setGenerateError(null)
    setProposalModalOpen(true)
  }

  async function handleSave() {
    setSaving(true)
    setError(null)

    // Always delete and re-insert materials
    const { error: delMatErr } = await supabase
      .from('service_agreement_materials')
      .delete()
      .eq('agreement_id', agreementId)
    if (delMatErr) { setError(getSupabaseErrorMessage(delMatErr)); setSaving(false); return }

    const validMats = materialRows.filter((r) => r.chemical_id)
    if (validMats.length > 0) {
      const { error: matErr } = await supabase
        .from('service_agreement_materials')
        .insert(validMats.map((r) => ({
          agreement_id: agreementId,
          chemical_id: r.chemical_id,
          recommended_amount: r.recommended_amount ? parseFloat(r.recommended_amount) : null,
          recommended_unit: r.recommended_unit || null,
        })))
      if (matErr) { setError(getSupabaseErrorMessage(matErr)); setSaving(false); return }
    }

    // Delete and re-insert line items while they're editable (draft or externally signed)
    if (canEditLineItems) {
      const { error: delLiErr } = await supabase
        .from('service_agreement_line_items')
        .delete()
        .eq('agreement_id', agreementId)
      if (delLiErr) { setError(getSupabaseErrorMessage(delLiErr)); setSaving(false); return }

      const validLIs = liRows.filter((r) => r.is_manual_override ? r.description.trim() : r.service_type_id)
      if (validLIs.length > 0) {
        const { error: liErr } = await supabase
          .from('service_agreement_line_items')
          .insert(validLIs.map((r, idx) => {
            const lineItemsList = r.line_items.filter((li) => li.trim())
            const base = {
              agreement_id: agreementId,
              sort_order: idx,
              frequency: r.frequency,
              season_start_month: (r.frequency === 'monthly_seasonal' || r.frequency === 'weekly_seasonal') ? r.season_start_month : null,
              season_end_month: (r.frequency === 'monthly_seasonal' || r.frequency === 'weekly_seasonal') ? r.season_end_month : null,
              line_items: lineItemsList,
            }
            if (r.is_manual_override) {
              return { ...base, description: r.description.trim(), amount: parseFloat(r.amount) || 0, is_manual_override: true }
            }
            return {
              ...base,
              service_type_id: r.service_type_id,
              acreage: r.acreage ? parseFloat(r.acreage) : null,
              hours: r.hours ? parseFloat(r.hours) : null,
              unit_rate: r.unit_rate ? parseFloat(r.unit_rate) : null,
              amount: rowTotal(r),
              is_manual_override: false,
            }
          }))
        if (liErr) { setError(getSupabaseErrorMessage(liErr)); setSaving(false); return }
      }
    }

    // Regenerate WOs after line item changes (idempotent -- duplicates ignored)
    if (canEditLineItems) {
      const { data: genData, error: genError } = await supabase.rpc('generate_work_orders_for_agreement', {
        p_agreement_id: agreementId
      })
      if (genError) {
        setError(`Estimate saved, but work order generation failed: ${genError.message}`)
      } else if ((genData as { reason?: string } | null)?.reason === 'po_required') {
        setError('Estimate saved. Work orders were not generated because this client requires a PO Number. Add the PO and regenerate.')
      }
    }

    clearLiDraft()
    setDraftNotice(false)
    refetchMaterials()
    refetchLineItems()
    setEditing(false)
    setSaving(false)
  }

  // Editing mode
  if (editing) {
    return (
      <div className="space-y-6">
        {draftNotice && (
          <div className="flex items-center justify-between text-sm text-[var(--color-text-muted)]">
            <span>Draft restored.</span>
            <button type="button" onClick={() => { clearLiDraft(); setDraftNotice(false) }} className="ml-2 hover:text-[var(--color-text-primary)]">&times;</button>
          </div>
        )}
        {!isExternallySigned && boilerplateBlock}
        <MaterialsSection rows={materialRows} onChange={setMaterialRows} totalAcres={totalAcres} />
        {canEditLineItems ? (
          <div className="border-t border-surface-border pt-4">
            <AgreementLineItemsSection rows={liRows} onChange={setLiRows} totalAcres={totalAcres} />
          </div>
        ) : (
          <div className="border-t border-surface-border pt-4">
            <AgreementLineItemsSection rows={liRows} onChange={() => {}} readOnly totalAcres={totalAcres} />
            <p className="text-xs text-[var(--color-text-muted)] mt-2">Line items are locked after the agreement is activated.</p>
          </div>
        )}
        {error && <p className="text-sm text-red-600">{error}</p>}
        <div className="flex gap-2 justify-end">
          <Button variant="secondary" size="sm" onClick={handleCancel} disabled={saving}>Cancel</Button>
          <Button size="sm" onClick={handleSave} disabled={saving}>{saving ? 'Saving...' : 'Save'}</Button>
        </div>
      </div>
    )
  }

  // Read-only mode
  return (
    <div className="space-y-4">
      {canEdit(role) && (
        <div className="flex justify-end">
          <Button variant="ghost" size="sm" onClick={handleEdit}>Edit Estimate</Button>
        </div>
      )}

      {!isExternallySigned && boilerplateBlock}

      <div>
        <h2 className="text-sm font-semibold mb-3">Materials</h2>
        {materials.length === 0 ? (
          <p className="text-sm text-[var(--color-text-muted)]">No materials.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-surface-border text-left text-[var(--color-text-muted)]">
                  <th className="pb-2 pr-4">Chemical</th>
                  <th className="pb-2 pr-4">Active Ingredient</th>
                  <th className="pb-2">Recommended</th>
                </tr>
              </thead>
              <tbody>
                {materials.map((m) => (
                  <tr key={m.id} className="border-b border-surface-border last:border-0">
                    <td className="py-2 pr-4">{m.chemical?.name ?? '—'}</td>
                    <td className="py-2 pr-4 text-[var(--color-text-muted)]">{m.chemical?.active_ingredient ?? '—'}</td>
                    <td className="py-2">{m.recommended_amount ?? '—'} {m.recommended_unit ?? ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="border-t border-surface-border pt-4">
        <h2 className="text-sm font-semibold mb-3">Line Items</h2>
        {lineItems.length === 0 ? (
          <p className="text-sm text-[var(--color-text-muted)]">No line items.</p>
        ) : (
          <>
            <div className="space-y-1">
              {lineItems.map((li) => (
                <div key={li.id}>
                  <div className="flex justify-between text-sm py-1">
                    <span>{li.is_manual_override ? (li.description || '—') : (li.service_type?.name || '—')}</span>
                    <span>{formatCurrency(li.amount)}</span>
                  </div>
                  {Array.isArray(li.line_items) && li.line_items.length > 0 && (
                    <ul className="ml-4 mb-1">
                      {li.line_items.map((item, j) => (
                        <li key={j} className="text-xs text-[var(--color-text-muted)] leading-snug">• {item}</li>
                      ))}
                    </ul>
                  )}
                  {li.frequency !== 'one_time' && (
                    <p className="text-xs text-[var(--color-text-muted)] ml-4">
                      {FREQUENCY_LABELS[li.frequency]}
                      {(li.frequency === 'monthly_seasonal' || li.frequency === 'weekly_seasonal') && li.season_start_month && li.season_end_month && (
                        <> ({['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][li.season_start_month - 1]}–{['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][li.season_end_month - 1]})</>
                      )}
                    </p>
                  )}
                </div>
              ))}
            </div>
            <div className="flex justify-end border-t border-surface-border pt-2 mt-2">
              <p className="text-sm font-semibold">Total: {formatCurrency(total)}</p>
            </div>
          </>
        )}
      </div>

      {/* Agreement actions */}
      <div className="border-t border-surface-border pt-4 space-y-3">
        {isExternallySigned ? (
          <ExternalContractPanel
            agreementId={agreementId}
            signedPdfUrl={signedPdfUrl ?? null}
            onUploaded={refetchLineItems}
          />
        ) : !hasSigningUrl ? (
          <div>
            <Button
              size="sm"
              onClick={() => { setGenerateError(null); setProposalModalOpen(true) }}
              disabled={generating || lineItems.length === 0}
              style={{ backgroundColor: '#2a6b2a', color: '#fff' }}
            >
              <FileText size={16} />
              Create Agreement
            </Button>
          </div>
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-3">
              <SigningStatusBadge status={localSigningStatus} />

              <button
                type="button"
                onClick={() => { setEmailSentTo(null); setSendModalOpen(true) }}
                className="inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium text-white transition-colors hover:opacity-90"
                style={{ backgroundColor: '#2a6b2a' }}
              >
                <Send size={14} />
                Preview &amp; Send
              </button>

              <Button
                size="sm"
                variant="secondary"
                onClick={() => copyToClipboard(clientSigningUrl!)}
              >
                {copied ? <Check size={14} /> : <Copy size={14} />}
                {copied ? 'Copied!' : 'Copy Link'}
              </Button>

              {localSigningStatus !== 'completed' && (
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => setConfirmRecreate(true)}
                  disabled={clearing}
                >
                  <RefreshCw size={14} />
                  {clearing ? 'Clearing...' : 'Recreate Proposal'}
                </Button>
              )}

              {localSigningStatus === 'completed' && signedPdfUrl && (
                <a
                  href={signedPdfUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-sm text-brand-green hover:underline"
                >
                  <Download size={14} />
                  Download Signed PDF
                </a>
              )}

              {localSigningStatus === 'completed' && signingCompletedAt && (
                <span className="text-xs text-[var(--color-text-muted)]">
                  Signed on {formatDate(signingCompletedAt)}
                </span>
              )}
            </div>

            {emailSentTo && (
              <p className="text-sm text-green-700">Email sent to {emailSentTo}</p>
            )}
          </>
        )}
      </div>

      <GenerateProposalModal
        open={proposalModalOpen}
        agreementId={agreementId}
        onClose={() => setProposalModalOpen(false)}
        onConfirm={handleGenerateProposal}
        clientContact={clientContact}
        clientEmail={clientEmail}
        generating={generating}
        error={generateError}
      />

      {hasSigningUrl && (
        <SendProposalModal
          open={sendModalOpen}
          onClose={() => setSendModalOpen(false)}
          agreementId={agreementId}
          signingUrl={clientSigningUrl!}
          documentName={documentName}
          clientContact={clientContact}
          clientEmail={clientEmail}
          clientPhone={clientPhone}
          companyName="Chem-Weed"
          onSent={(email) => {
            setSendModalOpen(false)
            setEmailSentTo(email)
            setLocalSigningStatus('sent')
          }}
        />
      )}

      <Modal
        open={confirmRecreate}
        onClose={() => setConfirmRecreate(false)}
        title="Recreate Proposal?"
      >
        <div className="space-y-4">
          <p className="text-sm text-[var(--color-text-muted)]">
            This will invalidate the current proposal and signing link. The client will no longer be able to sign the previous version.
          </p>
          <p className="text-sm text-[var(--color-text-muted)]">
            A new proposal will be generated using the current estimate, boilerplate text, and pricing.
          </p>
          <div className="flex gap-2 justify-end pt-2 border-t border-surface-border">
            <Button variant="secondary" size="sm" onClick={() => setConfirmRecreate(false)}>
              Cancel
            </Button>
            <button
              type="button"
              onClick={handleRecreateProposal}
              disabled={clearing}
              className="inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium text-white transition-colors disabled:opacity-50"
              style={{ backgroundColor: '#2a6b2a' }}
            >
              {clearing ? 'Clearing...' : 'Yes, Recreate'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}

function ScheduleSection({ agreement }: { agreement: ServiceAgreement }) {
  return (
    <div>
      <h2 className="text-sm font-semibold mb-3">Schedule</h2>
      <dl className="space-y-2 text-sm">
        <div>
          <dt className="text-[var(--color-text-muted)]">Proposed Start Date</dt>
          <dd>{formatDate(agreement.proposed_start_date)}</dd>
        </div>
        <div>
          <dt className="text-[var(--color-text-muted)]">Contract Start</dt>
          <dd>{formatDate(agreement.contract_start_date)}</dd>
        </div>
        <div>
          <dt className="text-[var(--color-text-muted)]">Contract End</dt>
          <dd>{formatDate(agreement.contract_end_date)}</dd>
        </div>
        <div>
          <dt className="text-[var(--color-text-muted)]">Assigned PCA</dt>
          <dd>{agreement.pca ? `${agreement.pca.first_name} ${agreement.pca.last_name}` : '—'}</dd>
        </div>
        <div>
          <dt className="text-[var(--color-text-muted)]">Sales Rep</dt>
          <dd>{agreement.sales_rep ? `${agreement.sales_rep.first_name} ${agreement.sales_rep.last_name}` : '—'}</dd>
        </div>
      </dl>
    </div>
  )
}

function isFuturePeriod(wo: WorkOrder): boolean {
  if (wo.period_year == null || wo.period_month == null) return false
  const now = new Date()
  const currentPeriod = now.getFullYear() * 100 + (now.getMonth() + 1)
  const woPeriod = wo.period_year * 100 + wo.period_month
  return woPeriod > currentPeriod
}

function WorkOrdersSection({ workOrders, lineItems }: { workOrders: WorkOrder[]; lineItems: ServiceAgreementLineItem[] }) {
  const navigate = useNavigate()

  if (workOrders.length === 0) {
    return <p className="text-sm text-[var(--color-text-muted)]">No work orders generated yet.</p>
  }

  // Group by line item
  const grouped = lineItems.map(li => ({
    lineItem: li,
    wos: workOrders.filter(wo => wo.agreement_line_item_id === li.id),
  })).filter(g => g.wos.length > 0)

  // Also show WOs not matched (shouldn't happen, but just in case)
  const matchedIds = new Set(grouped.flatMap(g => g.wos.map(wo => wo.id)))
  const unmatched = workOrders.filter(wo => !matchedIds.has(wo.id))

  return (
    <div className="space-y-4">
      {grouped.map(({ lineItem, wos }) => (
        <div key={lineItem.id}>
          <h3 className="text-sm font-semibold mb-2">
            {lineItem.is_manual_override ? lineItem.description : lineItem.service_type?.name ?? 'Line Item'}
            <span className="text-xs font-normal text-[var(--color-text-muted)] ml-2">
              ({FREQUENCY_LABELS[lineItem.frequency]})
            </span>
          </h3>
          <div className="space-y-1">
            {wos.map(wo => {
              const future = isFuturePeriod(wo)
              return (
                <button
                  key={wo.id}
                  type="button"
                  onClick={() => navigate(`/work-orders/${wo.id}`)}
                  className={`w-full flex items-center justify-between text-sm py-2 px-3 rounded-lg hover:bg-surface transition-colors text-left ${future ? 'opacity-50' : ''}`}
                >
                  <span className="flex items-center gap-2">
                    {formatPeriodLabel(wo)}
                    {future && (
                      <span className="inline-block rounded-full bg-gray-100 text-gray-500 px-2 py-0.5 text-[10px] font-medium">
                        Future
                      </span>
                    )}
                  </span>
                  <div className="flex items-center gap-2">
                    {wo.scheduled_date && (
                      <span className="text-xs text-[var(--color-text-muted)]">{formatDate(wo.scheduled_date)}</span>
                    )}
                    <Badge status={wo.status} />
                  </div>
                </button>
              )
            })}
          </div>
        </div>
      ))}
      {unmatched.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold mb-2">Other</h3>
          {unmatched.map(wo => (
            <button
              key={wo.id}
              type="button"
              onClick={() => navigate(`/work-orders/${wo.id}`)}
              className="w-full flex items-center justify-between text-sm py-2 px-3 rounded-lg hover:bg-surface transition-colors text-left"
            >
              <span>{formatPeriodLabel(wo)}</span>
              <Badge status={wo.status} />
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function NotesSection({ agreement }: { agreement: ServiceAgreement }) {
  const hasAny = agreement.notes_client || agreement.notes_internal || agreement.notes_technician || agreement.disclaimer

  if (!hasAny) {
    return <p className="text-sm text-[var(--color-text-muted)]">No notes for this agreement.</p>
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-sm font-semibold mb-2">Client Notes</h2>
        <p className="text-sm whitespace-pre-wrap">{agreement.notes_client || <span className="text-[var(--color-text-muted)]">—</span>}</p>
      </div>
      <div className="border-t border-surface-border pt-4">
        <h2 className="text-sm font-semibold mb-2">Internal Notes</h2>
        <p className="text-sm whitespace-pre-wrap">{agreement.notes_internal || <span className="text-[var(--color-text-muted)]">—</span>}</p>
      </div>
      <div className="border-t border-surface-border pt-4">
        <h2 className="text-sm font-semibold mb-2">Tech Instructions</h2>
        <p className="text-sm whitespace-pre-wrap">{agreement.notes_technician || <span className="text-[var(--color-text-muted)]">—</span>}</p>
      </div>
      {agreement.disclaimer && (
        <div className="border-t border-surface-border pt-4">
          <h2 className="text-sm font-semibold mb-2">Disclaimer</h2>
          <p className="text-sm whitespace-pre-wrap bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-amber-900">
            {agreement.disclaimer}
          </p>
        </div>
      )}
    </div>
  )
}

function DetailItem({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-[140px]">
      <dt className="text-xs text-[var(--color-text-muted)]">{label}</dt>
      <dd className="text-sm mt-0.5">{children}</dd>
    </div>
  )
}

export function AgreementDetail() {
  const { id } = useParams<{ id: string }>()
  const { role, user } = useAuth()
  const { agreement, lineItems, isLoading, error, notFound, refetch } = useServiceAgreement(id)
  const { materials, refetch: refetchMaterials } = useServiceAgreementMaterials(id)
  const { weedProfile, observationLogs, refetch: refetchSiteProfile } = useSiteProfile(agreement?.site_id)
  const { photos: sitePhotos, refetch: refetchPhotos } = useSitePhotos(agreement?.site_id)
  const { groups: fieldLogGroups } = useFieldLogPhotos(agreement?.site_id)
  const { workOrders } = useWorkOrders()
  const [activeTab, setActiveTab] = useState('details')
  const [siteInfoOpen, setSiteInfoOpen] = useState(false)
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const [editModalOpen, setEditModalOpen] = useState(false)
  const [activating, setActivating] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [woGenWarning, setWoGenWarning] = useState<string | null>(null)
  const [regenerating, setRegenerating] = useState(false)
  const [regenSuccess, setRegenSuccess] = useState<string | null>(null)

  // Read wo_gen_failed / wo_gen_po_required query params on mount
  useEffect(() => {
    if (searchParams.get('wo_gen_failed') === '1') {
      setWoGenWarning('Agreement saved, but work order generation failed. Use the "Regenerate Work Orders" button below to retry.')
      setSearchParams({}, { replace: true })
    } else if (searchParams.get('wo_gen_po_required') === '1') {
      setWoGenWarning('Agreement saved. Work orders were not generated because this client requires a PO Number. Add the PO and regenerate to release the work orders.')
      setSearchParams({}, { replace: true })
    }
  }, [searchParams, setSearchParams])

  // Filter WOs for this agreement
  const agreementWOs = workOrders.filter(wo => wo.service_agreement_id === id)

  if (isLoading) return <LoadingSpinner />
  if (error) return <ErrorMessage message={error} onRetry={refetch} />
  if (notFound || !agreement) return (
    <div className="max-w-lg mx-auto mt-12 px-4">
      <Card>
        <div className="p-6 text-center">
          <h2 className="text-lg font-semibold mb-2">Agreement Not Found</h2>
          <p className="text-sm text-[var(--color-text-muted)] mb-6">
            This agreement could not be found. It may have been deleted.
          </p>
          <Button variant="secondary" onClick={() => navigate('/agreements')}>
            <ArrowLeft size={16} className="mr-2" />
            Back to Agreements
          </Button>
        </div>
      </Card>
    </div>
  )

  async function deleteAgreement() {
    if (!agreement) return
    const confirmed = window.confirm('Are you sure you want to delete this service agreement? This will also delete all associated work orders.')
    if (!confirmed) return
    setDeleting(true)
    const { error: err } = await supabase
      .from('service_agreements')
      .delete()
      .eq('id', agreement.id)
    if (err) {
      alert(getSupabaseErrorMessage(err))
      setDeleting(false)
    } else {
      navigate('/agreements')
    }
  }

  async function activateAgreement() {
    if (!agreement) return
    setActivating(true)
    setWoGenWarning(null)
    const { error: err } = await supabase
      .from('service_agreements')
      .update({ agreement_status: 'active' })
      .eq('id', agreement.id)
    if (err) {
      alert(getSupabaseErrorMessage(err))
    } else {
      // Generate all WOs for the agreement upfront
      const { data: genData, error: genError } = await supabase.rpc(
        'generate_work_orders_for_agreement',
        { p_agreement_id: agreement.id }
      )
      if (genError) {
        setWoGenWarning('Agreement activated, but work order generation failed. Use the "Regenerate Work Orders" button below to retry.')
      } else if ((genData as { reason?: string } | null)?.reason === 'po_required') {
        setWoGenWarning('Agreement activated. Work orders were not generated because this client requires a PO Number. Add the PO and regenerate.')
      }
      refetch()
    }
    setActivating(false)
  }

  async function regenerateWorkOrders() {
    if (!agreement) return
    setRegenerating(true)
    setWoGenWarning(null)
    setRegenSuccess(null)
    const { data: genData, error: genError } = await supabase.rpc('generate_work_orders_for_agreement', {
      p_agreement_id: agreement.id
    })
    if (genError) {
      setWoGenWarning(`Work order generation failed: ${genError.message}`)
    } else if ((genData as { reason?: string } | null)?.reason === 'po_required') {
      setWoGenWarning('Work orders were not generated because this client requires a PO Number. Add the PO above and try again.')
    } else {
      setRegenSuccess('Work orders regenerated successfully.')
      setTimeout(() => setRegenSuccess(null), 4000)
      refetch()
    }
    setRegenerating(false)
  }

  return (
    <div>
      <Link to="/agreements" className="inline-flex items-center gap-1 text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] mb-4">
        <ArrowLeft size={16} />
        Back to Agreements
      </Link>

      <div className="flex items-start justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold">{agreement.client?.name} — {agreement.site?.name}</h1>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <Badge agreementStatus={agreement.agreement_status} />
            {agreement.client?.po_required && (
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700">
                PO Required
              </span>
            )}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {agreement.agreement_status === 'draft' && canEdit(role) && (
            <Button size="sm" onClick={activateAgreement} disabled={activating}>
              <CheckCircle size={16} />
              {activating ? 'Activating...' : 'Activate Agreement'}
            </Button>
          )}
          {agreement.agreement_status === 'active' && canEdit(role) && (
            <Button size="sm" variant="secondary" onClick={regenerateWorkOrders} disabled={regenerating}>
              <RefreshCw size={16} className={regenerating ? 'animate-spin' : ''} />
              {regenerating ? 'Regenerating...' : 'Regenerate Work Orders'}
            </Button>
          )}
          {canEdit(role) && (
            <Button variant="secondary" size="sm" onClick={() => setEditModalOpen(true)}>
              <Edit size={16} />
              Edit
            </Button>
          )}
          {canEdit(role) && (
            <Button variant="danger" size="sm" onClick={deleteAgreement} disabled={deleting}>
              <Trash2 size={16} />
              {deleting ? 'Deleting...' : 'Delete'}
            </Button>
          )}
        </div>
      </div>

      {woGenWarning && (
        <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700 flex items-center justify-between">
          <span>{woGenWarning}</span>
          <button type="button" onClick={() => setWoGenWarning(null)} className="ml-2 text-amber-500 hover:text-amber-700 font-bold">&times;</button>
        </div>
      )}

      {regenSuccess && (
        <div className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
          {regenSuccess}
        </div>
      )}

      {agreement.site && (
        <SiteInfoCard
          site={agreement.site}
          weedProfile={weedProfile}
          observationLogs={observationLogs}
          sitePhotos={sitePhotos}
          fieldLogGroups={fieldLogGroups}
          isOpen={siteInfoOpen}
          onToggle={() => setSiteInfoOpen(!siteInfoOpen)}
          role={role}
          userId={user?.id}
          refetchSiteProfile={refetchSiteProfile}
          refetchPhotos={refetchPhotos}
        />
      )}

      <Card padding={false}>
        <TabBar tabs={TABS} activeTab={activeTab} onChange={setActiveTab} />
        <div className="p-5">
          {activeTab === 'details' && <DetailsSection agreement={agreement} lineItems={lineItems} />}
          {activeTab === 'estimate' && <EstimateSection lineItems={lineItems} materials={materials} agreementId={agreement.id} agreementStatus={agreement.agreement_status} signingStatus={agreement.signing_status} clientSigningUrl={agreement.client_signing_url} signedPdfUrl={agreement.signed_pdf_url} signingCompletedAt={agreement.signing_completed_at} totalAcres={agreement.site?.total_acres} clientContact={agreement.client?.billing_contact ?? null} clientEmail={agreement.client?.billing_email ?? null} clientPhone={agreement.client?.billing_phone ?? null} clientName={agreement.client?.name ?? ''} boilerplateTemplateId={agreement.boilerplate_template_id ?? null} boilerplateTemplateName={agreement.boilerplate_template?.name ?? null} boilerplateTemplateBody={agreement.boilerplate_template?.body ?? null} refetchLineItems={refetch} refetchMaterials={refetchMaterials} />}
          {activeTab === 'schedule' && <ScheduleSection agreement={agreement} />}
          {activeTab === 'work_orders' && <WorkOrdersSection workOrders={agreementWOs} lineItems={lineItems} />}
          {activeTab === 'notes' && <NotesSection agreement={agreement} />}
        </div>
      </Card>

      {editModalOpen && (
        <EditAgreementModal
          open={editModalOpen}
          agreement={agreement}
          onClose={() => setEditModalOpen(false)}
          onSaved={refetch}
        />
      )}
    </div>
  )
}
