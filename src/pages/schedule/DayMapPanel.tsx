import { useRef, useEffect, useState, useCallback } from 'react'
import { X, ChevronDown } from 'lucide-react'
import { DayJobList } from './DayDetailPanel'
import type { WorkOrder } from '@/types/database'

const GOOGLE_MAPS_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string

// ── Google Maps loader ────────────────────────────────────────────────
let mapsPromise: Promise<void> | null = null
function loadGoogleMaps(): Promise<void> {
  if (window.google?.maps) return Promise.resolve()
  if (mapsPromise) return mapsPromise
  mapsPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script')
    script.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_KEY}&libraries=marker,geocoding`
    script.async = true
    script.defer = true
    script.onload = () => resolve()
    script.onerror = () => { mapsPromise = null; reject(new Error('Failed to load Google Maps')) }
    document.head.appendChild(script)
  })
  return mapsPromise
}

// ── Geocoding cache ───────────────────────────────────────────────────
const geocodeCache = new Map<string, google.maps.LatLngLiteral | null>()

function geocodeAddress(
  geocoder: google.maps.Geocoder,
  address: string,
): Promise<google.maps.LatLngLiteral | null> {
  if (geocodeCache.has(address)) return Promise.resolve(geocodeCache.get(address)!)
  return new Promise(resolve => {
    geocoder.geocode({ address }, (results, status) => {
      if (status === 'OK' && results?.[0]) {
        const loc = results[0].geometry.location
        const latLng = { lat: loc.lat(), lng: loc.lng() }
        geocodeCache.set(address, latLng)
        resolve(latLng)
      } else {
        geocodeCache.set(address, null)
        resolve(null)
      }
    })
  })
}

function buildFullAddress(site: { address_line: string; city: string; state: string; zip: string }) {
  return [site.address_line, site.city, site.state, site.zip].filter(Boolean).join(', ')
}

// ── Marker SVG ────────────────────────────────────────────────────────
function createMarkerSvg(color: string, label: string): string {
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(`
    <svg xmlns="http://www.w3.org/2000/svg" width="28" height="40" viewBox="0 0 28 40">
      <path d="M14 0C6.3 0 0 6.3 0 14c0 10.5 14 26 14 26s14-15.5 14-26C28 6.3 21.7 0 14 0z" fill="${color}"/>
      <circle cx="14" cy="14" r="8" fill="white"/>
      <text x="14" y="18" text-anchor="middle" font-size="12" font-weight="bold" fill="${color}" font-family="Arial">${label}</text>
    </svg>
  `)}`
}

// ── Component ─────────────────────────────────────────────────────────
interface DayMapPanelProps {
  dateStr: string
  workOrders: WorkOrder[]
  open: boolean
  onClose: () => void
  assigneeColorMap: Map<string, string>
}

