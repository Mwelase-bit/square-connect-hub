import { Link, createFileRoute } from "@tanstack/react-router";
import { AppShell, Card, Stat, btnGhost } from "@/components/AppShell";
import {
  FORM_TYPES,
  canAccessClient,
  formatZAR,
  netWorth,
  reminderStatus,
  useDB,
  useSession,
} from "@/lib/store";
import { CLAIM_STAGES } from "@/lib/store";

export const Route = createFileRoute("/adviser/clients/$clientId")({
  head: () => ({
    meta: [
      { title: "Client profile — Royal Square Financial" },
      { name: "description", content: "Full client profile for the assigned adviser." },
      { property: "og:title", content: "Client profile — Royal Square Financial" },
      {
        property: "og:description",
        content: "Policies, claims, reminders and goals for one client.",
      },
    ],
  }),
  component: () => (
    <AppShell allow={["adviser", "admin"]}>
      <ClientDetailPage />
    </AppShell>
  ),
});

function ClientDetailPage() {
  const { clientId } = Route.useParams();
  const db = useDB();
  const session = useSession()!;
  const id = Number(clientId);
  const client = db.clients.find((c) => c.id === id);

  if (!client) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-muted-foreground">Client not found.</p>
        <Link to="/adviser" className={btnGhost}>
          Back to dashboard
        </Link>
      </div>
    );
  }

  if (!canAccessClient(session, id)) {
    return (
      <div className="space-y-3 text-center">
        <p className="text-4xl font-bold text-primary">403</p>
        <p className="text-sm text-muted-foreground">This client is not assigned to you.</p>
        <Link to="/adviser" className={btnGhost}>
          Back to dashboard
        </Link>
      </div>
    );
  }

  const adviser = db.advisers.find((a) => a.id === client.adviser_id);
  const policies = db.policies.filter((p) => p.client_id === id);
  const claims = db.claims.filter((c) => c.client_id === id);
  const goals = db.goals.filter((g) => g.shared_client_ids.includes(id));
  const reminders = db.reminders.filter((r) => r.client_id === id);
  const forms = db.forms.filter((f) => f.client_id === id);
  const signed = forms.filter((f) => f.signed).length;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">{client.name}</h1>
          <p className="text-sm text-muted-foreground">
            {client.email} · {client.phone} · Adviser: {adviser?.name ?? "Unassigned"}
          </p>
        </div>
        <Link to="/adviser" className={btnGhost}>
          Back to dashboard
        </Link>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Net worth" value={formatZAR(netWorth(id))} />
        <Stat label="Policies & investments" value={String(policies.length)} />
        <Stat
          label="Open claims"
          value={String(claims.filter((c) => c.status !== "completed").length)}
        />
        <Stat label="Onboarding" value={`${signed}/${FORM_TYPES.length}`} hint="Documents signed" />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Policies & investments">
          <ul className="space-y-2 text-sm">
            {policies.map((p) => (
              <li key={p.id} className="rounded-md border border-border p-3">
                <p className="font-semibold">
                  {p.insurer} — {p.product}
                </p>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">{p.kind}</p>
              </li>
            ))}
            {policies.length === 0 && <p className="text-muted-foreground">No policies on file.</p>}
          </ul>
        </Card>

        <Card title="Claims">
          <ul className="space-y-2 text-sm">
            {claims.map((c) => {
              const stage = CLAIM_STAGES.findIndex((s) => s.key === c.status);
              return (
                <li key={c.id} className="rounded-md border border-border p-3">
                  <Link
                    to="/claims/$claimId"
                    params={{ claimId: String(c.id) }}
                    className="font-semibold text-primary"
                  >
                    {c.claim_number ?? "Draft claim"}
                  </Link>
                  <span className="block text-xs text-muted-foreground">
                    {c.insurer} · {c.status.replace(/_/g, " ")} · stage {stage + 1} of{" "}
                    {CLAIM_STAGES.length}
                  </span>
                </li>
              );
            })}
            {claims.length === 0 && <p className="text-muted-foreground">No claims filed.</p>}
          </ul>
        </Card>

        <Card title="Reminders">
          <ul className="space-y-2 text-sm">
            {reminders.map((r) => {
              const st = reminderStatus(r.due_date);
              return (
                <li key={r.id} className="rounded-md border border-border p-3">
                  <span
                    className={
                      "mr-2 inline-block h-2 w-2 rounded-full " +
                      (st === "overdue" ? "bg-danger" : st === "soon" ? "bg-warning" : "bg-success")
                    }
                  />
                  {r.message}
                  <span className="block text-xs text-muted-foreground">
                    Due {new Date(r.due_date).toLocaleDateString("en-ZA")}
                  </span>
                </li>
              );
            })}
            {reminders.length === 0 && <p className="text-muted-foreground">No reminders.</p>}
          </ul>
        </Card>

        <Card title="Goals">
          <ul className="space-y-3 text-sm">
            {goals.map((g) => {
              const pct = Math.min(100, Math.round((g.current_amount / g.target_amount) * 100));
              return (
                <li key={g.id}>
                  <p className="font-medium">
                    {g.goal_name}: {pct}%
                  </p>
                  <div className="mt-1 h-2 w-full rounded-full bg-muted">
                    <div className="h-2 rounded-full bg-primary" style={{ width: `${pct}%` }} />
                  </div>
                </li>
              );
            })}
            {goals.length === 0 && <p className="text-muted-foreground">No goals.</p>}
          </ul>
        </Card>
      </div>
    </div>
  );
}
