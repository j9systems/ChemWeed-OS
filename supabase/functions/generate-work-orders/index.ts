import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
)

Deno.serve(async (req) => {
  // Optional: accept a specific agreement_id to regenerate one agreement
  let data, error

  try {
    const body = req.method === 'POST' ? await req.json() : {}
    if (body.agreement_id) {
      ;({ data, error } = await supabase.rpc('generate_work_orders_for_agreement', {
        p_agreement_id: body.agreement_id
      }))
    } else {
      ;({ data, error } = await supabase.rpc('generate_work_orders_all_active'))
    }
  } catch {
    ;({ data, error } = await supabase.rpc('generate_work_orders_all_active'))
  }

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 })
  }
  return new Response(JSON.stringify(data), {
    headers: { 'Content-Type': 'application/json' }
  })
})
