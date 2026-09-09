import { useEffect, useState, useCallback } from 'react';
import { getHistory } from '../api';
import type { Party } from '../types';

export function HistoryView() {
  const [history, setHistory] = useState<Party[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const refresh = useCallback(async () => {
    try {
      const data = await getHistory();
      setHistory(data);
      setError('');
    } catch {
      setError('Failed to load history.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, 10000);
    return () => clearInterval(interval);
  }, [refresh]);

  const getStatusBadge = (party: Party) => {
    switch (party.resolutionType) {
      case 'seated':
        return <span className="badge badge-seated">Seated</span>;
      case 'no-show':
        return <span className="badge badge-no-show">No-show</span>;
      default:
        return null;
    }
  };

  if (loading) {
    return <div className="view-loading">Loading history...</div>;
  }

  return (
    <div className="view history-view">
      <div className="view-header">
        <h2>History</h2>
        <span className="count-badge">{history.length} record{history.length !== 1 ? 's' : ''}</span>
      </div>

      {error && <div className="error-message">{error}</div>}

      {history.length === 0 ? (
        <div className="empty-state">
          <p>No history yet.</p>
        </div>
      ) : (
        <div className="history-table-wrapper">
          <table className="history-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Size</th>
                <th>Phone</th>
                <th>Status</th>
                <th>Added</th>
                <th>Notified</th>
                <th>Resolved</th>
              </tr>
            </thead>
            <tbody>
              {history.map((party) => (
                <tr key={party.id}>
                  <td className="td-name">{party.name}</td>
                  <td>{party.partySize}</td>
                  <td className="td-phone">{party.phone}</td>
                  <td>{getStatusBadge(party)}</td>
                  <td className="td-time">
                    {party.addedAt
                      ? new Date(party.addedAt).toLocaleString()
                      : '—'}
                  </td>
                  <td className="td-time">
                    {party.notifiedAt
                      ? new Date(party.notifiedAt).toLocaleString()
                      : '—'}
                  </td>
                  <td className="td-time">
                    {party.resolvedAt
                      ? new Date(party.resolvedAt).toLocaleString()
                      : '—'}
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
