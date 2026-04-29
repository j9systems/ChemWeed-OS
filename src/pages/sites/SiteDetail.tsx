import { useState, useRef } from 'react'
import { useParams, useSearchParams, Link } from 'react-router'
import {
  ArrowLeft,
  MapPin,
  ImageIcon,
  Upload,
  ChevronLeft,
  ChevronRight,
  X,
  Phone,
  Mail,
  Navigation,
  AlertTriangle,
  Pencil,
  Trash2,
} from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { useSite } from '@/hooks/useSite'
import { useSiteProfile } from '@/hooks/useSiteProfile'
import { useSitePhotos } from '@/hooks/useSitePhotos'
import { useFieldLogPhotos } from '@/hooks/useFieldLogPhotos'
import { useWorkOrders } from '@/hooks/useWorkOrders'
import { supabase } from '@/lib/supabase'
import { getSupabaseErrorMessage, formatDate, formatDateTime } from '@/lib/utils'
import { canEdit } from '@/lib/roles'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'
import { ErrorMessage } from '@/components/ui/ErrorMessage'
import { EditSiteModal } from './EditSiteModal'

const GOOGLE_MAPS_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string
const PHOTOS_PER_PAGE = 6

function buildAddress(site: { address_line: string; city: string; state: string; zip: string }) {
  return [site.address_line, site.city, site.state, site.zip].filter(Boolean).join(', ')
}

function streetViewUrl(address: string) {
  if (!address || !GOOGLE_MAPS_KEY) return null
  return `https://maps.googleapis.com/maps/api/streetview?size=800x400&location=${encodeURIComponent(address)}&key=${GOOGLE_MAPS_KEY}`
}

function googleMapEmbedUrl(address: string) {
  if (!address || !GOOGLE_MAPS_KEY) return null
  return `https://www.google.com/maps/embed/v1/place?q=${encodeURIComponent(address)}&key=${GOOGLE_MAPS_KEY}`
}

