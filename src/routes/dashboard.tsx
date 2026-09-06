import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { AppShell, Avatar, Card, Stat, btn, btnGhost } from "@/components/AppShell";
import { PANIC_HOLD_SECONDS, activateIncident } from "@/lib/incidents";
import { FORM_TYPES, formatZAR, netWorth, reminderStatus, useDB, useSession } from "@/lib/store";

export const Route = createFileRoute("/dashboard")({
  head: () => ({
    meta: [
      { title: "My dashboard — Royal Square Financial" },
      { name: "description", content: "Your policies, investments, goals and reminders at a glance." },
      { property: "og:title", content: "My dashboard — Royal Square Financial" },
      { property: "og:description", content: "See your net worth, policies, investments and adviser in one place." },
    ],
  }),
  component: () => (
    <AppShell allow={["client"]}>
      <ClientDashboard />
    </AppShell>
  ),
});

function ClientDashboard() {
  const db = useDB();
  const session = useSession()!;
  const client = db.clients.find((c) => c.id === session.userId);
  if (!client) return <p>Client record not found.</p>;

  const adviser = db.advisers.find((a) => a.id === client.adviser_id);
  const policies = db.policies.filter((p) => p.client_id === client.id && p.kind === "policy");
  const investments = db.policies.filter((p) => p.client_id === client.id && p.kind === "investment");
  const premium = policies.reduce((s, p) => s + p.annual_premium, 0);
  const invested = investments.reduce((s, p) => s + p.value, 0);
  const goals = db.goals.filter((g) => g.shared_client_ids.includes(client.id));
  const reminders = db.reminders.filter(
    (r) => r.client_id === client.id && r.audience !== "adviser" && !r.dismissed,
  );
  const signed = db.forms.filter((f) => f.client_id === client.id && f.signed).length;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-4">
        <Avatar name={client.name} avatarUrl={client.avatar_base64} />
        <div>
          <h1 className="text-2xl font-bold">{client.name}</h1>
          <p className="text-sm text-muted-foreground">{client.email} · {client.phone}</p>
        </div>
      </div>

      {signed < FORM_TYPES.length && (
        <div className="rounded-md border border-primary/40 bg-accent p-4 text-sm text-accent-foreground">
          <strong>Onboarding incomplete:</strong> {signed} of {FORM_TYPES.length} documents signed.{" "}
          <Link to="/onboarding" className="font-semibold underline">Finish signing now</Link>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Estimated net worth" value={formatZAR(netWorth(client.id))} hint="Policies + investments" />
        <Stat label="Active policies" value={String(policies.length)} hint={`${formatZAR(premium)} annual premium`} />
        <Stat label="Investment holdings" value={String(investments.length)} hint={formatZAR(invested)} />
        <Stat label="Open reminders" value={String(reminders.filter((r) => !r.read).length)} hint="Unread" />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <PanicButton clientId={client.id} adviserId={client.adviser_id} />

          <Card title="Quick actions">
            <div className="flex flex-wrap gap-3">
              <Link to="/claims/checklist" className={btn}>Report an Accident or Loss</Link>
              <Link to="/claims/new" className={btnGhost}>Register a Motor Claim</Link>
              <Link to="/profile" className={btnGhost}>Update Profile</Link>
              <Link to="/reminders" className={btnGhost}>View Reminders</Link>
              <Link to="/goals" className={btnGhost}>View My Goals</Link>
            </div>
          </Card>

          <Card title="My policies and investments">
            <ul className="space-y-3">
              {db.policies.filter((p) => p.client_id === client.id).map((p) => (
                <li key={p.id} className="rounded-md border border-border p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="font-semibold">{p.insurer} — {p.product}</p>
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">{p.kind}</p>
                    </div>
                    <div className="text-right text-sm">
                      {p.value > 0 && <p className="font-semibold">{formatZAR(p.value)}</p>}
                      {p.annual_premium > 0 && (
                        <p className="text-muted-foreground">{formatZAR(p.annual_premium)} / year</p>
                      )}
                    </div>
                  </div>
                  <div className="mt-2 h-2 w-full rounded-full bg-muted">
                    <div
                      className="h-2 rounded-full bg-primary"
                      style={{ width: `${Math.min(100, (p.value || p.annual_premium * 10) / 5000)}%` }}
                    />
                  </div>
                </li>
              ))}
            </ul>
          </Card>

          <Card title="My goals" action={<Link to="/goals" className="text-sm font-semibold text-primary">View all</Link>}>
            {goals.length === 0 && <p className="text-sm text-muted-foreground">No goals yet.</p>}
            <ul className="space-y-3">
              {goals.map((g) => {
                const pct = Math.min(100, Math.round((g.current_amount / g.target_amount) * 100));
                return (
                  <li key={g.id}>
                    <p className="text-sm font-medium">
                      {g.goal_name}: {pct}% toward target ({formatZAR(g.current_amount)} of {formatZAR(g.target_amount)} by{" "}
                      {new Date(g.target_date).toLocaleDateString("en-ZA", { month: "short", year: "numeric" })})
                    </p>
                    <div className="mt-1 h-3 w-full rounded-full bg-muted">
                      <div className="h-3 rounded-full bg-primary" style={{ width: `${pct}%` }} />
                    </div>
                  </li>
                );
              })}
            </ul>
          </Card>
        </div>

        <div className="space-y-4">
          <Card title="My adviser">
            {adviser ? (
              <div className="text-sm">
                <p className="text-base font-semibold">{adviser.name}</p>
                <p className="text-muted-foreground">{adviser.email}</p>
                <p className="text-muted-foreground">{adviser.phone}</p>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Not yet assigned.</p>
            )}
          </Card>

          <Card title="Upcoming reminders">
            {reminders.length === 0 && <p className="text-sm text-muted-foreground">Nothing due.</p>}
            <ul className="space-y-2 text-sm">
              {reminders.slice(0, 4).map((r) => {
                const st = reminderStatus(r.due_date);
                return (
                  <li key={r.id} className="rounded-md border border-border p-2">
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
            </ul>
          </Card>

          <Card title="Signed documents">
            <p className="text-sm text-muted-foreground">{signed} of {FORM_TYPES.length} documents signed.</p>
            <Link to="/onboarding" className={btnGhost + " mt-3"}>Download my documents</Link>
          </Card>
        </div>
      </div>
    </div>
  );
}

function PanicButton({ clientId, adviserId }: { clientId: number; adviserId: number }) {
  const navigate = useNavigate();
  const [holding, setHolding] = useState(false);
  const [progress, setProgress] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startRef = useRef(0);

  const stop = () => {
    setHolding(false);
    setProgress(0);
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
  };

  const start = () => {
    setHolding(true);
    startRef.current = Date.now();
    timerRef.current = setInterval(() => {
      const elapsed = (Date.now() - startRef.current) / 1000;
      const pct = Math.min(1, elapsed / PANIC_HOLD_SECONDS);
      setProgress(pct);
      if (pct >= 1) {
        stop();
        activateIncident(clientId, adviserId);
        void navigate({ to: "/claims/checklist" });
      }
    }, 50);
  };

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const radius = 28;
  const circumference = 2 * Math.PI * radius;

  return (
    <div className="flex flex-wrap items-center gap-4 rounded-md border border-danger/40 bg-danger/5 p-4">
      <button
        type="button"
        onPointerDown={start}
        onPointerUp={stop}
        onPointerLeave={stop}
        className="relative flex h-16 w-16 shrink-0 select-none items-center justify-center rounded-full bg-danger text-xs font-extrabold text-white"
      >
        <svg className="absolute inset-0 h-16 w-16 -rotate-90" viewBox="0 0 64 64">
          <circle cx="32" cy="32" r={radius} fill="none" stroke="white" strokeOpacity="0.35" strokeWidth="4" />
          <circle
            cx="32"
            cy="32"
            r={radius}
            fill="none"
            stroke="white"
            strokeWidth="4"
            strokeDasharray={circumference}
            strokeDashoffset={circumference * (1 - progress)}
          />
        </svg>
        {holding ? `${Math.ceil(PANIC_HOLD_SECONDS * (1 - progress))}s` : "SOS"}
      </button>
      <div>
        <p className="text-sm font-bold text-danger">Emergency? Press and hold for help</p>
        <p className="text-xs font-medium text-muted-foreground">
          Hold for {PANIC_HOLD_SECONDS} seconds to alert your adviser immediately and start an accident report. This
          notifies Royal Square — it is not an emergency services line.
        </p>
      </div>
    </div>
  );
}
