export interface Party {
  id: string;
  name: string;
  partySize: number;
  phone: string;
  status: PartyStatus;
  addedAt: string; // ISO timestamp
  notifiedAt: string | null;
  resolvedAt: string | null;
  resolutionType: ResolutionType | null;
  expiresAt: string | null; // when timer expires (notifiedAt + timeout)
}

export type PartyStatus = 'active' | 'seated' | 'no-show';
export type ResolutionType = 'seated' | 'no-show';

export interface PartyFormData {
  name: string;
  partySize: string;
  phone: string;
}

export interface AppState {
  activeParties: Party[];
  history: Party[];
  selectedTab: 'waitlist' | 'history';
}

export const SMS_TEMPLATE =
  "Your table is ready at Restaurant Waitlist! Please come to the host stand as soon as possible.";

export const DEFAULT_TIMEOUT_MS = 15 * 60 * 1000; // 15 minutes
