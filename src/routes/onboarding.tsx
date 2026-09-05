import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { AppShell, Card, btn, btnGhost, input, label } from "@/components/AppShell";
import { FORM_TYPES, audit, getDB, nextId, update, useDB, useSession } from "@/lib/store";
import { buildPdf, downloadPdf } from "@/lib/pdf";
import type { FormType, OnboardingForm } from "@/lib/types";

export const Route = createFileRoute("/onboarding")({
  head: () => ({
    meta: [
      { title: "Onboarding documents — Royal Square Financial" },
      { name: "description", content: "Complete and digitally sign your Royal Square Financial onboarding documents." },
      { property: "og:title", content: "Onboarding documents — Royal Square Financial" },
      { property: "og:description", content: "Digital-first onboarding: sign your broker appointment, FAIS disclosure and consent forms online." },
    ],
  }),
  component: () => (
    <AppShell allow={["client"]}>
      <OnboardingPage />
    </AppShell>
  ),
});

const FORM_BLURB: Record<FormType, string> = {
  "Confidentiality Agreement": "How we keep your personal and financial information private.",
  "Broker Appointment": "Appoints Royal Square Financial as your broker with your insurers.",
  "Client Consent": "Your POPIA consent for processing and communication preferences.",
  "FAIS Disclosure": "Regulatory disclosure required by the FAIS Act.",
  "Service Agreement": "What we deliver, how often we review, and our fees.",
  "Privacy Policy & T&Cs": "Our privacy policy and portal terms and conditions.",
};

function OnboardingPage() {
  const db = useDB();
  const session = useSession()!;
  const [openForm, setOpenForm] = useState<FormType | null>(null);

  const client = db.clients.find((c) => c.id === session.userId);
  const forms = db.forms.filter((f) => f.client_id === session.userId);
  const signedCount = forms.filter((f) => f.signed).length;
  const status =
    signedCount === 0 ? "Incomplete" : signedCount < FORM_TYPES.length ? "In progress" : "Completed";

  if (!client) return <p>Client record not found.</p>;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold">Onboarding documents</h1>
        <p className="text-sm text-muted-foreground">
          Status: <strong>{status}</strong> — {signedCount} of {FORM_TYPES.length} documents signed.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {FORM_TYPES.map((type) => {
          const existing = forms.find((f) => f.form_type === type);
          return (
            <Card key={type} title={type}>
              <p className="text-sm text-muted-foreground">{FORM_BLURB[type]}</p>
              {existing?.signed ? (
                <div className="mt-3 space-y-2">
                  <p className="rounded-md bg-accent px-3 py-2 text-sm font-medium text-accent-foreground">
                    ✓ Signed on {new Date(existing.signed_at!).toLocaleDateString("en-ZA")} at{" "}
                    {new Date(existing.signed_at!).toLocaleTimeString("en-ZA", { hour: "2-digit", minute: "2-digit" })}
                  </p>
                  <button
                    className={btnGhost}
                    onClick={async () => {
                      const pdf = existing.pdf_base64 ?? (await regeneratePdf(existing));
                      downloadPdf(pdf, `${type.replace(/\W+/g, "-")}.pdf`);
                      audit("document_downloaded", "onboarding", { form: type });
                    }}
                  >
                    Download PDF
                  </button>
                </div>
              ) : (
                <button className={btn + " mt-3"} onClick={() => setOpenForm(type)}>
                  Fill in and sign
                </button>
              )}
            </Card>
          );
        })}
      </div>

      {openForm && (
        <FormDialog
          type={openForm}
          onClose={() => setOpenForm(null)}
        />
      )}
    </div>
  );
}

async function regeneratePdf(form: OnboardingForm) {
  return buildPdf(form.form_type, [
    ...Object.entries(form.data).map(([k, v]) => `${k.replace(/_/g, " ")}: ${String(v)}`),
    `Signed electronically on ${form.signed_at}`,
  ]);
}

