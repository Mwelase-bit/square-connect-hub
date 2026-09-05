import { createFileRoute, useNavigate } from "@tanstack/react-router";
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

  useEffect(() => setReady(true), []);

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
      setError("That PIN doesn't match. Check the browser console for the demo PIN.");
      return;
    }
    setError("");
    const db = getDB();
    if (email === "admin@royalsquare.co.za") {
      setSession({ role: "admin", userId: 0, name: "Royal Square Admin", lastActivity: Date.now() });
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
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4 py-10">
      <img
        src="/royal-square-logo.png"
        alt="Royal Square Financial logo"
        className="mb-6 h-16 w-auto"
      />
      <div className="card-surface w-full max-w-md p-6">
        <h1 className="text-xl font-bold">Client & Adviser Portal</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Sign in with a one-time PIN. For this demo the PIN is printed in the browser console.
        </p>

        {step === "email" && (
          <div className="mt-5 space-y-4">
            <div>
              <label className={label} htmlFor="email">Email address</label>
              <input id="email" className={input} value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@email.com" />
            </div>
            <button className={btn + " w-full"} onClick={() => sendOtp(email)}>Send my PIN</button>
          </div>
        )}

        {step === "otp" && (
          <div className="mt-5 space-y-4">
            <p className="rounded-md bg-accent px-3 py-2 text-sm text-accent-foreground">
              Demo PIN sent to <strong>{email}</strong>: <strong>{sentOtp}</strong>
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
            <p className="text-sm text-muted-foreground">Welcome! Let's create your profile.</p>
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

      {ready && (
        <div className="mt-6 w-full max-w-md text-sm text-muted-foreground">
          <p className="font-semibold text-foreground">Demo sign-ins</p>
          <p>Clients: john@email.com · jane@email.com · bob@email.com</p>
          <p>Advisers: qiniso@royalsquare.co.za · lerato@royalsquare.co.za</p>
          <p>Admin: admin@royalsquare.co.za</p>
        </div>
      )}
    </div>
  );
}
