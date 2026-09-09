import { AddPartyForm } from './AddPartyForm';
import { PartyCard } from './PartyCard';
import { getActiveParties } from '../api';
import type { Party } from '../types';
import { useEffect, useState, useCallback } from 'react';

const REFRESH_INTERVAL = 5000; // 5s — catches server-side timeouts

export function WaitlistView() {
  const [activeParties, setActiveParties] = useState<Party[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const refresh = useCallback(async () => {
    try {
      const parties = await getActiveParties();
      setActiveParties(parties);
      setError('');
    } catch {
      setError('Failed to load waitlist.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, REFRESH_INTERVAL);
    return () => clearInterval(interval);
  }, [refresh]);

  const handleAdded = () => {
    refresh();
  };

  if (loading) {
    return <div className="view-loading">Loading waitlist...</div>;
  }

  return (
    <div className="view waitlist-view">
      <div className="view-header">
        <h2>Active Waitlist</h2>
        <span className="count-badge">{activeParties.length} party{activeParties.length !== 1 ? 'ies' : 'y'}</span>
      </div>

      <AddPartyForm onAdded={handleAdded} />

      {error && <div className="error-message">{error}</div>}

      {activeParties.length === 0 ? (
        <div className="empty-state">
          <p>No parties waiting.</p>
        </div>
      ) : (
        <div className="party-list">
          {activeParties.map((party) => (
            <PartyCard key={party.id} party={party} onUpdate={refresh} />
          ))}
        </div>
      )}
    </div>
  );
}
