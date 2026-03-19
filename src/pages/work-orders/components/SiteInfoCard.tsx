import { useState } from 'react'
import { ChevronDown, ChevronUp, X } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { getSupabaseErrorMessage, formatDateTime } from '@/lib/utils'
import { canEdit } from '@/lib/roles'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { SitePhotoGrid } from '@/components/ui/SitePhotoGrid'
import type { Site, SiteWeedProfile, SiteObservationLog, SitePhoto, Role } from '@/types/database'

interface SiteInfoCardProps {
  site: Site
  weedProfile: SiteWeedProfile[]
  observationLogs: SiteObservationLog[]
  sitePhotos: SitePhoto[]
  uploadingPhoto: boolean
  onUploadPhoto: (file: File) => void
  isOpen: boolean
  onToggle: () => void
  role: Role | null
  userId: string | undefined
  refetchSiteProfile: () => void
}

function buildMapSrc(site: Site): string | null {
  const parts = [site.address_line, site.city, site.state, site.zip].filter(Boolean)
  if (parts.length === 0) return null
  const q = encodeURIComponent(parts.join(', '))
  return `https://maps.google.com/maps?q=${q}&output=embed`
}

export function SiteInfoCard({
  site,
  weedProfile,
  observationLogs,
  sitePhotos,
  uploadingPhoto,
  onUploadPhoto,
  isOpen,
  onToggle,
  role,
  userId,
  refetchSiteProfile,
}: SiteInfoCardProps) {
  const [newWeed, setNewWeed] = useState('')
  const [adding, setAdding] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showAllLogs, setShowAllLogs] = useState(false)

  const mapSrc = buildMapSrc(site)

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

  const visibleLogs = showAllLogs ? observationLogs : observationLogs.slice(0, 5)

  return (
    <Card className="mb-4">
      <button
        onClick={onToggle}
        className="flex items-center justify-between w-full min-h-[44px] text-left"
      >
        <span className="text-sm font-semibold">Site Info</span>
        {isOpen ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
      </button>

      {isOpen && (
        <div className="mt-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Left Column — Site Details, Weed Profile, Observation Log */}
            <div className="space-y-6">
              {/* Section 1 — Site Details */}
              <div>
                <h3 className="text-xs font-semibold uppercase text-[var(--color-text-muted)] mb-2">Site Details</h3>
                <dl className="space-y-1 text-sm">
                  <div><dt className="text-[var(--color-text-muted)] inline">Address: </dt><dd className="inline">{site.address_line}</dd></div>
                  <div><dt className="text-[var(--color-text-muted)] inline">City: </dt><dd className="inline">{site.city}</dd></div>
                  {site.county && <div><dt className="text-[var(--color-text-muted)] inline">County: </dt><dd className="inline">{site.county.name}</dd></div>}
                  <div><dt className="text-[var(--color-text-muted)] inline">State: </dt><dd className="inline">{site.state}</dd></div>
                  <div><dt className="text-[var(--color-text-muted)] inline">Zip: </dt><dd className="inline">{site.zip}</dd></div>
                  {site.total_acres != null && <div><dt className="text-[var(--color-text-muted)] inline">Acreage: </dt><dd className="inline">{site.total_acres}</dd></div>}
                  {site.property_type && <div><dt className="text-[var(--color-text-muted)] inline">Property Type: </dt><dd className="inline capitalize">{site.property_type}</dd></div>}
                  {site.notes && <div><dt className="text-[var(--color-text-muted)] inline">Notes: </dt><dd className="inline">{site.notes}</dd></div>}
                </dl>
              </div>

              {/* Section 2 — Weed Profile */}
              <div>
                <h3 className="text-xs font-semibold uppercase text-[var(--color-text-muted)] mb-2">Weed Profile</h3>
                {weedProfile.length === 0 ? (
                  <p className="text-sm text-[var(--color-text-muted)]">No weed species on record for this site.</p>
                ) : (
                  <div className="flex flex-wrap gap-2 mb-2">
                    {weedProfile.map((w) => (
                      <span
                        key={w.id}
                        className="inline-flex items-center gap-1 bg-[#F5F8FE] rounded-full px-3 py-1 text-sm"
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
                {error && <p className="text-sm text-red-600 mt-1">{error}</p>}
              </div>

              {/* Section 3 — Observation Log */}
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

            {/* Right Column — Map + Photo Grid */}
            <div className="space-y-4">
              {/* Map */}
              <div>
                <h4 className="text-xs font-semibold uppercase text-[var(--color-text-muted)] mb-2">Location</h4>
                {mapSrc ? (
                  <div className="rounded-lg overflow-hidden">
                    <iframe
                      src={mapSrc}
                      width="100%"
                      height="200"
                      style={{ border: 0 }}
                      allowFullScreen
                      loading="lazy"
                      referrerPolicy="no-referrer-when-downgrade"
                      title="Site location"
                    />
                  </div>
                ) : (
                  <div className="flex items-center justify-center h-[200px] rounded-lg bg-[#F5F8FE] text-sm text-[var(--color-text-muted)]">
                    No address available for map
                  </div>
                )}
              </div>

              {/* Photo Grid */}
              <SitePhotoGrid
                photos={sitePhotos}
                uploading={uploadingPhoto}
                onUpload={onUploadPhoto}
                canAdd={canEdit(role)}
              />
            </div>
          </div>
        </div>
      )}
    </Card>
  )
}
