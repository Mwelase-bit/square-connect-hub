import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { AppShell, Card } from "@/components/AppShell";
import { REMINDER_LABELS, audit, reminderStatus, update, useDB, useSession } from "@/lib/store";
import type { ReminderType } from "@/lib/types";

export const Route = createFileRoute("/reminders")({
  head: () => ({
    meta: [
      { title: "Reminders — Royal Square Financial" },
      { name: "description", content: "Upcoming and overdue reminders for clients and advisers." },
      { property: "og:title", content: "Reminders — Royal Square Financial" },
      {
        property: "og:description",
        content: "Track licence renewals, valuations, reviews and more.",
      },
    ],
  }),
  component: () => (
    <AppShell>
      <RemindersPage />
    </AppShell>
  ),
});

const STATUS_DOT: Record<string, string> = {
  overdue: "bg-danger",
  soon: "bg-warning",
  pending: "bg-success",
};

const STATUS_LABEL: Record<string, string> = {
  overdue: "Overdue",
  soon: "Due soon",
  pending: "Pending",
};

function RemindersPage() {
  const db = useDB();
  const session = useSession()!;
  const isClient = session.role === "client";
  const [typeFilter, setTypeFilter] = useState<"all" | ReminderType>("all");
  const [showDismissed, setShowDismissed] = useState(false);

  const clientIds = isClient
    ? [session.userId]
    : db.clients
        .filter((c) => session.role === "admin" || c.adviser_id === session.userId)
        .map((c) => c.id);

  const visible = db.reminders.filter((r) => {
    if (!clientIds.includes(r.client_id)) return false;
    if (isClient && r.audience === "adviser") return false;
    if (!isClient && r.audience === "client") return false;
    return true;
  });

  const filtered = visible
    .filter((r) => (typeFilter === "all" ? true : r.reminder_type === typeFilter))
    .filter((r) => showDismissed || !r.dismissed)
    .sort((a, b) => a.due_date.localeCompare(b.due_date));

  const markRead = (id: number) => {
    update((db) => {
      const r = db.reminders.find((x) => x.id === id);
      if (r) r.read = true;
    });
    audit("data_viewed", "reminder", { reminderId: id, action: "read" });
  };

  const dismiss = (id: number) => {
    update((db) => {
      const r = db.reminders.find((x) => x.id === id);
      if (r) r.dismissed = true;
    });
    audit("data_viewed", "reminder", { reminderId: id, action: "dismissed" });
  };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold">Reminders</h1>
        <p className="text-sm text-muted-foreground">
          {isClient
            ? "Your personal reminders."
            : "Reminders across your client book, soonest first."}
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <select
          className="rounded-md border border-input bg-card px-3 py-2 text-sm"
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value as "all" | ReminderType)}
        >
          <option value="all">All types</option>
          {Object.entries(REMINDER_LABELS).map(([k, label]) => (
            <option key={k} value={k}>
              {label}
            </option>
          ))}
        </select>
        {!isClient && (
          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            <input
              type="checkbox"
              checked={showDismissed}
              onChange={(e) => setShowDismissed(e.target.checked)}
            />
            Show dismissed
          </label>
        )}
      </div>

      <Card>
        {filtered.length === 0 && <p className="text-sm text-muted-foreground">Nothing to show.</p>}
        <ul className="space-y-3">
          {filtered.map((r) => {
            const st = reminderStatus(r.due_date);
            const client = db.clients.find((c) => c.id === r.client_id);
            return (
              <li
                key={r.id}
                className={
                  "rounded-md border border-border p-4 " + (r.dismissed ? "opacity-50" : "")
                }
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className={"inline-block h-2.5 w-2.5 rounded-full " + STATUS_DOT[st]} />
                      <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        {STATUS_LABEL[st]} · {REMINDER_LABELS[r.reminder_type]}
                      </span>
                      {!r.read && (
                        <span className="rounded-full bg-accent px-2 py-0.5 text-[10px] font-bold uppercase text-accent-foreground">
                          New
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-sm font-medium">
                      {!isClient && client && <>{client.name} — </>}
                      {r.message}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Due {new Date(r.due_date).toLocaleDateString("en-ZA")}
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    {!r.read && (
                      <button
                        className="rounded-md border border-border px-3 py-2 text-xs font-semibold hover:bg-muted"
                        onClick={() => markRead(r.id)}
                      >
                        Mark as read
                      </button>
                    )}
                    {!r.dismissed && (
                      <button
                        className="rounded-md border border-border px-3 py-2 text-xs font-semibold hover:bg-muted"
                        onClick={() => dismiss(r.id)}
                      >
                        Dismiss
                      </button>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      </Card>
    </div>
  );
}
