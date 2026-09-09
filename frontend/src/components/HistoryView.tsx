import { useEffect, useState, useCallback } from "react";
import { getHistory } from "../api";
import type { Party } from "../types";
import { formatClock } from "../lib/waitlist";
import { Badge } from "@/components/ui/badge";

function EmptyState({ text }: { text: string }) {
  return (
    <div className="empty-panel">
      <p>{text}</p>
    </div>
  );
}

export function HistoryView() {
  const [history, setHistory] = useState<Party[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const data = await getHistory();
      setHistory(data);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
    const id = window.setInterval(refresh, 10000);
    return () => window.clearInterval(id);
  }, [refresh]);

  if (loading) {
    return <div className="view-loading">Loading history...</div>;
  }

  return (
    <div className="view">
      <div className="view-header">
        <h2>Seating History</h2>
        <span className="count-badge">
          {history.length} record{history.length !== 1 ? "s" : ""}
        </span>
      </div>

      {history.length === 0 ? (
        <EmptyState text="No history yet tonight." />
      ) : (
        <div className="panel overflow-x-auto">
          <table className="history-table w-full min-w-[46rem] text-left text-sm">
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
              {history.map((p) => (
                <tr key={p.id} className="border-b border-border/60 last:border-0">
                  <td className="px-4 py-3 font-display text-lg">{p.name}</td>
                  <td className="px-4 py-3">{p.size}</td>
                  <td className="px-4 py-3 text-muted-foreground">{p.phone}</td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {formatClock(p.addedAt)}
                  </td>
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
      )}
    </div>
  );
}
