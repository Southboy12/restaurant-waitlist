# Restaurant Waitlist Manager – Project Scope

## Overview
Staff-only waitlist management app for a **single restaurant**, used on mobile devices (phones/tablets).

## Core Workflow
1. **Add Party** – Staff enters:
   - Name
   - Party size
   - Phone number

2. **Notify** – One-click automatic SMS text when a table is ready (pre-set template).

3. **Timer** – Starts immediately after notification. If party doesn't arrive before timeout:
   - Party is **automatically removed** from the active list.

4. **Seat** – Staff manually marks party as seated from the active list.

5. **History** – Full log of all past parties, including:
   - Seated
   - No-show (timed out)
   - Notified (with timestamp)

## Device
- Mobile-first (phones/tablets)
- Responsive design

## Out of Scope
- Guest-facing app or portal
- Multi-location / chain support
- Manual text customization per party
- Table mapping or floor plans
- Reservation system (this is waitlist only)

## Future Considerations (Not in MVP)
- Dashboard analytics
- Integration with POS
- Staff login/audit trails