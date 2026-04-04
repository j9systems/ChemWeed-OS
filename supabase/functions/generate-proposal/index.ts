import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const DOCSAUTOMATOR_API_KEY = Deno.env.get('DOCSAUTOMATOR_API_KEY')!
const DOCSAUTOMATOR_AUTOMATION_ID = Deno.env.get('DOCSAUTOMATOR_AUTOMATION_ID')!
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function errorResponse(message: string, status: number) {
  return new Response(
    JSON.stringify({ success: false, error: message }),
    { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  )
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const body = await req.json()
    const agreement_id = body.agreement_id ?? body.work_order_id
    if (!agreement_id) {
      return errorResponse('agreement_id is required', 400)
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

    const { data: wo, error: woErr } = await supabase
      .from('service_agreements')
      .select(`
        *,
        client:clients(*),
        site:sites(*, county:counties(*)),
        service_type:service_types(*)
      `)
      .eq('id', agreement_id)
      .single()

    if (woErr || !wo) {
      return errorResponse('Service agreement not found', 404)
    }

    const { data: charges, error: chargesErr } = await supabase
      .from('service_agreement_line_items')
      .select('*, service_type:service_types(*)')
      .eq('agreement_id', agreement_id)
      .order('sort_order', { ascending: true })

    if (chargesErr) {
      return errorResponse('Failed to fetch line items', 500)
    }

    const { data: company, error: companyErr } = await supabase
      .from('company_settings')
      .select('*')
      .eq('id', 1)
      .single()

    if (companyErr || !company) {
      return errorResponse('Company settings not configured', 500)
    }

    const dateStr = wo.proposed_start_date
      ? new Date(wo.proposed_start_date).toLocaleDateString('en-US', {
          month: 'short', day: 'numeric', year: 'numeric',
        })
      : new Date().toLocaleDateString('en-US', {
          month: 'short', day: 'numeric', year: 'numeric',
        })

    const documentName = `Proposal - ${wo.client?.name ?? 'Client'} - ${dateStr}`

    const clientAddress = wo.client?.billing_address ?? wo.site?.address_line ?? ''
    const clientCity = wo.client?.billing_city ?? wo.site?.city ?? ''
    const clientState = wo.client?.billing_state ?? wo.site?.state ?? 'CA'
    const clientZip = wo.client?.billing_zip ?? wo.site?.zip ?? ''
    const clientCityStateZip = `${clientCity}, ${clientState} ${clientZip}`.trim()

    // Frequency and month helpers
    const frequencyLabels: Record<string, string> = {
      one_time: '1X',
      annual: 'ANNUAL',
      monthly_seasonal: 'MONTHLY',
      weekly_seasonal: 'WEEKLY',
    }
    const monthNames = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC']
    const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'

    const lineItems1 = (charges ?? []).map((charge: any) => {
      let serviceName: string
      if (charge.is_manual_override && charge.description) {
        serviceName = charge.description.toUpperCase()
      } else if (charge.service_type) {
        const year = new Date().getFullYear()
        const siteAddr = wo.site?.address_line
          ? ` ${wo.site.address_line.toUpperCase()}, ${(wo.site?.city ?? '').toUpperCase()}`
          : ''
        serviceName = `${charge.service_type.name.toUpperCase()} ${year}${siteAddr}`
      } else {
        serviceName = (charge.description ?? 'SERVICE').toUpperCase()
      }

      const costLabel = charge.is_manual_override
        ? (charge.description ?? 'SERVICE').toUpperCase()
        : (charge.service_type?.name ?? 'SERVICE').toUpperCase()

      const formattedTotal = new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
      }).format(charge.amount ?? 0)

      const frequencyLabel = frequencyLabels[charge.frequency] ?? (charge.frequency ?? '').toUpperCase()

      let seasonLabel = ''
      if ((charge.frequency === 'monthly_seasonal' || charge.frequency === 'weekly_seasonal')
          && charge.season_start_month && charge.season_end_month) {
        seasonLabel = `${monthNames[charge.season_start_month - 1]}\u2013${monthNames[charge.season_end_month - 1]}`
      }

      // Ensure line_items is an array
      let rawItems = charge.line_items
      if (typeof rawItems === 'string') {
        try { rawItems = JSON.parse(rawItems) } catch { rawItems = [] }
      }
      if (!Array.isArray(rawItems)) rawItems = []

      // Map to DocsAutomator nested format with line_letter
      const subLines = rawItems
        .filter((li: string) => typeof li === 'string' && li.trim().length > 0)
        .map((li: string, idx: number) => ({
          line_letter: letters[idx] ?? String(idx + 1),
          description: li,
        }))

      console.log('Charge:', costLabel, 'frequency:', frequencyLabel, 'subLines:', JSON.stringify(subLines))

      return {
        service_name: serviceName,
        cost_label: costLabel,
        service_total: formattedTotal,
        frequency: frequencyLabel,
        season: seasonLabel,
        line_items_1_1: subLines,
      }
    })

    console.log('Full payload line_items_1:', JSON.stringify(lineItems1, null, 2))

    const payload = {
      docId: DOCSAUTOMATOR_AUTOMATION_ID,
      documentName,
      data: {
        company_name: company.business_name ?? '',
        company_address: company.address ?? '',
        company_phone: company.phone ?? '',
        company_email: company.email ?? '',
        company_license: company.license_number ?? '',
        signer_line: company.signer_line ?? '',
        proposal_terms: company.default_proposal_terms ?? '',

        client_name: wo.client?.name ?? '',
        client_address: clientAddress,
        client_city_state_zip: clientCityStateZip,
        client_contact: wo.client?.billing_contact ?? '',
        client_phone: wo.client?.billing_phone ?? '',
        client_email: wo.client?.billing_email ?? '',

        date: dateStr,
        contract_type: wo.frequency_type ?? lineItems1[0]?.frequency ?? '1X',
        po_number: wo.po_number ?? '',
        closing_notes: wo.notes_client ?? '',

        line_items_1: lineItems1,
      },
    }

    const daResponse = await fetch('https://api.docsautomator.co/createDocument', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${DOCSAUTOMATOR_API_KEY}`,
      },
      body: JSON.stringify(payload),
    })

    if (!daResponse.ok) {
      const errText = await daResponse.text()
      console.error('DocsAutomator error:', errText)
      return errorResponse(`DocsAutomator error: ${daResponse.status}`, 502)
    }

    const daData = await daResponse.json()

    return new Response(
      JSON.stringify({
        success: true,
        documentUrl: daData.documentUrl ?? daData.pdfUrl ?? daData.url ?? null,
        documentId: daData.documentId ?? null,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (err) {
    console.error('Edge function error:', err)
    return errorResponse('Internal server error', 500)
  }
})
