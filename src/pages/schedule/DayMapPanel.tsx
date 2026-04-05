import { useRef, useEffect, useState } from 'react'
import { ChevronDown } from 'lucide-react'
import type { WorkOrder } from '@/types/database'

const GOOGLE_MAPS_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string

interface DayMapPanelProps {
  dateStr: string
  workOrders: WorkOrder[]
  open: boolean
  onClose: () => void
  assigneeColorMap: Map<string, string>
}

// Load Google Maps JS API once
let mapsPromise: Promise<void> | null = null
function loadGoogleMaps(): Promise<void> {
  if (window.google?.maps) return Promise.resolve()
  if (mapsPromise) return mapsPromise
  mapsPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script')
    script.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_KEY}&libraries=marker`
    script.async = true
    script.defer = true
    script.onload = () => resolve()
    script.onerror = () => { mapsPromise = null; reject(new Error('Failed to load Google Maps')) }
    document.head.appendChild(script)
  })
  return mapsPromise
}

function createMarkerSvg(color: string, label: string): string {
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(`
    <svg xmlns="http://www.w3.org/2000/svg" width="28" height="40" viewBox="0 0 28 40">
      <path d="M14 0C6.3 0 0 6.3 0 14c0 10.5 14 26 14 26s14-15.5 14-26C28 6.3 21.7 0 14 0z" fill="${color}"/>
      <circle cx="14" cy="14" r="8" fill="white"/>
      <text x="14" y="18" text-anchor="middle" font-size="12" font-weight="bold" fill="${color}" font-family="Arial">${label}</text>
    </svg>
  `)}`
}

export function DayMapPanel({ dateStr, workOrders, open, onClose, assigneeColorMap }: DayMapPanelProps) {
  const mapRef = useRef<HTMLDivElement>(null)
  const mapInstanceRef = useRef<google.maps.Map | null>(null)
  const markersRef = useRef<google.maps.Marker[]>([])
  const [mapError, setMapError] = useState<string | null>(null)

  // WOs that have coordinates
  const mappableWOs = workOrders.filter(wo => wo.site?.latitude && wo.site?.longitude)

  useEffect(() => {
    if (!open || !mapRef.current || mappableWOs.length === 0) return
    if (!GOOGLE_MAPS_KEY) { setMapError('Google Maps API key not configured'); return }

    let cancelled = false

    loadGoogleMaps().then(() => {
      if (cancelled || !mapRef.current) return

      // Clear old markers
      markersRef.current.forEach(m => m.setMap(null))
      markersRef.current = []

      // Create or reuse map
      if (!mapInstanceRef.current) {
        mapInstanceRef.current = new google.maps.Map(mapRef.current, {
          zoom: 10,
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: false,
        })
      }

      const bounds = new google.maps.LatLngBounds()

      mappableWOs.forEach((wo, i) => {
        const lat = wo.site!.latitude!
        const lng = wo.site!.longitude!
        const pos = { lat, lng }
        bounds.extend(pos)

        const color = wo.pca_id
          ? assigneeColorMap.get(wo.pca_id) ?? '#6b7280'
          : '#6b7280'

        const label = String(i + 1)

        const marker = new google.maps.Marker({
          position: pos,
          map: mapInstanceRef.current!,
          title: `${wo.client?.name ?? 'Client'} – ${wo.site?.name ?? 'Site'}`,
          icon: {
            url: createMarkerSvg(color, label),
            scaledSize: new google.maps.Size(28, 40),
            anchor: new google.maps.Point(14, 40),
          },
        })

        const assigneeName = wo.pca
          ? `${wo.pca.first_name} ${wo.pca.last_name}`
          : 'Unassigned'
        const address = wo.site
          ? [wo.site.address_line, wo.site.city].filter(Boolean).join(', ')
          : ''

        const infoWindow = new google.maps.InfoWindow({
          content: `
            <div style="font-family:system-ui;max-width:220px">
              <p style="font-weight:600;margin:0 0 2px">${wo.client?.name ?? 'Client'}</p>
              <p style="font-size:12px;color:#6b7280;margin:0 0 2px">${wo.service_type?.name ?? ''}</p>
              <p style="font-size:12px;color:#6b7280;margin:0 0 4px">${address}</p>
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
      })

      if (mappableWOs.length === 1) {
        mapInstanceRef.current.setCenter(bounds.getCenter())
        mapInstanceRef.current.setZoom(13)
      } else {
        mapInstanceRef.current.fitBounds(bounds, 40)
      }
    }).catch(() => {
      if (!cancelled) setMapError('Failed to load map')
    })

    return () => { cancelled = true }
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

  return (
    <div
      className={`fixed bottom-0 left-0 right-0 bg-white shadow-[0_-4px_20px_rgba(0,0,0,0.15)] z-50 flex flex-col transition-transform duration-300 ease-in-out ${
        open ? 'translate-y-0' : 'translate-y-full'
      }`}
      style={{ height: '45vh', minHeight: '280px' }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-surface-border shrink-0">
        <div className="flex items-center gap-3">
          <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">Job Map</h3>
          {/* Legend */}
          <div className="flex items-center gap-3 flex-wrap">
            {legendEntries.map(e => (
              <div key={e.name} className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: e.color }} />
                <span className="text-[10px] text-[var(--color-text-muted)]">{e.name}</span>
              </div>
            ))}
          </div>
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
      <div className="flex-1 relative">
        {mapError ? (
          <div className="flex items-center justify-center h-full text-sm text-[var(--color-text-muted)]">{mapError}</div>
        ) : mappableWOs.length === 0 ? (
          <div className="flex items-center justify-center h-full text-sm text-[var(--color-text-muted)]">
            No jobs with coordinates for this day.
          </div>
        ) : (
          <div ref={mapRef} className="w-full h-full" />
        )}
      </div>
    </div>
  )
}
