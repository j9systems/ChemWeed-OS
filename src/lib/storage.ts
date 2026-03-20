import { supabase } from './supabase'

export async function uploadPhoto(
  workOrderId: string,
  blob: Blob,
  filename: string
): Promise<string> {
  const path = `field-photos/${workOrderId}/${filename}`
  const { error } = await supabase.storage
    .from('field-photos')
    .upload(path, blob, { contentType: 'image/jpeg', upsert: true })

  if (error) throw new Error(`Photo upload failed: ${error.message}`)

  const { data } = supabase.storage.from('field-photos').getPublicUrl(path)
  return data.publicUrl
}

export async function uploadSitePhoto(
  siteId: string,
  blob: Blob,
  filename: string
): Promise<string> {
  const path = `site-photos/${siteId}/${filename}`
  const { error } = await supabase.storage
    .from('field-photos')
    .upload(path, blob, { contentType: 'image/jpeg', upsert: true })

  if (error) throw new Error(`Site photo upload failed: ${error.message}`)

  const { data } = supabase.storage.from('field-photos').getPublicUrl(path)
  return data.publicUrl
}

export async function uploadSignature(
  workOrderId: string,
  blob: Blob
): Promise<string> {
  const path = `signatures/${workOrderId}.png`
  const { error } = await supabase.storage
    .from('field-photos')
    .upload(path, blob, { contentType: 'image/png', upsert: true })

  if (error) throw new Error(`Signature upload failed: ${error.message}`)

  const { data } = supabase.storage.from('field-photos').getPublicUrl(path)
  return data.publicUrl
}
