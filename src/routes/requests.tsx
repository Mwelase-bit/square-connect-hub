import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { AppShell, Card, btn, btnGhost, input, label } from "@/components/AppShell";
import { downloadPdf } from "@/lib/pdf";
import {
  REQUEST_STATUS_LABEL,
  SELECTABLE_REQUEST_TYPES,
  decideRequest,
  requestTypeConfig,
  submitRequest,
} from "@/lib/requests";
import { useDB, useSession } from "@/lib/store";
import type { RequestType, ServiceRequest } from "@/lib/types";

export const Route = createFileRoute("/requests")({
  head: () => ({
    meta: [
      { title: "Service requests — Royal Square Financial" },
      {
        name: "description",
        content: "Request address and bank detail changes, documents and consultations.",
      },
      { property: "og:title", content: "Service requests — Royal Square Financial" },
      {
        property: "og:description",
        content: "Submit and track requests for documents, changes and consultations.",
      },
    ],
  }),
  component: () => (
    <AppShell>
      <RequestsPage />
    </AppShell>
  ),
});

const STATUS_BADGE: Record<string, string> = {
  pending: "bg-warning/15 text-warning",
  approved: "bg-accent text-accent-foreground",
  rejected: "bg-danger/15 text-danger",
  completed: "bg-success/15 text-success",
};

function RequestsPage() {
  const db = useDB();
  const session = useSession()!;
  const isClient = session.role === "client";
  const [showForm, setShowForm] = useState(false);

  const visible = isClient
    ? db.requests.filter((r) => r.client_id === session.userId)
    : db.requests.filter((r) => {
        if (session.role === "admin") return true;
        const client = db.clients.find((c) => c.id === r.client_id);
        return client?.adviser_id === session.userId;
      });

  const sorted = [...visible].sort((a, b) => b.created_at.localeCompare(a.created_at));

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Service requests</h1>
          <p className="text-sm font-medium text-muted-foreground">
            {isClient
              ? "Address and bank changes, documents and consultations."
              : "Requests raised by your clients."}
          </p>
        </div>
        {isClient && (
          <button className={btn} onClick={() => setShowForm((s) => !s)}>
            {showForm ? "Cancel" : "New request"}
          </button>
        )}
      </div>

      {isClient && showForm && <NewRequestForm onDone={() => setShowForm(false)} />}

      <div className="grid gap-4 md:grid-cols-2">
        {sorted.length === 0 && <p className="text-sm text-muted-foreground">No requests yet.</p>}
        {sorted.map((r) => (
          <RequestCard key={r.id} request={r} isClient={isClient} clientName={db.clients.find((c) => c.id === r.client_id)?.name} />
        ))}
      </div>
    </div>
  );
}