export function SiteDetail() {
  const { id } = useParams<{ id: string }>()
  const [searchParams] = useSearchParams()
  const { role, user } = useAuth()
  const { site, isLoading, error, refetch: refetchSite } = useSite(id)
  const { weedProfile, observationLogs, refetch: refetchSiteProfile } = useSiteProfile(id)
  const { photos: sitePhotos, refetch: refetchPhotos } = useSitePhotos(id)
  const { groups: fieldLogGroups } = useFieldLogPhotos(id)
  const { workOrders } = useWorkOrders()

  const [newWeed, setNewWeed] = useState('')
  const [adding, setAdding] = useState(false)
  const [weedError, setWeedError] = useState<string | null>(null)
  const [showAllLogs, setShowAllLogs] = useState(false)
  const [photoPage, setPhotoPage] = useState(0)
  const [photoTab, setPhotoTab] = useState<'admin' | 'field_log'>('admin')
  const [uploading, setUploading] = useState(false)
  const [editModalOpen, setEditModalOpen] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  if (isLoading) return <LoadingSpinner />
  if (error) return <ErrorMessage message={error} />
  if (!site) return <ErrorMessage message="Site not found." />

  const siteAddress = buildAddress(site)
  const hasAddress = Boolean(site.address_line && site.city)
  const streetView = hasAddress ? streetViewUrl(siteAddress) : null
  const mapEmbed = hasAddress ? googleMapEmbedUrl(siteAddress) : null

  const siteWorkOrders = workOrders.filter((wo) => wo.site_id === site.id)

  const visibleLogs = showAllLogs ? observationLogs : observationLogs.slice(0, 5)
  const totalPages = Math.ceil(sitePhotos.length / PHOTOS_PER_PAGE)
  const pagedPhotos = sitePhotos.slice(photoPage * PHOTOS_PER_PAGE, (photoPage + 1) * PHOTOS_PER_PAGE)

  const navUrl = (() => {
    if (site.latitude != null && site.longitude != null) {
      return `https://www.google.com/maps/dir/?api=1&destination=${site.latitude},${site.longitude}`
    }
    if (hasAddress) {
      return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(siteAddress)}`
    }
    return null
  })()

  async function addWeed() {
    const name = newWeed.trim()
    if (!name || !site) return
    setAdding(true)
    setWeedError(null)

    const { error: err } = await supabase
      .from('site_weed_profile')
      .insert({ site_id: site.id, weed_name: name, added_by: user?.id ?? null })

    if (err) {
      setWeedError(getSupabaseErrorMessage(err))
    } else {
      setNewWeed('')
      refetchSiteProfile()
    }
    setAdding(false)
  }

  async function removeWeed(weedId: string) {
    setWeedError(null)
    const { error: err } = await supabase
      .from('site_weed_profile')
      .delete()
      .eq('id', weedId)

    if (err) {
      setWeedError(getSupabaseErrorMessage(err))
    } else {
      refetchSiteProfile()
    }
  }

  async function handlePhotoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files
    if (!files || files.length === 0 || !site) return
    setUploading(true)
    setWeedError(null)

    for (const file of Array.from(files)) {
      const ext = file.name.split('.').pop()
      const path = `site-photos/${site.id}/${crypto.randomUUID()}.${ext}`

      const { error: uploadErr } = await supabase.storage
        .from('site-photos')
        .upload(path, file)

      if (uploadErr) {
        setWeedError(getSupabaseErrorMessage(uploadErr))
        continue
      }

      const { data: urlData } = supabase.storage.from('site-photos').getPublicUrl(path)

      const { error: insertErr } = await supabase
        .from('site_photos')
        .insert({
          site_id: site.id,
          photo_url: urlData.publicUrl,
          photo_type: 'admin',
          uploaded_by: user?.id ?? null,
        })

      if (insertErr) {
        setWeedError(getSupabaseErrorMessage(insertErr))
      }
    }

    setUploading(false)
    refetchPhotos()
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  async function handleDeletePhoto(photoId: string) {
    setWeedError(null)
    const { error: err } = await supabase
      .from('site_photos')
      .delete()
      .eq('id', photoId)

    if (err) {
      setWeedError(getSupabaseErrorMessage(err))
    } else {
      refetchPhotos()
    }
  }

  // Count field log photos across all groups
  const fieldLogPhotoCount = fieldLogGroups.reduce(
    (sum, g) => sum + g.beforeUrls.length + g.afterUrls.length + g.duringUrls.length,
    0,
  )

  return (
    <div>
      {/* Back link */}
      {searchParams.get('from') === 'wo' && searchParams.get('woId') ? (
        <Link
          to={`/work-orders/${searchParams.get('woId')}`}
          className="inline-flex items-center gap-1 text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] mb-4"
        >
          <ArrowLeft size={16} />
          Back to Job
        </Link>
      ) : site.client ? (
        <Link
          to={`/clients/${site.client_id}`}
          className="inline-flex items-center gap-1 text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] mb-4"
        >
          <ArrowLeft size={16} />
          Back to {site.client.name}
        </Link>
      ) : (
        <Link
          to="/clients"
          className="inline-flex items-center gap-1 text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] mb-4"
        >
          <ArrowLeft size={16} />
          Back to Clients
        </Link>
      )}

      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">{site.name}</h1>
          {site.client && (
            <p className="text-sm text-[var(--color-text-muted)] mt-0.5">{site.client.name}</p>
          )}
        </div>
        <div className="flex items-center gap-2">
          {canEdit(role) && (
            <button
              onClick={() => setEditModalOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-surface-border bg-surface-raised px-3 py-2 text-sm hover:bg-surface transition-colors"
            >
              <Pencil size={16} />
              Edit
            </button>
          )}
          {navUrl && (
            <a
              href={navUrl}
              className="inline-flex items-center gap-1.5 rounded-lg border border-surface-border bg-surface-raised px-3 py-2 text-sm hover:bg-surface transition-colors"
            >
              <Navigation size={16} />
              Navigate
            </a>
          )}
        </div>
      </div>

      {/* Street View hero + site details */}
      <Card className="mb-6 overflow-hidden" padding={false}>
        <div className="flex flex-col sm:flex-row">
          {/* Street View */}
          <div className="sm:w-[320px] md:w-[400px] shrink-0">
            {streetView ? (
              <img
                src={streetView}
                alt={`Street view of ${siteAddress}`}
                className="w-full h-[200px] sm:h-full object-cover"
              />
            ) : (
              <div className="w-full h-[200px] sm:h-full bg-surface flex items-center justify-center text-sm text-[var(--color-text-muted)]">
                <div className="flex flex-col items-center gap-1">
                  <MapPin size={24} />
                  <span>{hasAddress ? 'Street view unavailable' : 'No address'}</span>
                </div>
              </div>
            )}
          </div>

          {/* Site details */}
          <div className="flex-1 p-5 sm:p-6">
            <h2 className="text-sm font-semibold mb-3">Site Details</h2>
            <dl className="space-y-1.5 text-sm">
              <div>
                <dt className="text-[var(--color-text-muted)] inline">Address: </dt>
                <dd className="inline">{site.address_line}</dd>
              </div>
              <div>
                <dt className="text-[var(--color-text-muted)] inline">City: </dt>
                <dd className="inline">{site.city}{site.state ? `, ${site.state}` : ''} {site.zip ?? ''}</dd>
              </div>
              {site.county && (
                <div className="flex items-center gap-2">
                  <dt className="text-[var(--color-text-muted)] inline">County: </dt>
                  <dd className="inline">{site.county.name}</dd>
                  {!site.county.is_licensed && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-700 font-medium">
                      <AlertTriangle size={12} />
                      Unlicensed
                    </span>
                  )}
                </div>
              )}
              {site.property_type && (
                <div>
                  <dt className="text-[var(--color-text-muted)] inline">Property Type: </dt>
                  <dd className="inline capitalize">{site.property_type}</dd>
                </div>
              )}
              {(site.latitude != null && site.longitude != null) && (
                <div>
                  <dt className="text-[var(--color-text-muted)] inline">Coordinates: </dt>
                  <dd className="inline">{site.latitude.toFixed(6)}, {site.longitude.toFixed(6)}</dd>
                </div>
              )}
              {site.total_acres != null && (
                <div>
                  <dt className="text-[var(--color-text-muted)] inline">Acreage: </dt>
                  <dd className="inline">{site.total_acres}</dd>
                </div>
              )}
              {site.notes && (
                <div>
                  <dt className="text-[var(--color-text-muted)] inline">Notes: </dt>
                  <dd className="inline">{site.notes}</dd>
                </div>
              )}
            </dl>

            {/* Quick contact */}
            {site.client && (
              <div className="flex items-center gap-3 mt-4 pt-3 border-t border-surface-border">
                {site.client.billing_phone && (
                  <a
                    href={`tel:${site.client.billing_phone}`}
                    className="inline-flex items-center gap-1 text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]"
                  >
                    <Phone size={14} />
                    {site.client.billing_phone}
                  </a>
                )}
                {site.client.billing_email && (
                  <a
                    href={`mailto:${site.client.billing_email}`}
                    className="inline-flex items-center gap-1 text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]"
                  >
                    <Mail size={14} />
                    {site.client.billing_email}
                  </a>
                )}
              </div>
            )}
          </div>
        </div>
      </Card>

      {/* Two-column content */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        {/* Left — Map & Weed Profile */}
        <div className="space-y-6">
          {/* Google Map */}
          <Card padding={false} className="overflow-hidden">
            <div className="p-4 pb-0">
              <h3 className="text-xs font-semibold uppercase text-[var(--color-text-muted)] mb-2">Location</h3>
            </div>
            {mapEmbed ? (
              <div className="px-4 pb-4">
                <div className="rounded-lg overflow-hidden border border-surface-border">
                  <iframe
                    title="Site location"
                    width="100%"
                    height="260"
                    style={{ border: 0 }}
                    loading="lazy"
                    allowFullScreen
                    referrerPolicy="no-referrer-when-downgrade"
                    src={mapEmbed}
                  />
                </div>
              </div>
            ) : (
              <div className="px-4 pb-4">
                <div className="rounded-lg border border-surface-border bg-surface flex items-center justify-center h-[260px] text-sm text-[var(--color-text-muted)]">
                  <div className="flex flex-col items-center gap-1">
                    <MapPin size={24} />
                    <span>No address available</span>
                  </div>
                </div>
              </div>
            )}
          </Card>

          {/* Weed Profile */}
          <Card>
            <h3 className="text-xs font-semibold uppercase text-[var(--color-text-muted)] mb-3">Weed Profile</h3>
            {weedProfile.length === 0 ? (
              <p className="text-sm text-[var(--color-text-muted)]">No weed species on record for this site.</p>
            ) : (
              <div className="flex flex-wrap gap-2 mb-2">
                {weedProfile.map((w) => (
                  <span
                    key={w.id}
                    className="inline-flex items-center gap-1 bg-surface-raised border border-surface-border rounded-full px-3 py-1 text-sm"
                  >
                    {w.weed_name}
                    {canEdit(role) && (
                      <button
                        onClick={() => removeWeed(w.id)}
                        className="text-[var(--color-text-muted)] hover:text-red-600 min-h-[24px] min-w-[24px] flex items-center justify-center"
                        aria-label={`Remove ${w.weed_name}`}
                      >
                        <X size={14} />
                      </button>
                    )}
                  </span>
                ))}
              </div>
            )}
            {canEdit(role) && (
              <div className="flex gap-2 items-end mt-2">
                <Input
                  label="Add species"
                  value={newWeed}
                  onChange={(e) => setNewWeed(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addWeed() } }}
                  className="flex-1"
                />
                <Button size="sm" onClick={addWeed} disabled={adding || !newWeed.trim()}>
                  Add
                </Button>
              </div>
            )}
            {weedError && <p className="text-sm text-red-600 mt-1">{weedError}</p>}
          </Card>
        </div>

        {/* Right — Photos & Observation Log */}
        <div className="space-y-6">
          {/* Site Photos — Tabbed */}
          <Card>
            {/* Tab bar */}
            <div className="flex items-center gap-0 border-b border-surface-border -mx-4 px-4 mb-3">
              <button
                type="button"
                onClick={() => { setPhotoTab('admin'); setPhotoPage(0) }}
                className={`px-3 py-2 text-xs font-semibold uppercase transition-colors min-h-[40px] ${
                  photoTab === 'admin'
                    ? 'text-brand-green border-b-2 border-brand-green'
                    : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]'
                }`}
              >
                Admin Photos
                {sitePhotos.length > 0 && (
                  <span className="ml-1 text-[10px] font-normal">({sitePhotos.length})</span>
                )}
              </button>
              <button
                type="button"
                onClick={() => { setPhotoTab('field_log'); setPhotoPage(0) }}
                className={`px-3 py-2 text-xs font-semibold uppercase transition-colors min-h-[40px] ${
                  photoTab === 'field_log'
                    ? 'text-brand-green border-b-2 border-brand-green'
                    : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]'
                }`}
              >
                Field Log Photos
                {fieldLogPhotoCount > 0 && (
                  <span className="ml-1 text-[10px] font-normal">({fieldLogPhotoCount})</span>
                )}
              </button>
            </div>

            {/* Admin Photos tab */}
            {photoTab === 'admin' && (
              <>
                {canEdit(role) && (
                  <div className="flex justify-end mb-2">
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      multiple
                      onChange={handlePhotoUpload}
                      className="hidden"
                    />
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploading}
                      className="inline-flex items-center gap-1 text-xs text-brand-green hover:underline min-h-[32px]"
                    >
                      <Upload size={14} />
                      {uploading ? 'Uploading...' : 'Upload'}
                    </button>
                  </div>
                )}

                {sitePhotos.length === 0 ? (
                  <div className="rounded-lg border border-surface-border bg-surface flex items-center justify-center h-[220px] text-sm text-[var(--color-text-muted)]">
                    <div className="flex flex-col items-center gap-1">
                      <ImageIcon size={24} />
                      <span>No admin photos yet</span>
                    </div>
                  </div>
                ) : (
                  <div>
                    <div className="grid grid-cols-3 grid-rows-2 gap-2">
                      {pagedPhotos.map((photo) => (
                        <div key={photo.id} className="relative aspect-square rounded-lg overflow-hidden bg-surface-raised border border-surface-border group">
                          <img
                            src={photo.photo_url}
                            alt={photo.caption ?? 'Site photo'}
                            className="w-full h-full object-cover"
                          />
                          {canEdit(role) && (
                            <button
                              type="button"
                              onClick={() => handleDeletePhoto(photo.id)}
                              className="absolute top-1 right-1 rounded-full bg-black/60 p-1 text-white hover:bg-red-600 opacity-0 group-hover:opacity-100 transition-opacity min-h-[28px] min-w-[28px] flex items-center justify-center"
                              title="Delete photo"
                            >
                              <Trash2 size={14} />
                            </button>
                          )}
                        </div>
                      ))}
                      {Array.from({ length: Math.max(0, PHOTOS_PER_PAGE - pagedPhotos.length) }).map((_, i) => (
                        <div key={`empty-${i}`} className="aspect-square rounded-lg bg-surface-raised border border-surface-border" />
                      ))}
                    </div>
                    {totalPages > 1 && (
                      <div className="flex items-center justify-center gap-3 mt-2">
                        <button
                          onClick={() => setPhotoPage((p) => Math.max(0, p - 1))}
                          disabled={photoPage === 0}
                          className="p-1 rounded-lg hover:bg-surface-raised disabled:opacity-30 min-h-[32px] min-w-[32px] flex items-center justify-center"
                        >
                          <ChevronLeft size={18} />
                        </button>
                        <span className="text-xs text-[var(--color-text-muted)]">
                          {photoPage + 1} / {totalPages}
                        </span>
                        <button
                          onClick={() => setPhotoPage((p) => Math.min(totalPages - 1, p + 1))}
                          disabled={photoPage === totalPages - 1}
                          className="p-1 rounded-lg hover:bg-surface-raised disabled:opacity-30 min-h-[32px] min-w-[32px] flex items-center justify-center"
                        >
                          <ChevronRight size={18} />
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </>
            )}

            {/* Field Log Photos tab */}
            {photoTab === 'field_log' && (
              <>
                {fieldLogGroups.length === 0 ? (
                  <div className="rounded-lg border border-surface-border bg-surface flex items-center justify-center h-[220px] text-sm text-[var(--color-text-muted)]">
                    <div className="flex flex-col items-center gap-1">
                      <ImageIcon size={24} />
                      <span>No field log photos yet</span>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {fieldLogGroups.map((group) => (
                      <div key={group.workOrderId} className="border border-surface-border rounded-lg p-3">
                        <div className="flex items-center justify-between mb-2">
                          <div>
                            <p className="text-sm font-medium">
                              {group.serviceTypeName ?? 'Service'}
                            </p>
                            <p className="text-xs text-[var(--color-text-muted)]">
                              {group.completionDate
                                ? formatDate(group.completionDate)
                                : group.scheduledDate
                                  ? formatDate(group.scheduledDate)
                                  : 'No date'}
                            </p>
                          </div>
                          <Link
                            to={`/work-orders/${group.workOrderId}`}
                            className="text-xs text-brand-green hover:underline"
                          >
                            View Job
                          </Link>
                        </div>

                        {group.beforeUrls.length > 0 && (
                          <div className="mb-2">
                            <p className="text-[10px] font-semibold uppercase text-[var(--color-text-muted)] mb-1">Before</p>
                            <div className="grid grid-cols-4 gap-1.5">
                              {group.beforeUrls.map((url, i) => (
                                <div key={url} className="aspect-square rounded overflow-hidden border border-surface-border">
                                  <img src={url} alt={`Before ${i + 1}`} className="w-full h-full object-cover" />
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {group.afterUrls.length > 0 && (
                          <div className="mb-2">
                            <p className="text-[10px] font-semibold uppercase text-[var(--color-text-muted)] mb-1">After</p>
                            <div className="grid grid-cols-4 gap-1.5">
                              {group.afterUrls.map((url, i) => (
                                <div key={url} className="aspect-square rounded overflow-hidden border border-surface-border">
                                  <img src={url} alt={`After ${i + 1}`} className="w-full h-full object-cover" />
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {group.duringUrls.length > 0 && (
                          <div>
                            <p className="text-[10px] font-semibold uppercase text-[var(--color-text-muted)] mb-1">During</p>
                            <div className="grid grid-cols-4 gap-1.5">
                              {group.duringUrls.map((url, i) => (
                                <div key={url} className="aspect-square rounded overflow-hidden border border-surface-border">
                                  <img src={url} alt={`During ${i + 1}`} className="w-full h-full object-cover" />
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </Card>

          {/* Observation Log */}
          <Card>
            <h3 className="text-xs font-semibold uppercase text-[var(--color-text-muted)] mb-3">Observation Log</h3>
            {observationLogs.length === 0 ? (
              <p className="text-sm text-[var(--color-text-muted)]">No observation logs yet.</p>
            ) : (
              <>
                <div className="space-y-0">
                  {visibleLogs.map((log) => (
                    <div key={log.id} className="border-b border-surface-border py-2 text-sm last:border-0">
                      <p className="font-medium">{formatDateTime(log.observed_at)}</p>
                      {log.weed_species && log.weed_species.length > 0 && (
                        <p className="text-[var(--color-text-muted)]">Species: {log.weed_species.join(', ')}</p>
                      )}
                      {log.density && <p className="text-[var(--color-text-muted)]">Density: {log.density}</p>}
                      {log.conditions && <p className="text-[var(--color-text-muted)]">Conditions: {log.conditions}</p>}
                      {log.notes && <p className="text-[var(--color-text-muted)]">{log.notes}</p>}
                    </div>
                  ))}
                </div>
                {observationLogs.length > 5 && (
                  <button
                    onClick={() => setShowAllLogs(!showAllLogs)}
                    className="text-sm text-[#2a6b2a] hover:underline mt-2 min-h-[44px]"
                  >
                    {showAllLogs ? 'Show less' : `View all (${observationLogs.length})`}
                  </button>
                )}
              </>
            )}
          </Card>
        </div>
      </div>

      {/* Work Orders for this site */}
      <Card>
        <h3 className="text-xs font-semibold uppercase text-[var(--color-text-muted)] mb-3">Jobs</h3>
        {siteWorkOrders.length === 0 ? (
          <p className="text-sm text-[var(--color-text-muted)]">No work orders for this site.</p>
        ) : (
          <div className="space-y-0">
            {siteWorkOrders.map((wo) => (
              <Link
                key={wo.id}
                to={`/work-orders/${wo.id}`}
                className="flex items-center justify-between border-b border-surface-border py-3 last:border-0 hover:bg-surface transition-colors -mx-4 px-4 rounded-lg"
              >
                <div>
                  <p className="text-sm font-medium">
                    {wo.service_type?.name ?? 'Service'}{' '}
                    {wo.scheduled_date && (
                      <span className="text-[var(--color-text-muted)] font-normal">— {formatDate(wo.scheduled_date)}</span>
                    )}
                  </p>
                  {wo.pca && (
                    <p className="text-xs text-[var(--color-text-muted)]">
                      {wo.pca.first_name} {wo.pca.last_name}
                    </p>
                  )}
                </div>
                <Badge status={wo.status} />
              </Link>
            ))}
          </div>
        )}
      </Card>

      {/* Edit Site Modal */}
      <EditSiteModal
        open={editModalOpen}
        site={site}
        onCancel={() => setEditModalOpen(false)}
        onSuccess={() => {
          setEditModalOpen(false)
          refetchSite()
        }}
      />
    </div>
  )
}
