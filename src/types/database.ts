export type Role = 'admin' | 'manager' | 'technician' | 'pca'

export type AgreementStatus = 'draft' | 'active' | 'completed' | 'cancelled'

export type WorkOrderStatus =
  'unscheduled' | 'tentative' | 'scheduled' | 'in_progress' | 'partial_complete' | 'completed' | 'cancelled'

export type FrequencyType = 'one_time' | 'annual' | 'monthly_seasonal' | 'weekly_seasonal'

export type PropertyType = 'commercial' | 'government' | 'residential'

export type WindDirection = 'N' | 'NE' | 'E' | 'SE' | 'S' | 'SW' | 'W' | 'NW'

export type PricingModel = 'per_acre' | 'per_hour' | 'flat_rate'

export interface Client {
  id: string
  name: string
  billing_contact: string | null
  billing_email: string | null
  billing_phone: string | null
  billing_address: string | null
  billing_city: string | null
  billing_state: string
  billing_zip: string | null
  po_required: boolean
  payment_method: string | null
  notes: string | null
  is_active: boolean
  archived_at: string | null
  created_at: string
  updated_at: string
}

export interface ClientContact {
  id: string
  client_id: string
  name: string
  email: string | null
  phone: string | null
  role: string | null
  is_primary: boolean
  is_billing: boolean
  created_at: string
  updated_at: string
}

export interface Site {
  id: string
  client_id: string
  name: string
  address_line: string
  city: string
  county_id: string
  state: string
  zip: string
  total_acres: number | null
  property_type: PropertyType | null
  notes: string | null
  is_active: boolean
  created_at: string
  latitude: number | null
  longitude: number | null
  county?: County
  client?: Client
}

export interface County {
  id: string
  name: string
  state: string
  is_licensed: boolean
  report_recipient: string | null
  notes: string | null
}

export interface UrgencyLevel {
  id: string
  key: string
  label: string
  sort_order: number
  is_default: boolean
  created_at: string
}

export interface ServiceAgreementLineItem {
  id: string
  agreement_id: string
  sort_order: number
  description: string | null
  service_type_id: string | null
  service_type?: ServiceType
  acreage: number | null
  hours: number | null
  unit_rate: number | null
  amount: number
  is_manual_override: boolean
  line_items: string[]
  frequency: FrequencyType
  season_start_month: number | null
  season_end_month: number | null
  created_at: string
}

export interface ProposalBoilerplateTemplate {
  id: string
  name: string
  body: string
  is_default: boolean
  is_active: boolean
  sort_order: number
  created_at: string
  updated_at: string
}