export function DayMapPanel({ dateStr, workOrders, open, onClose, assigneeColorMap }: DayMapPanelProps) {
  const mapElRef = useRef<HTMLDivElement | null>(null)
  const mapInstanceRef = useRef<google.maps.Map | null>(null)
  const markersRef = useRef<google.maps.Marker[]>([])
  const [mapError, setMapError] = useState<string | null>(null)

  // Track the visible map container — on resize/responsive switch, the map
  // element may move between mobile and desktop containers. We use a
  // portal-like approach: a single map div that gets moved into whichever
  // container is visible.
  const mobileMapSlotRef = useRef<HTMLDivElement>(null)
  const desktopMapSlotRef = useRef<HTMLDivElement>(null)
  const mapDivRef = useRef<HTMLDivElement | null>(null)

  // Create the shared map div once
  useEffect(() => {
    if (!mapDivRef.current) {
      const div = document.createElement('div')
      div.style.width = '100%'
      div.style.height = '100%'
      mapDivRef.current = div
    }
  }, [])

  // Move the map div into the correct visible slot
  useEffect(() => {
    const mapDiv = mapDivRef.current
    if (!mapDiv || !open) return

    // Check which slot is visible (sm breakpoint = 640px)
    const isMobile = window.innerWidth < 640
    const slot = isMobile ? mobileMapSlotRef.current : desktopMapSlotRef.current
    if (slot && !slot.contains(mapDiv)) {
      slot.innerHTML = ''
      slot.appendChild(mapDiv)
    }
    mapElRef.current = mapDiv
  }, [open])

  const mappableWOs = workOrders.filter(wo => wo.site?.address_line)

  const dateLabel = dateStr
    ? new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
        year: 'numeric',
      })
    : ''

  useEffect(() => {
    if (!open || !mapDivRef.current || mappableWOs.length === 0) return
    if (!GOOGLE_MAPS_KEY) { setMapError('Google Maps API key not configured'); return }

    // Small delay to ensure the div is placed in the DOM slot
    const timer = setTimeout(() => {
      runMap()
    }, 50)

    let cancelled = false

    async function runMap() {
      try {
        await loadGoogleMaps()
      } catch {
        if (!cancelled) setMapError('Failed to load map')
        return
      }
      if (cancelled || !mapDivRef.current) return

      // Clear old markers
      markersRef.current.forEach(m => m.setMap(null))
      markersRef.current = []

      // Create or reuse map instance
      if (!mapInstanceRef.current) {
        mapInstanceRef.current = new google.maps.Map(mapDivRef.current, {
          zoom: 10,
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: false,
        })
      }

      const geocoder = new google.maps.Geocoder()
      const bounds = new google.maps.LatLngBounds()
      let placedCount = 0

      for (let i = 0; i < mappableWOs.length; i++) {
        if (cancelled) return
        const wo = mappableWOs[i]!
        const address = buildFullAddress(wo.site!)
        const latLng = await geocodeAddress(geocoder, address)
        if (!latLng || cancelled) continue

        bounds.extend(latLng)
        placedCount++

        const color = wo.pca_id
          ? assigneeColorMap.get(wo.pca_id) ?? '#6b7280'
          : '#6b7280'

        const marker = new google.maps.Marker({
          position: latLng,
          map: mapInstanceRef.current!,
          title: `${wo.client?.name ?? 'Client'} – ${wo.site?.name ?? 'Site'}`,
          icon: {
            url: createMarkerSvg(color, String(i + 1)),
            scaledSize: new google.maps.Size(28, 40),
            anchor: new google.maps.Point(14, 40),
          },
        })

        const assigneeName = wo.pca
          ? `${wo.pca.first_name} ${wo.pca.last_name}`
          : 'Unassigned'
        const shortAddress = [wo.site!.address_line, wo.site!.city].filter(Boolean).join(', ')

        const infoWindow = new google.maps.InfoWindow({
          content: `
            <div style="font-family:system-ui;max-width:220px">
              <p style="font-weight:600;margin:0 0 2px">${wo.client?.name ?? 'Client'}</p>
              <p style="font-size:12px;color:#6b7280;margin:0 0 2px">${wo.service_type?.name ?? ''}</p>
              <p style="font-size:12px;color:#6b7280;margin:0 0 4px">${shortAddress}</p>
              <div style="display:flex;align-items:center;gap:4px">
                <span style="width:8px;height:8px;border-radius:50%;background:${color};display:inline-block"></span>
                <span style="font-size:11px;color:#6b7280">${assigneeName}</span>
              </div>
            </div>
          `,
        })

        marker.addListener('click', () => {
          infoWindow.open(mapInstanceRef.current!, marker)
        })

        markersRef.current.push(marker)
      }

      if (cancelled || placedCount === 0) return

      if (placedCount === 1) {
        mapInstanceRef.current.setCenter(bounds.getCenter())
        mapInstanceRef.current.setZoom(13)
      } else {
        mapInstanceRef.current.fitBounds(bounds, 40)
      }
    }

    return () => { cancelled = true; clearTimeout(timer) }
  }, [open, dateStr, mappableWOs.length])

  // Build assignee legend
  const legendEntries: { name: string; color: string }[] = []
  const seenPca = new Set<string>()
  for (const wo of workOrders) {
    const pcaId = wo.pca_id ?? '__unassigned__'
    if (seenPca.has(pcaId)) continue
    seenPca.add(pcaId)
    legendEntries.push({
      name: wo.pca ? `${wo.pca.first_name} ${wo.pca.last_name}` : 'Unassigned',
      color: wo.pca_id ? assigneeColorMap.get(wo.pca_id) ?? '#6b7280' : '#6b7280',
    })
  }

  const mapPlaceholder = mapError ? (
    <div className="flex items-center justify-center h-full text-sm text-[var(--color-text-muted)]">{mapError}</div>
  ) : mappableWOs.length === 0 ? (
    <div className="flex items-center justify-center h-full text-sm text-[var(--color-text-muted)]">
      No jobs with addresses for this day.
    </div>
  ) : null

  const legendBar = legendEntries.length > 0 && (
    <div className="flex items-center gap-3 flex-wrap">
      {legendEntries.map(e => (
        <div key={e.name} className="flex items-center gap-1">
          <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: e.color }} />
          <span className="text-[10px] text-[var(--color-text-muted)]">{e.name}</span>
        </div>
      ))}
    </div>
  )

  return (
    <>
      {/* ── Mobile: combined slide-up panel (jobs + map) ── */}
      <div
        className={`sm:hidden fixed inset-x-0 bottom-0 bg-white shadow-[0_-4px_20px_rgba(0,0,0,0.15)] z-50 flex flex-col transition-transform duration-300 ease-in-out ${
          open ? 'translate-y-0' : 'translate-y-full'
        }`}
        style={{ height: '85vh' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-surface-border bg-surface shrink-0">
          <div>
            <h3 className="text-base font-semibold text-[var(--color-text-primary)]">{dateLabel}</h3>
            <p className="text-xs text-[var(--color-text-muted)]">{workOrders.length} job{workOrders.length !== 1 ? 's' : ''} scheduled</p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-2 hover:bg-gray-100 transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
          >
            <X size={20} />
          </button>
        </div>

        {/* Job list (top portion) */}
        <div className="overflow-y-auto p-3 space-y-2 border-b border-surface-border" style={{ maxHeight: '45%' }}>
          <DayJobList workOrders={workOrders} assigneeColorMap={assigneeColorMap} />
        </div>

        {/* Legend */}
        {legendEntries.length > 0 && (
          <div className="flex items-center gap-3 px-3 py-1.5 border-b border-surface-border shrink-0 flex-wrap">
            {legendBar}
          </div>
        )}

        {/* Map (bottom portion) */}
        <div className="flex-1 relative min-h-0">
          {mapPlaceholder ?? <div ref={mobileMapSlotRef} className="w-full h-full" />}
        </div>
      </div>

      {/* ── Desktop: bottom map panel, stops at detail panel edge ── */}
      <div
        className={`hidden sm:flex fixed bottom-0 left-0 bg-white shadow-[0_-4px_20px_rgba(0,0,0,0.15)] z-50 flex-col transition-transform duration-300 ease-in-out ${
          open ? 'translate-y-0' : 'translate-y-full'
        }`}
        style={{ height: '45vh', minHeight: '280px', right: '420px' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-2 border-b border-surface-border shrink-0">
          <div className="flex items-center gap-3">
            <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">Job Map</h3>
            {legendBar}
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-2 hover:bg-gray-100 transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
            title="Close map"
          >
            <ChevronDown size={20} />
          </button>
        </div>

        {/* Map area */}
        <div className="flex-1 relative min-h-0">
          {mapPlaceholder ?? <div ref={desktopMapSlotRef} className="w-full h-full" />}
        </div>
      </div>
    </>
  )
}
