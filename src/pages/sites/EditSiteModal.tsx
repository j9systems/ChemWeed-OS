import { useState, useEffect, useRef, useCallback } from 'react'
import { MapPin, X as XIcon } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { getSupabaseErrorMessage } from '@/lib/utils'
import { loadGoogleMaps, geocodeAddress } from '@/lib/googleMaps'
import { useUnsavedChanges } from '@/hooks/useUnsavedChanges'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import type { Site, PropertyType } from '@/types/database'

// Chem-Weed HQ area (Thornton, CA) as fallback center
const DEFAULT_CENTER = { lat: 38.2275, lng: -121.4253 }

interface EditSiteModalProps {
  open: boolean
  site: Site
  onSuccess: () => void
  onCancel: () => void
}

export function EditSiteModal({ open, site, onSuccess, onCancel }: EditSiteModalProps) {
  const [address, setAddress] = useState('')
  const [city, setCity] = useState('')
  const [state, setState] = useState('')
  const [zip, setZip] = useState('')
  const [propertyType, setPropertyType] = useState<PropertyType | ''>('')
  const [acreage, setAcreage] = useState('')
  const [latitude, setLatitude] = useState('')
  const [longitude, setLongitude] = useState('')
  const [notes, setNotes] = useState('')
  const [showManualCoords, setShowManualCoords] = useState(false)

  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [mapError, setMapError] = useState<string | null>(null)

  // Map refs
  const mapContainerRef = useRef<HTMLDivElement>(null)
  const mapInstanceRef = useRef<google.maps.Map | null>(null)
  const markerRef = useRef<google.maps.Marker | null>(null)
  const mapInitializedRef = useRef(false)

  const isDirty =
    address !== (site.address_line ?? '') ||
    city !== (site.city ?? '') ||
    state !== (site.state ?? '') ||
    zip !== (site.zip ?? '') ||
    propertyType !== (site.property_type ?? '') ||
    acreage !== (site.total_acres != null ? String(site.total_acres) : '') ||
    latitude !== (site.latitude != null ? String(site.latitude) : '') ||
    longitude !== (site.longitude != null ? String(site.longitude) : '') ||
    notes !== (site.notes ?? '')
  useUnsavedChanges(isDirty)

  useEffect(() => {
    if (open) {
      setAddress(site.address_line ?? '')
      setCity(site.city ?? '')
      setState(site.state ?? '')
      setZip(site.zip ?? '')
      setPropertyType(site.property_type ?? '')
      setAcreage(site.total_acres != null ? String(site.total_acres) : '')
      setLatitude(site.latitude != null ? String(site.latitude) : '')
      setLongitude(site.longitude != null ? String(site.longitude) : '')
      setNotes(site.notes ?? '')
      setShowManualCoords(false)
      setError(null)
      setMapError(null)
      setSaving(false)
      // Reset map state so it reinitializes when the modal reopens
      mapInstanceRef.current = null
      markerRef.current = null
      mapInitializedRef.current = false
    }
  }, [open, site])

  // Place or move the marker and update lat/lng state
  const placePin = useCallback(
    (latLng: google.maps.LatLngLiteral) => {
      const map = mapInstanceRef.current
      if (!map) return

      if (markerRef.current) {
        markerRef.current.setPosition(latLng)
      } else {
        markerRef.current = new google.maps.Marker({
          position: latLng,
          map,
          draggable: true,
          title: 'Site location',
        })
        // Update coords when marker is dragged
        markerRef.current.addListener('dragend', () => {
          const pos = markerRef.current?.getPosition()
          if (pos) {
            setLatitude(String(pos.lat().toFixed(6)))
            setLongitude(String(pos.lng().toFixed(6)))
          }
        })
      }

      setLatitude(String(latLng.lat.toFixed(6)))
      setLongitude(String(latLng.lng.toFixed(6)))
    },
    [],
  )

  // Clear pin and coordinates
  function clearPin() {
    if (markerRef.current) {
      markerRef.current.setMap(null)
      markerRef.current = null
    }
    setLatitude('')
    setLongitude('')
  }

  // Initialize the map once the modal is open and the container is mounted
  useEffect(() => {
    if (!open) return
    if (mapInitializedRef.current) return

    // Small delay to let the modal render the container
    const timer = setTimeout(() => {
      initMap()
    }, 100)

    let cancelled = false

    async function initMap() {
      if (!mapContainerRef.current || cancelled) return

      try {
        await loadGoogleMaps()
      } catch (err) {
        if (!cancelled) setMapError(err instanceof Error ? err.message : 'Failed to load map')
        return
      }
      if (cancelled || !mapContainerRef.current) return

      mapInitializedRef.current = true

      // Determine initial center:
      // 1. Existing coordinates on the site
      // 2. Geocode the site address
      // 3. Default to Thornton, CA
      let center = DEFAULT_CENTER
      let initialZoom = 12

      const hasCoords = site.latitude != null && site.longitude != null
      if (hasCoords) {
        center = { lat: site.latitude!, lng: site.longitude! }
        initialZoom = 15
      }

      const map = new google.maps.Map(mapContainerRef.current, {
        center,
        zoom: initialZoom,
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: false,
      })
      mapInstanceRef.current = map

      // If site has existing coords, place the pin
      if (hasCoords) {
        placePin(center)
      } else {
        // Try to geocode the address for initial centering (no pin placed)
        const addr = [site.address_line, site.city, site.state, site.zip]
          .filter(Boolean)
          .join(', ')
        if (addr) {
          const geocoder = new google.maps.Geocoder()
          const result = await geocodeAddress(geocoder, addr)
          if (result && !cancelled) {
            map.setCenter(result)
            map.setZoom(15)
          }
        }
      }

      // Click to place/move pin
      map.addListener('click', (e) => {
        if (e?.latLng) {
          const latLng = { lat: e.latLng.lat(), lng: e.latLng.lng() }
          placePin(latLng)
        }
      })
    }

    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [open, site, placePin])

  async function handleSubmit() {
    setSaving(true)
    setError(null)

    const { error: err } = await supabase
      .from('sites')
      .update({
        address_line: address.trim(),
        city: city.trim(),
        state: state.trim(),
        zip: zip.trim(),
        property_type: propertyType || null,
        total_acres: acreage ? parseFloat(acreage) : null,
        latitude: latitude ? parseFloat(latitude) : null,
        longitude: longitude ? parseFloat(longitude) : null,
        notes: notes.trim() || null,
      })
      .eq('id', site.id)

    setSaving(false)

    if (err) {
      setError(getSupabaseErrorMessage(err))
      return
    }

    onSuccess()
  }

  const selectClasses =
    'w-full rounded-lg border border-surface-border bg-surface-raised px-3 py-2 text-sm min-h-[44px] transition-colors focus:outline-none focus:ring-2 focus:ring-brand-green/30 focus:border-brand-green'

  const hasPin = Boolean(latitude && longitude)

  return (
    <Modal open={open} onClose={onCancel} title="Edit Site Details">
      <div className="space-y-3">
        <Input
          label="Address"
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          placeholder="Street address"
          autoFocus
        />

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <Input
            label="City"
            value={city}
            onChange={(e) => setCity(e.target.value)}
          />
          <Input
            label="State"
            value={state}
            onChange={(e) => setState(e.target.value)}
          />
          <Input
            label="ZIP"
            value={zip}
            onChange={(e) => setZip(e.target.value)}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-1">
            Property Type
          </label>
          <select
            value={propertyType}
            onChange={(e) => setPropertyType(e.target.value as PropertyType)}
            className={selectClasses}
          >
            <option value="">None</option>
            <option value="commercial">Commercial</option>
            <option value="government">Government</option>
            <option value="residential">Residential</option>
          </select>
        </div>

        <Input
          label="Acreage"
          type="number"
          value={acreage}
          onChange={(e) => setAcreage(e.target.value)}
          placeholder="Optional"
          min="0"
          step="0.01"
        />

        {/* Map pin picker */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="block text-sm font-medium text-[var(--color-text-primary)]">
              Location
            </label>
            <div className="flex items-center gap-2">
              {hasPin && (
                <button
                  type="button"
                  onClick={clearPin}
                  className="inline-flex items-center gap-1 text-xs text-red-600 hover:text-red-700 min-h-[28px]"
                >
                  <XIcon size={12} />
                  Clear pin
                </button>
              )}
              <button
                type="button"
                onClick={() => setShowManualCoords(!showManualCoords)}
                className="text-xs text-brand-green hover:underline min-h-[28px]"
              >
                {showManualCoords ? 'Hide manual entry' : 'Edit manually'}
              </button>
            </div>
          </div>

          {/* Map container */}
          {mapError ? (
            <div className="rounded-lg border border-surface-border bg-surface flex items-center justify-center h-[280px] text-sm text-[var(--color-text-muted)]">
              <div className="flex flex-col items-center gap-1">
                <MapPin size={24} />
                <span>{mapError}</span>
              </div>
            </div>
          ) : (
            <div
              ref={mapContainerRef}
              className="rounded-lg border border-surface-border overflow-hidden"
              style={{ height: 280 }}
            />
          )}

          {/* Coordinates display */}
          {hasPin && !showManualCoords && (
            <p className="text-xs text-[var(--color-text-muted)] mt-1">
              {parseFloat(latitude).toFixed(6)}, {parseFloat(longitude).toFixed(6)}
            </p>
          )}

          {!hasPin && !mapError && (
            <p className="text-xs text-[var(--color-text-muted)] mt-1">
              Tap the map to drop a pin, or use manual entry.
            </p>
          )}

          {/* Manual coordinate inputs */}
          {showManualCoords && (
            <div className="grid grid-cols-2 gap-3 mt-2">
              <Input
                label="Latitude"
                type="number"
                value={latitude}
                onChange={(e) => {
                  setLatitude(e.target.value)
                  // Move pin if map is ready
                  if (e.target.value && longitude && mapInstanceRef.current) {
                    const lat = parseFloat(e.target.value)
                    const lng = parseFloat(longitude)
                    if (!isNaN(lat) && !isNaN(lng)) {
                      placePin({ lat, lng })
                      mapInstanceRef.current.setCenter({ lat, lng })
                    }
                  }
                }}
                placeholder="e.g. 38.2345"
                step="0.000001"
              />
              <Input
                label="Longitude"
                type="number"
                value={longitude}
                onChange={(e) => {
                  setLongitude(e.target.value)
                  if (latitude && e.target.value && mapInstanceRef.current) {
                    const lat = parseFloat(latitude)
                    const lng = parseFloat(e.target.value)
                    if (!isNaN(lat) && !isNaN(lng)) {
                      placePin({ lat, lng })
                      mapInstanceRef.current.setCenter({ lat, lng })
                    }
                  }
                }}
                placeholder="e.g. -121.4567"
                step="0.000001"
              />
            </div>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-1">Notes</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            className="w-full rounded-lg border border-surface-border bg-surface-raised px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-green/30 focus:border-brand-green"
            placeholder="Optional notes..."
          />
        </div>

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        )}

        <div className="flex items-center justify-between pt-2">
          <button
            type="button"
            onClick={onCancel}
            className="text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] underline"
          >
            Cancel
          </button>
          <Button onClick={handleSubmit} disabled={saving}>
            {saving ? 'Saving...' : 'Save Changes'}
          </Button>
        </div>
      </div>
    </Modal>
  )
}
