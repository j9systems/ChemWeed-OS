# ChemWeed-OS — Claude Code Reference

## Git Rules
- ALWAYS commit directly to `main`
- NEVER create new branches (`git checkout -b` is forbidden)
- After every change: `git add . && git commit -m "..." && git push origin main`

## Email drafting voice (Ben Bliss / J9 Systems)

When drafting emails on my behalf, follow this voice. It is not optional.

### Structure
- Open with "Hi [Name]," — warm but efficient. Never "Dear." Use "Hey [Name]" only for established peers.
- Short-to-medium sentences. No walls of text.
- Every email ends with a clear next step: a confirmation needed, a date, a link, a named owner.
- For onboarding or status updates, use numbered checklists.
- Close with "Best,", "Talk soon,", or "Thanks!" — match the register of the thread.

### Signature
```
Best,
Ben Bliss
Founder & CEO
607-973-0482
ben@j9systems.com
j9systems.com
```

### Voice rules
- Surface conflicts, risks, and trade-offs proactively. Do not bury them.
- Acknowledge feedback briefly ("This is great feedback") then hold the sequencing when the trade-off is right — explain the why, don't capitulate.
- Warm but not saccharine. Compliments are efficient, not effusive.
- Occasional wit with peers who match it. Never with cold prospects.
- Own timelines and status. If something slipped, say so plainly.

### Banned phrases
- "Circle back", "touch base", "as per", "reach out" (rarely)
- Exclamation stacks ("Thanks!!!")
- Filler hedging ("just wanted to", "I was wondering if maybe")
- Corporate apology theater ("I sincerely apologize for any inconvenience this may have caused")
- Anything that reads AI-generated

### Banned punctuation
- Em dashes (—) anywhere in an email. Period. Replace with a period and start a new sentence, or use a comma. En dashes (–) are also out; use a hyphen (-) for ranges.

### Prefer
- "Happy to…" · "Let me know" · "Following up" · "Here's what was updated" · "Talk soon"

---

## Project Overview

**ChemWeed-OS** is a field operations and client management PWA for **Chem-Weed LLC**, a licensed vegetation management company based in Thornton, CA. It replaces a legacy desktop system called Tiger Jill.

The app covers the full job lifecycle:
- Client intake and site management
- Estimates, proposals (with eSign via DocsAutomator), and service agreements
- Work order generation and scheduling
- Field completion logging and chemical tracking
- County compliance reporting (future)
- Invoicing and payments (future)

**Key users:**
- **Art** — business owner, primary estimator and field operator
- **Kayla** — office admin, primary day-to-day user
- **Tyler** — office staff
- **Rick Foell** — licensed PCA (Pest Control Advisor), issues chemical recommendations for regulated jobs

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | React 18 + TypeScript + Vite |
| Routing | React Router v7 (SPA mode) |
| Styling | Tailwind CSS v4 |
| Backend | Supabase JS v2 (project ID: `wlimdoqdyntslagvlqcd`) |
| Hosting | Vercel (project: `prj_YpPlxns3H3A4Twbm0Boh7GquXVuP`, team: j9systems) |
| PWA | vite-plugin-pwa (service worker, NetworkFirst strategy) |
| Icons | Lucide React |
| Emails | Resend |
| Documents | DocsAutomator (Google Docs templates) |
| Auth | Supabase Auth (magic links, invite flow) |

---

## Design System

- **Background:** white
- **Brand green:** `#2a6b2a` (primary), `#3d8f3d` (light), `#1a4a1a` (dark)
- Colors match the Chem-Weed logo
- All new UI must use these brand colors via Tailwind utilities or inline styles
- Mobile-first; most field users are on phones

---

## Supabase Architecture

### Division of Labor
- Schema changes (DDL) → always use `apply_migration`, never `execute_sql`
- One-off data queries/inspection → `execute_sql` is fine
- Edge function deploys → always set `verify_jwt: false` for all functions in this project (they handle their own auth or receive external webhooks)

### Key Tables (public schema)

**`clients`** — Billing entity. Has `billing_county_id` FK. RLS enabled.

**`sites`** — Job locations. Belongs to a client. Has `county_id` FK for compliance. Multiple sites per client. RLS enabled.

**`service_agreements`** — Contract-level records. One agreement per site engagement. Defines scope, pricing, signing status, and contract dates. Key columns:
- `agreement_status`: `draft | active | completed | cancelled`
- `signing_status`: `not_sent | created | pending | in_progress | completed | expired | cancelled | declined`
- `frequency_type`, `contract_start_date`, `contract_end_date`
- `proposal_pdf_url`, `signed_pdf_url`, `signing_session_id`, `client_signing_url`
- `billing_method`: `upfront | per_visit | net_30`

**`service_agreement_line_items`** — Line items on an agreement. Each line carries:
- `frequency`: `one_time | annual | monthly_seasonal | weekly_seasonal`
- `season_start_month` / `season_end_month` (1–12) for seasonal lines
- `line_items` (jsonb array of sub-line breakdowns)
- `service_type_id`, `acreage`, `hours`, `unit_rate`, `amount`

**`work_orders`** — Execution records, one per visit/period. Generated upfront from service agreement line items when an agreement is saved. Key columns:
- `service_agreement_id` + `agreement_line_item_id` (parent references)
- `period_month`, `period_year`, `period_week` (which billing period this WO covers)
- `status`: `unscheduled | tentative | scheduled | in_progress | completed | cancelled`
- `scheduled_date`, `scheduled_time`, `completion_date`
- Weather fields: `wind_speed_mph`, `wind_direction`, `air_temp_f`

**`work_order_crew`** — Junction table: team members assigned to a work order.

**`field_completions`** — Field log submitted by tech on job completion. Includes weather, crew, signature, photos.

