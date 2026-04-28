# J9 | ChemWeed System Review
**Date:** April 27, 2026, 11:00 AM
**Attendees:** Ben Bliss (J9), Art Prudhel (Chem-Weed), Kayla (Chem-Weed), Christian Cecil (Chem-Weed)
**Granola ID:** 556e7682-ce26-44c1-862e-8090c56a42d2

---

## Action Items

### 1. Schedule: Show site name first on calendar (not client name)
- Calendar chips currently show client name first, then service type
- Team needs to see the site/location at a glance (e.g. "RD 2074" not "Co Sig Free")
- **Change:** Site name as primary label, client name as subheader, then service type
- Christian: "I want the guys to look at the schedule and see, okay, that's 2074 we need to go to"
- Art agreed: "The site needs to be the one that's primarily displayed on the calendar"

### 2. Coordinates / pin drop for sites without addresses
- Legacy sites from previous owner often have no address, just a known spray area
- Need lat/long coordinate fields displayed in site details card
- Coordinates already exist in DB (`latitude`, `longitude` columns) but are not shown in the UI
- Phase 1: Show coordinates in site details, allow manual entry + "drop pin" toggle as alternative to address
- Phase 2 (future): Map outline/polygon for spray areas
- Christian: "Having being able to just put a dot on a location, like, put a pin, a drop pin, that's the bigger, more important one"

### 3. Site photos: Admin photos tab (permanent reference images)
- Current site photos are just a flat gallery
- Need separation: admin-uploaded reference photos (maps, spray area highlights) vs. field log photos
- **Change:** Tab layout on site detail: "Admin Photos" (permanent) | "Field Log Photos" (from work orders) | Details
- Christian: "An admin area for adding admin photos which are hard-locked, this is what we do for this area"

### 4. Per-visit pricing model for service types
- Quality Assurance and Quality Perfection packages need per-visit pricing
- Currently using flat_rate as a workaround
- **Change:** Add `per_visit` to service_types.pricing_model CHECK constraint
- Christian: "I would like to have a per-visit pricing model... we offer those as a package but it's per visit, we do 5 visits"

### 5. Remove number prefixes from service type names
- Christian's numbering (0-5) was for his own internal tracking only
- Numbers should not appear on client-facing estimates
- **Change:** Strip number prefixes from service type names in DB
- Also: delete all inactive service types (confirmed by Christian)
- Christian: "Go ahead and update the numbering. It's more so for my own sanity"

### 6. Add sort_order field to service types
- Christian wants a fixed position number tied to each service type for his internal reference
- Sorting number stays fixed to the treatment regardless of display order changes
- **Change:** Add `sort_order integer` column to service_types table
- Christian: "More of a sorting number rather than a... I want the number to be fixed to whatever the treatment is"

### 7. Recommendation/warning notes field on proposals
- Need a second text block on proposals for disclaimers/recommendations
- Positioned above the signature on the estimate/proposal template
- Use case: one-time jobs need "this is not a permanent treatment, weeds will return" language
- Separate from existing `notes_client` (which maps to `closing_notes` in the template)
- **Change:** Add `recommendation_notes` column to service_agreements, wire into proposal template
- Christian: "At the bottom of the estimate... a recommendation, like a warning... a legalized way of saying it"
- Art: Described the use case of disclaiming one-time treatments vs ongoing service packages

### 8. Proposal tab on work order detail (tech-facing)
- Techs need to see the full proposal content when they're in the field
- Should show line items, service scope, and the signed document
- No PDF viewer needed, just the systematized data
- **Change:** Add "Proposal" tab to WorkOrderDetail after the Field tab
- Christian: "Whenever we send them to a job site, we always send them with a proposal"
- Art: "They should be able to see what was on the proposal"

### 9. Dynamic estimate templates per sender (BLOCKED - awaiting autographs)
- Different Google Docs templates for Art vs Christian, each with their own signature PNG
- System should select template based on logged-in user sending the proposal
- **Blocked:** Art and Christian will scan autographs and send them over
- Art: "If Christian sends it or I send it... whoever, it doesn't necessarily matter which section you're logged into"
- Ben clarified: Two Google Docs templates, system picks based on logged-in user

### 10. Confirmed bugs resolved
- "Program still resets progress" - Christian confirmed this is fixed
- "Crash in agreement details" - no longer reproducible

### 11. Future items discussed (NOT for this sprint)
- Claude AI integration for bulk data migration (clients from legacy system)
- Atlas phone system integration (AI receptionist creating work orders)
- Commission tracking system (sales rep field already added, needs reporting)
- HR/employee documentation section (Art sent forms and job descriptions)
- Vehicle/equipment maintenance logs and checklists
- Map polygon/outline for spray areas (Phase 2 of coordinates feature)

---

## Context Notes
- Christian is actively migrating clients from legacy system this week
- Using Claude to consolidate 8 separate export documents from old system
- Reclamation district jobs are expected to stress-test the system ("break the system" per Art)
- Feedback tab was demoed, team liked it, not yet pushed to production
- Draft save/restore feature was noticed and appreciated
- Client contacts feature is being used (Benito example)
