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
    const { team_member_id, email } = await req.json()

    if (!team_member_id) {
      return jsonResponse({ success: false, error: 'team_member_id is required.' }, 400)
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    // Delete the team record
    const { error: deleteErr } = await supabase
      .from('team')
      .delete()
      .eq('id', team_member_id)

    if (deleteErr) {
      console.error('Team delete error:', deleteErr.message)
      return jsonResponse({ success: false, error: deleteErr.message })
    }

    // If an email was provided, also remove the auth user
    if (email?.trim()) {
      const { data: users } = await supabase.auth.admin.listUsers()
      const authUser = users?.users?.find(
        (u: { email?: string }) => u.email?.toLowerCase() === email.trim().toLowerCase(),
      )

      if (authUser) {
        const { error: authErr } = await supabase.auth.admin.deleteUser(authUser.id)
        if (authErr) {
          console.error('Auth user delete error:', authErr.message)
          // Team record already deleted — report as warning, not failure
          return jsonResponse({
            success: true,
            warning: `Team member deleted but auth user removal failed: ${authErr.message}`,
          })
        }
      }
    }

    return jsonResponse({ success: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('Unhandled error:', message)
    return jsonResponse({ success: false, error: message }, 500)
  }
})
