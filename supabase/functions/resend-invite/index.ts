import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SITE_URL = Deno.env.get('SITE_URL') ?? ''

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
    const { email } = await req.json()

    if (!email?.trim()) {
      return jsonResponse({ success: false, error: 'Email is required.' }, 400)
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    const { error: inviteErr } = await supabase.auth.admin.inviteUserByEmail(email.trim(), {
      redirectTo: `${SITE_URL}/auth/callback`,
    })

    if (inviteErr) {
      console.error('Resend invite error:', inviteErr.message)
      return jsonResponse({ success: false, error: inviteErr.message })
    }

    return jsonResponse({ success: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('Unhandled error:', message)
    return jsonResponse({ success: false, error: message }, 500)
  }
})
