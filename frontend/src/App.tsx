import { useState } from "react";
import { WaitlistView } from "./components/WaitlistView";
import { HistoryView } from "./components/HistoryView";

export function App() {
  const [tab, setTab] = useState<"active" | "history">("active");

  return (
    <div className="app">
      <header className="app-header">
        <h1 className="font-display text-2xl leading-none">
          Waitlist Manager – Olive &amp; Ember
        </h1>
        <nav className="app-nav">
          <button
            className={`nav-btn ${tab === "active" ? "active" : ""}`}
            onClick={() => setTab("active")}
          >
            Active
          </button>
          <button
            className={`nav-btn ${tab === "history" ? "active" : ""}`}
            onClick={() => setTab("history")}
          >
            History
          </button>
        </nav>
      </header>

      <main className="app-main">
        {tab === "active" ? <WaitlistView /> : <HistoryView />}
      </main>

      <footer className="app-footer">
        <span>Restaurant Waitlist Manager · Staff-only web app</span>
      </footer>
    </div>
  );
}
