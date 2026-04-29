import { useState, useRef, useEffect } from 'react'
import { Link } from 'react-router'
import { ChevronDown, ChevronUp, ChevronLeft, ChevronRight, X, Upload, MapPin, ImageIcon, Eye, Trash2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { getSupabaseErrorMessage, formatDate, formatDateTime } from '@/lib/utils'
import { canEdit } from '@/lib/roles'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { PhotoLightbox } from '@/components/ui/PhotoLightbox'
import type { Site, SiteWeedProfile, SiteObservationLog, SitePhoto, Role } from '@/types/database'
import type { FieldLogPhotoGroup } from '@/hooks/useFieldLogPhotos'

const GOOGLE_MAPS_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string

interface SiteInfoCardProps {
  site: Site
  weedProfile: SiteWeedProfile[]
  observationLogs: SiteObservationLog[]
  sitePhotos: SitePhoto[]
  fieldLogGroups?: FieldLogPhotoGroup[]
  isOpen: boolean
  onToggle: () => void
  role: Role | null
  userId: string | undefined
  refetchSiteProfile: () => void
  refetchPhotos: () => void
  workOrderId?: string
}

const PHOTOS_PER_PAGE = 6

function buildAddress(site: Site) {
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

export function SiteInfoCard({
  site,
  weedProfile,
  observationLogs,
  sitePhotos,
  fieldLogGroups = [],
  isOpen,
  onToggle,
  role,
  userId,
  refetchSiteProfile,
  refetchPhotos,
  workOrderId,
}: SiteInfoCardProps) {
  const [newWeed, setNewWeed] = useState('')
  const [adding, setAdding] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showAllLogs, setShowAllLogs] = useState(false)
  const [photoPage, setPhotoPage] = useState(0)
  const [photoTab, setPhotoTab] = useState<'admin' | 'field_log'>('admin')
  const [uploading, setUploading] = useState(false)
  const [lightboxUrls, setLightboxUrls] = useState<string[]>([])
  const [lightboxIndex, setLightboxIndex] = useState(0)
  const fileInputRef = useRef<HTMLInputElement>(null)

  async function addWeed() {
    const name = newWeed.trim()
    if (!name || !site.id) return
    setAdding(true)
    setError(null)

    const { error: err } = await supabase
      .from('site_weed_profile')
      .insert({ site_id: site.id, weed_name: name, added_by: userId ?? null })

    if (err) {
      setError(getSupabaseErrorMessage(err))
    } else {
      setNewWeed('')
      refetchSiteProfile()
    }
    setAdding(false)
  }

  async function removeWeed(id: string) {
    setError(null)
    const { error: err } = await supabase
      .from('site_weed_profile')
      .delete()
      .eq('id', id)

    if (err) {
      setError(getSupabaseErrorMessage(err))
    } else {
      refetchSiteProfile()
    }
  }

  async function handlePhotoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files
    if (!files || files.length === 0) return
    setUploading(true)
    setError(null)

    for (const file of Array.from(files)) {
      const ext = file.name.split('.').pop()
      const path = `site-photos/${site.id}/${crypto.randomUUID()}.${ext}`

      const { error: uploadErr } = await supabase.storage
        .from('site-photos')
        .upload(path, file)

      if (uploadErr) {
        setError(getSupabaseErrorMessage(uploadErr))
        continue
      }

      const { data: urlData } = supabase.storage.from('site-photos').getPublicUrl(path)

      const { error: insertErr } = await supabase
        .from('site_photos')
        .insert({
          site_id: site.id,
          photo_url: urlData.publicUrl,
          uploaded_by: userId ?? null,
        })

      if (insertErr) {
        setError(getSupabaseErrorMessage(insertErr))
      }
    }

    setUploading(false)
    refetchPhotos()
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  async function handleDeletePhoto(photoId: string) {
    setError(null)
    const { error: err } = await supabase
      .from('site_photos')
      .delete()
      .eq('id', photoId)

    if (err) {
      setError(getSupabaseErrorMessage(err))
    } else {
      refetchPhotos()
    }
  }

  const fieldLogPhotoCount = fieldLogGroups.reduce(
    (sum, g) => sum + g.beforeUrls.length + g.afterUrls.length + g.duringUrls.length,
    0,
  )

  const contentRef = useRef<HTMLDivElement>(null)
  const [contentHeight, setContentHeight] = useState(0)

  useEffect(() => {
    if (isOpen && contentRef.current) {
      setContentHeight(contentRef.current.scrollHeight)
    }
  }, [isOpen, observationLogs, weedProfile, sitePhotos, fieldLogGroups, showAllLogs, photoTab])

  const visibleLogs = showAllLogs ? observationLogs : observationLogs.slice(0, 5)

  const totalPages = Math.ceil(sitePhotos.length / PHOTOS_PER_PAGE)
  const pagedPhotos = sitePhotos.slice(photoPage * PHOTOS_PER_PAGE, (photoPage + 1) * PHOTOS_PER_PAGE)

  const siteAddress = buildAddress(site)
  const hasAddress = Boolean(site.address_line && site.city)
  const streetView = hasAddress ? streetViewUrl(siteAddress) : null
  const mapEmbed = hasAddress ? googleMapEmbedUrl(siteAddress) : null

  return (
    <Card className="mb-4 overflow-hidden" padding={false}>
      {/* Collapsed summary — street view left, site info right */}
      <button
        type="button"
        onClick={onToggle}
        className="w-full text-left"
      >
        <div className="flex flex-col sm:flex-row">
          {/* Street View thumbnail */}
          <div className="sm:w-[280px] md:w-[340px] shrink-0">
            {streetView ? (
              <img
                src={streetView}
                alt={`Street view of ${siteAddress}`}
                className="w-full h-[160px] sm:h-full object-cover"
              />
            ) : (
              <div className="w-full h-[160px] sm:h-full bg-surface flex items-center justify-center text-sm text-[var(--color-text-muted)]">
                <div className="flex flex-col items-center gap-1">
                  <MapPin size={24} />
                  <span>{hasAddress ? 'Street view unavailable' : 'No address'}</span>
                </div>
              </div>
            )}
          </div>

          {/* Site summary info */}
          <div className="flex-1 p-4 sm:p-5 flex flex-col justify-center">
            <div className="flex items-start justify-between gap-2">
              <h3 className="text-sm font-semibold mb-2">Site Info</h3>
              <span className="shrink-0 text-[var(--color-text-muted)]">
                {isOpen ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
              </span>
            </div>
            <dl className="space-y-1 text-sm">
              <div>
                <dt className="text-[var(--color-text-muted)] inline">Address: </dt>
                <dd className="inline">{site.address_line ?? '—'}</dd>
              </div>
              {site.city && (
                <div>
                  <dt className="text-[var(--color-text-muted)] inline">City: </dt>
                  <dd className="inline">{site.city}{site.state ? `, ${site.state}` : ''} {site.zip ?? ''}</dd>
                </div>
              )}
              {site.property_type && (
                <div>
                  <dt className="text-[var(--color-text-muted)] inline">Property Type: </dt>
                  <dd className="inline capitalize">{site.property_type}</dd>
                </div>
              )}
              {site.total_acres != null && (
                <div>
                  <dt className="text-[var(--color-text-muted)] inline">Acreage: </dt>
                  <dd className="inline">{site.total_acres}</dd>
                </div>
              )}
            </dl>
            <Link
              to={`/sites/${site.id}${workOrderId ? `?from=wo&woId=${workOrderId}` : ''}`}
              onClick={(e) => e.stopPropagation()}
              className="inline-flex items-center gap-1 text-xs text-brand-green hover:underline mt-2"
            >
              View Site <Eye size={12} />
            </Link>
          </div>
        </div>
      </button>

      {/* Expanded content — map, weed profile, observation log, site photos */}
      <div
        ref={contentRef}
        className="overflow-hidden transition-all duration-300 ease-in-out"
        style={{
          maxHeight: isOpen ? `${contentHeight}px` : '0px',
          opacity: isOpen ? 1 : 0,
        }}
      >
        <div className="border-t border-surface-border px-5 sm:px-8 pb-8 pt-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-6 md:items-start">
            {/* Left Column — Google Map & Weed Profile */}
            <div className="space-y-6">
              {/* Google Map */}
              <div>
                <h3 className="text-xs font-semibold uppercase text-[var(--color-text-muted)] mb-2">Location</h3>
                {mapEmbed ? (
                  <div className="rounded-lg overflow-hidden border border-surface-border">
                    <iframe
                      title="Site location"
                      width="100%"
                      height="220"
                      style={{ border: 0 }}
                      loading="lazy"
                      allowFullScreen
                      referrerPolicy="no-referrer-when-downgrade"
                      src={mapEmbed}
                    />
                  </div>
                ) : (
                  <div className="rounded-lg border border-surface-border bg-surface-raised flex items-center justify-center h-[220px] text-sm text-[var(--color-text-muted)]">
                    <div className="flex flex-col items-center gap-1">
                      <MapPin size={24} />
                      <span>No address available</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Weed Profile */}
              <div>
                <h3 className="text-xs font-semibold uppercase text-[var(--color-text-muted)] mb-2">Weed Profile</h3>
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
                            onClick={(e) => { e.stopPropagation(); removeWeed(w.id) }}
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
                {error && <p className="text-sm text-red-600 mt-1">{error}</p>}
              </div>
            </div>

            {/* Right Column — Photo Gallery & Observation Log */}
            <div className="space-y-6">
              {/* Photo Gallery — Tabbed */}
              <div>
                {/* Tab bar */}
                <div className="flex items-center gap-0 border-b border-surface-border mb-2">
                  <button
                    type="button"
                    onClick={() => { setPhotoTab('admin'); setPhotoPage(0) }}
                    className={`px-3 py-1.5 text-xs font-semibold uppercase transition-colors min-h-[36px] ${
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
                    className={`px-3 py-1.5 text-xs font-semibold uppercase transition-colors min-h-[36px] ${
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
                      <div className="rounded-lg border border-surface-border bg-surface-raised flex items-center justify-center h-[220px] text-sm text-[var(--color-text-muted)]">
                        <div className="flex flex-col items-center gap-1">
                          <ImageIcon size={24} />
                          <span>No admin photos yet</span>
                        </div>
                      </div>
                    ) : (
                      <div className="relative">
                        <div className="grid grid-cols-3 grid-rows-2 gap-2">
                          {pagedPhotos.map((photo, idx) => (
                            <div
                              key={photo.id}
                              className="relative aspect-square rounded-lg overflow-hidden bg-surface-raised border border-surface-border group cursor-pointer"
                              onClick={() => {
                                setLightboxUrls(sitePhotos.map(p => p.photo_url))
                                setLightboxIndex(photoPage * PHOTOS_PER_PAGE + idx)
                              }}
                            >
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
                      <div className="rounded-lg border border-surface-border bg-surface-raised flex items-center justify-center h-[220px] text-sm text-[var(--color-text-muted)]">
                        <div className="flex flex-col items-center gap-1">
                          <ImageIcon size={24} />
                          <span>No field log photos yet</span>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {fieldLogGroups.map((group) => (
                          <div key={group.workOrderId} className="border border-surface-border rounded-lg p-2.5">
                            <div className="flex items-center justify-between mb-1.5">
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

                            {(() => {
                              const allUrls = [...group.beforeUrls, ...group.afterUrls, ...group.duringUrls]
                              let offset = 0

                              function renderBucket(label: string, urls: string[], startOffset: number) {
                                if (urls.length === 0) return null
                                return (
                                  <div className={label !== 'During' ? 'mb-1.5' : ''}>
                                    <p className="text-[10px] font-semibold uppercase text-[var(--color-text-muted)] mb-1">{label}</p>
                                    <div className="grid grid-cols-4 gap-1.5">
                                      {urls.map((url, i) => (
                                        <div
                                          key={url}
                                          className="aspect-square rounded overflow-hidden border border-surface-border cursor-pointer"
                                          onClick={() => { setLightboxUrls(allUrls); setLightboxIndex(startOffset + i) }}
                                        >
                                          <img src={url} alt={`${label} ${i + 1}`} className="w-full h-full object-cover" />
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )
                              }

                              const beforeEl = renderBucket('Before', group.beforeUrls, offset)
                              offset += group.beforeUrls.length
                              const afterEl = renderBucket('After', group.afterUrls, offset)
                              offset += group.afterUrls.length
                              const duringEl = renderBucket('During', group.duringUrls, offset)

                              return <>{beforeEl}{afterEl}{duringEl}</>
                            })()}
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>

              {/* Observation Log */}
              <div>
                <h3 className="text-xs font-semibold uppercase text-[var(--color-text-muted)] mb-2">Observation Log</h3>
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
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Photo Lightbox */}
      {lightboxUrls.length > 0 && (
        <PhotoLightbox
          urls={lightboxUrls}
          currentIndex={lightboxIndex}
          onClose={() => setLightboxUrls([])}
          onChange={setLightboxIndex}
        />
      )}
    </Card>
  )
}
