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

    // Optional signer overrides from the confirmation modal
    const body_signer_name: string | undefined = body.signer_name
    const body_signer_email: string | undefined = body.signer_email

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

    // Fetch boilerplate template text if one is selected on this agreement
    let proposalTerms = company.default_proposal_terms ?? ''
    if (wo.boilerplate_template_id) {
      const { data: tpl } = await supabase
        .from('proposal_boilerplate_templates')
        .select('body')
        .eq('id', wo.boilerplate_template_id)
        .single()
      if (tpl?.body) {
        proposalTerms = tpl.body
      }
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

    const frequencyLabels: Record<string, string> = {
      one_time: '1X',
      annual: 'ANNUAL',
      monthly_seasonal: 'MONTHLY',
      weekly_seasonal: 'WEEKLY',
    }
    const monthNames = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC']

    // 6 non-breaking spaces for indent (matches v18 pattern)
    const INDENT = '\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0'

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
        seasonLabel = `${monthNames[charge.season_start_month - 1]}-${monthNames[charge.season_end_month - 1]}`
      }

      // Build children array (DocsAutomator API uses "children" key, not the template tag name)
      const rawItems = Array.isArray(charge.line_items) ? charge.line_items : []

      const children = rawItems
        .filter((li: any) => typeof li === 'string' && li.trim().length > 0)
        .map((li: string, idx: number) => ({
          // Indent + letter goes in line_letter, description is plain uppercase
          line_letter: `${INDENT}${String.fromCharCode(65 + idx)}.`,
          description: li.toUpperCase(),
        }))

      // Add cost line as last child (no indent, no letter)
      children.push({
        line_letter: '',
        description: `COST FOR ${costLabel}: ${formattedTotal}`,
      })

      return {
        service_name: serviceName,
        frequency: frequencyLabel,
        season: seasonLabel,
        children: children,
      }
    })

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
        proposal_terms: proposalTerms,

        client_name: wo.client?.name ?? '',
        client_address: clientAddress,
        client_city_state_zip: clientCityStateZip,
        client_contact: wo.client?.billing_contact ?? '',
        client_phone: wo.client?.billing_phone ?? '',
        client_email: wo.client?.billing_email ?? '',

        signer_name: body_signer_name ?? wo.client?.billing_contact ?? '',
        signer_email: body_signer_email ?? wo.client?.billing_email ?? '',

        date: dateStr,
        contract_type: wo.frequency_type ?? lineItems1[0]?.frequency ?? '1X',
        po_number: wo.po_number ?? '',
        closing_notes: wo.notes_client ?? '',
        disclaimer: wo.disclaimer ?? '',

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
      return errorResponse(`DocsAutomator error: ${daResponse.status} - ${errText}`, 502)
    }

    const daData = await daResponse.json()

    const signingUrl = daData.signingUrl ?? daData.documentUrl ?? daData.pdfUrl ?? daData.url ?? null
    const documentId = daData.documentId ?? daData.id ?? null

    // Save signing session data to the service_agreements table.
    // Status is 'created' (document generated, not yet emailed to client).
    const { error: updateErr } = await supabase
      .from('service_agreements')
      .update({
        client_signing_url: signingUrl,
        signing_session_id: documentId,
        signing_status: 'created',
      })
      .eq('id', agreement_id)

    if (updateErr) {
      console.error('Failed to save signing data:', updateErr)
      return errorResponse('Document created but failed to save signing data', 500)
    }

    return new Response(
      JSON.stringify({
        success: true,
        documentUrl: signingUrl,
        documentId,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (err) {
    console.error('Edge function error:', err)
    return errorResponse('Internal server error', 500)
  }
})
