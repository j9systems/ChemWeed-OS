// Required Supabase secrets:
//   DOCSAUTOMATOR_API_KEY          = 40b7254a-21ad-4f55-b71e-b2cba8c97d2a
//   DOCSAUTOMATOR_AUTOMATION_ID    = 69ca013a723efefefdeed9b1

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
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

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { work_order_id } = await req.json()
    if (!work_order_id) {
      return errorResponse('work_order_id is required', 400)
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

    // Fetch work order with all needed relations
    const { data: wo, error: woErr } = await supabase
      .from('work_orders')
      .select(`
        *,
        client:clients(*),
        site:sites(*, county:counties(*)),
        service_type:service_types(*)
      `)
      .eq('id', work_order_id)
      .single()

    if (woErr || !wo) {
      return errorResponse('Work order not found', 404)
    }

    // Fetch charges ordered by insertion
    const { data: charges, error: chargesErr } = await supabase
      .from('work_order_charges')
      .select('*, service_type:service_types(*)')
      .eq('work_order_id', work_order_id)
      .order('created_at', { ascending: true })

    if (chargesErr) {
      return errorResponse('Failed to fetch charges', 500)
    }

    // Fetch company settings
    const { data: company, error: companyErr } = await supabase
      .from('company_settings')
      .select('*')
      .eq('id', 1)
      .single()

    if (companyErr || !company) {
      return errorResponse('Company settings not configured', 500)
    }

    // Format date
    const dateStr = wo.proposed_start_date
      ? new Date(wo.proposed_start_date).toLocaleDateString('en-US', {
          month: 'short', day: 'numeric', year: 'numeric',
        })
      : new Date().toLocaleDateString('en-US', {
          month: 'short', day: 'numeric', year: 'numeric',
        })

    const documentName = `Proposal - ${wo.client?.name ?? 'Client'} - ${dateStr}`

    // Client billing address — fall back to site address if billing address not set
    const clientAddress = wo.client?.billing_address ?? wo.site?.address_line ?? ''
    const clientCity = wo.client?.billing_city ?? wo.site?.city ?? ''
    const clientState = wo.client?.billing_state ?? wo.site?.state ?? 'CA'
    const clientZip = wo.client?.billing_zip ?? wo.site?.zip ?? ''
    const clientCityStateZip = `${clientCity}, ${clientState} ${clientZip}`.trim()

    // Build nested line items for DocsAutomator
    const lineItems1 = (charges ?? []).map((charge: any) => {
      // Service block header
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

      // Short cost label for "COST FOR [X]: $amount"
      const costLabel = charge.is_manual_override
        ? (charge.description ?? 'SERVICE').toUpperCase()
        : (charge.service_type?.name ?? 'SERVICE').toUpperCase()

      // Format total as currency
      const formattedTotal = new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
      }).format(charge.amount ?? 0)

      // Map string[] line items to DocsAutomator nested format
      const subLines = (charge.line_items ?? [])
        .filter((li: string) => li.trim().length > 0)
        .map((li: string) => ({ description: li }))

      return {
        service_name: serviceName,
        cost_label: costLabel,
        service_total: formattedTotal,
        line_items_1_1: subLines,
      }
    })

    // Full DocsAutomator payload
    const payload = {
      docId: DOCSAUTOMATOR_AUTOMATION_ID,
      documentName,
      data: {
        // Company header
        company_name: company.business_name ?? '',
        company_address: company.address ?? '',
        company_phone: company.phone ?? '',
        company_email: company.email ?? '',
        company_license: company.license_number ?? '',
        signer_line: company.signer_line ?? '',
        proposal_terms: company.default_proposal_terms ?? '',

        // Client block
        client_name: wo.client?.name ?? '',
        client_address: clientAddress,
        client_city_state_zip: clientCityStateZip,
        client_contact: wo.client?.billing_contact ?? '',
        client_phone: wo.client?.billing_phone ?? '',
        client_email: wo.client?.billing_email ?? '',

        // Job details
        date: dateStr,
        contract_type: wo.frequency_type ?? '1 time',
        po_number: wo.po_number ?? '',
        closing_notes: wo.notes_client ?? '',

        // Nested service blocks
        line_items_1: lineItems1,
      },
    }

    // Call DocsAutomator
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
