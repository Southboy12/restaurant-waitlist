import { PartyCard } from "./PartyCard";
import { Button } from "@/components/ui/button";
import {
  getActiveParties,
  addParty,
  notifyParty,
  seatParty,
  removeParty,
} from "../api";
import type { Party } from "../types";
import {
  SAMPLE_ACTIVE,
} from "../lib/waitlist";
import { useEffect, useState, useMemo, useCallback, FormEvent } from "react";

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

function EmptyState({ text }: { text: string }) {
  return (
    <div className="empty-panel">
      <p>{text}</p>
    </div>
  );
}

export function WaitlistView() {
  const [active, setActive] = useState<Party[]>(SAMPLE_ACTIVE);
  const [form, setForm] = useState({ name: "", size: "2", phone: "" });
  const [toast, setToast] = useState<string | null>(null);

  const now = useNow(true);

  useEffect(() => {
    if (!toast) return;
    const id = window.setTimeout(() => setToast(null), 3200);
    return () => window.clearTimeout(id);
  }, [toast]);

  // Auto-remove expired parties
  useEffect(() => {
    const expired = active.filter(
      (p) => p.expiresAt !== null && p.expiresAt <= now,
    );
    if (expired.length === 0) return;
    setActive((list) =>
      list.filter((p) => !expired.some((e) => e.id === p.id)),
    );
  }, [now, active]);

  const waiting = active.length;
  const notified = active.filter((p) => p.notifiedAt).length;
  const avgWait = useMemo(() => {
    if (!active.length) return 0;
    return Math.round(
      active.reduce((sum, p) => sum + (now - p.addedAt), 0) /
        active.length /
        60000,
    );
  }, [active, now]);

  function addPartyHandler(e: FormEvent) {
    e.preventDefault();
    const size = Number(form.size);
    if (!form.name.trim() || !form.phone.trim() || !Number.isFinite(size) || size < 1)
      return;
    addParty({ name: form.name, size: form.size, phone: form.phone }).then(() => {
      setForm({ name: "", size: "2", phone: "" });
      refresh();
      setToast("Party added!");
    });
  }

  const refresh = useCallback(async () => {
    try {
      const parties = await getActiveParties();
      setActive(parties);
    } catch {
      // silent
    }
  }, []);

  useEffect(() => {
    refresh();
    const id = window.setInterval(refresh, 5000);
    return () => window.clearInterval(id);
  }, [refresh]);

  async function onNotify(party: Party) {
    try {
      await notifyParty(party.id);
      setToast("SMS sent!");
      refresh();
    } catch {
      setToast("Failed to send");
    }
  }

  async function onSeat(party: Party) {
    try {
      await seatParty(party.id);
      setToast("Seated!");
      refresh();
    } catch {
      setToast("Failed to seat");
    }
  }

  async function onRemove(party: Party) {
    try {
      await removeParty(party.id);
      setToast("Removed");
      refresh();
    } catch {
      setToast("Failed to remove");
    }
  }

  return (
    <div className="view">
      {/* Stats row */}
      <div className="panel p-4 flex items-center gap-6 flex-wrap">
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground tabular">
            Waiting
          </span>
          <span className="font-display text-2xl tabular">{waiting}</span>
        </div>
        {notified > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground tabular">
              Notified
            </span>
            <span className="font-display text-2xl tabular">{notified}</span>
          </div>
        )}
        <div className="flex-1" />
        <div className="flex items-center gap-2 text-sm text-muted-foreground tabular">
          <span>Avg wait</span>
          <span className="font-display text-lg tabular">
            {avgWait > 0 ? `${avgWait}m` : "—"}
          </span>
        </div>
      </div>

      {/* Add party form */}
      <form onSubmit={addPartyHandler} className="add-party-form">
        <h3>Add Party</h3>
        <div className="form-row">
          <input
            type="text"
            placeholder="Party name"
            value={form.name}
            onChange={(e) =>
              setForm((f) => ({ ...f, name: e.target.value }))
            }
            className="input w-full"
            autoFocus
          />
        </div>
        <div className="form-row form-row-inline">
          <input
            type="number"
            placeholder="Size"
            value={form.size}
            onChange={(e) =>
              setForm((f) => ({ ...f, size: e.target.value }))
            }
            className="input input-small"
            min="1"
          />
          <input
            type="tel"
            placeholder="Phone number"
            value={form.phone}
            onChange={(e) =>
              setForm((f) => ({ ...f, phone: e.target.value }))
            }
            className="input w-full"
          />
        </div>
        <Button
          type="submit"
          size="md"
          disabled={!form.name.trim() || !form.phone.trim()}
        >
          Add to Waitlist
        </Button>
      </form>

      {/* Active parties */}
      {active.length === 0 ? (
        <EmptyState text="No parties waiting." />
      ) : (
        <div className="party-list">
          {active.map((party) => (
            <PartyCard
              key={party.id}
              party={party}
              now={now}
              onNotify={() => onNotify(party)}
              onSeat={() => onSeat(party)}
              onRemove={() => onRemove(party)}
            />
          ))}
        </div>
      )}

      {/* Toast */}
      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}
