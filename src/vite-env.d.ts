/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/react" />

// Google Maps JS API — loaded dynamically in DayMapPanel
declare namespace google.maps {
  class Map {
    constructor(el: HTMLElement, opts?: MapOptions)
    setCenter(latLng: LatLng | LatLngLiteral): void
    setZoom(zoom: number): void
    fitBounds(bounds: LatLngBounds, padding?: number | Padding): void
  }
  class Marker {
    constructor(opts?: MarkerOptions)
    setMap(map: Map | null): void
    addListener(event: string, handler: () => void): void
  }
  class LatLngBounds {
    constructor()
    extend(point: LatLng | LatLngLiteral): void
    getCenter(): LatLng
  }
  class LatLng {
    constructor(lat: number, lng: number)
    lat(): number
    lng(): number
  }
  class Geocoder {
    constructor()
    geocode(
      request: { address: string },
      callback: (results: GeocoderResult[] | null, status: string) => void,
    ): void
  }
  interface GeocoderResult {
    geometry: { location: LatLng }
  }
  class InfoWindow {
    constructor(opts?: { content?: string })
    open(map: Map, anchor?: Marker): void
  }
  class Size {
    constructor(width: number, height: number)
  }
  class Point {
    constructor(x: number, y: number)
  }
  interface LatLngLiteral { lat: number; lng: number }
  interface Padding { top?: number; right?: number; bottom?: number; left?: number }
  interface MapOptions {
    center?: LatLng | LatLngLiteral
    zoom?: number
    mapTypeControl?: boolean
    streetViewControl?: boolean
    fullscreenControl?: boolean
  }
  interface MarkerOptions {
    position?: LatLng | LatLngLiteral
    map?: Map
    title?: string
    icon?: string | { url: string; scaledSize?: Size; anchor?: Point }
  }
}

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string
  readonly VITE_SUPABASE_ANON_KEY: string
  readonly VITE_GOOGLE_MAPS_API_KEY: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
