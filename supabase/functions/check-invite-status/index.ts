import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

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
    const { emails } = await req.json()

    if (!Array.isArray(emails) || emails.length === 0) {
      return jsonResponse({ success: true, pending: [] })
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    // Fetch all auth users (paginated — up to 1000 should cover most teams)
    const { data: authData, error: authErr } = await supabase.auth.admin.listUsers({
      perPage: 1000,
    })

    if (authErr) {
      console.error('List users error:', authErr.message)
      return jsonResponse({ success: false, error: authErr.message })
    }

    const users = authData?.users ?? []

    // Build a set of emails that have confirmed their account
    const confirmedEmails = new Set(
      users
        .filter((u) => u.email_confirmed_at)
        .map((u) => u.email?.toLowerCase())
        .filter(Boolean)
    )

    // Emails that are either not in auth at all, or are in auth but unconfirmed
    const pending = emails.filter(
      (e: string) => !confirmedEmails.has(e.toLowerCase())
    )

    return jsonResponse({ success: true, pending })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('Unhandled error:', message)
    return jsonResponse({ success: false, error: message }, 500)
  }
})
