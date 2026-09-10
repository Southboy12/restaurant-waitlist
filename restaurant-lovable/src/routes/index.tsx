import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Badge, Button, Field } from "@/components/waitlist/ui";
import {
  RESTAURANT_NAME,
  SAMPLE_ACTIVE,
  SAMPLE_HISTORY,
  SMS_TEMPLATE,
  TIMEOUT_OPTIONS,
  formatClock,
  formatDuration,
  waitedLabel,
  type Party,
} from "@/lib/waitlist";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: `Waitlist Manager – ${RESTAURANT_NAME}` },
      {
        name: "description",
        content:
          "Staff waitlist board: add parties, text them when a table is ready, track countdowns and seating history.",
      },
      { property: "og:title", content: `Waitlist Manager – ${RESTAURANT_NAME}` },
      {
        property: "og:description",
        content: "Add parties, notify by text, watch the countdown, and log every seating.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: WaitlistPage,
});

function useNow(active: boolean) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    const tick = () => setNow(Date.now());
    const id = window.setInterval(tick, 1000);
    document.addEventListener("visibilitychange", tick);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [active]);
  return now;
}

function WaitlistPage() {
  const [active, setActive] = useState<Party[]>(SAMPLE_ACTIVE);
  const [history, setHistory] = useState<Party[]>(SAMPLE_HISTORY);
  const [tab, setTab] = useState<"active" | "history">("active");
  const [timeout, setTimeoutMins] = useState(15);
  const [form, setForm] = useState({ name: "", size: "2", phone: "" });
  const [toast, setToast] = useState<string | null>(null);

  const now = useNow(true);

  useEffect(() => {
    if (!toast) return;
    const id = window.setTimeout(() => setToast(null), 3200);
    return () => window.clearTimeout(id);
  }, [toast]);

  // Auto-remove expired parties (timestamp based, survives backgrounding).
  useEffect(() => {
    const expired = active.filter((p) => p.expiresAt !== null && p.expiresAt <= now);
    if (expired.length === 0) return;
    setActive((list) => list.filter((p) => !expired.some((e) => e.id === p.id)));
    setHistory((list) => [
      ...expired.map((p) => ({
        ...p,
        resolvedAt: p.expiresAt ?? now,
        resolution: "no-show" as const,
      })),
      ...list,
    ]);
  }, [now, active]);

  const waiting = active.length;
  const notified = active.filter((p) => p.notifiedAt).length;
  const avgWait = useMemo(() => {
    if (!active.length) return 0;
    return Math.round(
      active.reduce((sum, p) => sum + (now - p.addedAt), 0) / active.length / 60000,
    );
  }, [active, now]);

  function addParty(e: React.FormEvent) {
    e.preventDefault();
    const size = Number(form.size);
    if (!form.name.trim() || !form.phone.trim() || !Number.isFinite(size) || size < 1) return;
    setActive((list) => [
      {
        id: crypto.randomUUID(),
        name: form.name.trim(),
        size,
        phone: form.phone.trim(),
        addedAt: Date.now(),
        notifiedAt: null,
        expiresAt: null,
        resolvedAt: null,
        resolution: null,
      },
      ...list,
    ]);
    setForm({ name: "", size: "2", phone: "" });
    setTab("active");
  }

  function notify(party: Party) {
    const t = Date.now();
    setActive((list) =>
      list.map((p) =>
        p.id === party.id ? { ...p, notifiedAt: t, expiresAt: t + timeout * 60000 } : p,
      ),
    );
    setToast(`Text sent to ${party.name} · ${party.phone}`);
  }

  function seat(party: Party) {
    setActive((list) => list.filter((p) => p.id !== party.id));
    setHistory((list) => [
      { ...party, resolvedAt: Date.now(), resolution: "seated" as const, expiresAt: null },
      ...list,
    ]);
    setToast(`${party.name} seated`);
  }

  function remove(party: Party) {
    setActive((list) => list.filter((p) => p.id !== party.id));
    setHistory((list) => [
      { ...party, resolvedAt: Date.now(), resolution: "no-show" as const, expiresAt: null },
      ...list,
    ]);
  }

  return (
    <main className="mx-auto min-h-screen w-full max-w-6xl px-4 pb-24 pt-6 sm:px-6 lg:px-8">
      <header className="flex flex-wrap items-end justify-between gap-4 border-b border-border pb-6">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-primary">
            {RESTAURANT_NAME}
          </p>
          <h1 className="mt-1 font-display text-4xl leading-none tracking-tight sm:text-5xl">
            Tonight&rsquo;s waitlist
          </h1>
        </div>
        <div className="flex items-center gap-6 tabular">
          <Stat label="Waiting" value={waiting} />
          <Stat label="Notified" value={notified} />
          <Stat label="Avg wait" value={`${avgWait}m`} />
        </div>
      </header>

      <div className="mt-6 grid gap-6 lg:grid-cols-[22rem_1fr]">
        <aside className="space-y-4">
          <form onSubmit={addParty} className="panel space-y-4 p-5">
            <h2 className="font-display text-2xl leading-none">Add a party</h2>
            <Field
              label="Name"
              placeholder="Party name"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
            />
            <div className="grid grid-cols-[7rem_1fr] gap-3">
              <Field
                label="Size"
                type="number"
                min={1}
                value={form.size}
                onChange={(e) => setForm({ ...form, size: e.target.value })}
                required
              />
              <Field
                label="Phone"
                type="tel"
                placeholder="+234 800 000 0000"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                required
              />
            </div>
            <Button type="submit" size="lg" className="w-full">
              Add to waitlist
            </Button>
          </form>

          <section className="panel space-y-3 p-5">
            <h2 className="font-display text-2xl leading-none">Hold time</h2>
            <p className="text-sm text-muted-foreground">
              How long a party has to arrive after being texted.
            </p>
            <div className="grid grid-cols-4 gap-2">
              {TIMEOUT_OPTIONS.map((m) => (
                <Button
                  key={m}
                  type="button"
                  variant={m === timeout ? "primary" : "outline"}
                  size="sm"
                  onClick={() => setTimeoutMins(m)}
                >
                  {m}m
                </Button>
              ))}
            </div>
            <div className="rounded-lg border border-dashed border-border bg-background/40 p-3">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                Message sent
              </p>
              <p className="mt-1.5 text-sm italic text-foreground/90">&ldquo;{SMS_TEMPLATE}&rdquo;</p>
            </div>
          </section>
        </aside>

        <section>
          <div className="mb-4 inline-flex rounded-xl border border-border bg-surface p-1">
            <TabButton active={tab === "active"} onClick={() => setTab("active")}>
              Waitlist ({active.length})
            </TabButton>
            <TabButton active={tab === "history"} onClick={() => setTab("history")}>
              History ({history.length})
            </TabButton>
          </div>

          {tab === "active" ? (
            <div className="space-y-3">
              {active.length === 0 && (
                <EmptyState text="No one is waiting. The dining room is all yours." />
              )}
              {active.map((p) => (
                <PartyCard
                  key={p.id}
                  party={p}
                  now={now}
                  onNotify={() => notify(p)}
                  onSeat={() => seat(p)}
                  onRemove={() => remove(p)}
                />
              ))}
            </div>
          ) : (
            <HistoryTable rows={history} />
          )}
        </section>
      </div>

      {toast && (
        <div className="fixed inset-x-4 bottom-5 z-50 mx-auto w-fit max-w-[92vw] rounded-full border border-border bg-surface-2 px-5 py-3 text-sm shadow-lg">
          {toast}
        </div>
      )}
    </main>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="text-right">
      <p className="font-display text-3xl leading-none">{value}</p>
      <p className="mt-1 text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
        {label}
      </p>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        "rounded-lg px-4 py-2 text-sm font-semibold transition-colors " +
        (active
          ? "bg-primary text-primary-foreground"
          : "text-muted-foreground hover:text-foreground")
      }
    >
      {children}
    </button>
  );
}