function RequestCard({
  request,
  isClient,
  clientName,
}: {
  request: ServiceRequest;
  isClient: boolean;
  clientName?: string | undefined;
}) {
  const config = requestTypeConfig(request.request_type);
  const [note, setNote] = useState("");

  return (
    <Card title={config.label}>
      {!isClient && clientName && <p className="text-sm text-muted-foreground">{clientName}</p>}
      <div className="mt-1 flex flex-wrap items-center gap-2">
        <span className={"rounded-full px-2 py-1 text-xs font-bold " + STATUS_BADGE[request.status]}>
          {REQUEST_STATUS_LABEL[request.status]}
        </span>
        {request.high_risk && (
          <span className="rounded-full bg-muted px-2 py-1 text-xs font-semibold text-muted-foreground">
            Verified
          </span>
        )}
      </div>
      <dl className="mt-3 space-y-1 text-sm">
        {config.fields.map((f) => (
          <div key={f.key} className="flex gap-2">
            <dt className="w-40 shrink-0 text-muted-foreground">{f.label}</dt>
            <dd className="font-medium">{request.details[f.key] || "—"}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-2 text-xs text-muted-foreground">
        Submitted {new Date(request.created_at).toLocaleString("en-ZA")}
      </p>
      {request.adviser_note && (
        <p className="mt-2 rounded-md bg-muted p-2 text-sm">
          <span className="font-semibold">Adviser note: </span>
          {request.adviser_note}
        </p>
      )}
      {request.document_base64 && (
        <button
          className={btnGhost + " mt-3"}
          onClick={() => downloadPdf(request.document_base64!, `${config.key}-${request.id}.pdf`)}
        >
          Download document
        </button>
      )}
      {!isClient && request.status === "pending" && (
        <div className="mt-4 space-y-2 border-t border-border pt-3">
          <label className={label} htmlFor={`note-${request.id}`}>
            Note (optional)
          </label>
          <textarea
            id={`note-${request.id}`}
            className={input}
            rows={2}
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
          <div className="flex gap-2">
            <button className={btn} onClick={() => decideRequest(request.id, "approved", note)}>
              Approve
            </button>
            <button
              className="rounded-md border border-danger px-4 py-3 text-sm font-bold text-danger hover:bg-danger/10"
              onClick={() => decideRequest(request.id, "rejected", note)}
            >
              Reject
            </button>
          </div>
        </div>
      )}
    </Card>
  );
}

function NewRequestForm({ onDone }: { onDone: () => void }) {
  const db = useDB();
  const session = useSession()!;
  const client = db.clients.find((c) => c.id === session.userId)!;
  const [type, setType] = useState<RequestType>(SELECTABLE_REQUEST_TYPES[0]!.key);
  const [values, setValues] = useState<Record<string, string>>(() => {
    const cfg = requestTypeConfig(SELECTABLE_REQUEST_TYPES[0]!.key);
    const defaults: Record<string, string> = {};
    for (const f of cfg.fields) {
      if (f.type === "select" && f.options && f.options.length > 0) defaults[f.key] = f.options[0]!;
    }
    return defaults;
  });
  const [error, setError] = useState("");

  const [verifying, setVerifying] = useState(false);
  const [sentCode, setSentCode] = useState("");
  const [enteredCode, setEnteredCode] = useState("");

  const config = requestTypeConfig(type);

  const changeType = (t: RequestType) => {
    setType(t);
    const cfg = requestTypeConfig(t);
    const defaults: Record<string, string> = {};
    for (const f of cfg.fields) {
      if (f.type === "select" && f.options && f.options.length > 0) defaults[f.key] = f.options[0]!;
    }
    setValues(defaults);
    setError("");
    setVerifying(false);
    setEnteredCode("");
  };

  const setField = (key: string, v: string) => setValues((p) => ({ ...p, [key]: v }));

  const missingFields = config.fields.filter((f) => !f.optional && !values[f.key]?.trim());

  const finalizeSubmit = (stepUpVerified: boolean) => {
    submitRequest({
      clientId: client.id,
      adviserId: client.adviser_id,
      type,
      details: values,
      stepUpVerified,
    });
    onDone();
  };

  const startSubmit = () => {
    if (missingFields.length > 0) {
      setError("Please complete all fields before submitting.");
      return;
    }
    setError("");
    if (config.highRisk) {
      const code = String(Math.floor(100000 + Math.random() * 900000));
      setSentCode(code);
      setVerifying(true);
      return;
    }
    finalizeSubmit(false);
  };

  const confirmVerification = () => {
    if (enteredCode.trim() !== sentCode) {
      setError("That verification code doesn't match.");
      return;
    }
    finalizeSubmit(true);
  };

  return (
    <Card title="New request">
      <div className="grid gap-4 md:grid-cols-2">
        <div className="md:col-span-2">
          <label className={label} htmlFor="request_type">
            Request type
          </label>
          <select
            id="request_type"
            className={input}
            value={type}
            onChange={(e) => changeType(e.target.value as RequestType)}
          >
            {SELECTABLE_REQUEST_TYPES.map((t) => (
              <option key={t.key} value={t.key}>
                {t.label}
              </option>
            ))}
          </select>
          <p className="mt-1 text-sm font-medium text-muted-foreground">{config.description}</p>
        </div>

        {!verifying &&
          config.fields.map((f) => (
            <div key={f.key} className={f.type === "textarea" ? "md:col-span-2" : undefined}>
              <label className={label} htmlFor={f.key}>
                {f.label}
              </label>
              {f.type === "textarea" ? (
                <textarea
                  id={f.key}
                  className={input}
                  rows={3}
                  value={values[f.key] ?? ""}
                  onChange={(e) => setField(f.key, e.target.value)}
                />
              ) : f.type === "select" ? (
                <select
                  id={f.key}
                  className={input}
                  value={values[f.key] ?? f.options?.[0] ?? ""}
                  onChange={(e) => setField(f.key, e.target.value)}
                >
                  {f.options?.map((o) => (
                    <option key={o} value={o}>
                      {o}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  id={f.key}
                  type={f.type === "date" ? "date" : "text"}
                  className={input}
                  value={values[f.key] ?? ""}
                  onChange={(e) => setField(f.key, e.target.value)}
                  placeholder={f.placeholder}
                />
              )}
            </div>
          ))}
      </div>

      {verifying && (
        <div className="mt-4 space-y-3 rounded-md border border-border p-4">
          <p className="text-sm font-medium">
            This change needs step-up verification. A verification code was sent to{" "}
            <strong>{client.email}</strong>: <strong className="font-bold">{sentCode}</strong>
          </p>
          <div>
            <label className={label} htmlFor="verify_code">
              Verification code
            </label>
            <input
              id="verify_code"
              className={input}
              value={enteredCode}
              onChange={(e) => setEnteredCode(e.target.value)}
              inputMode="numeric"
            />
          </div>
        </div>
      )}

      {error && <p className="mt-3 text-sm font-medium text-danger">{error}</p>}

      <div className="mt-4 flex gap-3">
        {!verifying ? (
          <button className={btn} onClick={startSubmit}>
            {config.highRisk ? "Continue to verification" : "Submit request"}
          </button>
        ) : (
          <button className={btn} onClick={confirmVerification}>
            Verify and submit
          </button>
        )}
        <button className={btnGhost} onClick={onDone}>
          Cancel
        </button>
      </div>
    </Card>
  );
}
