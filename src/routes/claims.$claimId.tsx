import { Link, createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { AppShell, Card, btn, btnGhost } from "@/components/AppShell";
import { confidenceClass } from "@/lib/ocr";
import { downloadPdf } from "@/lib/pdf";
import { CLAIM_STAGES, audit, canAccessClient, update, useDB, useSession } from "@/lib/store";

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

      {claim.status === "completed" && <RatingCard claim={claim} />}
    </div>
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
