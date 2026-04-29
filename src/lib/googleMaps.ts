const GOOGLE_MAPS_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string

// ── Google Maps loader ────────────────────────────────────────────────
let mapsPromise: Promise<void> | null = null
let mapsAuthError = false

export function loadGoogleMaps(): Promise<void> {
  if (mapsAuthError)
    return Promise.reject(
      new Error(
        'Google Maps API error — enable the Maps JavaScript API and Geocoding API in Google Cloud Console.',
      ),
    )
  if (window.google?.maps) return Promise.resolve()
  if (mapsPromise) return mapsPromise
  mapsPromise = new Promise((resolve, reject) => {
    ;(window as any).gm_authFailure = () => {
      mapsAuthError = true
      mapsPromise = null
      reject(
        new Error(
          'Google Maps API error — enable the Maps JavaScript API and Geocoding API in Google Cloud Console.',
        ),
      )
    }
    const script = document.createElement('script')
    script.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_KEY}&libraries=marker`
    script.async = true
    script.defer = true
    script.onload = () => {
      if (!mapsAuthError) resolve()
    }
    script.onerror = () => {
      mapsPromise = null
      reject(new Error('Failed to load Google Maps'))
    }
    document.head.appendChild(script)
  })
  return mapsPromise
}

// ── Geocoding cache ───────────────────────────────────────────────────
const geocodeCache = new Map<string, google.maps.LatLngLiteral | null>()

export function geocodeAddress(
  geocoder: google.maps.Geocoder,
  address: string,
): Promise<google.maps.LatLngLiteral | null> {
  if (geocodeCache.has(address)) return Promise.resolve(geocodeCache.get(address)!)
  return new Promise((resolve) => {
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
