import { useState, useEffect } from 'react';
import type { Party } from '../types';
import { notifyParty, seatParty } from '../api';

interface Props {
  party: Party;
  onUpdate: () => void;
}

export function PartyCard({ party, onUpdate }: Props) {
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const [notifying, setNotifying] = useState(false);
  const [seating, setSeating] = useState(false);
  const [showSmsModal, setShowSmsModal] = useState(false);
  const [lastSmsMessage, setLastSmsMessage] = useState('');

  // Compute time-left from expiresAt timestamp (not from interval ticks alone)
  useEffect(() => {
    if (!party.expiresAt) {
      setTimeLeft(null);
      return;
    }

    const compute = () => {
      const expires = party.expiresAt;
      if (!expires) return 0;
      const diff = new Date(expires).getTime() - Date.now();
      return Math.max(0, Math.floor(diff / 1000));
    };

    setTimeLeft(compute());

    const interval = setInterval(() => {
      const expires = party.expiresAt;
      if (!expires) {
        setTimeLeft(null);
        return;
      }
      const diff = new Date(expires).getTime() - Date.now();
      setTimeLeft(Math.max(0, Math.floor(diff / 1000)));
    }, 1000);

    return () => clearInterval(interval);
  }, [party.expiresAt, party.id]);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const isExpired = timeLeft !== null && timeLeft <= 0 && party.status === 'active';

  const handleNotify = async () => {
    setNotifying(true);
    try {
      const result = await notifyParty(party.id);
      setLastSmsMessage(result.message);
      setShowSmsModal(true);
      onUpdate();
    } catch {
      alert('Failed to send notification.');
    } finally {
      setNotifying(false);
    }
  };

  const handleSeat = async () => {
    if (!confirm(`Seat ${party.name} (${party.partySize} guests)?`)) return;
    setSeating(true);
    try {
      await seatParty(party.id);
      onUpdate();
    } catch {
      alert('Failed to seat party.');
    } finally {
      setSeating(false);
    }
  };

  const statusLabel = party.notifiedAt ? 'Notified' : 'Waiting';
  const statusClass = party.notifiedAt ? 'status-notified' : 'status-waiting';

  return (
    <div className={`party-card ${statusClass}`}>
      <div className="party-header">
        <div className="party-name">
          <span className="party-name-text">{party.name}</span>
          <span className="party-size">{party.partySize} guests</span>
        </div>
        <div className="party-phone">{party.phone}</div>
      </div>

      <div className="party-meta">
        <span className={statusClass}>{statusLabel}</span>
        <span className="party-added">
          Added {new Date(party.addedAt).toLocaleTimeString()}
        </span>
      </div>

      {party.notifiedAt && (
        <div className="timer-section">
          {isExpired ? (
            <div className="timer timer-expired">
              <span className="timer-label">Time's up!</span>
            </div>
          ) : (
            <div className={`timer ${party.notifiedAt ? 'timer-active' : ''}`}>
              <span className="timer-label">Ready in</span>
              <span className="timer-value">
                {timeLeft !== null ? formatTime(timeLeft) : '--:--'}
              </span>
            </div>
          )}
        </div>
      )}

      <div className="party-actions">
        {!party.notifiedAt ? (
          <button
            className="btn btn-sm btn-success"
            onClick={handleNotify}
            disabled={notifying}
          >
            {notifying ? 'Sending...' : '📱 Notify (SMS)'}
          </button>
        ) : isExpired ? (
          <span className="expired-badge">No-show (timed out)</span>
        ) : (
          <button
            className="btn btn-sm btn-primary"
            onClick={handleSeat}
            disabled={seating}
          >
            {seating ? 'Seating...' : '✓ Seat Party'}
          </button>
        )}
      </div>

      {showSmsModal && (
        <div className="modal-overlay" onClick={() => setShowSmsModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h4>SMS Sent</h4>
            <p>To: {party.phone}</p>
            <pre className="sms-preview">{lastSmsMessage}</pre>
            <button className="btn btn-primary" onClick={() => setShowSmsModal(false)}>
              OK
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
