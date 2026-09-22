export type Role = 'owner' | 'admin' | 'crew';
export type LeadStatus = 'new' | 'qualified' | 'quoted' | 'won' | 'lost';
export type QuoteStatus = 'draft' | 'sent' | 'viewed' | 'accepted' | 'declined' | 'expired';
export type JobStatus =
  | 'unscheduled'
  | 'scheduled'
  | 'in_progress'
  | 'complete'
  | 'paid'
  | 'cancelled';
export type InvoiceStatus = 'draft' | 'sent' | 'paid' | 'void';
export type PhotoKind = 'lead' | 'before' | 'after' | 'progress';

export interface Business {
  id: string;
  name: string;
  slug: string;
  trade: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  timezone: string;
  plan: string;
  review_url: string | null;
  is_demo: number;
  created_at: string;
}

export interface User {
  id: string;
  business_id: string;
  email: string;
  name: string;
  phone: string | null;
  role: Role;
  password_hash: string;
  active: number;
  created_at: string;
}

export interface Crew {
  id: string;
  business_id: string;
  name: string;
  color: string;
  lead_user_id: string | null;
  active: number;
  created_at: string;
}

export interface Customer {
  id: string;
  business_id: string;
  name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  lat: number | null;
  lng: number | null;
  source: string | null;
  notes: string | null;
  tags: string | null;
  created_at: string;
}

export interface Lead {
  id: string;
  business_id: string;
  customer_id: string;
  source: string;
  service_type: string;
  description: string;
  summary: string | null;
  urgency: 'low' | 'normal' | 'high';
  preferred_date: string | null;
  preferred_time: string | null;
  status: LeadStatus;
  est_low: number | null;
  est_high: number | null;
  est_basis: string | null;
  lost_reason: string | null;
  created_at: string;
  updated_at: string;
}

export interface Photo {
  id: string;
  business_id: string;
  kind: PhotoKind;
  lead_id: string | null;
  job_id: string | null;
  url: string;
  caption: string | null;
  uploaded_by: string | null;
  created_at: string;
}

export interface Quote {
  id: string;
  business_id: string;
  number: number;
  customer_id: string;
  lead_id: string | null;
  title: string;
  service_type: string;
  status: QuoteStatus;
  subtotal: number;
  tax: number;
  total: number;
  notes: string | null;
  token: string;
  sent_at: string | null;
  viewed_at: string | null;
  accepted_at: string | null;
  declined_at: string | null;
  expires_at: string | null;
  follow_up_stage: number;
  created_at: string;
  updated_at: string;
}

export interface QuoteItem {
  id: string;
  quote_id: string;
  kind: 'labor' | 'material' | 'disposal' | 'travel' | 'other';
  description: string;
  quantity: number;
  unit: string;
  unit_price: number;
  total: number;
  sort: number;
}

export interface Job {
  id: string;
  business_id: string;
  number: number;
  customer_id: string;
  quote_id: string | null;
  crew_id: string | null;
  title: string;
  service_type: string;
  status: JobStatus;
  scheduled_start: string | null;
  scheduled_end: string | null;
  duration_min: number;
  amount: number;
  address: string | null;
  notes: string | null;
  token: string;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ChecklistItem {
  id: string;
  job_id: string;
  label: string;
  done: number;
  done_at: string | null;
  done_by: string | null;
  sort: number;
}

export interface Invoice {
  id: string;
  business_id: string;
  number: number;
  job_id: string | null;
  customer_id: string;
  amount: number;
  amount_paid: number;
  status: InvoiceStatus;
  due_date: string | null;
  token: string;
  sent_at: string | null;
  paid_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Payment {
  id: string;
  business_id: string;
  invoice_id: string;
  amount: number;
  method: 'card' | 'cash' | 'check' | 'ach';
  provider: string;
  provider_ref: string | null;
  status: string;
  created_at: string;
}

export interface Review {
  id: string;
  business_id: string;
  job_id: string | null;
  customer_id: string;
  rating: number;
  comment: string | null;
  routed_to: 'public' | 'private';
  created_at: string;
}

export interface Message {
  id: string;
  business_id: string;
  customer_id: string | null;
  lead_id: string | null;
  quote_id: string | null;
  job_id: string | null;
  direction: 'in' | 'out';
  channel: 'sms' | 'email' | 'note';
  body: string;
  automated: number;
  created_at: string;
}

export interface Activity {
  id: string;
  business_id: string;
  kind: string;
  title: string;
  detail: string | null;
  entity_type: string | null;
  entity_id: string | null;
  amount: number | null;
  actor: string | null;
  created_at: string;
}

export interface Automation {
  id: string;
  business_id: string;
  key: string;
  name: string;
  description: string | null;
  trigger_event: string;
  enabled: number;
  config: string;
  run_count: number;
  created_at: string;
  updated_at: string;
}

export interface AutomationTask {
  id: string;
  business_id: string;
  automation_id: string | null;
  kind: string;
  run_at: string;
  status: 'pending' | 'done' | 'cancelled' | 'failed';
  entity_type: string | null;
  entity_id: string | null;
  payload: string;
  result: string | null;
  created_at: string;
  ran_at: string | null;
}

export interface Settings {
  business_id: string;
  min_job_price: number;
  hourly_rate: number;
  material_markup: number;
  travel_fee: number;
  min_sqft: number;
  tax_rate: number;
  deposit_pct: number;
  work_days: string;
  work_start: string;
  work_end: string;
  travel_buffer_min: number;
  service_area: string | null;
  quote_valid_days: number;
  updated_at: string;
}

export interface ServiceRate {
  id: string;
  business_id: string;
  service_type: string;
  label: string;
  base_price: number;
  per_hour: number;
  typical_hours: number;
  material_est: number;
  min_price: number;
  spread_pct: number;
  active: number;
}
