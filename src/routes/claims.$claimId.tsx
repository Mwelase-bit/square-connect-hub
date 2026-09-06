import { Link, createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { AppShell, Card, btn, btnGhost, input, label } from "@/components/AppShell";
import { rankCarHireProviders, suggestHireCarReturn } from "@/lib/carHire";
import {
  completeClaim,
  postRepairUpdate,
  recordClaimNumber,
  scheduleAssessment,
  scheduleRepair,
} from "@/lib/claims";
import { confidenceClass } from "@/lib/ocr";
import { downloadPdf } from "@/lib/pdf";
import { CLAIM_STAGES, audit, canAccessClient, update, useDB, useSession } from "@/lib/store";
import type { Claim } from "@/lib/types";

export const Route = createFileRoute("/claims/$claimId")({
  head: () => ({
    meta: [
      { title: "Claim tracking — Royal Square Financial" },
      {
        name: "description",
        content: "Track a motor claim from submission through to completion.",
      },
      { property: "og:title", content: "Claim tracking — Royal Square Financial" },
      {
        property: "og:description",
        content: "Live claim status, attachments and settlement rating.",
      },
    ],
  }),
  component: () => (
    <AppShell>
      <ClaimDetailPage />
    </AppShell>
  ),
});

const STAR = "★";

function ClaimDetailPage() {
  const { claimId } = Route.useParams();
  const db = useDB();
  const session = useSession()!;
  const id = Number(claimId);
  const claim = db.claims.find((c) => c.id === id);

  if (!claim) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-muted-foreground">Claim not found.</p>
        <Link to="/claims" className={btnGhost}>
          Back to claims
        </Link>
      </div>
    );
  }

  if (!canAccessClient(session, claim.client_id)) {
    return (
      <div className="space-y-3 text-center">
        <p className="text-4xl font-bold text-primary">403</p>
        <p className="text-sm text-muted-foreground">You don't have access to this claim.</p>
        <Link to="/claims" className={btnGhost}>
          Back to claims
        </Link>
      </div>
    );
  }

  const client = db.clients.find((c) => c.id === claim.client_id);
  const attachments = db.attachments.filter((a) => a.claim_id === claim.id);
  const updates = db.statusUpdates
    .filter((u) => u.claim_id === claim.id)
    .sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  const stageIdx = CLAIM_STAGES.findIndex((s) => s.key === claim.status);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">{claim.claim_number ?? "Draft claim"}</h1>
          <p className="text-sm text-muted-foreground">
            {client?.name} · {claim.insurer} · incident{" "}
            {new Date(claim.incident_date).toLocaleDateString("en-ZA")}
          </p>
        </div>
        <Link to="/claims" className={btnGhost}>
          Back to claims
        </Link>
      </div>

      <Card title="Claim progress">
        <div className="mb-3 h-3 w-full rounded-full bg-muted">
          <div
            className="h-3 rounded-full bg-primary transition-all"
            style={{ width: `${((stageIdx + 1) / CLAIM_STAGES.length) * 100}%` }}
          />
        </div>
        <div className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
          {CLAIM_STAGES.map((s, i) => (
            <div
              key={s.key}
              className={
                "rounded-md border p-2 text-center " +
                (i <= stageIdx
                  ? "border-primary bg-accent text-accent-foreground"
                  : "border-border text-muted-foreground")
              }
            >
              {s.label}
            </div>
          ))}
        </div>

        <ol className="mt-5 space-y-3 border-l-2 border-border pl-4">
          {updates.map((u) => (
            <li key={u.id} className="relative">
              <span className="absolute -left-[21px] top-1 h-3 w-3 rounded-full bg-primary" />
              <p className="text-sm font-medium">{u.message}</p>
              <p className="text-xs text-muted-foreground">
                {new Date(u.timestamp).toLocaleString("en-ZA")}
              </p>
            </li>
          ))}
        </ol>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Incident details">
          <dl className="space-y-2 text-sm">
            <Row k="Description" v={claim.incident_description} />
            <Row k="Time" v={claim.incident_time} />
            <Row
              k="Police notified"
              v={claim.police_notified ? `Yes — ${claim.police_case_number}` : "No"}
            />
            <Row k="Driver" v={`${claim.driver} (${claim.usage} use)`} />
            <Row
              k="Witness"
              v={claim.witness_name ? `${claim.witness_name} · ${claim.witness_phone}` : "None"}
            />
            <Row
              k="Third party"
              v={
                claim.third_party_name
                  ? `${claim.third_party_name} · ${claim.third_party_insurer} ${claim.third_party_policy}`
                  : "N/A"
              }
            />
          </dl>
        </Card>

        <Card title="Digital signature">
          <dl className="space-y-2 text-sm">
            <Row k="Signed by" v={claim.signed_by ?? "—"} />
            <Row
              k="Signed at"
              v={claim.signed_at ? new Date(claim.signed_at).toLocaleString("en-ZA") : "—"}
            />
          </dl>
          {claim.pdf_base64 && (
            <button
              className={btnGhost + " mt-3"}
              onClick={() => {
                downloadPdf(claim.pdf_base64!, `${claim.claim_number ?? "claim"}.pdf`);
                audit("document_downloaded", "claim", { claimId: claim.id });
              }}
            >
              Download signed claim PDF
            </button>
          )}
        </Card>
      </div>

      {attachments.length > 0 && (
        <Card title="Attachments & extracted data">
          <div className="grid gap-4 md:grid-cols-2">
            {attachments.map((a) => (
              <div key={a.id} className="rounded-md border border-border p-3">
                <p className="text-sm font-semibold">{a.file_name}</p>
                {a.file_base64.startsWith("data:image") && (
                  <img
                    src={a.file_base64}
                    alt={a.file_name}
                    className="mt-2 h-20 w-auto rounded-md border border-border object-cover"
                  />
                )}
                {a.fields.length > 0 && (
                  <ul className="mt-2 space-y-1 text-xs">
                    {a.fields.map((f) => {
                      const cls = confidenceClass(f.confidence, f.critical);
                      const color =
                        cls === "green"
                          ? "text-success"
                          : cls === "amber"
                            ? "text-warning"
                            : "text-danger";
                      return (
                        <li key={f.label} className="flex justify-between gap-2">
                          <span className="text-muted-foreground">{f.label}</span>
                          <span className={"font-medium " + color}>
                            {f.value || "—"} ({f.confidence}%)
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            ))}
          </div>
        </Card>
      )}

      {session.role === "client" && !claim.claim_number && claim.status !== "submitted" && (
        <ClaimNumberCard claim={claim} />
      )}

      {session.role === "client" && !!claim.claim_number && !claim.assessment_date && (
        <ScheduleAssessmentCard claim={claim} />
      )}

      {session.role === "client" && claim.status === "repair_authorised" && !claim.repair_date && (
        <ScheduleRepairCard claim={claim} />
      )}

      {!!claim.repair_date && <CarHireCard claim={claim} clientCity={client?.city ?? ""} />}

      {(session.role === "adviser" || session.role === "admin") && claim.status === "repair_in_progress" && (
        <RepairUpdateCard claim={claim} />
      )}

      {claim.status === "completed" && <RatingCard claim={claim} />}
    </div>
  );
}

function ClaimNumberCard({ claim }: { claim: Claim }) {
  const [claimNumber, setClaimNumber] = useState("");
  const [claimHandler, setClaimHandler] = useState("");
  const [error, setError] = useState("");

  const save = () => {
    if (!claimNumber.trim() || !claimHandler.trim()) {
      setError("Please enter both the claim number and the handler's name.");
      return;
    }
    setError("");
    recordClaimNumber(claim.id, claimNumber, claimHandler);
  };

  return (
    <Card title="Record your claim number">
      <p className="text-sm text-muted-foreground">
        Once {claim.insurer} contacts you, enter the claim number and claims handler here so it's on record and you
        get reminders tied to this claim.
      </p>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <div>
          <label className={label} htmlFor="claim_number_input">
            Claim number
          </label>
          <input id="claim_number_input" className={input} value={claimNumber} onChange={(e) => setClaimNumber(e.target.value)} />
        </div>
        <div>
          <label className={label} htmlFor="claim_handler_input">
            Claims handler's name
          </label>
          <input id="claim_handler_input" className={input} value={claimHandler} onChange={(e) => setClaimHandler(e.target.value)} />
        </div>
      </div>
      {error && <p className="mt-3 text-sm font-medium text-danger">{error}</p>}
      <button className={btn + " mt-4"} onClick={save}>
        Save
      </button>
    </Card>
  );
}

function ScheduleAssessmentCard({ claim }: { claim: Claim }) {
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [error, setError] = useState("");

  const save = () => {
    if (!date || !time) {
      setError("Please provide both a date and a time.");
      return;
    }
    setError("");
    scheduleAssessment(claim.id, date, time);
  };

  return (
    <Card title="Book your vehicle in for assessment">
      <p className="text-sm text-muted-foreground">
        Tell us when you're taking the vehicle in for assessment. Royal Square and {claim.insurer} will both be
        notified.
      </p>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <div>
          <label className={label} htmlFor="assessment_date_input">
            Date
          </label>
          <input id="assessment_date_input" type="date" className={input} value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
        <div>
          <label className={label} htmlFor="assessment_time_input">
            Time
          </label>
          <input id="assessment_time_input" type="time" className={input} value={time} onChange={(e) => setTime(e.target.value)} />
        </div>
      </div>
      {error && <p className="mt-3 text-sm font-medium text-danger">{error}</p>}
      <button className={btn + " mt-4"} onClick={save}>
        Confirm assessment booking
      </button>
    </Card>
  );
}

function ScheduleRepairCard({ claim }: { claim: Claim }) {
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [error, setError] = useState("");

  const save = () => {
    if (!date || !time) {
      setError("Please provide both a date and a time.");
      return;
    }
    setError("");
    scheduleRepair(claim.id, date, time);
  };

  return (
    <Card title="Book your vehicle in for repair">
      <p className="text-sm text-muted-foreground">
        Your repair has been authorised. Let us know when the vehicle is going in so we can line up a hire car for
        you in the meantime.
      </p>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <div>
          <label className={label} htmlFor="repair_date_input">
            Date
          </label>
          <input id="repair_date_input" type="date" className={input} value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
        <div>
          <label className={label} htmlFor="repair_time_input">
            Time
          </label>
          <input id="repair_time_input" type="time" className={input} value={time} onChange={(e) => setTime(e.target.value)} />
        </div>
      </div>
      {error && <p className="mt-3 text-sm font-medium text-danger">{error}</p>}
      <button className={btn + " mt-4"} onClick={save}>
        Confirm repair booking
      </button>
    </Card>
  );
}

function CarHireCard({ claim, clientCity }: { claim: Claim; clientCity: string }) {
  const providers = rankCarHireProviders(clientCity);
  const suggestedReturn = suggestHireCarReturn(claim.repair_date);

  return (
    <Card title="Hire car while your vehicle is repaired">
      <p className="text-sm text-muted-foreground">
        Approved car hire providers you can use in the meantime. Selecting one does not book it — call to arrange
        collection.
      </p>
      {providers.length === 0 ? (
        <p className="mt-3 rounded-md bg-warning/15 p-3 text-sm font-medium text-warning">
          No approved car hire partner is on file for your area — contact your adviser directly.
        </p>
      ) : (
        <ul className="mt-3 space-y-2">
          {providers.map((p) => (
            <li key={p.name} className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border p-3">
              <div>
                <p className="text-sm font-bold">
                  {p.name}{" "}
                  <span className="ml-1 rounded-full bg-success/15 px-2 py-0.5 text-[10px] font-bold uppercase text-success">
                    Approved
                  </span>
                </p>
                <p className="text-xs text-muted-foreground">From R{p.dailyRate} / day</p>
              </div>
              <a href={`tel:${p.phone}`} className={btn}>
                Call {p.phone}
              </a>
            </li>
          ))}
        </ul>
      )}
      {suggestedReturn && (
        <p className="mt-3 text-sm font-medium">
          Suggested hire car return: <strong>{new Date(suggestedReturn).toLocaleDateString("en-ZA")}</strong> — around
          when your vehicle should be ready for collection. Your adviser's weekly updates below will confirm the
          actual date.
        </p>
      )}
    </Card>
  );
}

function RepairUpdateCard({ claim }: { claim: Claim }) {
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const post = () => {
    if (!message.trim()) {
      setError("Please enter an update before posting.");
      return;
    }
    setError("");
    postRepairUpdate(claim.id, message);
    setMessage("");
  };

  return (
    <Card title="Post a repair update">
      <p className="text-sm text-muted-foreground">
        Log the repairer's weekly progress update — the client sees this immediately on their claim timeline.
      </p>
      <textarea
        className={input + " mt-3"}
        rows={2}
        placeholder="e.g. Week 2 update: panel work complete, awaiting paint."
        value={message}
        onChange={(e) => setMessage(e.target.value)}
      />
      {error && <p className="mt-2 text-sm font-medium text-danger">{error}</p>}
      <div className="mt-3 flex flex-wrap gap-3">
        <button className={btn} onClick={post}>
          Post update
        </button>
        <button
          className="rounded-md border border-success px-4 py-3 text-sm font-bold text-success hover:bg-success/10"
          onClick={() => completeClaim(claim.id)}
        >
          Mark repair complete & close claim
        </button>
      </div>
    </Card>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between gap-3 border-b border-border pb-2 last:border-0">
      <dt className="text-muted-foreground">{k}</dt>
      <dd className="text-right font-medium">{v}</dd>
    </div>
  );
}

function RatingCard({ claim }: { claim: ReturnType<typeof useDB>["claims"][number] }) {
  const session = useSession()!;
  const role = session.role === "client" ? "client" : "adviser";
  const myRating = claim.ratings.find((r) => r.by === role);
  const [stars, setStars] = useState(5);
  const [comment, setComment] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const avg =
    claim.ratings.length > 0
      ? (claim.ratings.reduce((s, r) => s + r.stars, 0) / claim.ratings.length).toFixed(1)
      : null;

  const submit = () => {
    update((db) => {
      const c = db.claims.find((x) => x.id === claim.id);
      if (!c || c.ratings.some((r) => r.by === role)) return;
      c.ratings.push({ by: role, stars, comment: comment.trim(), at: new Date().toISOString() });
    });
    setSubmitted(true);
  };

  return (
    <Card title="Rate this claim experience">
      {avg && (
        <p className="mb-3 text-sm text-muted-foreground">
          Average rating: <strong>{avg} / 5</strong> ({claim.ratings.length} rating
          {claim.ratings.length > 1 ? "s" : ""})
        </p>
      )}
      {myRating || submitted ? (
        <p className="text-sm font-medium text-success">
          ✓ You rated this claim {myRating?.stars ?? stars} / 5. Thank you for your feedback.
        </p>
      ) : (
        <div className="space-y-3">
          <div className="flex gap-1 text-2xl">
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                type="button"
                aria-label={`${n} stars`}
                className={n <= stars ? "text-primary" : "text-muted-foreground"}
                onClick={() => setStars(n)}
              >
                {STAR}
              </button>
            ))}
          </div>
          <textarea
            className="w-full rounded-md border border-input bg-card px-3 py-3 text-sm"
            rows={2}
            placeholder="Optional comment…"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
          />
          <button className={btn} onClick={submit}>
            Submit rating
          </button>
        </div>
      )}
    </Card>
  );
}
