import { audit, getDB, logApiCall, update } from "./store";
import type { Claim, ClaimStatus } from "./types";

export const INSURERS = ["Santam", "Old Mutual", "Liberty", "Momentum", "Discovery", "Allan Gray"];

export function claimNumberFor(id: number) {
  const d = new Date();
  const stamp = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
  return `RSF-CLM-${stamp}-${String(id % 1000).padStart(3, "0")}`;
}

export function addStatus(claimId: number, status: ClaimStatus, message: string) {
  update((db) => {
    db.seq += 1;
    db.statusUpdates.push({
      id: db.seq,
      claim_id: claimId,
      status,
      message,
      timestamp: new Date().toISOString(),
    });
    const claim = db.claims.find((c) => c.id === claimId);
    if (claim) {
      claim.status = status;
      claim.updated_at = new Date().toISOString();
    }
  });
}

// Notifies the assigned adviser inside the app (appears on their Reminders
// tab) — the closest thing this prototype has to a push notification.
function notifyAdviser(clientId: number, adviserId: number, message: string) {
  update((db) => {
    db.seq += 1;
    db.reminders.push({
      id: db.seq,
      adviser_id: adviserId,
      client_id: clientId,
      reminder_type: "claim_update",
      // Due "tomorrow" rather than today so a fresh notification reads as
      // "due soon", not "overdue" the instant it's created.
      due_date: new Date(Date.now() + 86400000).toISOString().slice(0, 10),
      message,
      audience: "adviser",
      read: false,
      dismissed: false,
      created_at: new Date().toISOString(),
    });
  });
}

export function submitClaim(claim: Claim) {
  update((db) => {
    db.claims.push(claim);
    const c = db.clients.find((x) => x.id === claim.client_id);
    if (c) c.last_interaction = new Date().toISOString();
  });
  addStatus(claim.id, "submitted", "Claim submitted and digitally signed by the client.");
  audit("claim_submitted", "claim", { claimId: claim.id, insurer: claim.insurer });

  const request = {
    policy_holder: getDB().clients.find((c) => c.id === claim.client_id)?.name,
    id_number: getDB().clients.find((c) => c.id === claim.client_id)?.id_number,
    insurer: claim.insurer,
    incident_date: claim.incident_date,
    incident_time: claim.incident_time,
    description: claim.incident_description,
    police_case_number: claim.police_case_number || null,
    third_party: {
      name: claim.third_party_name,
      id_number: claim.third_party_id,
      insurer: claim.third_party_insurer,
      policy: claim.third_party_policy,
    },
    signature: { signed_by: claim.signed_by, signed_at: claim.signed_at },
  };
  const response = {
    status: 201,
    acknowledged: true,
    sla_hours: 48,
    next_steps: [
      "The insurer will contact you directly with your claim number and claims handler",
      "Keep the vehicle available for inspection",
    ],
  };
  logApiCall("POST", `https://api.mock-${claim.insurer.toLowerCase().replace(/\s/g, "")}.com/claims/submit`, request, response);

  // The insurer's own acknowledgement is the only step simulated automatically —
  // everything after this point (claim number, assessment, repair booking) is
  // entered by the client as it actually happens, matching how the insurer
  // really communicates it (phone/email), not a live provider integration.
  setTimeout(
    () => addStatus(claim.id, "processing", `${claim.insurer} has received your claim and is processing it.`),
    600,
  );
}

// Client records what the insurer told them once contacted — this app has no
// live insurer integration, so this is the record-of-truth for the claim
// number and handler.
export function recordClaimNumber(claimId: number, claimNumber: string, claimHandler: string) {
  update((db) => {
    const c = db.claims.find((x) => x.id === claimId);
    if (c) {
      c.claim_number = claimNumber.trim();
      c.claim_handler = claimHandler.trim();
    }
  });
  addStatus(claimId, "processing", `Claim number ${claimNumber.trim()} recorded. Handler: ${claimHandler.trim()}.`);
  audit("claim_number_recorded", "claim", { claimId, claimNumber, claimHandler });
}

// Client indicates they're taking the vehicle in for assessment — notifies
// Royal Square (adviser reminder) and the insurer (mock API call), then the
// insurer-side assessment/quote/authorisation steps play out automatically
// since those aren't actions the client or adviser take in the app.
export function scheduleAssessment(claimId: number, date: string, time: string) {
  const claim = getDB().claims.find((c) => c.id === claimId);
  if (!claim) return;
  update((db) => {
    const c = db.claims.find((x) => x.id === claimId);
    if (c) {
      c.assessment_date = date;
      c.assessment_time = time;
    }
  });
  addStatus(claimId, "assessment_scheduled", `Vehicle booked in for assessment on ${date} at ${time}.`);
  audit("assessment_scheduled", "claim", { claimId, date, time });
  logApiCall(
    "POST",
    `https://api.mock-${claim.insurer.toLowerCase().replace(/\s/g, "")}.com/claims/${claimId}/assessment`,
    { claim_number: claim.claim_number, assessment_date: date, assessment_time: time },
    { status: 200, acknowledged: true },
  );

  const client = getDB().clients.find((c) => c.id === claim.client_id);
  if (client) notifyAdviser(client.id, client.adviser_id, `Client booked their vehicle in for assessment on ${date} at ${time} (claim ${claim.claim_number ?? "#" + claim.id}).`);

  const steps: [number, ClaimStatus, string][] = [
    [1000, "under_assessment", "Vehicle with assessor (approved panel)."],
    [2000, "quote_received", "Repair quote received from the assessor."],
    [3000, "repair_authorised", "Repair authorised by the insurer. You can now book your vehicle in for repair."],
  ];
  steps.forEach(([delay, status, message]) => {
    setTimeout(() => addStatus(claimId, status, message), delay);
  });
}

// Client specifies when the car goes in for repair — this is also the point
// where car hire options become relevant, so the caller (UI) shows the
// suggested hire providers once this is set.
export function scheduleRepair(claimId: number, date: string, time: string) {
  const claim = getDB().claims.find((c) => c.id === claimId);
  if (!claim) return;
  update((db) => {
    const c = db.claims.find((x) => x.id === claimId);
    if (c) {
      c.repair_date = date;
      c.repair_time = time;
    }
  });
  addStatus(claimId, "repair_in_progress", `Vehicle booked in for repair on ${date} at ${time}.`);
  audit("repair_scheduled", "claim", { claimId, date, time });
  const client = getDB().clients.find((c) => c.id === claim.client_id);
  if (client) notifyAdviser(client.id, client.adviser_id, `Client booked their vehicle in for repair on ${date} at ${time} (claim ${claim.claim_number ?? "#" + claim.id}).`);
}

// Adviser posts the repairer's weekly progress update — appears live in the
// client's claim timeline.
export function postRepairUpdate(claimId: number, message: string) {
  addStatus(claimId, "repair_in_progress", message.trim());
  audit("repair_update_posted", "claim", { claimId });
}

export function completeClaim(claimId: number) {
  addStatus(claimId, "completed", "Repair complete. Vehicle collected and hire car returned — claim closed.");
  audit("claim_completed", "claim", { claimId });
}
