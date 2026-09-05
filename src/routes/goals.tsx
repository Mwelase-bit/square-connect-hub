import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { AppShell, Card, btn, btnGhost, input, label } from "@/components/AppShell";
import { audit, formatZAR, update, useDB, useSession } from "@/lib/store";

export const Route = createFileRoute("/goals")({
  head: () => ({
    meta: [
      { title: "Goals — Royal Square Financial" },
      { name: "description", content: "Track progress toward financial goals." },
      { property: "og:title", content: "Goals — Royal Square Financial" },
      {
        property: "og:description",
        content: "Individual and shared financial goals with progress tracking.",
      },
    ],
  }),
  component: () => (
    <AppShell>
      <GoalsPage />
    </AppShell>
  ),
});

function GoalsPage() {
  const db = useDB();
  const session = useSession()!;
  const isClient = session.role === "client";
  const [showForm, setShowForm] = useState(false);

  const myClients = db.clients.filter(
    (c) => session.role === "admin" || c.adviser_id === session.userId,
  );
  const goals = isClient
    ? db.goals.filter((g) => g.shared_client_ids.includes(session.userId))
    : db.goals.filter((g) => g.shared_client_ids.some((id) => myClients.some((c) => c.id === id)));

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">{isClient ? "My goals" : "Client goals"}</h1>
          <p className="text-sm text-muted-foreground">
            {isClient
              ? "Progress toward the targets your adviser set with you."
              : "Goals created for your clients."}
          </p>
        </div>
        {!isClient && (
          <button className={btn} onClick={() => setShowForm((s) => !s)}>
            {showForm ? "Cancel" : "Create a goal"}
          </button>
        )}
      </div>

      {!isClient && showForm && <GoalForm clients={myClients} onDone={() => setShowForm(false)} />}

      <div className="grid gap-4 md:grid-cols-2">
        {goals.length === 0 && <p className="text-sm text-muted-foreground">No goals yet.</p>}
        {goals.map((g) => {
          const pct = Math.min(100, Math.round((g.current_amount / g.target_amount) * 100));
          const names = g.shared_client_ids
            .map((id) => db.clients.find((c) => c.id === id)?.name)
            .filter(Boolean)
            .join(", ");
          return (
            <Card key={g.id} title={g.goal_name}>
              <p className="text-sm text-muted-foreground">{g.description}</p>
              {!isClient && (
                <p className="mt-1 text-xs text-muted-foreground">
                  {names} · {g.shared_client_ids.length > 1 ? "Shared" : "Individual"}
                </p>
              )}
              <p className="mt-3 text-sm font-medium">
                {pct}% toward target ({formatZAR(g.current_amount)} of {formatZAR(g.target_amount)}{" "}
                by{" "}
                {new Date(g.target_date).toLocaleDateString("en-ZA", {
                  month: "short",
                  year: "numeric",
                })}
                )
              </p>
              <div className="mt-2 h-3 w-full rounded-full bg-muted">
                <div
                  className="h-3 rounded-full bg-primary transition-all"
                  style={{ width: `${pct}%` }}
                />
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

function GoalForm({
  clients,
  onDone,
}: {
  clients: { id: number; name: string }[];
  onDone: () => void;
}) {
  const session = useSession()!;
  const [goalName, setGoalName] = useState("");
  const [targetAmount, setTargetAmount] = useState("");
  const [currentAmount, setCurrentAmount] = useState("0");
  const [targetDate, setTargetDate] = useState("");
  const [description, setDescription] = useState("");
  const [selected, setSelected] = useState<number[]>([]);
  const [error, setError] = useState("");

  const toggle = (id: number) =>
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const submit = () => {
    if (!goalName.trim() || !targetAmount || !targetDate || selected.length === 0) {
      setError("Please provide a goal name, target amount, target date and at least one client.");
      return;
    }
    update((db) => {
      db.seq += 1;
      db.goals.push({
        id: db.seq,
        created_by_adviser_id: session.userId,
        goal_name: goalName.trim(),
        target_amount: Number(targetAmount),
        current_amount: Number(currentAmount) || 0,
        target_date: targetDate,
        description: description.trim(),
        shared_client_ids: selected,
        created_at: new Date().toISOString(),
      });
    });
    audit("form_submitted", "goal", { goal: goalName.trim(), clients: selected });
    onDone();
  };

  return (
    <Card title="New goal">
      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <label className={label} htmlFor="goal_name">
            Goal name
          </label>
          <input
            id="goal_name"
            className={input}
            value={goalName}
            onChange={(e) => setGoalName(e.target.value)}
          />
        </div>
        <div>
          <label className={label} htmlFor="target_amount">
            Target amount (R)
          </label>
          <input
            id="target_amount"
            type="number"
            className={input}
            value={targetAmount}
            onChange={(e) => setTargetAmount(e.target.value)}
          />
        </div>
        <div>
          <label className={label} htmlFor="current_amount">
            Current amount (R)
          </label>
          <input
            id="current_amount"
            type="number"
            className={input}
            value={currentAmount}
            onChange={(e) => setCurrentAmount(e.target.value)}
          />
        </div>
        <div>
          <label className={label} htmlFor="target_date">
            Target date
          </label>
          <input
            id="target_date"
            type="date"
            className={input}
            value={targetDate}
            onChange={(e) => setTargetDate(e.target.value)}
          />
        </div>
        <div className="md:col-span-2">
          <label className={label} htmlFor="description">
            Description
          </label>
          <textarea
            id="description"
            className={input}
            rows={2}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>
        <div className="md:col-span-2">
          <p className={label}>
            Clients (select one for an individual goal, multiple for a shared goal)
          </p>
          <div className="flex flex-wrap gap-2">
            {clients.map((c) => (
              <label
                key={c.id}
                className={
                  "cursor-pointer rounded-full border px-3 py-2 text-sm " +
                  (selected.includes(c.id)
                    ? "border-primary bg-accent text-accent-foreground"
                    : "border-border")
                }
              >
                <input
                  type="checkbox"
                  className="hidden"
                  checked={selected.includes(c.id)}
                  onChange={() => toggle(c.id)}
                />
                {c.name}
              </label>
            ))}
          </div>
        </div>
      </div>
      {error && <p className="mt-3 text-sm font-medium text-danger">{error}</p>}
      <div className="mt-4 flex gap-3">
        <button className={btn} onClick={submit}>
          Create goal
        </button>
        <button className={btnGhost} onClick={onDone}>
          Cancel
        </button>
      </div>
    </Card>
  );
}
