import { Link, createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { AppShell, Card, btn, btnGhost } from "@/components/AppShell";
import { rankTowProviders } from "@/lib/towing";
import { useDB, useSession } from "@/lib/store";

export const Route = createFileRoute("/claims/checklist")({
  head: () => ({
    meta: [
      { title: "Report an accident or loss — Royal Square Financial" },
      { name: "description", content: "A step-by-step checklist of everything to gather at an accident scene." },
      { property: "og:title", content: "Report an accident or loss — Royal Square Financial" },
      { property: "og:description", content: "What to photograph and collect at the scene before registering a motor claim." },
    ],
  }),
  component: () => (
    <AppShell allow={["client", "adviser", "admin"]}>
      <ChecklistPage />
    </AppShell>
  ),
});

const ITEMS = [
  {
    title: "Photograph every vehicle",
    instruction: "Open your phone's camera and take clear photos of each vehicle involved — get close-up shots of exactly where the damage is.",
  },
  {
    title: "Photograph the road and direction of travel",
    instruction: "Take a wide photo of the road surface, and note which direction each vehicle was travelling before the crash.",
  },
  {
    title: "Record the exact location",
    instruction: "Take a photo of a street sign, or write down the nearest two cross streets, so the location is on record.",
  },
  {
    title: "Photograph number plates and discs",
    instruction: "Take a clear, close-up photo of the licence plate and the windscreen registration disc of every vehicle involved.",
  },
  {
    title: "Photograph ID documents",
    instruction: "Photograph the ID document or driver's licence of everyone involved, including any witnesses.",
  },
  {
    title: "Get witness details",
    instruction: "Ask any witnesses for their full name and phone number. If they're willing, record a short voice note of what they saw.",
  },
  {
    title: "Write down insurance details",
    instruction: "Ask the other driver for their insurance company and policy number, and write it down or photograph it.",
  },
  {
    title: "Report it to the police",
    instruction: "Phone the police to report the accident. South African law requires this within 48 hours.",
  },
];

function ChecklistPage() {
  const db = useDB();
  const session = useSession();
  const [checked, setChecked] = useState<boolean[]>(ITEMS.map(() => false));
  const done = checked.filter(Boolean).length;

  const client = session?.role === "client" ? db.clients.find((c) => c.id === session.userId) : undefined;
  const towProviders = rankTowProviders(client?.city ?? "");

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold">Step 1 of 4 — At the scene</h1>
        <p className="text-sm text-muted-foreground">
          If anyone is hurt, call for medical help first. Once everyone is safe, work through this guide — it tells
          you exactly what to do, in order. Tick each one off as you finish it, then register your claim.
        </p>
      </div>

      <Card title={`Collected ${done} of ${ITEMS.length}`}>
        <div className="mb-4 h-3 w-full rounded-full bg-muted">
          <div className="h-3 rounded-full bg-primary transition-all" style={{ width: `${(done / ITEMS.length) * 100}%` }} />
        </div>
        <ul className="space-y-3">
          {ITEMS.map((item, i) => (
            <li key={item.title}>
              <label className="flex cursor-pointer items-start gap-3 rounded-md border border-border p-3 text-sm">
                <input
                  type="checkbox"
                  className="mt-0.5 h-5 w-5 shrink-0"
                  checked={checked[i]}
                  onChange={(e) =>
                    setChecked((prev) => prev.map((v, idx) => (idx === i ? e.target.checked : v)))
                  }
                />
                <span className={checked[i] ? "opacity-50" : ""}>
                  <span className={"block font-bold" + (checked[i] ? " line-through" : "")}>
                    {i + 1}. {item.title}
                  </span>
                  <span className="mt-0.5 block font-medium text-muted-foreground">{item.instruction}</span>
                </span>
              </label>
            </li>
          ))}
        </ul>
      </Card>

      {done > 0 && (
        <Card title="Step 2 of 4 — AI rapid assistance & tow support">
          <p className="text-sm text-muted-foreground">
            Approved towing providers ranked by distance and availability. Selecting a provider does not book a tow —
            you must call to confirm.
          </p>
          {towProviders.length === 0 ? (
            <p className="mt-3 rounded-md bg-warning/15 p-3 text-sm font-medium text-warning">
              No approved towing partner is on file for your area. This has been escalated — contact your adviser
              directly, or use the assistant chat in the bottom-right corner.
            </p>
          ) : (
            <ul className="mt-3 space-y-2">
              {towProviders.map((p) => (
                <li key={p.name} className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border p-3">
                  <div>
                    <p className="text-sm font-bold">
                      {p.name}{" "}
                      <span className="ml-1 rounded-full bg-success/15 px-2 py-0.5 text-[10px] font-bold uppercase text-success">
                        Approved
                      </span>
                    </p>
                    <p className="text-xs text-muted-foreground">
                      ~{p.distanceKm.toFixed(1)} km away · ETA {p.etaMinutes} min
                    </p>
                  </div>
                  <a href={`tel:${p.phone}`} className={btn}>
                    Call {p.phone}
                  </a>
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}

      <div className="flex flex-wrap gap-3">
        <Link to="/claims/new" className={btn}>Register a Motor Claim</Link>
        <Link to="/claims" className={btnGhost}>Back to claims</Link>
      </div>
    </div>
  );
}