**`work_order_photos`** — Before/after/during photos per work order (Supabase Storage URLs).

**`work_order_notes`** — Internal notes per work order with `author_id`.

**`team`** — Staff registry. Roles: `technician | admin | pca | manager`. `pesticide_license_number` and `license_expiry_date` for compliance.

**`team_unavailability`** — Blocked dates per team member for scheduling.

**`chemicals`** — Chemical product registry with EPA reg numbers, default rates, max rates, reapplication intervals.

**`service_agreement_chemicals`** — Chemicals planned/used per agreement (planned vs actual amounts).

**`service_agreement_materials`** — Materials (chemicals) per agreement with recommended and actual amounts.

**`counties`** — California counties. `is_licensed` gates job creation. `report_recipient` for compliance reporting.

**`service_types`** — Lookup: Pre-Emergent, Post-Emergent, Bare Ground, Aquatic, Mowing, Disking, etc. `pricing_model`: `per_acre | per_hour | flat_rate`.

**`activities`** — Audit log for agreements. `activity_type` values: `proposal_created | proposal_sent | agreement_signed | field_log_submitted | work_order_completed`.

**`company_settings`** — Singleton (id=1). Company branding, license number, proposal/invoice terms. Referenced by edge functions.

**`app_settings`** — Singleton (id=1). Default tank size (100 gal), minimum job charge, county report due day.

**`urgency_levels`** — Lookup table for job urgency.

**`job_site_categories`** — Site type taxonomy (school, commercial, airport, etc.). `requires_annual_report` flag.

### Work Order Generation Logic
Work orders are generated **upfront** when a service agreement is saved (not via cron). Rules:
- `one_time` lines → 1 work order
- `annual` lines → 1 work order per year in the contract window
- `monthly_seasonal` lines → 1 work order per month within `season_start_month`–`season_end_month` for each contract year
- `weekly_seasonal` lines → 1 work order per week (tracked via `period_week`) within the seasonal window
- Scheduling UI filters the unscheduled queue to show only current and next-month work orders
- End year for open-ended agreements defaults to **current year** (not a far-future fallback)
- Deduplication uses `NOT EXISTS` pattern (not `ON CONFLICT DO NOTHING`, which fails with NULL unique index values)
- Cleanup step runs before regeneration: deletes unscheduled WOs outside the valid window

---

## Edge Functions

All deployed to Supabase, all have `verify_jwt: false`.

| Function | Purpose |
|---|---|
| `generate-proposal` | Calls DocsAutomator to generate proposal PDF, passes signer info |
| `esign-webhook` | Receives DocsAutomator completion callbacks, updates `signing_status` and `signed_pdf_url` |
| `send-proposal-email` | Sends proposal email via Resend with signing link |
| `invite-team-member` | Invites new users via Supabase `inviteUserByEmail` (handles delivery itself) |
| `resend-invite` | For already-confirmed users: generates login link via `generateLink()`, sends via Resend |
| `delete-team-member` | Removes team member from auth and public.team |

---

## Auth Flow

- **New users** → `invite-team-member` edge function → Supabase sends standard invite email → user clicks link → `/auth/callback` → detects `type=invite` → redirects to `/set-password`
- **Existing users** → `resend-invite` edge function → Resend delivers magic login link → `/auth/callback` → session established → redirects to `/dashboard`
- **Known issue history:** Gmail's in-app browser consumed single-use tokens before user could click. Resolved by using `X-Resend-Track-Clicks: false` header and advising users to open links in Safari/Chrome.
- Auth redirect URLs must be configured in Supabase dashboard (not in code). Production domain must be in the allowlist.
- `supabase.auth.admin.generateLink()` returns the link in `data.properties.action_link` but does NOT send email — delivery is handled separately by Resend.

---

## DocsAutomator Integration

- Nested records use the key `children` (not the template tag name)
- Non-breaking spaces (`\u00A0`) are used to prevent Markdown code-block formatting on lines with leading spaces
- Proposal flow: `generate-proposal` → DocsAutomator → PDF stored → `send-proposal-email` → client signs → `esign-webhook` fires → `signed_pdf_url` and `signing_completed_at` updated

---

## Roles and Access

Planned role-gated experience (same codebase, different nav/access):
- **Admin (Kayla/Tyler):** Full app — clients, agreements, scheduling, team, settings
- **Manager (Art):** Full app including estimates and approval actions
- **Technician:** Stripped-down mobile view — today's jobs, job detail, chemical log form. No access to client, estimate, or agreement features.
- **PCA (Rick):** Read access to jobs requiring PCA rec; can review but not edit agreements

Technician views are mobile-first, one-handed, with prominent chemical application form.

---

## Key Patterns and Conventions

- **Supabase client:** use the existing singleton — never instantiate a new client
- **Tailwind:** use brand green classes or inline hex values; do not introduce new color schemes
- **Forms:** use `onChange`/`onClick` handlers — never use HTML `<form>` tags in React components
- **Icons:** Lucide React only
- **Error handling:** always surface errors to the user with a toast or inline message; never silently fail
- **RLS:** `clients`, `sites`, `work_orders`, `service_agreement_line_items`, `service_agreement_chemicals`, `service_agreement_materials`, `site_photos`, `work_order_notes`, `field_completions`, `urgency_levels`, `activities` all have RLS enabled — queries must be made as authenticated user
- **Estimate formula:** acreage × price per acre = estimate total. Chemical cost is internal reference only, not a separate billable line item.

---

## What Is NOT Built Yet (Do Not Implement Without Direction)

- Invoicing and payment collection
- Client portal
- County compliance report generation/submission
- Offline write queuing (service worker handles reads; write sync is future work)
- Any external API integrations beyond Supabase, Resend, DocsAutomator, and Vercel
