import { Link, createFileRoute } from "@tanstack/react-router";
import { Camera } from "lucide-react";
import { useState } from "react";
import { AppShell, Avatar, Card, btn, input, label } from "@/components/AppShell";
import { audit, update, useDB, useSession } from "@/lib/store";

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

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

function AvatarUpload({
  name,
  avatarUrl,
  onUpload,
}: {
  name: string;
  avatarUrl?: string | undefined;
  onUpload: (dataUrl: string) => void;
}) {
  const inputId = "avatar-" + name.replace(/\s+/g, "-").toLowerCase();
  return (
    <div className="relative h-16 w-16 shrink-0">
      <Avatar name={name} avatarUrl={avatarUrl} />
      <label
        htmlFor={inputId}
        className="absolute -bottom-1 -right-1 flex h-6 w-6 cursor-pointer items-center justify-center rounded-full border-2 border-card bg-primary text-primary-foreground"
        title="Change profile photo"
      >
        <Camera className="h-3.5 w-3.5" />
        <input
          id={inputId}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void readAsDataUrl(f).then(onUpload);
          }}
        />
      </label>
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
          {adviser ? (
            <AvatarUpload
              name={session.name}
              avatarUrl={adviser.avatar_base64}
              onUpload={(dataUrl) => {
                update((db) => {
                  const a = db.advisers.find((x) => x.id === adviser.id);
                  if (a) a.avatar_base64 = dataUrl;
                });
                audit("data_viewed", "adviser", { action: "avatar_updated" });
              }}
            />
          ) : (
            <Avatar name={session.name} />
          )}
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
  });

  const set = (k: keyof typeof values, v: string) => setValues((p) => ({ ...p, [k]: v }));

  const save = () => {
    update((db) => {
      const c = db.clients.find((x) => x.id === client.id);
      if (!c) return;
      c.name = values.name.trim();
      c.email = values.email.trim();
      c.phone = values.phone.trim();
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
            <AvatarUpload
              name={client.name}
              avatarUrl={client.avatar_base64}
              onUpload={(dataUrl) => {
                update((db) => {
                  const c = db.clients.find((x) => x.id === client.id);
                  if (c) c.avatar_base64 = dataUrl;
                });
                audit("data_viewed", "client", { action: "avatar_updated" });
              }}
            />
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
              <span className="text-muted-foreground">ID number:</span> {client.id_number || "—"}
            </p>
          </div>
        )}
      </Card>

      <Card title="Address">
        <p className="text-sm font-medium">
          {client.address ? `${client.address}, ${client.city} ${client.postal_code}` : "No address on file."}
        </p>
        <p className="mt-2 text-xs text-muted-foreground">
          Address changes require adviser verification. Contact your adviser directly, or{" "}
          <Link to="/requests" className="font-semibold text-primary underline">
            request a consultation
          </Link>
          .
        </p>
      </Card>

      <Card title="Bank details">
        <p className="text-sm font-medium">
          {client.bank_name
            ? `${client.bank_name} · account ${client.bank_account_number} · branch ${client.bank_branch_code}`
            : "No bank details on file."}
        </p>
        <p className="mt-2 text-xs text-muted-foreground">
          Bank changes require step-up verification and adviser approval. Contact your adviser directly, or{" "}
          <Link to="/requests" className="font-semibold text-primary underline">
            request a consultation
          </Link>
          .
        </p>
      </Card>
    </div>
  );
}
