import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')!
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const FROM_EMAIL = Deno.env.get('RESEND_FROM_EMAIL') ?? 'noreply@chemweed.com'
const COMPANY_NAME = Deno.env.get('COMPANY_NAME') ?? 'Chem-Weed'

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
    const { agreement_id, to_email, to_name, signing_url, document_name } = await req.json()

    if (!agreement_id || !to_email || !signing_url) {
      return jsonResponse({ success: false, error: 'agreement_id, to_email, and signing_url are required' }, 400)
    }

    const recipientName = to_name || 'there'

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background-color: #2a6b2a; padding: 16px 24px; text-align: center;">
          <span style="color: #ffffff; font-size: 18px; font-weight: 700;">${COMPANY_NAME}</span>
        </div>
        <div style="padding: 24px; font-size: 14px; color: #333; line-height: 1.6;">
          <p>Hi ${recipientName},</p>
          <p>Your proposal is ready for review and signature.</p>
          <p style="font-weight: 600;">${document_name || 'Proposal'}</p>
          <div style="text-align: center; margin: 24px 0;">
            <a href="${signing_url}"
               style="display: inline-block; background-color: #2a6b2a; color: #ffffff;
                      padding: 12px 32px; border-radius: 6px; font-size: 14px;
                      font-weight: 600; text-decoration: none;">
              Review &amp; Sign Proposal
            </a>
          </div>
          <div style="border-top: 1px solid #e5e5e5; padding-top: 16px; font-size: 12px; color: #999; text-align: center;">
            <p style="margin: 0;">${COMPANY_NAME}</p>
          </div>
        </div>
      </div>
    `

    // Send email via Resend
    const resendRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: `${COMPANY_NAME} <${FROM_EMAIL}>`,
        to: [to_email],
        subject: `${document_name || 'Your Proposal'} — Ready for Signature`,
        html,
      }),
    })

    if (!resendRes.ok) {
      const errText = await resendRes.text()
      console.error('Resend error:', errText)
      return jsonResponse({ success: false, error: `Email delivery failed: ${resendRes.status}` }, 502)
    }

    // Email sent successfully — now update signing_status to 'sent'
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
    const { error: updateErr } = await supabase
      .from('service_agreements')
      .update({ signing_status: 'sent' })
      .eq('id', agreement_id)

    if (updateErr) {
      console.error('Failed to update signing_status:', updateErr)
      // Email was sent successfully, so still return success but warn
    }

    return jsonResponse({ success: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('send-proposal-email error:', message)
    return jsonResponse({ success: false, error: message }, 500)
  }
})
