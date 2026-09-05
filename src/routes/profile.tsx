import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { AppShell, Card, btn, input, label } from "@/components/AppShell";
import { audit, update, useDB, useSession } from "@/lib/store";

export const Route = createFileRoute("/profile")({
  head: () => ({
    meta: [
      { title: "Profile — Royal Square Financial" },
      { name: "description", content: "View and update your profile details." },
      { property: "og:title", content: "Profile — Royal Square Financial" },
      { property: "og:description", content: "Manage your Royal Square Financial profile." },
    ],
  }),
  component: () => (
    <AppShell>
      <ProfilePage />
    </AppShell>
  ),
});

function Initials({ name }: { name: string }) {
  return (
    <div className="flex h-16 w-16 items-center justify-center rounded-full bg-secondary text-xl font-bold text-secondary-foreground">
      {name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .slice(0, 2)}
    </div>
  );
}

function ProfilePage() {
  const db = useDB();
  const session = useSession()!;

  if (session.role === "client") {
    const client = db.clients.find((c) => c.id === session.userId);
    if (!client) return <p>Client record not found.</p>;
    return <ClientProfile client={client} />;
  }

  const adviser = db.advisers.find((a) => a.id === session.userId);
  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold">Profile</h1>
      <Card>
        <div className="flex items-center gap-4">
          <Initials name={session.name} />
          <div>
            <p className="text-lg font-semibold">{session.name}</p>
            <p className="text-sm capitalize text-muted-foreground">{session.role}</p>
          </div>
        </div>
        {adviser && (
          <div className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
            <p>
              <span className="text-muted-foreground">Email:</span> {adviser.email}
            </p>
            <p>
              <span className="text-muted-foreground">Phone:</span> {adviser.phone}
            </p>
          </div>
        )}
        {!adviser && (
          <p className="mt-4 text-sm text-muted-foreground">
            Signed in as an administrator. Profile editing is not applicable to this role.
          </p>
        )}
      </Card>
    </div>
  );
}

function ClientProfile({ client }: { client: ReturnType<typeof useDB>["clients"][number] }) {
  const [editing, setEditing] = useState(false);
  const [values, setValues] = useState({
    name: client.name,
    email: client.email,
    phone: client.phone,
    address: client.address,
    city: client.city,
    postal_code: client.postal_code,
  });

  const set = (k: keyof typeof values, v: string) => setValues((p) => ({ ...p, [k]: v }));

  const save = () => {
    update((db) => {
      const c = db.clients.find((x) => x.id === client.id);
      if (!c) return;
      c.name = values.name.trim();
      c.email = values.email.trim();
      c.phone = values.phone.trim();
      c.address = values.address.trim();
      c.city = values.city.trim();
      c.postal_code = values.postal_code.trim();
      c.last_interaction = new Date().toISOString();
    });
    audit("data_viewed", "client", { action: "profile_updated" });
    setEditing(false);
  };

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold">My profile</h1>
      <Card>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Initials name={client.name} />
            <div>
              <p className="text-lg font-semibold">{client.name}</p>
              <p className="text-sm text-muted-foreground">
                Client since {new Date(client.date_joined).toLocaleDateString("en-ZA")}
              </p>
            </div>
          </div>
          {!editing && (
            <button className={btn} onClick={() => setEditing(true)}>
              Edit profile
            </button>
          )}
        </div>

        {editing ? (
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <div>
              <label className={label} htmlFor="p_name">
                Full name
              </label>
              <input
                id="p_name"
                className={input}
                value={values.name}
                onChange={(e) => set("name", e.target.value)}
              />
            </div>
            <div>
              <label className={label} htmlFor="p_email">
                Email
              </label>
              <input
                id="p_email"
                className={input}
                value={values.email}
                onChange={(e) => set("email", e.target.value)}
              />
            </div>
            <div>
              <label className={label} htmlFor="p_phone">
                Phone
              </label>
              <input
                id="p_phone"
                className={input}
                value={values.phone}
                onChange={(e) => set("phone", e.target.value)}
              />
            </div>
            <div>
              <label className={label} htmlFor="p_address">
                Street address
              </label>
              <input
                id="p_address"
                className={input}
                value={values.address}
                onChange={(e) => set("address", e.target.value)}
              />
            </div>
            <div>
              <label className={label} htmlFor="p_city">
                City
              </label>
              <input
                id="p_city"
                className={input}
                value={values.city}
                onChange={(e) => set("city", e.target.value)}
              />
            </div>
            <div>
              <label className={label} htmlFor="p_postal">
                Postal code
              </label>
              <input
                id="p_postal"
                className={input}
                value={values.postal_code}
                onChange={(e) => set("postal_code", e.target.value)}
              />
            </div>
            <div className="flex gap-3 md:col-span-2">
              <button className={btn} onClick={save}>
                Save changes
              </button>
              <button
                className="rounded-md border border-border bg-card px-4 py-3 text-sm font-semibold hover:bg-muted"
                onClick={() => setEditing(false)}
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <div className="mt-5 grid gap-3 text-sm sm:grid-cols-2">
            <p>
              <span className="text-muted-foreground">Email:</span> {client.email}
            </p>
            <p>
              <span className="text-muted-foreground">Phone:</span> {client.phone}
            </p>
            <p>
              <span className="text-muted-foreground">Address:</span> {client.address || "—"}
            </p>
            <p>
              <span className="text-muted-foreground">City:</span> {client.city || "—"}
            </p>
            <p>
              <span className="text-muted-foreground">Postal code:</span>{" "}
              {client.postal_code || "—"}
            </p>
            <p>
              <span className="text-muted-foreground">ID number:</span> {client.id_number || "—"}
            </p>
          </div>
        )}
      </Card>
    </div>
  );
}
