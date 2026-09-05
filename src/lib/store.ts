import { useSyncExternalStore } from "react";
import type {
  Claim,
  ClaimStatus,
  DB,
  FormType,
  Role,
  Session,
} from "./types";

const DB_KEY = "rsf.db.v1";
const SESSION_KEY = "rsf.session.v1";
export const SESSION_TIMEOUT_MS = 30 * 60 * 1000;

export const FORM_TYPES: FormType[] = [
  "Confidentiality Agreement",
  "Broker Appointment",
  "Client Consent",
  "FAIS Disclosure",
  "Service Agreement",
  "Privacy Policy & T&Cs",
];

const day = 86400000;
const iso = (offsetDays: number) => new Date(Date.now() + offsetDays * day).toISOString();
const dateOnly = (offsetDays: number) => iso(offsetDays).slice(0, 10);

function seed(): DB {
  let seq = 1000;
  const id = () => ++seq;

  const advisers = [
    { id: 1, name: "Qiniso Ntuli", email: "qiniso@royalsquare.co.za", phone: "+27 82 555 0111" },
    { id: 2, name: "Lerato Mokoena", email: "lerato@royalsquare.co.za", phone: "+27 82 555 0122" },
  ];

  const clients = [
    {
      id: 1, email: "john@email.com", phone: "+27 83 111 2222", name: "John Smith",
      address: "12 Oak Avenue, Sandton", city: "Johannesburg", postal_code: "2196",
      id_number: "8501015800083", adviser_id: 1, profile_complete: true,
      date_joined: iso(-320), last_interaction: iso(-3),
    },
    {
      id: 2, email: "jane@email.com", phone: "+27 84 333 4444", name: "Jane Doe",
      address: "8 Protea Road, Rondebosch", city: "Cape Town", postal_code: "7700",
      id_number: "9003125900085", adviser_id: 1, profile_complete: true,
      date_joined: iso(-210), last_interaction: iso(-11),
    },
    {
      id: 3, email: "bob@email.com", phone: "+27 82 777 8888", name: "Bob Johnson",
      address: "45 Umhlanga Rocks Drive", city: "Durban", postal_code: "4051",
      id_number: "7811205700081", adviser_id: 2, profile_complete: true,
      date_joined: iso(-95), last_interaction: iso(-1),
    },
  ];

  const policies = [
    { id: id(), client_id: 1, insurer: "Santam", product: "Motor Comprehensive", kind: "policy" as const, annual_premium: 18400, value: 320000 },
    { id: id(), client_id: 1, insurer: "Old Mutual", product: "Balanced Unit Trust", kind: "investment" as const, annual_premium: 0, value: 185000 },
    { id: id(), client_id: 1, insurer: "Liberty", product: "Life Cover R1.5m", kind: "policy" as const, annual_premium: 9600, value: 0 },
    { id: id(), client_id: 2, insurer: "Liberty", product: "Life Cover R2m", kind: "policy" as const, annual_premium: 11400, value: 0 },
    { id: id(), client_id: 2, insurer: "Old Mutual", product: "Retirement Annuity", kind: "investment" as const, annual_premium: 0, value: 412000 },
    { id: id(), client_id: 2, insurer: "Old Mutual", product: "Tax Free Savings", kind: "investment" as const, annual_premium: 0, value: 96000 },
    { id: id(), client_id: 3, insurer: "Santam", product: "Motor Comprehensive", kind: "policy" as const, annual_premium: 21200, value: 465000 },
    { id: id(), client_id: 3, insurer: "Liberty", product: "Life & Disability", kind: "policy" as const, annual_premium: 14300, value: 0 },
  ];

  const forms = clients.flatMap((c) =>
    FORM_TYPES.map((t) => ({
      id: id(),
      client_id: c.id,
      form_type: t,
      data: {
        full_name: c.name, email: c.email, phone: c.phone, address: c.address,
        city: c.city, postal_code: c.postal_code, id_number: c.id_number,
        popia_consent: true, comms_consent: true,
        adviser: advisers.find((a) => a.id === c.adviser_id)!.name,
      },
      signed: true,
      signed_at: c.date_joined,
      pdf_base64: null,
    })),
  );

  const reminders = [
    { id: id(), adviser_id: 1, client_id: 1, reminder_type: "licence_expiry" as const, due_date: dateOnly(-5), message: "Driving licence expires — renewal overdue", audience: "both" as const, read: false, dismissed: false, created_at: iso(-40) },
    { id: id(), adviser_id: 1, client_id: 1, reminder_type: "valuation_cert" as const, due_date: dateOnly(4), message: "Insurance valuation certificate due for household contents", audience: "both" as const, read: false, dismissed: false, created_at: iso(-56) },
    { id: id(), adviser_id: 1, client_id: 2, reminder_type: "annual_review" as const, due_date: dateOnly(6), message: "Annual financial review meeting with Jane Doe", audience: "adviser" as const, read: false, dismissed: false, created_at: iso(-20) },
    { id: id(), adviser_id: 2, client_id: 3, reminder_type: "retirement_fee" as const, due_date: dateOnly(13), message: "Retirement fund fee renewal — confirm with Old Mutual", audience: "adviser" as const, read: false, dismissed: false, created_at: iso(-14) },
    { id: id(), adviser_id: 2, client_id: 3, reminder_type: "birthday" as const, due_date: dateOnly(0), message: "Bob Johnson's birthday today — send a note", audience: "adviser" as const, read: false, dismissed: false, created_at: iso(-1) },
    { id: id(), adviser_id: 1, client_id: 2, reminder_type: "licence_expiry" as const, due_date: dateOnly(25), message: "Driving licence expires in 30 days", audience: "client" as const, read: false, dismissed: false, created_at: iso(-5) },
    { id: id(), adviser_id: 1, client_id: 1, reminder_type: "annual_review" as const, due_date: dateOnly(-12), message: "Annual review meeting was not confirmed", audience: "both" as const, read: false, dismissed: false, created_at: iso(-30) },
  ];

  const goals = [
    { id: id(), created_by_adviser_id: 1, goal_name: "Emergency Fund", target_amount: 250000, current_amount: 62500, target_date: dateOnly(400), description: "Six months of living expenses in an accessible account.", shared_client_ids: [1], created_at: iso(-100) },
    { id: id(), created_by_adviser_id: 1, goal_name: "Retirement Top-Up", target_amount: 1000000, current_amount: 600000, target_date: dateOnly(900), description: "Additional retirement annuity contributions.", shared_client_ids: [1, 2], created_at: iso(-180) },
    { id: id(), created_by_adviser_id: 2, goal_name: "Home Deposit", target_amount: 500000, current_amount: 400000, target_date: dateOnly(300), description: "Deposit toward a family home purchase.", shared_client_ids: [3], created_at: iso(-150) },
    { id: id(), created_by_adviser_id: 1, goal_name: "Education Fund", target_amount: 180000, current_amount: 180000, target_date: dateOnly(60), description: "University fees for first year.", shared_client_ids: [2], created_at: iso(-260) },
  ];

  const claims: Claim[] = [
    {
      id: id(), client_id: 1, claim_number: "RSF-CLM-20260821-001", claim_type: "motor", insurer: "Santam",
      status: "under_assessment", incident_date: dateOnly(-15), incident_time: "07:40",
      incident_description: "Rear-ended at a traffic light on William Nicol Drive.",
      police_notified: true, police_case_number: "CAS 224/08/2026",
      witness_name: "Thabo Dlamini", witness_phone: "+27 71 222 3333", witness_statement: true,
      driver: "John Smith", usage: "personal",
      third_party_name: "Sipho Khumalo", third_party_id: "8207145600082", third_party_licence: "CA 421 902",
      third_party_registration: "ND 55 GP", third_party_insurer: "Discovery", third_party_policy: "DIS-889231",
      signed: true, signed_at: iso(-15), signed_by: "John Smith", pdf_base64: null, ratings: [],
      created_at: iso(-15), updated_at: iso(-2),
    },
    {
      id: id(), client_id: 2, claim_number: "RSF-CLM-20260903-002", claim_type: "motor", insurer: "Old Mutual",
      status: "submitted", incident_date: dateOnly(-2), incident_time: "18:15",
      incident_description: "Minor collision in a shopping centre parking area.",
      police_notified: false, police_case_number: "",
      witness_name: "", witness_phone: "", witness_statement: false,
      driver: "Jane Doe", usage: "personal",
      third_party_name: "Anna Botha", third_party_id: "9105060800087", third_party_licence: "CJ 118 774",
      third_party_registration: "CA 221 448", third_party_insurer: "Momentum", third_party_policy: "MOM-441220",
      signed: true, signed_at: iso(-2), signed_by: "Jane Doe", pdf_base64: null, ratings: [],
      created_at: iso(-2), updated_at: iso(-2),
    },
    {
      id: id(), client_id: 3, claim_number: "RSF-CLM-20260610-003", claim_type: "motor", insurer: "Santam",
      status: "completed", incident_date: dateOnly(-85), incident_time: "12:05",
      incident_description: "Hail damage to bonnet and roof.",
      police_notified: false, police_case_number: "",
      witness_name: "", witness_phone: "", witness_statement: false,
      driver: "Bob Johnson", usage: "business",
      third_party_name: "", third_party_id: "", third_party_licence: "",
      third_party_registration: "", third_party_insurer: "", third_party_policy: "",
      signed: true, signed_at: iso(-85), signed_by: "Bob Johnson", pdf_base64: null,
      ratings: [
        { by: "client", stars: 5, comment: "Fast and painless.", at: iso(-40) },
        { by: "adviser", stars: 4, comment: "Assessor was slightly delayed.", at: iso(-39) },
      ],
      created_at: iso(-85), updated_at: iso(-40),
    },
  ];

  const statusUpdates = [
    { id: id(), claim_id: claims[0]!.id, status: "submitted" as ClaimStatus, message: "Claim submitted and digitally signed.", timestamp: iso(-15) },
    { id: id(), claim_id: claims[0]!.id, status: "processing" as ClaimStatus, message: "Claim number RSF-CLM-20260821-001 assigned.", timestamp: iso(-15) },
    { id: id(), claim_id: claims[0]!.id, status: "assessment_scheduled" as ClaimStatus, message: "Assessment scheduled for " + dateOnly(-6) + ".", timestamp: iso(-12) },
    { id: id(), claim_id: claims[0]!.id, status: "under_assessment" as ClaimStatus, message: "Vehicle with assessor Pieter van Wyk (Santam panel).", timestamp: iso(-2) },
    { id: id(), claim_id: claims[1]!.id, status: "submitted" as ClaimStatus, message: "Claim submitted and digitally signed.", timestamp: iso(-2) },
    { id: id(), claim_id: claims[2]!.id, status: "submitted" as ClaimStatus, message: "Claim submitted and digitally signed.", timestamp: iso(-85) },
    { id: id(), claim_id: claims[2]!.id, status: "repair_in_progress" as ClaimStatus, message: "Bodywork 100% complete, panel beater sign-off received.", timestamp: iso(-48) },
    { id: id(), claim_id: claims[2]!.id, status: "completed" as ClaimStatus, message: "Claim closed and settled.", timestamp: iso(-41) },
  ];

  return {
    advisers, clients, policies, forms, reminders, goals, claims,
    attachments: [], statusUpdates,
    audit: [
      { id: id(), user_id: 1, user_type: "adviser", action: "login", resource: "session", timestamp: iso(-1), details: {} },
      { id: id(), user_id: 1, user_type: "client", action: "claim_submitted", resource: "claim", timestamp: iso(-15), details: { claim: "RSF-CLM-20260821-001" } },
    ],
    apiLog: [],
    seq,
  };
}

