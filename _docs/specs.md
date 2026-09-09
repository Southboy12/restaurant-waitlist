# Restaurant Waitlist Manager – Technical Specification

## 1. Project Overview

**Restaurant Waitlist Manager** is a staff-only web application for a single restaurant. It allows staff to manage a waitlist of parties waiting for a table, send automated SMS notifications when a table is ready, track wait times with automatic timeout removal, and maintain a full history of all parties.

This is a **web application** (browser-based), not a native mobile app. It must be responsive and usable on phones, tablets, and desktop displays.

---

## 2. Core Workflow (User Stories)

### 2.1 Add Party
- Staff can add a new party to the waitlist by entering:
  - **Name** (text, required)
  - **Party size** (number, required, ≥ 1)
  - **Phone number** (text, required, for SMS notification)
- The party appears at the top of the active waitlist immediately.
- A timestamp of when the party was added is recorded.

### 2.2 Notify (SMS)
- Staff can send a one-click SMS notification to a party when their table is ready.
- The SMS uses a **pre-set template** (no per-party customization in MVP).
- Template example: *"Your table is ready at [Restaurant Name]! Please come to the host stand as soon as possible."*
- The notification timestamp is recorded against the party.
- Once notified, the party's status changes and a countdown timer begins.

### 2.3 Timer (Auto-Removal on Timeout)
- A timer starts **immediately after notification** for each party.
- The timeout duration should be configurable (e.g., default 15 minutes).
- If the party does not arrive before the timer expires:
  - The party is **automatically removed** from the active waitlist.
  - The party is logged as a **No-show** in the history with the timeout timestamp.
- The timer must remain reliable even if the browser tab is backgrounded (see Section 4, Technical Considerations).

### 2.4 Seat
- Staff can manually mark a party as **Seated** from the active waitlist.
- When seated:
  - The party is removed from the active waitlist.
  - The party is logged in history with a "Seated" status and timestamp.
- Seating should be possible before or after the timer expires (staff discretion).

### 2.5 History
- A full log of all past parties is available, including:
  - **Seated** parties (with seated timestamp)
  - **No-show** parties (timed out, with timeout timestamp)
  - **Notified** parties (with notification timestamp and final outcome)
- History entries should show: name, party size, phone number, status, timestamps (added, notified, seated/timed-out).
- History should be viewable in a scrollable list or table.
- History persists across sessions (database-backed).

---

## 3. Out of Scope (MVP)

- Guest-facing app or portal
- Multi-location / chain support
- Manual text customization per SMS
- Table mapping or floor plans
- Reservation system (this is waitlist only)
- Staff login / authentication (MVP assumes a shared device in a trusted environment)
- Dashboard analytics
- POS integration
- Audit trails

---

## 4. Technical Considerations

### 4.1 Timer Reliability
Since this is a browser-based web app, the timer must handle browser tab backgrounding gracefully:

- Use `setInterval` or `requestAnimationFrame` for the visible countdown display.
- For the actual timeout enforcement, use the **Page Visibility API** (`visibilitychange` event) to detect when the tab is backgrounded.
- Store a **target expiration timestamp** (notification time + timeout duration) in each party's record. On tab resume / `visibilitychange` firing, recalculate elapsed time from the stored timestamp rather than relying purely on accumulated interval ticks.
- Consider a server-side heartbeat or periodic check as a fallback, but for MVP a client-side approach with timestamp-based recalculation should suffice given the trusted-device context.

### 4.2 SMS Integration
- SMS is sent via a third-party API (e.g., **Twilio**).
- The backend exposes an endpoint that the frontend calls to trigger an SMS.
- The SMS template is stored server-side; the frontend only passes the recipient phone number.
- SMS sending is fire-and-forget for MVP (no delivery tracking required).

### 4.3 Data Persistence
- A database stores: active waitlist parties and historical parties.
- Suitable options: SQLite (simple, file-based), PostgreSQL (more robust).
- Each party record contains at minimum:
  - Unique ID
  - Name
  - Party size
  - Phone number
  - Status (active / seated / no-show)
  - Added timestamp
  - Notified timestamp (nullable)
  - Resolved timestamp (seated or timed-out, nullable)
  - Resolution type (seated / no-show, nullable)

### 4.4 Responsive Design
- The UI must work well on a phone held horizontally (common restaurant use case) and on a desktop monitor.
- Touch-friendly buttons and controls.
- The active waitlist should be the primary view; history accessible via a tab or toggle.

---

## 5. Future Considerations (Not in MVP)

- Dashboard / analytics (wait time averages, no-show rates, peak hours)
- POS integration (auto-seat when table is opened in POS)
- Staff login and audit trails
- Multiple SMS template support
- Push notifications as an alternative to SMS
- Table assignment / floor plan integration

---

## 6. Acceptance Criteria (MVP)

1. A staff member can add a party (name, size, phone) and it appears in the active list.
2. A staff member can click "Notify" and an SMS is sent via the pre-set template.
3. After notification, a countdown timer is visible for each party.
4. When the timer expires, the party is automatically removed from the active list and appears in history as No-show.
5. A staff member can mark a party as Seated at any time; it is removed from the active list and logged in history.
6. The history view shows all past parties with their status and timestamps.
7. Data persists after page refresh / browser restart.
8. The app is usable on a mobile phone browser and on a desktop browser.
