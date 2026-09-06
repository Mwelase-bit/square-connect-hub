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
      if (status === "processing" && !claim.claim_number) claim.claim_number = claimNumberFor(claim.id);
    }
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

  const number = claimNumberFor(claim.id);
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
    claim_number: number,
    handler: "Nomsa Zulu (Motor Claims)",
    sla_hours: 48,
    next_steps: ["Assessment will be scheduled", "Keep the vehicle available for inspection"],
  };
  logApiCall("POST", `https://api.mock-${claim.insurer.toLowerCase().replace(/\s/g, "")}.com/claims/submit`, request, response);

  // Simulated insurer workflow.
  const steps: [number, ClaimStatus, string][] = [
    [400, "processing", `Claim number ${number} assigned. Handler: Nomsa Zulu.`],
    [900, "assessment_scheduled", `Assessment scheduled for ${new Date(Date.now() + 4 * 86400000).toLocaleDateString("en-ZA")}.`],
    [1400, "under_assessment", "Vehicle with assessor Pieter van Wyk (approved panel)."],
    [1900, "quote_received", "Repair quote received: R15,000 (paint, parts and labour)."],
    [2400, "repair_authorised", "Repair authorised by the insurer."],
    [2900, "repair_in_progress", "Week 1 update: parts ordered, bodywork 60% complete."],
  ];
  steps.forEach(([delay, status, message]) => {
    setTimeout(() => addStatus(claim.id, status, message), delay);
  });
}
