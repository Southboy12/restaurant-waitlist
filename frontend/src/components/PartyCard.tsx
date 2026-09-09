import type { Party } from "../types";
import {
  formatClock,
  formatDuration,
  waitedLabel,
} from "../lib/waitlist";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useEffect, useState } from "react";

interface Props {
  party: Party;
  now: number;
  onNotify: () => void;
  onSeat: () => void;
  onRemove: () => void;
}

export function PartyCard({ party, now, onNotify, onSeat, onRemove }: Props) {
  const [remaining, setRemaining] = useState<number | null>(null);

  useEffect(() => {
    if (party.expiresAt === null) {
      setRemaining(null);
      return;
    }
    const expiresAt = party.expiresAt;
    const compute = () => {
      const diff = expiresAt - Date.now();
      return Math.max(0, diff);
    };
    setRemaining(compute());
    const id = window.setInterval(() => setRemaining(compute()), 1000);
    return () => window.clearInterval(id);
  }, [party.expiresAt]);

  const urgent = remaining !== null && remaining < 2 * 60000;
  const expired = remaining !== null && remaining <= 0;

  return (
    <article className={`party-card ${party.notifiedAt ? "notified-card" : "waiting-card"}`}>
      <div className="party-header">
        <div>
          <div className="party-name">
            <h3 className="party-name-text truncate font-display text-2xl leading-none">
              {party.name}
            </h3>
            {party.notifiedAt ? (
              <Badge tone="notified">Notified</Badge>
            ) : (
              <Badge>Waiting</Badge>
            )}
          </div>
          <p className="mt-1.5 text-sm text-muted-foreground tabular">
            {party.phone} · added {formatClock(party.addedAt)} · waited{" "}
            {waitedLabel(party.addedAt, now)}
          </p>
        </div>
        <p className="text-sm text-muted-foreground tabular">{party.size} guests</p>
      </div>

      {remaining !== null && (
        <div
          className={
            "shrink-0 rounded-lg px-3 py-2 text-center tabular " +
            (urgent
              ? "bg-destructive/15 text-destructive"
              : "bg-warning/15 text-warning")
          }
        >
          <p className="font-display text-2xl leading-none">
            {formatDuration(remaining)}
          </p>
          <p className="text-[0.6rem] uppercase tracking-[0.12em] opacity-80">left</p>
        </div>
      )}

      <div className="party-actions">
        {!party.notifiedAt && (
          <Button onClick={onNotify} className="flex-1 sm:flex-none">
            Notify
          </Button>
        )}
        <Button variant="seat" onClick={onSeat} className="flex-1 sm:flex-none">
          Seat
        </Button>
        <Button
          variant="danger"
          onClick={onRemove}
          aria-label={`Remove ${party.name}`}
        >
          Remove
        </Button>
      </div>

      {expired && (
        <div className="expired-badge mt-1">No-show (timed out)</div>
      )}
    </article>
  );
}
