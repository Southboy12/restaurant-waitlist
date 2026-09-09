import type { Party, PartyFormData } from "../types";

// ---------------------------------------------------------------------------
// API client — centralized backend calls
// ---------------------------------------------------------------------------

const USE_MOCK = true;

// --- Helpers ---

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function nowMs(): number {
  return Date.now();
}

// --- Mock store (in-memory) ---

const mockStore: {
  active: Party[];
  history: Party[];
} = { active: [], history: [] };

// --- API functions ---

export async function addParty(data: PartyFormData): Promise<Party> {
  if (USE_MOCK) {
    const party: Party = {
      id: generateId(),
      name: data.name.trim(),
      size: Math.max(1, parseInt(data.size, 10) || 1),
      phone: data.phone.trim(),
      addedAt: nowMs(),
      notifiedAt: null,
      expiresAt: null,
      resolvedAt: null,
      resolution: null,
    };
    mockStore.active.unshift(party);
    return party;
  }

  const res = await fetch("/api/parties", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error("Failed to add party");
  return res.json();
}

export async function getActiveParties(): Promise<Party[]> {
  if (USE_MOCK) {
    const now = nowMs();
    const stillActive: Party[] = [];
    const expired: Party[] = [];

    for (const p of mockStore.active) {
      if (p.expiresAt !== null && p.expiresAt <= now) {
        expired.push(p);
      } else {
        stillActive.push(p);
      }
    }

    for (const p of expired) {
      p.resolution = "no-show";
      p.resolvedAt = now;
      mockStore.history.unshift(p);
    }
    mockStore.active = stillActive;

    return stillActive;
  }

  const res = await fetch("/api/parties/active");
  if (!res.ok) throw new Error("Failed to fetch active parties");
  return res.json();
}

export async function getHistory(): Promise<Party[]> {
  if (USE_MOCK) {
    return [...mockStore.history];
  }

  const res = await fetch("/api/parties/history");
  if (!res.ok) throw new Error("Failed to fetch history");
  return res.json();
}

export async function notifyParty(id: string): Promise<{ party: Party; message: string }> {
  if (USE_MOCK) {
    const idx = mockStore.active.findIndex((p) => p.id === id);
    if (idx === -1) throw new Error("Party not found in active list");

    const party = mockStore.active[idx];
    const notifiedAt = nowMs();
    const expiresAt = notifiedAt + 15 * 60 * 1000;

    party.notifiedAt = notifiedAt;
    party.expiresAt = expiresAt;

    const message = `Your table is ready at Restaurant Waitlist! Please come to the host stand as soon as possible.`;

    console.log(`[MOCK SMS] To: ${party.phone} — "${message}"`);

    return { party, message };
  }

  const res = await fetch(`/api/parties/${id}/notify`, {
    method: "POST",
  });
  if (!res.ok) throw new Error("Failed to send notification");
  return res.json();
}

export async function seatParty(id: string): Promise<Party> {
  if (USE_MOCK) {
    const idx = mockStore.active.findIndex((p) => p.id === id);
    if (idx === -1) throw new Error("Party not found in active list");

    const party = mockStore.active[idx];
    party.resolution = "seated";
    party.resolvedAt = nowMs();
    party.expiresAt = null;

    mockStore.history.unshift(party);
    mockStore.active.splice(idx, 1);

    return party;
  }

  const res = await fetch(`/api/parties/${id}/seat`, {
    method: "POST",
  });
  if (!res.ok) throw new Error("Failed to seat party");
  return res.json();
}

export async function removeParty(id: string): Promise<void> {
  if (USE_MOCK) {
    const idx = mockStore.active.findIndex((p) => p.id === id);
    if (idx === -1) throw new Error("Party not found in active list");

    const party = mockStore.active[idx];
    party.resolution = "no-show";
    party.resolvedAt = nowMs();

    mockStore.history.unshift(party);
    mockStore.active.splice(idx, 1);
  } else {
    const res = await fetch(`/api/parties/${id}`, { method: "DELETE" });
    if (!res.ok) throw new Error("Failed to remove party");
  }
}
