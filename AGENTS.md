# AGENTS.md — AI Coding Agent Instructions

This file provides guidance for AI coding agents (e.g., Cline, Claude Code, Copilot) working on the **Restaurant Waitlist Manager** project.

## Project Overview

- **Type:** Staff-only web application for a single restaurant
- **Purpose:** Waitlist management — add parties, send SMS notifications, timer-based auto-removal, seat parties, view history
- **Platform:** Browser-based (responsive web app, not native mobile)

## Tech Stack (TBD)

The tech stack has not been finalized yet. Options under consideration:

- **Frontend:** React (Vite) or Next.js, responsive CSS (Tailwind or vanilla)
- **Backend:** Node.js/Express or Next.js API routes
- **Database:** SQLite or PostgreSQL
- **SMS:** Twilio API

The final stack decision will be documented in `_docs/specs.md`.

## Project Structure

```
.
├── _docs/
│   ├── plan.md      # Project scope, workflow, out-of-scope
│   └── specs.md     # Technical specification, acceptance criteria
├── .gitignore
├── README.md
└── AGENTS.md       # This file
```

## Coding Conventions (to be established)

Once the tech stack is chosen, the following should be defined:

- Language / framework version
- Package manager (npm, pnpm, etc.)
- Linting and formatting rules
- Testing framework and conventions
- Directory structure for source code
- Environment variable naming

## Workflow for AI Agents

1. Read `_docs/plan.md` and `_docs/specs.md` before making changes to understand scope and requirements.
2. Do not extend scope beyond what is documented as "In Scope" without explicit approval.
3. When adding new files or features, follow existing conventions once established.
4. Keep commits atomic and well-described.
5. Update documentation (`_docs/specs.md`, `README.md`) when the spec or setup changes.

## Out of Scope (Reminder)

The following are **not** part of the MVP and should not be implemented unless explicitly requested:

- Guest-facing app or portal
- Multi-location / chain support
- Manual SMS text customization per party
- Table mapping or floor plans
- Reservation system
- Staff login / authentication (MVP)
- Dashboard analytics
- POS integration
- Audit trails
