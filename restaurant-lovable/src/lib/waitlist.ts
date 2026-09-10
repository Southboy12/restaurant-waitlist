export type Resolution = "seated" | "no-show";

export type Party = {
  id: string;
  name: string;
  size: number;
  phone: string;
  addedAt: number;
  notifiedAt: number | null;
  expiresAt: number | null;
  resolvedAt: number | null;
  resolution: Resolution | null;
};

export const RESTAURANT_NAME = "Olive & Ember";
export const SMS_TEMPLATE = `Your table is ready at ${RESTAURANT_NAME}! Please come to the host stand as soon as possible.`;

export const TIMEOUT_OPTIONS = [5, 10, 15, 20] as const;

export function formatClock(ts: number) {
  return new Date(ts).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

export function formatDuration(ms: number) {
  const total = Math.max(0, Math.round(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function waitedLabel(from: number, to: number) {
  const mins = Math.max(0, Math.round((to - from) / 60000));
  if (mins < 60) return `${mins} min`;
  return `${Math.floor(mins / 60)}h ${mins % 60}m`;
}

const now = Date.now();

export const SAMPLE_ACTIVE: Party[] = [
  {
    id: "p1",
    name: "Adeyemi",
    size: 4,
    phone: "+234 803 114 2288",
    addedAt: now - 6 * 60000,
    notifiedAt: null,
    expiresAt: null,
    resolvedAt: null,
    resolution: null,
  },
  {
    id: "p2",
    name: "Whitfield",
    size: 2,
    phone: "+234 701 550 9034",
    addedAt: now - 14 * 60000,
    notifiedAt: now - 3 * 60000,
    expiresAt: now + 11 * 60000,
    resolvedAt: null,
    resolution: null,
  },
  {
    id: "p3",
    name: "Okonkwo",
    size: 6,
    phone: "+234 812 400 7712",
    addedAt: now - 22 * 60000,
    notifiedAt: null,
    expiresAt: null,
    resolvedAt: null,
    resolution: null,
  },
];

export const SAMPLE_HISTORY: Party[] = [
  {
    id: "h1",
    name: "Bassey",
    size: 3,
    phone: "+234 809 221 6640",
    addedAt: now - 74 * 60000,
    notifiedAt: now - 61 * 60000,
    resolvedAt: now - 58 * 60000,
    expiresAt: null,
    resolution: "seated",
  },
  {
    id: "h2",
    name: "Larkin",
    size: 2,
    phone: "+234 705 333 1180",
    addedAt: now - 96 * 60000,
    notifiedAt: now - 82 * 60000,
    resolvedAt: now - 67 * 60000,
    expiresAt: null,
    resolution: "no-show",
  },
  {
    id: "h3",
    name: "Ifeanyi",
    size: 5,
    phone: "+234 816 909 4402",
    addedAt: now - 120 * 60000,
    notifiedAt: now - 108 * 60000,
    resolvedAt: now - 104 * 60000,
    expiresAt: null,
    resolution: "seated",
  },
];