let memory: DB | null = null;
const listeners = new Set<() => void>();
let snapshotVersion = 0;

function load(): DB {
  if (memory) return memory;
  if (typeof window === "undefined") return (memory = seed());
  try {
    const raw = window.localStorage.getItem(DB_KEY);
    memory = raw ? (JSON.parse(raw) as DB) : seed();
  } catch {
    memory = seed();
  }
  if (!window.localStorage.getItem(DB_KEY)) persist();
  return memory;
}

function persist() {
  if (typeof window === "undefined" || !memory) return;
  window.localStorage.setItem(DB_KEY, JSON.stringify(memory));
}

function emit() {
  snapshotVersion++;
  listeners.forEach((l) => l());
}

export function getDB(): DB {
  return load();
}

export function nextId(): number {
  const db = load();
  db.seq += 1;
  return db.seq;
}

export function update(mutator: (db: DB) => void) {
  const db = load();
  mutator(db);
  persist();
  emit();
}

export function resetDemoData() {
  memory = seed();
  persist();
  emit();
}

export function useDB(): DB {
  useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => snapshotVersion,
    () => 0,
  );
  return load();
}

/* ------------------------------ audit + api log ------------------------------ */

export function audit(
  action: string,
  resource: string,
  details: Record<string, unknown> = {},
) {
  const s = getSession();
  update((db) => {
    db.seq += 1;
    db.audit.unshift({
      id: db.seq,
      user_id: s?.userId ?? null,
      user_type: s?.role ?? "system",
      action,
      resource,
      timestamp: new Date().toISOString(),
      details,
    });
  });
}

