import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";
import {
  SESSION_TIMEOUT_MS,
  audit,
  getSession,
  setSession,
  touchSession,
  useSession,
} from "@/lib/store";
import type { Role } from "@/lib/types";
import { ApiLogPanel } from "./ApiLogPanel";

const clientNav = [
  { to: "/dashboard", label: "Dashboard" },
  { to: "/claims", label: "Claims" },
  { to: "/reminders", label: "Reminders" },
  { to: "/goals", label: "Goals" },
  { to: "/onboarding", label: "Documents" },
  { to: "/profile", label: "Profile" },
] as const;

const staffNav = [
  { to: "/adviser", label: "Dashboard" },
  { to: "/claims", label: "Claims" },
  { to: "/reminders", label: "Reminders" },
  { to: "/goals", label: "Goals" },
  { to: "/audit", label: "Audit trail" },
  { to: "/profile", label: "Profile" },
] as const;

export function AppShell({
  children,
  allow,
}: {
  children: ReactNode;
  allow?: Role[];
}) {
  const session = useSession();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [ready, setReady] = useState(false);

  useEffect(() => setReady(true), []);

  useEffect(() => {
    if (!ready) return;
    if (!session) {
      void navigate({ to: "/" });
      return;
    }
    touchSession();
  }, [ready, session, pathname, navigate]);

  useEffect(() => {
    const t = setInterval(() => {
      if (ready && !getSession()) void navigate({ to: "/" });
    }, 15000);
    return () => clearInterval(t);
  }, [ready, navigate]);

  if (!ready || !session) {
    return (
      <div className="flex min-h-screen items-center justify-center text-muted-foreground">
        Loading…
      </div>
    );
  }

  if (allow && !allow.includes(session.role)) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 px-6 text-center">
        <p className="text-4xl font-bold text-primary">403</p>
        <h1 className="text-xl font-semibold">You don't have access to this page</h1>
        <p className="text-sm text-muted-foreground">
          Your role ({session.role}) may not view this information.
        </p>
        <Link to="/" className="mt-2 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">
          Go home
        </Link>
      </div>
    );
  }

  const nav = session.role === "client" ? clientNav : staffNav;

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 border-b border-border bg-card">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-3 px-4 py-3">
          <Link to={session.role === "client" ? "/dashboard" : "/adviser"} className="flex items-center gap-2">
            <img
              src="/royal-square-logo.png"
              alt="Royal Square Financial logo"
              className="h-10 w-auto"
            />
          </Link>
          <div className="ml-auto flex items-center gap-3">
            <div className="text-right leading-tight">
              <p className="text-sm font-semibold">{session.name}</p>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">{session.role}</p>
            </div>
            <button
              onClick={() => {
                audit("logout", "session");
                setSession(null);
                void navigate({ to: "/" });
              }}
              className="rounded-md border border-border px-3 py-2 text-sm font-medium hover:bg-muted"
            >
              Log out
            </button>
          </div>
          <nav className="order-last flex w-full gap-1 overflow-x-auto pt-2 text-sm">
            {nav.map((n) => (
              <Link
                key={n.to}
                to={n.to}
                className="shrink-0 rounded-md px-3 py-2 font-medium text-muted-foreground hover:bg-muted"
                activeProps={{ className: "shrink-0 rounded-md px-3 py-2 font-semibold bg-secondary text-secondary-foreground" }}
              >
                {n.label}
              </Link>
            ))}
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
      <footer className="mx-auto max-w-6xl px-4 pb-10 text-xs text-muted-foreground">
        Royal Square Financial (Pty) Ltd — demo environment. Sessions expire after{" "}
        {SESSION_TIMEOUT_MS / 60000} minutes of inactivity.
      </footer>
      <ApiLogPanel />
    </div>
  );
}

export function Card({
  title,
  children,
  action,
}: {
  title?: string;
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <section className="card-surface p-5">
      {(title || action) && (
        <div className="mb-3 flex items-center justify-between gap-2">
          {title && <h2 className="text-base font-semibold">{title}</h2>}
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

export function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="card-surface p-5">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-bold text-foreground">{value}</p>
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

export const btn =
  "inline-flex items-center justify-center rounded-md bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50";
export const btnGhost =
  "inline-flex items-center justify-center rounded-md border border-border bg-card px-4 py-3 text-sm font-semibold hover:bg-muted disabled:opacity-50";
export const input =
  "w-full rounded-md border border-input bg-card px-3 py-3 text-base outline-none focus:border-ring focus:ring-2 focus:ring-ring/30";
export const label = "mb-1 block text-sm font-medium text-foreground";
