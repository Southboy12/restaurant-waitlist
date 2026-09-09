import { useState } from 'react';
import { WaitlistView } from './components/WaitlistView';
import { HistoryView } from './components/HistoryView';

export function App() {
  const [tab, setTab] = useState<'waitlist' | 'history'>('waitlist');

  return (
    <div className="app">
      <header className="app-header">
        <h1>🍽️ Restaurant Waitlist</h1>
        <nav className="app-nav">
          <button
            className={`nav-btn ${tab === 'waitlist' ? 'active' : ''}`}
            onClick={() => setTab('waitlist')}
          >
            Waitlist
          </button>
          <button
            className={`nav-btn ${tab === 'history' ? 'active' : ''}`}
            onClick={() => setTab('history')}
          >
            History
          </button>
        </nav>
      </header>

      <main className="app-main">
        {tab === 'waitlist' ? <WaitlistView /> : <HistoryView />}
      </main>

      <footer className="app-footer">
        <span>Restaurant Waitlist Manager · Staff-only web app</span>
      </footer>
    </div>
  );
}
