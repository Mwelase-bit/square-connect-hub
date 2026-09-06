import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { AppShell, Card, btn, btnGhost, input, label } from "@/components/AppShell";
import { INSURERS, submitClaim } from "@/lib/claims";
import { confidenceClass, runOcr, type ExtractedField } from "@/lib/ocr";
import { buildPdf } from "@/lib/pdf";
import { getDB, nextId, update, useSession } from "@/lib/store";
import { rankTowProviders } from "@/lib/towing";
import type { Claim, ClaimAttachment } from "@/lib/types";

export const Route = createFileRoute("/claims/new")({
  head: () => ({
    meta: [
      { title: "Register a motor claim — Royal Square Financial" },
      {
        name: "description",
        content:
          "Register a motor claim with document upload, OCR extraction and digital signature.",
      },
      { property: "og:title", content: "Register a motor claim — Royal Square Financial" },
      {
        property: "og:description",
        content: "Digital motor claim registration with AI-assisted data capture.",
      },
    ],
  }),
  component: () => (
    <AppShell allow={["client"]}>
      <NewClaimPage />
    </AppShell>
  ),
});

type Step = 2 | 3 | 4;

interface SlotState {
  key: string;
  title: string;
  ocr: boolean;
  fileName?: string;
  dataUrl?: string;
  text?: string;
  fields?: ExtractedField[];
  confirmed?: boolean;
  loading?: boolean;
}

