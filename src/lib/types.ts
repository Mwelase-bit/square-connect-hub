export type Role = "client" | "adviser" | "admin";

export interface Adviser {
  id: number;
  name: string;
  email: string;
  phone: string;
}

export interface Policy {
  id: number;
  client_id: number;
  insurer: string;
  product: string;
  kind: "policy" | "investment";
  annual_premium: number;
  value: number;
}

export interface Client {
  id: number;
  email: string;
  phone: string;
  name: string;
  address: string;
  city: string;
  postal_code: string;
  id_number: string;
  adviser_id: number;
  profile_complete: boolean;
  date_joined: string;
  last_interaction: string;
}

export type FormType =
  | "Confidentiality Agreement"
  | "Broker Appointment"
  | "Client Consent"
  | "FAIS Disclosure"
  | "Service Agreement"
  | "Privacy Policy & T&Cs";

export interface OnboardingForm {
  id: number;
  client_id: number;
  form_type: FormType;
  data: Record<string, string | boolean>;
  signed: boolean;
  signed_at: string | null;
  pdf_base64: string | null;
}

export type ReminderType =
  | "licence_expiry"
  | "valuation_cert"
  | "annual_review"
  | "retirement_fee"
  | "birthday";

export interface Reminder {
  id: number;
  adviser_id: number | null;
  client_id: number;
  reminder_type: ReminderType;
  due_date: string;
  message: string;
  audience: "client" | "adviser" | "both";
  read: boolean;
  dismissed: boolean;
  created_at: string;
}

export interface Goal {
  id: number;
  created_by_adviser_id: number;
  goal_name: string;
  target_amount: number;
  current_amount: number;
  target_date: string;
  description: string;
  shared_client_ids: number[];
  created_at: string;
}

export type ClaimStatus =
  | "submitted"
  | "processing"
  | "assessment_scheduled"
  | "under_assessment"
  | "quote_received"
  | "repair_authorised"
  | "repair_in_progress"
  | "completed";

export interface ClaimAttachment {
  id: number;
  claim_id: number;
  file_type: string;
  file_name: string;
  file_base64: string;
  extracted_text: string;
  fields: { label: string; value: string; confidence: number; critical?: boolean }[];
  confirmed: boolean;
  uploaded_at: string;
}

export interface ClaimStatusUpdate {
  id: number;
  claim_id: number;
  status: ClaimStatus;
  message: string;
  timestamp: string;
}

export interface Rating {
  by: "client" | "adviser";
  stars: number;
  comment: string;
  at: string;
}

export interface Claim {
  id: number;
  client_id: number;
  claim_number: string | null;
  claim_type: "motor";
  insurer: string;
  status: ClaimStatus;
  incident_date: string;
  incident_time: string;
  incident_description: string;
  police_notified: boolean;
  police_case_number: string;
  witness_name: string;
  witness_phone: string;
  witness_statement: boolean;
  driver: string;
  usage: "personal" | "business";
  third_party_name: string;
  third_party_id: string;
  third_party_licence: string;
  third_party_registration: string;
  third_party_insurer: string;
  third_party_policy: string;
  signed: boolean;
  signed_at: string | null;
  signed_by: string | null;
  pdf_base64: string | null;
  ratings: Rating[];
  created_at: string;
  updated_at: string;
}

export interface AuditEntry {
  id: number;
  user_id: number | null;
  user_type: Role | "system";
  action: string;
  resource: string;
  timestamp: string;
  details: Record<string, unknown>;
}

export interface ApiLogEntry {
  id: number;
  method: string;
  url: string;
  request: unknown;
  response: unknown;
  timestamp: string;
}

export interface DB {
  advisers: Adviser[];
  clients: Client[];
  policies: Policy[];
  forms: OnboardingForm[];
  reminders: Reminder[];
  goals: Goal[];
  claims: Claim[];
  attachments: ClaimAttachment[];
  statusUpdates: ClaimStatusUpdate[];
  audit: AuditEntry[];
  apiLog: ApiLogEntry[];
  seq: number;
}

export interface Session {
  role: Role;
  userId: number;
  name: string;
  lastActivity: number;
}
