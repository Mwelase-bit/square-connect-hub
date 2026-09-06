import { useState } from "react";
import { useDB, useSession } from "@/lib/store";

export function ApiLogPanel() {
  const db = useDB();
  const session = useSession();
  const [open, setOpen] = useState(false);

  if (!session || session.role === "client") return null;

  return (
    <>
      <button
        onClick={() => setOpen((o) => !o)}
        className="fixed bottom-4 right-4 z-40 rounded-full bg-secondary px-4 py-3 text-sm font-semibold text-secondary-foreground shadow-lg"
      >
        {open ? "Hide" : "Show"} API log ({db.apiLog.length})
      </button>
      {open && (
        <div className="fixed bottom-20 right-4 z-40 max-h-[60vh] w-[min(560px,92vw)] overflow-auto rounded-lg border border-border bg-secondary p-4 text-secondary-foreground shadow-2xl">
          <h3 className="mb-2 text-sm font-bold uppercase tracking-wide">Mock integration console</h3>
          {db.apiLog.length === 0 && (
            <p className="text-xs opacity-70">No API calls yet. Submit a claim to see the request and response.</p>
          )}
          <ul className="space-y-3">
            {db.apiLog.map((e) => (
              <li key={e.id} className="rounded-md bg-black/25 p-3">
                <p className="text-xs font-semibold">
                  {e.method} {e.url}
                </p>
                <p className="text-[11px] opacity-70">{new Date(e.timestamp).toLocaleString("en-ZA")}</p>
                <p className="mt-2 text-[11px] font-semibold uppercase opacity-70">Request</p>
                <pre className="overflow-auto text-[11px] leading-snug">{JSON.stringify(e.request, null, 2)}</pre>
                <p className="mt-2 text-[11px] font-semibold uppercase opacity-70">Response</p>
                <pre className="overflow-auto text-[11px] leading-snug">{JSON.stringify(e.response, null, 2)}</pre>
              </li>
            ))}
          </ul>
        </div>
      )}
    </>
  );
}
