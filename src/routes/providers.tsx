import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { AppShell, Card } from "@/components/AppShell";
import { useDB, useSession } from "@/lib/store";

export const Route = createFileRoute("/providers")({
  head: () => ({
    meta: [
      { title: "Providers — Royal Square Financial" },
      { name: "description", content: "Browse clients by insurance and investment provider." },
      { property: "og:title", content: "Providers — Royal Square Financial" },
      { property: "og:description", content: "See which clients hold a policy or investment with each provider." },
    ],
  }),
  component: () => (
    <AppShell allow={["adviser", "admin"]}>
      <ProvidersPage />
    </AppShell>
  ),
});

function ProvidersPage() {
  const db = useDB();
  const session = useSession()!;
  const [selected, setSelected] = useState<string | null>(null);

  const myClients = db.clients.filter((c) => session.role === "admin" || c.adviser_id === session.userId);
  const myClientIds = new Set(myClients.map((c) => c.id));
  const myPolicies = db.policies.filter((p) => myClientIds.has(p.client_id));

  const providerStats = Array.from(new Set(myPolicies.map((p) => p.insurer)))
    .sort()
    .map((name) => {
      const policies = myPolicies.filter((p) => p.insurer === name);
      const clientCount = new Set(policies.map((p) => p.client_id)).size;
      const policyCount = policies.filter((p) => p.kind === "policy").length;
      const investmentCount = policies.filter((p) => p.kind === "investment").length;
      return { name, clientCount, policyCount, investmentCount };
    });

  const selectedClients = selected
    ? myClients
        .map((c) => ({ client: c, policies: myPolicies.filter((p) => p.insurer === selected && p.client_id === c.id) }))
        .filter((x) => x.policies.length > 0)
        .sort((a, b) => a.client.name.localeCompare(b.client.name))
    : [];

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold">Providers</h1>
        <p className="text-sm text-muted-foreground">
          {session.role === "admin"
            ? "Every product provider across all clients. Select one to see who holds what."
            : "Product providers across your client book. Select one to see who holds what."}
        </p>
      </div>

      {providerStats.length === 0 ? (
        <p className="text-sm text-muted-foreground">No policies or investments on file yet.</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {providerStats.map((p) => (
            <button
              key={p.name}
              type="button"
              onClick={() => setSelected(p.name === selected ? null : p.name)}
              className={
                "card-surface p-5 text-left transition-colors " +
                (selected === p.name ? "ring-2 ring-primary" : "hover:bg-muted")
              }
            >
              <p className="text-lg font-bold">{p.name}</p>
              <p className="mt-1 text-sm font-medium text-muted-foreground">
                {p.clientCount} client{p.clientCount === 1 ? "" : "s"}
              </p>
              <p className="mt-2 text-xs text-muted-foreground">
                {p.policyCount > 0 && `${p.policyCount} polic${p.policyCount === 1 ? "y" : "ies"}`}
                {p.policyCount > 0 && p.investmentCount > 0 && " · "}
                {p.investmentCount > 0 && `${p.investmentCount} investment${p.investmentCount === 1 ? "" : "s"}`}
              </p>
            </button>
          ))}
        </div>
      )}

      {selected && (
        <Card title={`Clients with ${selected}`}>
          {selectedClients.length === 0 && <p className="text-sm text-muted-foreground">No clients found.</p>}
          <ul className="space-y-2">
            {selectedClients.map(({ client, policies }) => (
              <li
                key={client.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border p-3"
              >
                <span className="font-semibold">{client.name}</span>
                <span className="flex flex-wrap gap-2">
                  {policies.map((p) => (
                    <span
                      key={p.id}
                      className={
                        "rounded-full px-3 py-1 text-xs font-semibold " +
                        (p.kind === "investment" ? "bg-secondary text-secondary-foreground" : "bg-accent text-accent-foreground")
                      }
                    >
                      {p.product}
                    </span>
                  ))}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
