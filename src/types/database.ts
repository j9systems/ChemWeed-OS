export type Role = 'admin' | 'manager' | 'tech' | 'pca'

export type WorkOrderStatus = 'draft' | 'scheduled' | 'in_progress' | 'completed' | 'invoiced'

export type PropertyType = 'commercial' | 'government' | 'residential'

export type WindDirection = 'N' | 'NE' | 'E' | 'SE' | 'S' | 'SW' | 'W' | 'NW'

export interface Client {
  id: string
  name: string
  billing_contact: string | null
  billing_email: string | null
  billing_phone: string | null
  po_required: boolean
  payment_method: string | null
  notes: string | null
  is_active: boolean
  created_at: string
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

export interface WorkOrder {
  id: string
  work_order_number: string | null
  service_agreement_id?: string | null
  client_id: string
  site_id: string
  service_type_id: string
  frequency_type: string | null
  status: WorkOrderStatus
  proposed_start_date: string | null
  completion_date: string | null
  pca_id: string | null
  po_number: string | null
  reason: string | null
  urgency_level_id: string | null
  notes_client: string | null
  notes_internal: string | null
  notes_technician: string | null
  created_by: string
  created_at: string
  updated_at: string | null
  client?: Client
  site?: Site
  service_type?: ServiceType
  pca?: TeamMember
  urgency_level?: UrgencyLevel
}

export interface WorkOrderMaterial {
  id: string
  work_order_id: string
  chemical_id: string
  recommended_amount: number | null
  recommended_unit: string | null
  actual_amount_used: number | null
  tanks_used: number | null
  chemical?: Chemical
}

export interface WorkOrderCharge {
  id: string
  work_order_id: string
  description: string
  amount: number
}

export interface Chemical {
  id: string
  name: string
  manufacturer: string | null
  active_ingredient: string | null
  default_unit: string | null
  default_rate_per_100gal: number | null
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
  is_active: boolean
}

export interface TeamMember {
  id: string
  first_name: string
  last_name: string
  email: string | null
  personal_email: string | null
  photo: string | null
  role: Role
  phone: number | null
  active: string | null
}

export interface FieldCompletion {
  id: string
  work_order_id: string
  completed_by: string
  actual_start_at: string
  temperature_f: number | null
  wind_speed_mph: number | null
  wind_direction: WindDirection | null
  crew_ids: string[]
  notes: string | null
  signature_data_url: string | null
  photo_urls: string[]
  submitted_at: string
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
      work_orders: { Row: WorkOrder; Insert: Omit<WorkOrder, 'id' | 'created_at'>; Update: Partial<Omit<WorkOrder, 'id'>> }
      work_order_materials: { Row: WorkOrderMaterial; Insert: Omit<WorkOrderMaterial, 'id'>; Update: Partial<Omit<WorkOrderMaterial, 'id'>> }
      work_order_charges: { Row: WorkOrderCharge; Insert: Omit<WorkOrderCharge, 'id'>; Update: Partial<Omit<WorkOrderCharge, 'id'>> }
      chemicals: { Row: Chemical; Insert: Omit<Chemical, 'id'>; Update: Partial<Omit<Chemical, 'id'>> }
      service_types: { Row: ServiceType; Insert: Omit<ServiceType, 'id'>; Update: Partial<Omit<ServiceType, 'id'>> }
      team: { Row: TeamMember; Insert: Omit<TeamMember, 'id'>; Update: Partial<Omit<TeamMember, 'id'>> }
      field_completions: { Row: FieldCompletion; Insert: Omit<FieldCompletion, 'id'>; Update: Partial<Omit<FieldCompletion, 'id'>> }
      site_weed_profile: { Row: SiteWeedProfile; Insert: Omit<SiteWeedProfile, 'id' | 'added_at'>; Update: Partial<Omit<SiteWeedProfile, 'id'>> }
      site_observation_logs: { Row: SiteObservationLog; Insert: Omit<SiteObservationLog, 'id'>; Update: Partial<Omit<SiteObservationLog, 'id'>> }
      site_photos: { Row: SitePhoto; Insert: Omit<SitePhoto, 'id' | 'uploaded_at'>; Update: Partial<Omit<SitePhoto, 'id'>> }
      urgency_levels: { Row: UrgencyLevel; Insert: Omit<UrgencyLevel, 'id' | 'created_at'>; Update: Partial<Omit<UrgencyLevel, 'id'>> }
    }
  }
}
