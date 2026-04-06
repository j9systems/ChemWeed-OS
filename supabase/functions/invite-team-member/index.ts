import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// SITE_URL must be set as an edge function secret in the Supabase dashboard.
// Example: https://your-app.vercel.app
const SITE_URL = Deno.env.get('SITE_URL') ?? ''

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function errorResponse(message: string, status: number) {
  return new Response(
    JSON.stringify({ success: false, error: message }),
    { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
  )
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
      return errorResponse('first_name, last_name, role, and email are required.', 400)
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
      return errorResponse(insertErr.message, 500)
    }

    // Invite auth user so they receive a password-setup email
    const { error: inviteErr } = await supabase.auth.admin.inviteUserByEmail(email.trim(), {
      redirectTo: `${SITE_URL}/auth/callback`,
    })

    if (inviteErr) {
      return errorResponse(inviteErr.message, 500)
    }

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  } catch (err) {
    return errorResponse(err instanceof Error ? err.message : 'Unknown error', 500)
  }
})