export interface ServiceAgreement {
  id: string
  agreement_number: string | null
  client_id: string
  client?: Client
  site_id: string
  site?: Site
  service_type_id: string | null
  service_type_ids: string[]
  service_type?: ServiceType
  frequency_type: string | null
  reason: string | null
  proposed_start_date: string | null
  proposed_start_time: string | null
  contract_start_date: string | null
  contract_end_date: string | null
  contract_value: number | null
  billing_method: string | null
  po_number: string | null
  boilerplate_template_id?: string | null
  boilerplate_template?: ProposalBoilerplateTemplate | null
  pca_id: string | null
  pca?: TeamMember
  pca_rec_url: string | null
  sales_rep_id: string | null
  sales_rep?: TeamMember
  urgency_level_id: string | null
  urgency_level?: UrgencyLevel
  agreement_status: AgreementStatus
  notes_client: string | null
  notes_internal: string | null
  notes_technician: string | null
  signing_session_id?: string | null
  signing_status?: string | null
  client_signing_url?: string | null
  signed_pdf_url?: string | null
  signing_completed_at?: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface ServiceAgreementMaterial {
  id: string
  agreement_id: string
  chemical_id: string
  recommended_amount: number | null
  recommended_unit: string | null
  actual_amount_used: number | null
  tanks_used: number | null
  chemical?: Chemical
}

export interface Vehicle {
  id: string
  label: string
  license_plate: string | null
  notes: string | null
  is_active: boolean
}

export interface WorkOrder {
  id: string
  work_order_number: string | null
  service_agreement_id: string
  service_agreement?: ServiceAgreement
  agreement_line_item_id: string
  agreement_line_item?: ServiceAgreementLineItem
  client_id: string
  client?: Client
  site_id: string
  site?: Site
  service_type_id: string | null
  service_type?: ServiceType
  period_month: number | null
  period_year: number | null
  period_week: number | null
  status: WorkOrderStatus
  scheduled_date: string | null
  scheduled_time: string | null
  last_serviced_date: string | null
  days_since_last_service: number | null
  actual_start_date: string | null
  actual_start_time: string | null
  completion_date: string | null
  completion_time: string | null
  wind_speed_mph: number | null
  wind_direction: string | null
  air_temp_f: number | null
  tanks_used: number | null
  pca_id: string | null
  pca?: TeamMember
  pca_rec_url: string | null
  urgency_level_id: string | null
  urgency_level?: UrgencyLevel
  vehicle_id: string | null
  start_mileage: number | null
  end_mileage: number | null
  notes_client: string | null
  notes_internal: string | null
  notes_technician: string | null
  po_number: string | null
  signature_url: string | null
  created_by: string | null
  created_at: string
  updated_at: string
  work_order_crew?: WorkOrderCrewMember[]
}

export interface Chemical {
  id: string
  name: string
  manufacturer: string | null
  active_ingredient: string | null
  epa_reg_number: string | null
  default_unit: string | null
  default_rate_per_100gal: number | null
  default_rate_per_acre: number | null
  default_rate_unit: string | null
  cost_per_unit: number | null
  max_rate_per_100gal: number | null
  reapplication_interval_days: number | null
  use_types: string[]
  notes: string | null
  is_active: boolean
}

export interface ServiceType {
  id: string
  name: string
  description: string | null
  pricing_model: PricingModel
  base_rate_low: number | null
  base_rate_high: number | null
  default_scope_template: string | null
  internal_notes: string | null
  is_active: boolean
}

export interface JobSiteCategory {
  id: string
  name: string
  requires_annual_report: boolean
  is_active: boolean
  notes: string | null
}

export interface AppSettings {
  id: number
  default_tank_size_gal: number | null
  minimum_job_charge: number | null
  default_overhead_margin_pct: number | null
  county_report_due_day: number | null
  county_report_reminder_days_before: number | null
  no_activity_report_template: string | null
}

export interface CompanySettings {
  id: number
  business_name: string | null
  address: string | null
  phone: string | null
  email: string | null
  license_number: string | null
  logo_url: string | null
  default_proposal_terms: string | null
  default_invoice_terms: string | null
  signer_line: string | null
}

export interface TeamMember {
  id: string
  first_name: string
  last_name: string
  role: Role
  pesticide_license_number: string | null
  license_expiry_date: string | null
  phone: string | null
  email: string | null
  is_active: boolean
  notes: string | null
  photo_url: string | null
  created_at: string
}

export interface FieldCompletion {
  id: string
  work_order_id: string
  completed_by: string | null
  actual_start_at: string
  temperature_f: number | null
  wind_speed_mph: number | null
  wind_direction: WindDirection | null
  crew_ids: string[]
  notes: string | null
  signature_data_url: string | null
  photo_urls: string[]
  before_photo_urls: string[]
  after_photo_urls: string[]
  during_photo_urls: string[]
  submitted_at: string | null
}

export interface FieldCompletionMaterial {
  id: string
  field_completion_id: string
  service_agreement_material_id: string | null
  chemical_name: string
  recommended_amount: number | null
  recommended_unit: string | null
  actual_amount_used: number | null
  tanks_used: number | null
  created_at: string
}

export interface SiteWeedProfile {
  id: string
  site_id: string
  weed_name: string
  notes: string | null
  added_at: string
  added_by: string | null
}

export interface SitePhoto {
  id: string
  site_id: string
  photo_url: string
  caption: string | null
  uploaded_at: string
  uploaded_by: string | null
}

export interface WorkOrderCrewMember {
  id: string
  work_order_id: string
  team_member_id: string
  role: string | null
  team_member?: TeamMember
}

export interface TeamUnavailability {
  id: string
  team_member_id: string
  start_date: string
  end_date: string
  all_day: boolean
  start_time: string | null
  end_time: string | null
  reason: string | null
  created_by: string | null
  created_at: string
}

export interface SiteObservationLog {
  id: string
  site_id: string
  work_order_id: string | null
  observed_at: string
  observed_by: string | null
  weed_species: string[]
  density: string | null
  conditions: string | null
  notes: string | null
  photo_urls: string[]
}

// Supabase Database type for the client generic
export interface Database {
  public: {
    Tables: {
      clients: { Row: Client; Insert: Omit<Client, 'id' | 'created_at'>; Update: Partial<Omit<Client, 'id'>> }
      sites: { Row: Site; Insert: Omit<Site, 'id'>; Update: Partial<Omit<Site, 'id'>> }
      counties: { Row: County; Insert: Omit<County, 'id'>; Update: Partial<Omit<County, 'id'>> }
      service_agreements: { Row: ServiceAgreement; Insert: Omit<ServiceAgreement, 'id' | 'created_at'>; Update: Partial<Omit<ServiceAgreement, 'id'>> }
      service_agreement_line_items: { Row: ServiceAgreementLineItem; Insert: Omit<ServiceAgreementLineItem, 'id'>; Update: Partial<Omit<ServiceAgreementLineItem, 'id'>> }
      service_agreement_materials: { Row: ServiceAgreementMaterial; Insert: Omit<ServiceAgreementMaterial, 'id'>; Update: Partial<Omit<ServiceAgreementMaterial, 'id'>> }
      work_orders: { Row: WorkOrder; Insert: Omit<WorkOrder, 'id' | 'created_at'>; Update: Partial<Omit<WorkOrder, 'id'>> }
      chemicals: { Row: Chemical; Insert: Omit<Chemical, 'id'>; Update: Partial<Omit<Chemical, 'id'>> }
      service_types: { Row: ServiceType; Insert: Omit<ServiceType, 'id'>; Update: Partial<Omit<ServiceType, 'id'>> }
      team: { Row: TeamMember; Insert: Omit<TeamMember, 'id'>; Update: Partial<Omit<TeamMember, 'id'>> }
      field_completions: { Row: FieldCompletion; Insert: Omit<FieldCompletion, 'id'>; Update: Partial<Omit<FieldCompletion, 'id'>> }
      site_weed_profile: { Row: SiteWeedProfile; Insert: Omit<SiteWeedProfile, 'id' | 'added_at'>; Update: Partial<Omit<SiteWeedProfile, 'id'>> }
      site_observation_logs: { Row: SiteObservationLog; Insert: Omit<SiteObservationLog, 'id'>; Update: Partial<Omit<SiteObservationLog, 'id'>> }
      site_photos: { Row: SitePhoto; Insert: Omit<SitePhoto, 'id' | 'uploaded_at'>; Update: Partial<Omit<SitePhoto, 'id'>> }
      urgency_levels: { Row: UrgencyLevel; Insert: Omit<UrgencyLevel, 'id' | 'created_at'>; Update: Partial<Omit<UrgencyLevel, 'id'>> }
      work_order_crew: { Row: WorkOrderCrewMember; Insert: Omit<WorkOrderCrewMember, 'id'>; Update: Partial<Omit<WorkOrderCrewMember, 'id'>> }
      team_unavailability: { Row: TeamUnavailability; Insert: Omit<TeamUnavailability, 'id' | 'created_at'>; Update: Partial<Omit<TeamUnavailability, 'id'>> }
      proposal_boilerplate_templates: { Row: ProposalBoilerplateTemplate; Insert: Omit<ProposalBoilerplateTemplate, 'id' | 'created_at' | 'updated_at'>; Update: Partial<Omit<ProposalBoilerplateTemplate, 'id'>> }
    }
  }
}