export function logApiCall(method: string, url: string, request: unknown, response: unknown) {
  update((db) => {
    db.seq += 1;
    db.apiLog.unshift({
      id: db.seq,
      method,
      url,
      request,
      response,
      timestamp: new Date().toISOString(),
    });
  });
}

/* --------------------------------- session --------------------------------- */

const sessionListeners = new Set<() => void>();
let sessionVersion = 0;

export function getSession(): Session | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const s = JSON.parse(raw) as Session;
    if (Date.now() - s.lastActivity > SESSION_TIMEOUT_MS) {
      window.localStorage.removeItem(SESSION_KEY);
      return null;
    }
    return s;
  } catch {
    return null;
  }
}

export function setSession(s: Session | null) {
  if (typeof window === "undefined") return;
  if (s) window.localStorage.setItem(SESSION_KEY, JSON.stringify(s));
  else window.localStorage.removeItem(SESSION_KEY);
  sessionVersion++;
  sessionListeners.forEach((l) => l());
}

export function touchSession() {
  const s = getSession();
  if (s) {
    s.lastActivity = Date.now();
    if (typeof window !== "undefined")
      window.localStorage.setItem(SESSION_KEY, JSON.stringify(s));
  }
}

export function useSession(): Session | null {
  return useSyncExternalStore(
    (cb) => {
      sessionListeners.add(cb);
      return () => sessionListeners.delete(cb);
    },
    () => {
      const s = getSession();
      return s ? `${s.role}:${s.userId}:${sessionVersion}` : `none:${sessionVersion}`;
    },
    () => "ssr",
  ) === "ssr"
    ? null
    : getSession();
}

