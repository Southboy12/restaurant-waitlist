import type { Party, PartyFormData } from "../types";

// ---------------------------------------------------------------------------
// API client — real backend calls with Bearer token auth
// ---------------------------------------------------------------------------

const API_BASE = "/api";

// --- Token management (simple in-memory, no persistence) ---

let authToken: string | null = null;
let tokenExpiry: number | null = null;

/**
 * Set the auth token. Called after login. In a real app this would come
 * from an auth flow; for now the app assumes the backend is running and
 * we auto-login with default credentials on first API call.
 */
export function setAuthToken(token: string, expiryMs: number): void {
  authToken = token;
  tokenExpiry = Date.now() + expiryMs;
}

export function clearAuthToken(): void {
  authToken = null;
  tokenExpiry = null;
}

/**
 * Check if the token is still valid.
 */
export function isTokenValid(): boolean {
  if (!authToken || !tokenExpiry) return false;
  return Date.now() < tokenExpiry;
}

// --- Auto-login helper ---

async function ensureAuthenticated(): Promise<void> {
  if (isTokenValid()) return;

  // Try to login with default credentials
  const resp = await fetch(`${API_BASE}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: "host", password: "host123" }),
  });

  if (!resp.ok) {
    throw new Error("Authentication failed — check that the backend is running");
  }

  const data = await resp.json();
  // JWT exp claim is in seconds; we store ms and add a small buffer
  const expiresIn = (data.expires_in ?? 60) * 1000;
  setAuthToken(data.access_token, expiresIn);
}

// --- Helper for authenticated fetch ---

async function authFetch(
  path: string,
  options: RequestInit = {},
): Promise<Response> {
  await ensureAuthenticated();

  return fetch(path, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${authToken}`,
      ...options.headers,
    },
  });
}

// --- API functions ---

export async function addParty(data: PartyFormData): Promise<Party> {
  const res = await authFetch(`${API_BASE}/parties`, {
    method: "POST",
    body: JSON.stringify({
      name: data.name.trim(),
      size: data.size,
      phone: data.phone.trim(),
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Failed to add party" }));
    throw new Error((err as { error?: string }).error ?? "Failed to add party");
  }

  return res.json();
}

export async function getActiveParties(): Promise<Party[]> {
  const res = await authFetch(`${API_BASE}/parties/active`);

  if (!res.ok) {
    throw new Error("Failed to fetch active parties");
  }

  return res.json();
}

export async function getHistory(): Promise<Party[]> {
  const res = await authFetch(`${API_BASE}/parties/history`);

  if (!res.ok) {
    throw new Error("Failed to fetch history");
  }

  return res.json();
}

export async function notifyParty(
  id: string,
): Promise<{ party: Party; message: string }> {
  const res = await authFetch(`${API_BASE}/parties/${id}/notify`, {
    method: "POST",
  });

  if (!res.ok) {
    if (res.status === 404) {
      throw new Error("Party not found in active list");
    }
    throw new Error("Failed to send notification");
  }

  return res.json();
}

export async function seatParty(id: string): Promise<Party> {
  const res = await authFetch(`${API_BASE}/parties/${id}/seat`, {
    method: "POST",
  });

  if (!res.ok) {
    if (res.status === 404) {
      throw new Error("Party not found in active list");
    }
    throw new Error("Failed to seat party");
  }

  return res.json();
}

export async function removeParty(id: string): Promise<void> {
  const res = await authFetch(`${API_BASE}/parties/${id}`, {
    method: "DELETE",
  });

  if (!res.ok) {
    if (res.status === 404) {
      throw new Error("Party not found in active list");
    }
    throw new Error("Failed to remove party");
  }
}
