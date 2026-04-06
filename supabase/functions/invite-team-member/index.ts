import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// SITE_URL must be set as an edge function secret in the Supabase dashboard.
// Example: https://your-app.vercel.app
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
    const body = await req.json()
    const { first_name, last_name, role, phone, email, pesticide_license_number, license_expiry_date, notes } = body

    // Validate required fields
    if (!first_name?.trim() || !last_name?.trim() || !role?.trim() || !email?.trim()) {
      return jsonResponse({ success: false, error: 'first_name, last_name, role, and email are required.' }, 400)
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    // Insert team member record
    const { error: insertErr } = await supabase.from('team').insert({
      first_name: first_name.trim(),
      last_name: last_name.trim(),
      role: role.trim(),
      phone: phone?.trim() || null,
      email: email.trim(),
      is_active: true,
      pesticide_license_number: pesticide_license_number?.trim() || null,
      license_expiry_date: license_expiry_date || null,
      notes: notes?.trim() || null,
    })

    if (insertErr) {
      console.error('Team insert error:', insertErr.message)
      return jsonResponse({ success: false, error: insertErr.message }, 400)
    }

    // Invite auth user so they receive a password-setup email
    const { error: inviteErr } = await supabase.auth.admin.inviteUserByEmail(email.trim(), {
      redirectTo: `${SITE_URL}/auth/callback`,
    })

    if (inviteErr) {
      console.error('Invite error:', inviteErr.message)
      // Team record was created successfully — don't fail the whole request.
      // The admin can resend the invite from the Supabase dashboard.
      return jsonResponse({
        success: true,
        warning: `Team member created but invite email failed: ${inviteErr.message}`,
      })
    }

    return jsonResponse({ success: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('Unhandled error:', message)
    return jsonResponse({ success: false, error: message }, 500)
  }
})