const SLOTS: { key: string; title: string; ocr: boolean }[] = [
  { key: "photos_vehicle", title: "Photos of vehicles & damage", ocr: false },
  { key: "photos_road", title: "Photos of the road surface", ocr: false },
  { key: "licence_plates", title: "Licence plates & registration discs", ocr: true },
  { key: "drivers_licence", title: "Driver's licence photo", ocr: true },
  { key: "id_documents", title: "ID documents", ocr: true },
  { key: "accident_sketch", title: "Accident sketch (upload or placeholder)", ocr: false },
];

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function NewClaimPage() {
  const navigate = useNavigate();
  const session = useSession()!;
  const [step, setStep] = useState<Step>(2);

  // Step 2 — claim details
  const [insurer, setInsurer] = useState(INSURERS[0]!);
  const [incidentDate, setIncidentDate] = useState("");
  const [incidentTime, setIncidentTime] = useState("");
  const [incidentDescription, setIncidentDescription] = useState("");
  const [policeNotified, setPoliceNotified] = useState(false);
  const [policeCaseNumber, setPoliceCaseNumber] = useState("");
  const [witnessName, setWitnessName] = useState("");
  const [witnessPhone, setWitnessPhone] = useState("");
  const [witnessStatement, setWitnessStatement] = useState(false);
  const [driver, setDriver] = useState<"client" | "other">("client");
  const [usage, setUsage] = useState<"personal" | "business">("personal");
  const [thirdPartyName, setThirdPartyName] = useState("");
  const [thirdPartyId, setThirdPartyId] = useState("");
  const [thirdPartyLicence, setThirdPartyLicence] = useState("");
  const [thirdPartyInsurer, setThirdPartyInsurer] = useState("");
  const [thirdPartyPolicy, setThirdPartyPolicy] = useState("");
  const [detailsError, setDetailsError] = useState("");

  // Step 3 — uploads & OCR
  const [slots, setSlots] = useState<Record<string, SlotState>>(
    Object.fromEntries(SLOTS.map((s) => [s.key, { ...s }])),
  );

  // Step 4 — signature
  const [agree, setAgree] = useState(false);
  const [signError, setSignError] = useState("");
  const [busy, setBusy] = useState(false);

  const db = getDB();
  const client = db.clients.find((c) => c.id === session.userId)!;
  const towProviders = rankTowProviders(client.city);

  const goDetailsNext = () => {
    if (!incidentDate || !incidentTime || !incidentDescription.trim()) {
      setDetailsError("Please provide the incident date, time and a description.");
      return;
    }
    if (policeNotified && !policeCaseNumber.trim()) {
      setDetailsError("Please provide a police case number, or uncheck police notification.");
      return;
    }
    setDetailsError("");
    setStep(3);
  };

  const handleFile = async (key: string, file: File) => {
    const dataUrl = await readAsDataUrl(file);
    const slotDef = SLOTS.find((s) => s.key === key)!;
    setSlots((prev) => {
      const { text: _text, fields: _fields, ...rest } = prev[key]!;
      return {
        ...prev,
        [key]: { ...rest, fileName: file.name, dataUrl, loading: slotDef.ocr, confirmed: false },
      };
    });
    if (!slotDef.ocr) return;
    const result = await runOcr(dataUrl, file.name);
    setSlots((prev) => ({
      ...prev,
      [key]: { ...prev[key]!, loading: false, text: result.text, fields: result.fields },
    }));
  };

  const updateField = (key: string, idx: number, value: string) => {
    setSlots((prev) => {
      const slot = prev[key]!;
      const fields = [...(slot.fields ?? [])];
      fields[idx] = { ...fields[idx]!, value };
      return { ...prev, [key]: { ...slot, fields } };
    });
  };

  const confirmSlot = (key: string) => {
    setSlots((prev) => ({ ...prev, [key]: { ...prev[key]!, confirmed: true } }));
  };

  const uploadedOcrSlots = Object.values(slots).filter((s) => s.ocr && s.dataUrl);
  const allOcrConfirmed = uploadedOcrSlots.every((s) => s.confirmed);

  const submit = async () => {
    if (!agree) {
      setSignError("Please tick the box to sign electronically before submitting.");
      return;
    }
    setBusy(true);
    const id = nextId();
    const now = new Date();
    const claim: Claim = {
      id,
      client_id: client.id,
      claim_number: null,
      claim_handler: "",
      claim_type: "motor",
      insurer,
      status: "submitted",
      assessment_date: "",
      assessment_time: "",
      repair_date: "",
      repair_time: "",
      incident_date: incidentDate,
      incident_time: incidentTime,
      incident_description: incidentDescription.trim(),
      police_notified: policeNotified,
      police_case_number: policeNotified ? policeCaseNumber.trim() : "",
      witness_name: witnessName.trim(),
      witness_phone: witnessPhone.trim(),
      witness_statement: witnessStatement,
      driver: driver === "client" ? client.name : "Other person",
      usage,
      third_party_name: thirdPartyName.trim(),
      third_party_id: thirdPartyId.trim(),
      third_party_licence: thirdPartyLicence.trim(),
      third_party_insurer: thirdPartyInsurer.trim(),
      third_party_policy: thirdPartyPolicy.trim(),
      signed: true,
      signed_at: now.toISOString(),
      signed_by: client.name,
      pdf_base64: null,
      ratings: [],
      created_at: now.toISOString(),
      updated_at: now.toISOString(),
    };

    const pdf = await buildPdf("Motor Claim Registration", [
      `Insurer: ${insurer}`,
      `Incident: ${incidentDate} ${incidentTime}`,
      `Description: ${incidentDescription}`,
      `Police notified: ${policeNotified ? "Yes — " + policeCaseNumber : "No"}`,
      `Driver: ${claim.driver} (${usage} use)`,
      `Witness: ${witnessName || "None"} ${witnessPhone}`,
      `Third party: ${thirdPartyName || "N/A"} ${thirdPartyInsurer} ${thirdPartyPolicy}`,
      "",
      "I hereby declare that the above information is accurate and complete.",
      `Signed electronically by ${client.name} (user ID ${client.id})`,
      `Timestamp: ${now.toLocaleString("en-ZA")}`,
    ]);
    claim.pdf_base64 = pdf;

    const attachments: ClaimAttachment[] = Object.values(slots)
      .filter((s) => s.dataUrl)
      .map((s) => ({
        id: nextId(),
        claim_id: id,
        file_type: s.key,
        file_name: s.fileName ?? s.key,
        file_base64: s.dataUrl!,
        extracted_text: s.text ?? "",
        fields: s.fields ?? [],
        confirmed: s.confirmed ?? false,
        uploaded_at: now.toISOString(),
      }));

    update((db) => {
      db.attachments.push(...attachments);
    });
    submitClaim(claim);
    setBusy(false);
    void navigate({ to: "/claims/$claimId", params: { claimId: String(id) } });
  };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold">Step {step} of 4 — Register a Motor Claim</h1>
        <div className="mt-3 h-2 w-full rounded-full bg-muted">
          <div
            className="h-2 rounded-full bg-primary transition-all"
            style={{ width: `${((step - 1) / 3) * 100}%` }}
          />
        </div>
      </div>

      {step === 2 && (
        <Card title="Need a tow? AI-suggested assistance">
          <p className="text-sm text-muted-foreground">
            Approved towing providers ranked by distance and availability. Selecting a provider does not book a tow
            — you must call to confirm.
          </p>
          {towProviders.length === 0 ? (
            <p className="mt-3 rounded-md bg-warning/15 p-3 text-sm font-medium text-warning">
              No approved towing partner is on file for your area. This has been escalated — contact your adviser
              directly, or use the assistant chat in the bottom-right corner.
            </p>
          ) : (
            <ul className="mt-3 space-y-2">
              {towProviders.map((p) => (
                <li key={p.name} className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border p-3">
                  <div>
                    <p className="text-sm font-bold">
                      {p.name}{" "}
                      <span className="ml-1 rounded-full bg-success/15 px-2 py-0.5 text-[10px] font-bold uppercase text-success">
                        Approved
                      </span>
                    </p>
                    <p className="text-xs text-muted-foreground">
                      ~{p.distanceKm.toFixed(1)} km away · ETA {p.etaMinutes} min
                    </p>
                  </div>
                  <a href={`tel:${p.phone}`} className={btn}>
                    Call {p.phone}
                  </a>
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}

      {step === 2 && (
        <Card title="Claim details">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className={label} htmlFor="insurer">
                Insurer
              </label>
              <select
                id="insurer"
                className={input}
                value={insurer}
                onChange={(e) => setInsurer(e.target.value)}
              >
                {INSURERS.map((i) => (
                  <option key={i}>{i}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={label} htmlFor="incident_date">
                Incident date
              </label>
              <input
                id="incident_date"
                type="date"
                className={input}
                value={incidentDate}
                onChange={(e) => setIncidentDate(e.target.value)}
              />
            </div>
            <div>
              <label className={label} htmlFor="incident_time">
                Incident time
              </label>
              <input
                id="incident_time"
                type="time"
                className={input}
                value={incidentTime}
                onChange={(e) => setIncidentTime(e.target.value)}
              />
            </div>
            <div className="md:col-span-2">
              <label className={label} htmlFor="incident_description">
                Description
              </label>
              <textarea
                id="incident_description"
                className={input}
                rows={3}
                value={incidentDescription}
                onChange={(e) => setIncidentDescription(e.target.value)}
              />
            </div>

            <div className="md:col-span-2 rounded-md border border-border p-4">
              <label className="flex items-center gap-3 text-sm font-medium">
                <input
                  type="checkbox"
                  className="h-5 w-5"
                  checked={policeNotified}
                  onChange={(e) => setPoliceNotified(e.target.checked)}
                />
                Police were notified
              </label>
              {policeNotified && (
                <div className="mt-3">
                  <label className={label} htmlFor="case_number">
                    Police case number
                  </label>
                  <input
                    id="case_number"
                    className={input}
                    value={policeCaseNumber}
                    onChange={(e) => setPoliceCaseNumber(e.target.value)}
                  />
                </div>
              )}
              <p className="mt-2 text-xs text-muted-foreground">
                Reminder: report the accident to the police within 48 hours.
              </p>
            </div>

            <div className="md:col-span-2 grid gap-4 rounded-md border border-border p-4 sm:grid-cols-2">
              <div>
                <label className={label} htmlFor="witness_name">
                  Witness name
                </label>
                <input
                  id="witness_name"
                  className={input}
                  value={witnessName}
                  onChange={(e) => setWitnessName(e.target.value)}
                />
              </div>
              <div>
                <label className={label} htmlFor="witness_phone">
                  Witness phone
                </label>
                <input
                  id="witness_phone"
                  className={input}
                  value={witnessPhone}
                  onChange={(e) => setWitnessPhone(e.target.value)}
                />
              </div>
              <label className="flex items-center gap-3 text-sm sm:col-span-2">
                <input
                  type="checkbox"
                  className="h-5 w-5"
                  checked={witnessStatement}
                  onChange={(e) => setWitnessStatement(e.target.checked)}
                />
                Witness statement taken
              </label>
            </div>

            <div>
              <p className={label}>Who was driving?</p>
              <div className="flex gap-4 text-sm">
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="driver"
                    checked={driver === "client"}
                    onChange={() => setDriver("client")}
                  />{" "}
                  {client.name} (me)
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="driver"
                    checked={driver === "other"}
                    onChange={() => setDriver("other")}
                  />{" "}
                  Other person
                </label>
              </div>
            </div>
            <div>
              <p className={label}>Personal or business use?</p>
              <div className="flex gap-4 text-sm">
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="usage"
                    checked={usage === "personal"}
                    onChange={() => setUsage("personal")}
                  />{" "}
                  Personal
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="usage"
                    checked={usage === "business"}
                    onChange={() => setUsage("business")}
                  />{" "}
                  Business
                </label>
              </div>
            </div>

            <div className="md:col-span-2 grid gap-4 rounded-md border border-border p-4 sm:grid-cols-2">
              <p className="text-sm font-semibold sm:col-span-2">
                Other vehicle & third-party details
              </p>
              <div>
                <label className={label} htmlFor="tp_name">
                  Owner name
                </label>
                <input
                  id="tp_name"
                  className={input}
                  value={thirdPartyName}
                  onChange={(e) => setThirdPartyName(e.target.value)}
                />
              </div>
              <div>
                <label className={label} htmlFor="tp_id">
                  Owner ID number
                </label>
                <input
                  id="tp_id"
                  className={input}
                  value={thirdPartyId}
                  onChange={(e) => setThirdPartyId(e.target.value)}
                />
              </div>
              <div>
                <label className={label} htmlFor="tp_licence">
                  Licence plate
                </label>
                <input
                  id="tp_licence"
                  className={input}
                  value={thirdPartyLicence}
                  onChange={(e) => setThirdPartyLicence(e.target.value)}
                />
              </div>
              <div>
                <label className={label} htmlFor="tp_insurer">
                  Third-party insurer
                </label>
                <input
                  id="tp_insurer"
                  className={input}
                  value={thirdPartyInsurer}
                  onChange={(e) => setThirdPartyInsurer(e.target.value)}
                />
              </div>
              <div>
                <label className={label} htmlFor="tp_policy">
                  Third-party policy number
                </label>
                <input
                  id="tp_policy"
                  className={input}
                  value={thirdPartyPolicy}
                  onChange={(e) => setThirdPartyPolicy(e.target.value)}
                />
              </div>
            </div>
          </div>

          {detailsError && <p className="mt-3 text-sm font-medium text-danger">{detailsError}</p>}
          <div className="mt-5 flex gap-3">
            <button className={btn} onClick={goDetailsNext}>
              Continue to uploads
            </button>
          </div>
        </Card>
      )}

      {step === 3 && (
        <Card title="Upload photos and documents">
          <p className="text-sm text-muted-foreground">
            Uploads are optional but speed up your claim. ID, licence and registration documents are
            scanned automatically — review the extracted data before continuing.
          </p>
          <div className="mt-4 space-y-4">
            {SLOTS.map((s) => (
              <UploadSlot
                key={s.key}
                slot={slots[s.key]!}
                onFile={(f) => void handleFile(s.key, f)}
                onFieldChange={(idx, v) => updateField(s.key, idx, v)}
                onConfirm={() => confirmSlot(s.key)}
              />
            ))}
          </div>
          {!allOcrConfirmed && uploadedOcrSlots.length > 0 && (
            <p className="mt-3 text-sm font-medium text-warning">
              Please review and confirm the extracted data on every scanned document before
              continuing.
            </p>
          )}
          <div className="mt-5 flex flex-wrap gap-3">
            <button className={btnGhost} onClick={() => setStep(2)}>
              Back
            </button>
            <button className={btn} disabled={!allOcrConfirmed} onClick={() => setStep(4)}>
              Continue to signature
            </button>
          </div>
        </Card>
      )}

      {step === 4 && (
        <Card title="Digital signature">
          <p className="text-sm font-medium">
            I hereby declare that the above information is accurate and complete.
          </p>
          <label className="mt-4 flex items-start gap-3 rounded-md bg-muted p-4 text-sm">
            <input
              type="checkbox"
              className="mt-1 h-5 w-5"
              checked={agree}
              onChange={(e) => setAgree(e.target.checked)}
            />
            <span>
              <strong>I agree and sign electronically.</strong> My name ({client.name}), user ID (
              {client.id}) and the current date and time will be captured as my signature.
            </span>
          </label>
          {signError && <p className="mt-3 text-sm font-medium text-danger">{signError}</p>}
          <div className="mt-5 flex flex-wrap gap-3">
            <button className={btnGhost} onClick={() => setStep(3)} disabled={busy}>
              Back
            </button>
            <button className={btn} onClick={submit} disabled={busy}>
              {busy ? "Submitting claim…" : "Sign and submit claim"}
            </button>
          </div>
        </Card>
      )}
    </div>
  );
}

function UploadSlot({
  slot,
  onFile,
  onFieldChange,
  onConfirm,
}: {
  slot: SlotState;
  onFile: (f: File) => void;
  onFieldChange: (idx: number, v: string) => void;
  onConfirm: () => void;
}) {
  return (
    <div className="rounded-md border border-border p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm font-semibold">{slot.title}</p>
        <label className={btnGhost + " cursor-pointer text-xs"}>
          {slot.fileName ? "Replace file" : "Choose file"}
          <input
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) onFile(f);
            }}
          />
        </label>
      </div>
      {slot.fileName && <p className="mt-2 text-xs text-muted-foreground">{slot.fileName}</p>}
      {slot.dataUrl && slot.dataUrl.startsWith("data:image") && (
        <img
          src={slot.dataUrl}
          alt={slot.title}
          className="mt-2 h-24 w-auto rounded-md border border-border object-cover"
        />
      )}

      {slot.loading && <p className="mt-3 text-sm text-muted-foreground">Running OCR…</p>}

      {slot.fields && slot.fields.length > 0 && (
        <div className="mt-4 space-y-2 rounded-md bg-muted p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Extracted data
          </p>
          {slot.fields.map((f, idx) => {
            const cls = confidenceClass(f.confidence, f.critical);
            const badge =
              cls === "green"
                ? "bg-success/15 text-success"
                : cls === "amber"
                  ? "bg-warning/15 text-warning"
                  : "bg-danger/15 text-danger";
            return (
              <div key={f.label}>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="w-40 shrink-0 text-xs text-muted-foreground">{f.label}</span>
                  <input
                    className={input + " flex-1"}
                    value={f.value}
                    disabled={slot.confirmed}
                    onChange={(e) => onFieldChange(idx, e.target.value)}
                  />
                  <span className={"shrink-0 rounded-full px-2 py-1 text-xs font-semibold " + badge}>
                    {f.confidence}% confidence
                  </span>
                </div>
                {f.note && !slot.confirmed && (
                  <p className="mt-1 pl-[10.5rem] text-xs font-medium text-warning">⚠ {f.note}</p>
                )}
              </div>
            );
          })}
          {slot.text && (
            <details className="text-xs text-muted-foreground">
              <summary className="cursor-pointer">Show raw OCR output</summary>
              <pre className="mt-1 whitespace-pre-wrap">{slot.text}</pre>
            </details>
          )}
          {!slot.confirmed ? (
            <button className={btn + " mt-2"} onClick={onConfirm}>
              Confirm and lock data
            </button>
          ) : (
            <p className="text-sm font-medium text-success">✓ Confirmed and locked</p>
          )}
        </div>
      )}
    </div>
  );
}
