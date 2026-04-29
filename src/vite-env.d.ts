/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/react" />

// Google Maps JS API — loaded dynamically in DayMapPanel
declare namespace google.maps {
  class Map {
    constructor(el: HTMLElement, opts?: MapOptions)
    setCenter(latLng: LatLng | LatLngLiteral): void
    setZoom(zoom: number): void
    fitBounds(bounds: LatLngBounds, padding?: number | Padding): void
    addListener(event: string, handler: (e?: MapMouseEvent) => void): MapsEventListener
  }
  class Marker {
    constructor(opts?: MarkerOptions)
    setMap(map: Map | null): void
    setPosition(latLng: LatLng | LatLngLiteral): void
    getPosition(): LatLng | null
    addListener(event: string, handler: (e?: MapMouseEvent) => void): MapsEventListener
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
  interface MapMouseEvent {
    latLng?: LatLng
  }
  interface MapsEventListener {
    remove(): void
  }
  interface MarkerOptions {
    position?: LatLng | LatLngLiteral
    map?: Map
    title?: string
    draggable?: boolean
    icon?: string | { url: string; scaledSize?: Size; anchor?: Point }
  }
}

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string
  readonly VITE_SUPABASE_ANON_KEY: string
  readonly VITE_GOOGLE_MAPS_API_KEY: string
  readonly VITE_COMPANY_LOGO_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
