import { useState, useRef } from 'react'
import { ChevronDown, ChevronUp, ChevronLeft, ChevronRight, X, Upload, MapPin, ImageIcon } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { getSupabaseErrorMessage, formatDateTime } from '@/lib/utils'
import { canEdit } from '@/lib/roles'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import type { Site, SiteWeedProfile, SiteObservationLog, SitePhoto, Role } from '@/types/database'

const GOOGLE_MAPS_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string

interface SiteInfoCardProps {
  site: Site
  weedProfile: SiteWeedProfile[]
  observationLogs: SiteObservationLog[]
  sitePhotos: SitePhoto[]
  isOpen: boolean
  onToggle: () => void
  role: Role | null
  userId: string | undefined
  refetchSiteProfile: () => void
  refetchPhotos: () => void
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
  isOpen,
  onToggle,
  role,
  userId,
  refetchSiteProfile,
  refetchPhotos,
}: SiteInfoCardProps) {
  const [newWeed, setNewWeed] = useState('')
  const [adding, setAdding] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showAllLogs, setShowAllLogs] = useState(false)
  const [photoPage, setPhotoPage] = useState(0)
  const [uploading, setUploading] = useState(false)
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
          </div>
        </div>
      </button>

      {/* Expanded content — map, weed profile, observation log, site photos */}
      {isOpen && (
        <div className="border-t border-surface-border px-5 sm:px-8 pb-8 pt-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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

            {/* Right Column — Observation Log & Photo Gallery */}
            <div className="space-y-6">
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

              {/* Photo Gallery */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-xs font-semibold uppercase text-[var(--color-text-muted)]">Site Photos</h3>
                  {canEdit(role) && (
                    <>
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
                    </>
                  )}
                </div>

                {sitePhotos.length === 0 ? (
                  <div className="rounded-lg border border-surface-border bg-surface-raised flex items-center justify-center h-[180px] text-sm text-[var(--color-text-muted)]">
                    <div className="flex flex-col items-center gap-1">
                      <ImageIcon size={24} />
                      <span>No photos yet</span>
                    </div>
                  </div>
                ) : (
                  <div className="relative">
                    <div className="grid grid-cols-3 grid-rows-2 gap-2">
                      {pagedPhotos.map((photo) => (
                        <div key={photo.id} className="aspect-square rounded-lg overflow-hidden bg-surface-raised border border-surface-border">
                          <img
                            src={photo.photo_url}
                            alt={photo.caption ?? 'Site photo'}
                            className="w-full h-full object-cover"
                          />
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
              </div>
            </div>
          </div>
        </div>
      )}
    </Card>
  )
}
