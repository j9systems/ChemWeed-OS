import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const WEBHOOK_SECRET = Deno.env.get('ESIGN_WEBHOOK_SECRET') ?? ''

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Optional: verify webhook secret via query param or header
    if (WEBHOOK_SECRET) {
      const url = new URL(req.url)
      const token = url.searchParams.get('token') ?? req.headers.get('x-webhook-secret') ?? ''
      if (token !== WEBHOOK_SECRET) {
        return jsonResponse({ success: false, error: 'Unauthorized' }, 401)
      }
    }

    const body = await req.json()

    // DocsAutomator webhook payload fields
    const documentId: string | undefined = body.documentId ?? body.id
    const status: string | undefined = body.status ?? body.signingStatus ?? body.event
    const signedPdfUrl: string | undefined = body.signedPdfUrl ?? body.pdfUrl ?? body.documentUrl
    const completedAt: string | undefined = body.completedAt ?? body.signedAt

    if (!documentId) {
      return jsonResponse({ success: false, error: 'documentId is required' }, 400)
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

    // Look up the agreement by signing_session_id (the DocsAutomator document ID)
    const { data: agreement, error: lookupErr } = await supabase
      .from('service_agreements')
      .select('id, signing_status')
      .eq('signing_session_id', documentId)
      .single()

    if (lookupErr || !agreement) {
      console.error('Agreement not found for documentId:', documentId, lookupErr?.message)
      return jsonResponse({ success: false, error: 'Agreement not found for this document' }, 404)
    }

    // Map DocsAutomator status to our signing_status values
    const statusMap: Record<string, string> = {
      completed: 'completed',
      signed: 'completed',
      declined: 'declined',
      expired: 'expired',
      cancelled: 'cancelled',
      in_progress: 'in_progress',
      viewed: 'in_progress',
      pending: 'pending',
      sent: 'sent',
    }

    const normalizedStatus = statusMap[(status ?? '').toLowerCase()] ?? status?.toLowerCase()

    const updateData: Record<string, unknown> = {}

    if (normalizedStatus) {
      updateData.signing_status = normalizedStatus
    }

    if (normalizedStatus === 'completed') {
      updateData.signing_completed_at = completedAt ?? new Date().toISOString()
      if (signedPdfUrl) {
        updateData.signed_pdf_url = signedPdfUrl
      }
    }

    if (Object.keys(updateData).length === 0) {
      return jsonResponse({ success: true, message: 'No updates needed' })
    }

    const { error: updateErr } = await supabase
      .from('service_agreements')
      .update(updateData)
      .eq('id', agreement.id)

    if (updateErr) {
      console.error('Failed to update agreement:', updateErr)
      return jsonResponse({ success: false, error: 'Failed to update agreement' }, 500)
    }

    console.log(`Agreement ${agreement.id} signing_status updated to ${normalizedStatus}`)

    return jsonResponse({ success: true, signing_status: normalizedStatus })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('esign-webhook error:', message)
    return jsonResponse({ success: false, error: message }, 500)
  }
})
