import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { AppShell, Card } from "@/components/AppShell";
import { useDB, useSession } from "@/lib/store";

export const Route = createFileRoute("/audit")({
  head: () => ({
    meta: [
      { title: "Audit trail — Royal Square Financial" },
      { name: "description", content: "Compliance audit log of user actions." },
      { property: "og:title", content: "Audit trail — Royal Square Financial" },
      {
        property: "og:description",
        content: "Every action logged with user, timestamp and resource affected.",
      },
    ],
  }),
  component: () => (
    <AppShell allow={["adviser", "admin"]}>
      <AuditPage />
    </AppShell>
  ),
});

function AuditPage() {
  const db = useDB();
  const session = useSession()!;
  const [query, setQuery] = useState("");

  const myClientIds = db.clients
    .filter((c) => session.role === "admin" || c.adviser_id === session.userId)
    .map((c) => c.id);

  const visible = db.audit.filter((a) => {
    if (session.role === "admin") return true;
    if (a.user_type === "adviser") return a.user_id === session.userId;
    if (a.user_type === "client") return myClientIds.includes(a.user_id ?? -1);
    return true;
  });

  const filtered = visible.filter((a) => {
    const label = resolveUser(db, a.user_id, a.user_type);
    const haystack = `${a.action} ${a.resource} ${label}`.toLowerCase();
    return haystack.includes(query.toLowerCase());
  });

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold">Audit trail</h1>
        <p className="text-sm text-muted-foreground">
          {session.role === "admin"
            ? "Every logged action across the platform."
            : "Actions for you and your assigned clients."}
        </p>
      </div>

      <input
        className="w-full rounded-md border border-input bg-card px-3 py-3 text-base"
        placeholder="Search by action, resource or user…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />

      <Card>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="text-xs uppercase text-muted-foreground">
              <tr>
                <th className="py-2">Timestamp</th>
                <th>User</th>
                <th>Action</th>
                <th>Resource</th>
                <th>Details</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((a) => (
                <tr key={a.id} className="border-t border-border align-top">
                  <td className="py-3 whitespace-nowrap">
                    {new Date(a.timestamp).toLocaleString("en-ZA")}
                  </td>
                  <td className="whitespace-nowrap">
                    {resolveUser(db, a.user_id, a.user_type)}
                    <span className="block text-xs capitalize text-muted-foreground">
                      {a.user_type}
                    </span>
                  </td>
                  <td className="capitalize whitespace-nowrap">{a.action.replace(/_/g, " ")}</td>
                  <td className="capitalize whitespace-nowrap">{a.resource.replace(/_/g, " ")}</td>
                  <td className="max-w-xs">
                    <code className="text-xs text-muted-foreground">
                      {JSON.stringify(a.details)}
                    </code>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-6 text-center text-muted-foreground">
                    No matching audit entries.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

function resolveUser(
  db: ReturnType<typeof useDB>,
  userId: number | null,
  userType: string,
): string {
  if (userType === "system" || userId == null) return "System";
  if (userType === "adviser")
    return db.advisers.find((a) => a.id === userId)?.name ?? `Adviser #${userId}`;
  if (userType === "client")
    return db.clients.find((c) => c.id === userId)?.name ?? `Client #${userId}`;
  return "Admin";
}
