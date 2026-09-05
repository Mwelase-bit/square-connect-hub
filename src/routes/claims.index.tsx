import { Link, createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { AppShell, Card, btn, btnGhost } from "@/components/AppShell";
import { CLAIM_STAGES, useDB, useSession } from "@/lib/store";

export const Route = createFileRoute("/claims/")({
  head: () => ({
    meta: [
      { title: "Motor claims — Royal Square Financial" },
      { name: "description", content: "Register and track motor claims from report to repair completion." },
      { property: "og:title", content: "Motor claims — Royal Square Financial" },
      { property: "og:description", content: "Digital motor claim registration and live claim tracking." },
    ],
  }),
  component: () => (
    <AppShell>
      <ClaimsPage />
    </AppShell>
  ),
});

function ClaimsPage() {
  const db = useDB();
  const session = useSession()!;
  const [filter, setFilter] = useState("all");

  const isClient = session.role === "client";
  const visible = db.claims.filter((c) => {
    if (isClient) return c.client_id === session.userId;
    if (session.role === "admin") return true;
    const client = db.clients.find((x) => x.id === c.client_id);
    return client?.adviser_id === session.userId;
  });

  const filtered = visible.filter((c) => {
    if (filter === "all") return true;
    if (filter === "submitted") return c.status === "submitted";
    if (filter === "completed") return c.status === "completed";
    return c.status !== "submitted" && c.status !== "completed";
  });

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold">Motor claims</h1>

      {isClient && (
        <div className="flex flex-wrap gap-3">
          <Link to="/claims/checklist" className={btn}>Report an Accident or Loss</Link>
          <Link to="/claims/new" className={btnGhost}>Register a Motor Claim</Link>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {["all", "submitted", "in progress", "completed"].map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={
              "rounded-full px-4 py-2 text-sm font-medium capitalize " +
              (filter === f ? "bg-primary text-primary-foreground" : "border border-border bg-card")
            }
          >
            {f}
          </button>
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {filtered.length === 0 && <p className="text-sm text-muted-foreground">No claims to show.</p>}
        {filtered.map((c) => {
          const stage = CLAIM_STAGES.findIndex((s) => s.key === c.status);
          const client = db.clients.find((x) => x.id === c.client_id);
          return (
            <Card key={c.id} title={c.claim_number ?? "Draft claim"}>
              <p className="text-sm text-muted-foreground">
                {client?.name} · {c.insurer} · incident {new Date(c.incident_date).toLocaleDateString("en-ZA")}
              </p>
              <p className="mt-2 text-sm font-semibold capitalize">{c.status.replace(/_/g, " ")}</p>
              <div className="mt-2 h-2 w-full rounded-full bg-muted">
                <div
                  className="h-2 rounded-full bg-primary transition-all"
                  style={{ width: `${((stage + 1) / CLAIM_STAGES.length) * 100}%` }}
                />
              </div>
              <Link to="/claims/$claimId" params={{ claimId: String(c.id) }} className={btnGhost + " mt-3"}>
                View claim
              </Link>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
