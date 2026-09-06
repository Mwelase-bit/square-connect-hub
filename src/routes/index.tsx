import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Lock, ShieldCheck, Target, TrendingUp } from "lucide-react";
import { useEffect, useState } from "react";
import { btn, btnGhost, input, label } from "@/components/AppShell";
import { audit, getDB, setSession, update } from "@/lib/store";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Sign in — Royal Square Financial" },
      {
        name: "description",
        content:
          "Sign in with a one-time PIN to your Royal Square Financial client or adviser portal.",
      },
      { property: "og:title", content: "Sign in — Royal Square Financial" },
      {
        property: "og:description",
        content: "Secure one-time PIN sign-in for Royal Square Financial clients and advisers.",
      },
    ],
  }),
  component: LoginPage,
});

type Step = "email" | "otp" | "register";
type DemoRole = "client" | "adviser" | "admin";

const DEMO_ACCOUNTS: Record<DemoRole, { name: string; email: string }[]> = {
  client: [
    { name: "Musa", email: "musa@email.com" },
    { name: "Jane Doe", email: "jane@email.com" },
    { name: "Bob Johnson", email: "bob@email.com" },
  ],
  adviser: [
    { name: "Awande Mthembu", email: "awande@royalsquare.co.za" },
    { name: "Lerato Mokoena", email: "lerato@royalsquare.co.za" },
  ],
  admin: [{ name: "Oarabetse", email: "admin@royalsquare.co.za" }],
};

const ROLE_LABEL: Record<DemoRole, string> = {
  client: "Client",
  adviser: "Adviser",
  admin: "Admin",
};

const VALUE_PROPS = [
  { icon: TrendingUp, text: "Real-time net worth dashboard for every client" },
  { icon: Target, text: "Automated reminders and visual goal tracking" },
  { icon: ShieldCheck, text: "Motor claims registered and tracked end-to-end" },
  { icon: Lock, text: "Secure one-time PIN sign-in — no passwords to manage" },
];

function LoginPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [sentOtp, setSentOtp] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [error, setError] = useState("");
  const [ready, setReady] = useState(false);
  const [demoRole, setDemoRole] = useState<DemoRole | null>(null);

  useEffect(() => setReady(true), []);

  const pickRole = (role: DemoRole) => {
    setDemoRole(role);
    setEmail(DEMO_ACCOUNTS[role][0]!.email);
    setError("");
  };

  const sendOtp = (value: string) => {
    const clean = value.trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(clean)) {
      setError("Please enter a valid email address.");
      return;
    }
    const code = String(Math.floor(100000 + Math.random() * 900000));
    setSentOtp(code);
    setEmail(clean);
    setError("");
    setStep("otp");
    // Mock OTP delivery — demo only.
    console.log(`[Royal Square] OTP for ${clean}: ${code}`);
  };

  const verify = () => {
    if (otp.trim() !== sentOtp) {
      setError("That PIN doesn't match. Please try again.");
      return;
    }
    setError("");
    const db = getDB();
    if (email === "admin@royalsquare.co.za") {
      setSession({ role: "admin", userId: 0, name: "Oarabetse", lastActivity: Date.now() });
      audit("login", "session", { email });
      void navigate({ to: "/adviser" });
      return;
    }
    const adviser = db.advisers.find((a) => a.email === email);
    if (adviser) {
      setSession({ role: "adviser", userId: adviser.id, name: adviser.name, lastActivity: Date.now() });
      audit("login", "session", { email });
      void navigate({ to: "/adviser" });
      return;
    }
    const client = db.clients.find((c) => c.email === email);
    if (client) {
      setSession({ role: "client", userId: client.id, name: client.name, lastActivity: Date.now() });
      audit("login", "session", { email });
      void navigate({ to: "/dashboard" });
      return;
    }
    setStep("register");
  };

  const register = () => {
    if (!name.trim() || !phone.trim()) {
      setError("Please give us your full name and phone number.");
      return;
    }
    if (!agreed) {
      setError("You must accept the Privacy Policy and Terms & Conditions to continue.");
      return;
    }
    const id = Date.now() % 100000;
    update((db) => {
      db.clients.push({
        id,
        email,
        phone: phone.trim(),
        name: name.trim(),
        address: "",
        city: "",
        postal_code: "",
        id_number: "",
        bank_name: "",
        bank_account_number: "",
        bank_branch_code: "",
        adviser_id: 1,
        profile_complete: false,
        date_joined: new Date().toISOString(),
        last_interaction: new Date().toISOString(),
      });
    });
    setSession({ role: "client", userId: id, name: name.trim(), lastActivity: Date.now() });
    audit("account_created", "client", { email });
    void navigate({ to: "/onboarding" });
  };

  return (
    <div className="flex min-h-screen bg-background">
      <div
        className="relative hidden w-1/2 flex-col justify-between overflow-hidden bg-secondary bg-cover bg-center p-12 text-secondary-foreground lg:flex"
        style={{ backgroundImage: "url(/background.jpeg)" }}
      >
        <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/60 to-black/40" />
        <div className="inline-flex w-fit rounded-md bg-card p-2 relative">
          <img src="/royal-square-logo.png" alt="Royal Square Financial logo" className="h-10 w-auto" />
        </div>
        <div className="relative">
          <h2 className="text-3xl font-extrabold leading-tight">
            Wealth, planned. Claims, handled. All in one place.
          </h2>
          <ul className="mt-8 space-y-5">
            {VALUE_PROPS.map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-start gap-3">
                <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-secondary-foreground/10">
                  <Icon className="h-5 w-5" />
                </span>
                <span className="text-base font-semibold">{text}</span>
              </li>
            ))}
          </ul>
        </div>
        <p className="relative text-xs font-medium text-secondary-foreground/70">
          Royal Square Financial (Pty) Ltd · FSP Number 29370
        </p>
      </div>

      <div className="flex w-full flex-col items-center justify-center px-4 py-10 lg:w-1/2">
        <img
          src="/royal-square-logo.png"
          alt="Royal Square Financial logo"
          className="mb-6 h-16 w-auto lg:hidden"
        />
        <div className="card-surface w-full max-w-md p-6">
          <h1 className="text-2xl font-extrabold">Client & Adviser Portal</h1>
          <p className="mt-1 text-sm font-medium text-muted-foreground">
            Sign in with a one-time PIN sent to your email.
          </p>

          {step === "email" && (
            <div className="mt-5 space-y-4">
              <div>
                <label className={label} htmlFor="email">Email address</label>
                <input id="email" className={input} value={email} onChange={(e) => { setEmail(e.target.value); setDemoRole(null); }} placeholder="you@email.com" />
              </div>
              <button className={btn + " w-full"} onClick={() => sendOtp(email)}>Send my PIN</button>

              {ready && (
                <div className="border-t border-border pt-4">
                  <p className={label}>Sign in as (demo)</p>
                  <div className="grid grid-cols-3 gap-2">
                    {(Object.keys(DEMO_ACCOUNTS) as DemoRole[]).map((role) => (
                      <button
                        key={role}
                        type="button"
                        onClick={() => pickRole(role)}
                        className={
                          "rounded-md border px-3 py-2 text-sm font-bold transition-colors " +
                          (demoRole === role
                            ? "border-primary bg-primary text-primary-foreground"
                            : "border-border bg-card hover:bg-muted")
                        }
                      >
                        {ROLE_LABEL[role]}
                      </button>
                    ))}
                  </div>
                  {demoRole && DEMO_ACCOUNTS[demoRole].length > 1 && (
                    <select
                      className={input + " mt-3"}
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                    >
                      {DEMO_ACCOUNTS[demoRole].map((a) => (
                        <option key={a.email} value={a.email}>
                          {a.name}
                        </option>
                      ))}
                    </select>
                  )}
                  {demoRole && (
                    <p className="mt-2 text-xs font-medium text-muted-foreground">
                      Email filled in above. Select "Send my PIN" to continue as{" "}
                      <strong className="font-bold text-foreground">
                        {DEMO_ACCOUNTS[demoRole].find((a) => a.email === email)?.name}
                      </strong>
                      .
                    </p>
                  )}
                </div>
              )}
            </div>
          )}

          {step === "otp" && (
            <div className="mt-5 space-y-4">
              <p className="rounded-md bg-accent px-3 py-2 text-sm font-medium text-accent-foreground">
                PIN sent to <strong className="font-bold">{email}</strong>: <strong className="font-bold">{sentOtp}</strong>
              </p>
              <div>
                <label className={label} htmlFor="otp">6-digit PIN</label>
                <input id="otp" className={input} value={otp} onChange={(e) => setOtp(e.target.value)} inputMode="numeric" />
              </div>
              <button className={btn + " w-full"} onClick={verify}>Verify and continue</button>
              <button className={btnGhost + " w-full"} onClick={() => { setStep("email"); setOtp(""); }}>Use a different email</button>
            </div>
          )}

          {step === "register" && (
            <div className="mt-5 space-y-4">
              <p className="text-sm font-medium text-muted-foreground">Welcome! Let's create your profile.</p>
              <div>
                <label className={label} htmlFor="name">Full name</label>
                <input id="name" className={input} value={name} onChange={(e) => setName(e.target.value)} />
              </div>
              <div>
                <label className={label} htmlFor="phone">Phone number</label>
                <input id="phone" className={input} value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+27 ..." />
              </div>
              <label className="flex items-start gap-3 text-sm">
                <input type="checkbox" className="mt-1 h-5 w-5" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} />
                <span>
                  I have read and accept the Royal Square Financial Privacy Policy and Terms & Conditions, and I consent to my
                  personal information being processed in line with POPIA.
                </span>
              </label>
              <button className={btn + " w-full"} onClick={register}>Create my account</button>
            </div>
          )}

          {error && <p className="mt-4 text-sm font-medium text-danger">{error}</p>}
        </div>
      </div>
    </div>
  );
}
