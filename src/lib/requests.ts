import { buildPdf } from "./pdf";
import { audit, getDB, logApiCall, update } from "./store";
import type { RequestStatus, RequestType, ServiceRequest } from "./types";

export interface RequestField {
  key: string;
  label: string;
  type?: "text" | "textarea" | "date";
  placeholder?: string;
}

export interface RequestTypeConfig {
  key: RequestType;
  label: string;
  description: string;
  highRisk: boolean;
  autoComplete: boolean;
  fields: RequestField[];
}

export const REQUEST_TYPES: RequestTypeConfig[] = [
  {
    key: "address_change",
    label: "Change of address",
    description: "Update your registered residential address on file.",
    highRisk: true,
    autoComplete: false,
    fields: [
      { key: "address", label: "New street address" },
      { key: "city", label: "City" },
      { key: "postal_code", label: "Postal code" },
    ],
  },
  {
    key: "bank_details_change",
    label: "Change of bank details",
    description: "Update the bank account used for premiums and payouts.",
    highRisk: true,
    autoComplete: false,
    fields: [
      { key: "bank_name", label: "Bank name" },
      { key: "bank_account_number", label: "Account number" },
      { key: "bank_branch_code", label: "Branch code" },
    ],
  },
  {
    key: "policy_document",
    label: "Request a policy document",
    description: "Get a copy of a policy schedule or certificate.",
    highRisk: false,
    autoComplete: true,
    fields: [{ key: "policy_reference", label: "Policy or product name" }],
  },
  {
    key: "border_letter",
    label: "Request a border letter",
    description: "A letter of authority to take an insured vehicle across a border.",
    highRisk: false,
    autoComplete: true,
    fields: [
      { key: "destination_country", label: "Destination country" },
      { key: "travel_date", label: "Travel date", type: "date" },
    ],
  },
  {
    key: "irp5_request",
    label: "Request an IRP5",
    description: "Request an IRP5 tax certificate from your investment provider.",
    highRisk: false,
    autoComplete: true,
    fields: [{ key: "tax_year", label: "Tax year (e.g. 2025/2026)" }],
  },
  {
    key: "consultation_request",
    label: "Request a consultation",
    description: "Ask your adviser to schedule a meeting or call.",
    highRisk: false,
    autoComplete: false,
    fields: [
      { key: "preferred_date", label: "Preferred date", type: "date" },
      { key: "topic", label: "What would you like to discuss?", type: "textarea" },
    ],
  },
  {
    key: "financial_info",
    label: "Submit balance sheet & income statement",
    description: "Share your latest financial position for your adviser's records.",
    highRisk: false,
    autoComplete: true,
    fields: [{ key: "notes", label: "Notes for your adviser", type: "textarea" }],
  },
];

export function requestTypeConfig(type: RequestType): RequestTypeConfig {
  return REQUEST_TYPES.find((t) => t.key === type)!;
}

// Address and bank detail changes are no longer offered when creating a new
// request, but they stay in REQUEST_TYPES above so existing records of those
// types still display correctly.
const HIDDEN_FROM_NEW_REQUEST: RequestType[] = ["address_change", "bank_details_change"];
export const SELECTABLE_REQUEST_TYPES = REQUEST_TYPES.filter((t) => !HIDDEN_FROM_NEW_REQUEST.includes(t.key));

export const REQUEST_STATUS_LABEL: Record<RequestStatus, string> = {
  pending: "Pending",
  approved: "Approved",
  rejected: "Rejected",
  completed: "Completed",
};

async function generateDocument(config: RequestTypeConfig, details: Record<string, string>, clientName: string) {
  const lines = [
    `Client: ${clientName}`,
    ...config.fields.map((f) => `${f.label}: ${details[f.key] || "—"}`),
    "",
    `Generated automatically on ${new Date().toLocaleString("en-ZA")}.`,
  ];
  return buildPdf(config.label, lines);
}

export function submitRequest(input: {
  clientId: number;
  adviserId: number;
  type: RequestType;
  details: Record<string, string>;
  stepUpVerified: boolean;
}) {
  const config = requestTypeConfig(input.type);
  const id = (() => {
    let next = 0;
    update((db) => {
      db.seq += 1;
      next = db.seq;
    });
    return next;
  })();

  const now = new Date().toISOString();
  const request: ServiceRequest = {
    id,
    client_id: input.clientId,
    adviser_id: input.adviserId,
    request_type: input.type,
    status: "pending",
    high_risk: config.highRisk,
    step_up_verified: input.stepUpVerified,
    details: input.details,
    adviser_note: "",
    document_base64: null,
    created_at: now,
    updated_at: now,
  };

  update((db) => {
    db.requests.push(request);
  });
  audit("request_submitted", "service_request", { requestId: id, type: input.type });

  const client = getDB().clients.find((c) => c.id === input.clientId);
  logApiCall(
    "POST",
    `https://api.mock-royalsquare.co.za/requests/${input.type}`,
    { client_id: input.clientId, ...input.details },
    { status: 202, request_id: id },
  );

  if (config.autoComplete && client) {
    void generateDocument(config, input.details, client.name).then((pdf) => {
      update((db) => {
        const r = db.requests.find((x) => x.id === id);
        if (r) {
          r.status = "completed";
          r.document_base64 = pdf;
          r.updated_at = new Date().toISOString();
        }
      });
      audit("request_completed", "service_request", { requestId: id, type: input.type });
    });
  }

  return id;
}

export function decideRequest(requestId: number, status: RequestStatus, note: string) {
  update((db) => {
    const r = db.requests.find((x) => x.id === requestId);
    if (!r) return;
    r.status = status;
    r.adviser_note = note.trim();
    r.updated_at = new Date().toISOString();

    if (status === "approved" && r.request_type === "address_change") {
      const c = db.clients.find((x) => x.id === r.client_id);
      if (c) {
        c.address = r.details["address"] ?? c.address;
        c.city = r.details["city"] ?? c.city;
        c.postal_code = r.details["postal_code"] ?? c.postal_code;
        c.last_interaction = new Date().toISOString();
      }
      r.status = "completed";
    }
    if (status === "approved" && r.request_type === "bank_details_change") {
      const c = db.clients.find((x) => x.id === r.client_id);
      if (c) {
        c.bank_name = r.details["bank_name"] ?? c.bank_name;
        c.bank_account_number = r.details["bank_account_number"] ?? c.bank_account_number;
        c.bank_branch_code = r.details["bank_branch_code"] ?? c.bank_branch_code;
        c.last_interaction = new Date().toISOString();
      }
      r.status = "completed";
    }
    if (status === "approved" && r.request_type === "consultation_request") {
      r.status = "completed";
    }
  });
  audit("request_decided", "service_request", { requestId, status });
}
