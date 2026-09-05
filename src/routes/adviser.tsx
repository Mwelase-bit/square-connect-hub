import { Link, createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { AppShell, Card, Stat } from "@/components/AppShell";
import { formatZAR, netWorth, reminderStatus, useDB, useSession } from "@/lib/store";

export const Route = createFileRoute("/adviser")({
  head: () => ({
    meta: [
      { title: "Adviser dashboard — Royal Square Financial" },
      { name: "description", content: "Client book, reminders due and claims in progress for Royal Square advisers." },
      { property: "og:title", content: "Adviser dashboard — Royal Square Financial" },
      { property: "og:description", content: "Track clients, reminders and motor claims across your book of business." },
    ],
  }),
  component: () => (
    <AppShell allow={["adviser", "admin"]}>
      <AdviserDashboard />
    </AppShell>
  ),
});

function AdviserDashboard() {
  const db = useDB();
  const session = useSession()!;
  const [query, setQuery] = useState("");

  const clients = db.clients.filter((c) => session.role === "admin" || c.adviser_id === session.userId);
  const clientIds = clients.map((c) => c.id);
  const reminders = db.reminders
    .filter((r) => clientIds.includes(r.client_id) && r.audience !== "client" && !r.dismissed)
    .sort((a, b) => a.due_date.localeCompare(b.due_date));
  const dueThisWeek = reminders.filter((r) => reminderStatus(r.due_date) !== "pending");
  const claims = db.claims.filter((c) => clientIds.includes(c.client_id));
  const openClaims = claims.filter((c) => c.status !== "completed");
  const totalValue = clients.reduce((s, c) => s + netWorth(c.id), 0);
  const policyCount = db.policies.filter((p) => clientIds.includes(p.client_id)).length;

  const filtered = clients.filter((c) => c.name.toLowerCase().includes(query.toLowerCase()));

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Adviser dashboard</h1>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Active clients" value={String(clients.length)} />
        <Stat label="Reminders due this week" value={String(dueThisWeek.length)} hint={`${reminders.length} total open`} />
        <Stat label="Claims in progress" value={String(openClaims.length)} />
        <Stat label="Client value under management" value={formatZAR(totalValue)} hint={`${policyCount} policies & investments`} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Reminders due soon" action={<Link to="/reminders" className="text-sm font-semibold text-primary">All reminders</Link>}>
          <ul className="space-y-2 text-sm">
            {dueThisWeek.length === 0 && <li className="text-muted-foreground">Nothing due this week.</li>}
            {dueThisWeek.map((r) => {
              const st = reminderStatus(r.due_date);
              const client = db.clients.find((c) => c.id === r.client_id);
              return (
                <li key={r.id} className="rounded-md border border-border p-3">
                  <span className={"mr-2 inline-block h-2 w-2 rounded-full " + (st === "overdue" ? "bg-danger" : "bg-warning")} />
                  <strong>{client?.name}</strong> — {r.message}
                  <span className="block text-xs text-muted-foreground">Due {new Date(r.due_date).toLocaleDateString("en-ZA")}</span>
                </li>
              );
            })}
          </ul>
        </Card>

        <Card title="Claims in progress" action={<Link to="/claims" className="text-sm font-semibold text-primary">All claims</Link>}>
          <ul className="space-y-2 text-sm">
            {openClaims.length === 0 && <li className="text-muted-foreground">No open claims.</li>}
            {openClaims.map((c) => (
              <li key={c.id} className="rounded-md border border-border p-3">
                <Link to="/claims/$claimId" params={{ claimId: String(c.id) }} className="font-semibold text-primary">
                  {c.claim_number ?? "Draft claim"}
                </Link>
                <span className="block text-xs text-muted-foreground">
                  {db.clients.find((x) => x.id === c.client_id)?.name} · {c.insurer} · {c.status.replace(/_/g, " ")}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <Card title="My clients">
        <input
          className="mb-3 w-full rounded-md border border-input bg-card px-3 py-3 text-base"
          placeholder="Search clients by name…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="text-xs uppercase text-muted-foreground">
              <tr>
                <th className="py-2">Client</th>
                <th>Last interaction</th>
                <th>Policies</th>
                <th>Next reminder</th>
                <th>Open claims</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((c) => {
                const next = reminders.filter((r) => r.client_id === c.id)[0];
                const open = claims.filter((x) => x.client_id === c.id && x.status !== "completed").length;
                return (
                  <tr key={c.id} className="border-t border-border">
                    <td className="py-3">
                      <Link to="/adviser/clients/$clientId" params={{ clientId: String(c.id) }} className="font-semibold text-primary">
                        {c.name}
                      </Link>
                    </td>
                    <td>{new Date(c.last_interaction).toLocaleDateString("en-ZA")}</td>
                    <td>{db.policies.filter((p) => p.client_id === c.id).length}</td>
                    <td>{next ? new Date(next.due_date).toLocaleDateString("en-ZA") : "—"}</td>
                    <td>{open}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