function FormDialog({ type, onClose }: { type: FormType; onClose: () => void }) {
  const session = useSession()!;
  const db = getDB();
  const client = db.clients.find((c) => c.id === session.userId)!;
  const [values, setValues] = useState<Record<string, string>>({
    full_name: client.name,
    email: client.email,
    phone: client.phone,
    address: client.address,
    city: client.city,
    postal_code: client.postal_code,
    id_number: client.id_number,
    adviser: db.advisers.find((a) => a.id === client.adviser_id)?.name ?? "Qiniso Ntuli",
    comms_preference: "Email",
  });
  const [popia, setPopia] = useState(false);
  const [comms, setComms] = useState(false);
  const [signed, setSigned] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const set = (k: string, v: string) => setValues((p) => ({ ...p, [k]: v }));

  const submit = async () => {
    if (!values.full_name || !values.email || !values.phone || !values.id_number) {
      setError("Name, email, phone and ID number are required.");
      return;
    }
    if (!popia || !comms || !signed) {
      setError("Please tick all three confirmations, including the electronic signature.");
      return;
    }
    setBusy(true);
    const now = new Date();
    const data = { ...values, popia_consent: true, comms_consent: true, date_of_agreement: now.toISOString().slice(0, 10) };
    const pdf = await buildPdf(type, [
      ...Object.entries(data).map(([k, v]) => `${k.replace(/_/g, " ")}: ${String(v)}`),
      "",
      `Signed electronically by ${values.full_name} (user ID ${session.userId})`,
      `Timestamp: ${now.toLocaleString("en-ZA")}`,
    ]);

    update((db) => {
      db.seq += 1;
      const existing = db.forms.find((f) => f.client_id === session.userId && f.form_type === type);
      if (existing) {
        existing.data = data;
        existing.signed = true;
        existing.signed_at = now.toISOString();
        existing.pdf_base64 = pdf;
      } else {
        db.forms.push({
          id: db.seq,
          client_id: session.userId,
          form_type: type,
          data,
          signed: true,
          signed_at: now.toISOString(),
          pdf_base64: pdf,
        });
      }
      // Auto-extract key data into the client profile — no manual re-entry.
      const c = db.clients.find((x) => x.id === session.userId)!;
      c.name = values.full_name!;
      c.email = values.email!;
      c.phone = values.phone!;
      c.address = values.address ?? "";
      c.city = values.city ?? "";
      c.postal_code = values.postal_code ?? "";
      c.id_number = values.id_number!;
      c.last_interaction = now.toISOString();
      c.profile_complete =
        db.forms.filter((f) => f.client_id === session.userId && f.signed).length >= FORM_TYPES.length;
    });
    audit("form_submitted", "onboarding", { form: type });
    setBusy(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-4">
      <div className="card-surface my-6 w-full max-w-2xl p-6">
        <h2 className="text-lg font-bold">{type}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{FORM_BLURB[type]}</p>

        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <Field id="full_name" title="Full name" value={values.full_name!} onChange={set} />
          <Field id="email" title="Email" value={values.email!} onChange={set} />
          <Field id="phone" title="Phone" value={values.phone!} onChange={set} />
          <Field id="id_number" title="ID number" value={values.id_number!} onChange={set} />
          <Field id="address" title="Street address" value={values.address ?? ""} onChange={set} />
          <Field id="city" title="City" value={values.city ?? ""} onChange={set} />
          <Field id="postal_code" title="Postal code" value={values.postal_code ?? ""} onChange={set} />
          <div>
            <label className={label} htmlFor="adviser">Adviser assigned</label>
            <select id="adviser" className={input} value={values.adviser} onChange={(e) => set("adviser", e.target.value)}>
              {getDB().advisers.map((a) => (
                <option key={a.id}>{a.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={label} htmlFor="comms_preference">Preferred communication</label>
            <select id="comms_preference" className={input} value={values.comms_preference} onChange={(e) => set("comms_preference", e.target.value)}>
              <option>Email</option>
              <option>Phone call</option>
              <option>WhatsApp</option>
              <option>SMS</option>
            </select>
          </div>
        </div>

        <div className="mt-5 space-y-3 rounded-md bg-muted p-4 text-sm">
          <label className="flex items-start gap-3">
            <input type="checkbox" className="mt-1 h-5 w-5" checked={popia} onChange={(e) => setPopia(e.target.checked)} />
            <span>I consent to Royal Square Financial processing my personal information in terms of POPIA.</span>
          </label>
          <label className="flex items-start gap-3">
            <input type="checkbox" className="mt-1 h-5 w-5" checked={comms} onChange={(e) => setComms(e.target.checked)} />
            <span>I consent to being contacted using my preferred communication channel.</span>
          </label>
          <label className="flex items-start gap-3">
            <input type="checkbox" className="mt-1 h-5 w-5" checked={signed} onChange={(e) => setSigned(e.target.checked)} />
            <span>
              <strong>I agree and sign electronically.</strong> My name, user ID and the current date and time will be
              captured as my signature.
            </span>
          </label>
        </div>

        {error && <p className="mt-3 text-sm font-medium text-danger">{error}</p>}

        <div className="mt-5 flex flex-wrap gap-3">
          <button className={btn} disabled={busy} onClick={submit}>
            {busy ? "Generating PDF…" : "Sign and submit"}
          </button>
          <button className={btnGhost} onClick={onClose}>Cancel</button>
        </div>
      </div>
    </div>
  );
}

function Field({
  id,
  title,
  value,
  onChange,
}: {
  id: string;
  title: string;
  value: string;
  onChange: (k: string, v: string) => void;
}) {
  return (
    <div>
      <label className={label} htmlFor={id}>{title}</label>
      <input id={id} className={input} value={value} onChange={(e) => onChange(id, e.target.value)} />
    </div>
  );
}

export { nextId };