function PartyCard({
  party,
  now,
  onNotify,
  onSeat,
  onRemove,
}: {
  party: Party;
  now: number;
  onNotify: () => void;
  onSeat: () => void;
  onRemove: () => void;
}) {
  const remaining = party.expiresAt ? party.expiresAt - now : null;
  const urgent = remaining !== null && remaining < 3 * 60000;

  return (
    <article className="panel flex flex-wrap items-center gap-4 p-4 sm:flex-nowrap">
      <div className="flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-xl bg-surface-2">
        <span className="font-display text-2xl leading-none">{party.size}</span>
        <span className="text-[0.6rem] uppercase tracking-[0.12em] text-muted-foreground">
          guests
        </span>
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="truncate font-display text-2xl leading-none">{party.name}</h3>
          {party.notifiedAt ? <Badge tone="notified">Notified</Badge> : <Badge>Waiting</Badge>}
        </div>
        <p className="mt-1.5 text-sm text-muted-foreground tabular">
          {party.phone} · added {formatClock(party.addedAt)} · waited{" "}
          {waitedLabel(party.addedAt, now)}
        </p>
      </div>

      {remaining !== null && (
        <div
          className={
            "shrink-0 rounded-lg px-3 py-2 text-center tabular " +
            (urgent ? "bg-destructive/15 text-destructive" : "bg-warning/15 text-warning")
          }
        >
          <p className="font-display text-2xl leading-none">{formatDuration(remaining)}</p>
          <p className="text-[0.6rem] uppercase tracking-[0.12em] opacity-80">left</p>
        </div>
      )}

      <div className="flex w-full shrink-0 gap-2 sm:w-auto">
        {!party.notifiedAt && (
          <Button onClick={onNotify} className="flex-1 sm:flex-none">
            Notify
          </Button>
        )}
        <Button variant="seat" onClick={onSeat} className="flex-1 sm:flex-none">
          Seat
        </Button>
        <Button variant="danger" onClick={onRemove} aria-label={`Remove ${party.name}`}>
          Remove
        </Button>
      </div>
    </article>
  );
}

