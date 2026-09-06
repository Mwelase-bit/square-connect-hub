import { audit, update } from "./store";
import type { IncidentAlert } from "./types";

// The requirements doc specifies a 3-minute press-and-hold, but notes the duration
// should be configurable and may need to be shorter in practice — 3s here.
export const PANIC_HOLD_SECONDS = 3;

export function activateIncident(clientId: number, adviserId: number): number {
  let id = 0;
  update((db) => {
    db.seq += 1;
    id = db.seq;
    const incident: IncidentAlert = {
      id,
      client_id: clientId,
      adviser_id: adviserId,
      status: "active",
      activated_at: new Date().toISOString(),
      acknowledged_at: null,
      resolved_at: null,
    };
    db.incidents.push(incident);
  });
  audit("panic_alert_activated", "incident", { incidentId: id, clientId });
  return id;
}

export function acknowledgeIncident(id: number) {
  update((db) => {
    const inc = db.incidents.find((i) => i.id === id);
    if (inc) {
      inc.status = "acknowledged";
      inc.acknowledged_at = new Date().toISOString();
    }
  });
  audit("incident_acknowledged", "incident", { incidentId: id });
}

export function resolveIncident(id: number) {
  update((db) => {
    const inc = db.incidents.find((i) => i.id === id);
    if (inc) {
      inc.status = "resolved";
      inc.resolved_at = new Date().toISOString();
    }
  });
  audit("incident_resolved", "incident", { incidentId: id });
}