/* ------------------------------ access control ------------------------------ */

export function canAccessClient(session: Session | null, clientId: number): boolean {
  if (!session) return false;
  if (session.role === "admin") return true;
  if (session.role === "client") return session.userId === clientId;
  const client = getDB().clients.find((c) => c.id === clientId);
  return !!client && client.adviser_id === session.userId;
}

/* --------------------------------- helpers --------------------------------- */

export function netWorth(clientId: number): number {
  return getDB()
    .policies.filter((p) => p.client_id === clientId)
    .reduce((sum, p) => sum + p.value, 0);
}

export function formatZAR(n: number): string {
  return "R" + Math.round(n).toLocaleString("en-ZA");
}

export function reminderStatus(due: string): "overdue" | "soon" | "pending" {
  const diff = (new Date(due).getTime() - Date.now()) / day;
  if (diff < 0) return "overdue";
  if (diff <= 7) return "soon";
  return "pending";
}

export const REMINDER_LABELS: Record<string, string> = {
  licence_expiry: "Driving licence expiry",
  valuation_cert: "Valuation certificate",
  annual_review: "Annual review meeting",
  retirement_fee: "Retirement fee renewal",
  birthday: "Birthday / anniversary",
};

export const CLAIM_STAGES: { key: ClaimStatus; label: string }[] = [
  { key: "submitted", label: "Submitted" },
  { key: "processing", label: "Processing" },
  { key: "assessment_scheduled", label: "Assessment scheduled" },
  { key: "under_assessment", label: "Under assessment" },
  { key: "quote_received", label: "Repair quote received" },
  { key: "repair_authorised", label: "Repair authorised" },
  { key: "repair_in_progress", label: "Repair in progress" },
  { key: "completed", label: "Completed" },
];

export function role Label(): void {}