function HistoryTable({ rows }: { rows: Party[] }) {
  if (rows.length === 0) return <EmptyState text="No history yet tonight." />;
  return (
    <div className="panel overflow-x-auto">
      <table className="w-full min-w-[46rem] text-left text-sm">
        <thead className="border-b border-border text-xs uppercase tracking-[0.14em] text-muted-foreground">
          <tr>
            <th className="px-4 py-3 font-semibold">Party</th>
            <th className="px-4 py-3 font-semibold">Size</th>
            <th className="px-4 py-3 font-semibold">Phone</th>
            <th className="px-4 py-3 font-semibold">Added</th>
            <th className="px-4 py-3 font-semibold">Notified</th>
            <th className="px-4 py-3 font-semibold">Closed</th>
            <th className="px-4 py-3 font-semibold">Status</th>
          </tr>
        </thead>
        <tbody className="tabular">
          {rows.map((p) => (
            <tr key={p.id} className="border-b border-border/60 last:border-0">
              <td className="px-4 py-3 font-display text-lg">{p.name}</td>
              <td className="px-4 py-3">{p.size}</td>
              <td className="px-4 py-3 text-muted-foreground">{p.phone}</td>
              <td className="px-4 py-3 text-muted-foreground">{formatClock(p.addedAt)}</td>
              <td className="px-4 py-3 text-muted-foreground">
                {p.notifiedAt ? formatClock(p.notifiedAt) : "—"}
              </td>
              <td className="px-4 py-3 text-muted-foreground">
                {p.resolvedAt ? formatClock(p.resolvedAt) : "—"}
              </td>
              <td className="px-4 py-3">
                {p.resolution === "seated" ? (
                  <Badge tone="seated">Seated</Badge>
                ) : (
                  <Badge tone="noshow">No-show</Badge>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="panel px-6 py-16 text-center">
      <p className="font-display text-2xl">{text}</p>
    </div>
  );
}
