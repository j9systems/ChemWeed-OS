import { supabase } from './supabase'

interface NominatimResult {
  lat: string
  lon: string
}

export async function geocodeAddress(
  address: string,
  city: string,
  state: string,
  zip: string
): Promise<{ lat: number; lng: number } | null> {
  const query = [address, city, state, zip].filter(Boolean).join(', ')
  if (!query) return null

  try {
    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=1`
    const res = await fetch(url, {
      headers: { 'User-Agent': 'ChemWeed-OS/1.0' },
    })

    if (!res.ok) return null

    const data: NominatimResult[] = await res.json()
    if (data.length === 0) return null

    const first = data[0]
    if (!first) return null
    return { lat: parseFloat(first.lat), lng: parseFloat(first.lon) }
  } catch {
    return null
  }
}

export async function geocodeAndCacheSite(
  siteId: string,
  address: string,
  city: string,
  state: string,
  zip: string
): Promise<{ lat: number; lng: number } | null> {
  const coords = await geocodeAddress(address, city, state, zip)
  if (!coords) return null

  await supabase
    .from('sites')
    .update({ latitude: coords.lat, longitude: coords.lng })
    .eq('id', siteId)

  return coords
}
