import { useState } from 'react'
import { ChevronDown, ChevronUp, MapPin, AlertTriangle, X } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { getSupabaseErrorMessage, formatDateTime } from '@/lib/utils'
import { canEdit } from '@/lib/roles'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import type { Site, SiteWeedProfile, SiteObservationLog, Role } from '@/types/database'

interface SiteInfoCardProps {
  site: Site
  weedProfile: SiteWeedProfile[]
  observationLogs: SiteObservationLog[]
  isOpen: boolean
  onToggle: () => void
  role: Role | null
  userId: string | undefined
  refetchSiteProfile: () => void
}

function StreetViewImage({
  address,
  height,
  className,
}: {
  address: string
  height: number
  className?: string
}) {
  const [imgError, setImgError] = useState(false)
  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string | undefined

  if (!apiKey || imgError) {
    return (
      <div
        className={`flex flex-col items-center justify-center bg-surface-raised text-[var(--color-text-muted)] ${className ?? ''}`}
        style={{ height }}
      >
        <MapPin size={24} />
        <span className="text-xs mt-1">No street view available</span>
      </div>
    )
  }

  const src = `https://maps.googleapis.com/maps/api/streetview?size=640x200&location=${encodeURIComponent(address)}&key=${apiKey}`

  return (
    <img
      src={src}
      alt={`Street view of ${address}`}
      className={`object-cover w-full ${className ?? ''}`}
      style={{ height }}
      onError={() => setImgError(true)}
    />
  )
}

export function SiteInfoCard({
  site,
  weedProfile,
  observationLogs,
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

  const fullAddress = `${site.address_line}, ${site.city}, ${site.state} ${site.zip}`

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
    <Card padding={false} className="mb-4 overflow-hidden">
      {/* Collapsed summary — always visible */}
      {!isOpen && (
        <button
          onClick={onToggle}
          className="flex items-stretch w-full text-left min-h-[120px]"
        >
          {/* Street View thumbnail */}
          <div className="w-48 flex-shrink-0">
            <StreetViewImage
              address={fullAddress}
              height={120}
              className="rounded-l-lg h-full"
            />
          </div>
          {/* Address + property type */}
          <div className="flex-1 flex items-center px-4 py-3">
            <div>
              <p className="text-sm font-semibold">{site.address_line}</p>
              <p className="text-sm text-[var(--color-text-muted)]">
                {site.city}, {site.state} {site.zip}
              </p>
              {site.property_type && (
                <span className="inline-block mt-1.5 rounded-full bg-surface-raised border border-surface-border px-2 py-0.5 text-xs capitalize">
                  {site.property_type}
                </span>
              )}
            </div>
          </div>
          {/* Chevron */}
          <div className="flex items-center pr-4 text-[var(--color-text-muted)]">
            <ChevronDown size={18} />
          </div>
        </button>
      )}

      {/* Expanded state */}
      {isOpen && (
        <div>
          {/* Full-width hero image + collapse toggle */}
          <div className="relative">
            <StreetViewImage address={fullAddress} height={200} className="rounded-t-lg" />
            <button
              onClick={onToggle}
              className="absolute top-2 right-2 rounded-full bg-black/50 text-white p-1.5 hover:bg-black/70 min-h-[32px] min-w-[32px] flex items-center justify-center"
              aria-label="Collapse site info"
            >
              <ChevronUp size={16} />
            </button>
          </div>

          <div className="p-4 space-y-6">
            {/* Site Details */}
            <div>
              <h3 className="text-xs font-semibold uppercase text-[var(--color-text-muted)] mb-2">Site Details</h3>
              <dl className="space-y-1 text-sm">
                <div><dt className="text-[var(--color-text-muted)] inline">Address: </dt><dd className="inline">{fullAddress}</dd></div>
                {site.property_type && (
                  <div className="flex items-center gap-2">
                    <dt className="text-[var(--color-text-muted)]">Property Type:</dt>
                    <dd>
                      <span className="rounded-full bg-surface-raised border border-surface-border px-2 py-0.5 text-xs capitalize">
                        {site.property_type}
                      </span>
                    </dd>
                  </div>
                )}
                {site.total_acres != null && (
                  <div><dt className="text-[var(--color-text-muted)] inline">Acreage: </dt><dd className="inline">{site.total_acres} acres</dd></div>
                )}
                {site.county && (
                  <div className="flex items-center gap-2">
                    <dt className="text-[var(--color-text-muted)]">County:</dt>
                    <dd className="inline-flex items-center gap-2">
                      {site.county.name}
                      {!site.county.is_licensed && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-amber-700 text-xs font-medium">
                          <AlertTriangle size={12} />
                          Unlicensed County
                        </span>
                      )}
                    </dd>
                  </div>
                )}
                {site.notes && <div><dt className="text-[var(--color-text-muted)] inline">Notes: </dt><dd className="inline">{site.notes}</dd></div>}
              </dl>
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
      )}
    </Card>
  )
}
