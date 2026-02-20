# Accounting Firm Time Tracker

MVP implementation from `Time Tracker REQUIREMENTS.md` using Next.js + TypeScript + Tailwind + Prisma with Supabase/Stripe wiring.

## Included in this build

- Multi-tenant firm routing: `/<firm-slug>/...`
- Roles (`super_admin`, `firm_admin`, `firm_user`) with admin-gated profitability
- Core data model via Prisma:
  - `Tenant`, `User`, `Client`, `Workstream`, `TimeEntry`, `TimerSession`, `LockedPeriod`, `TimesheetApproval`, `AuditLog`
- Phase-1 core app flows:
  - Dashboard
  - Client/workstream CRUD
  - Live timer (one active timer per user)
  - Manual time entries with validation
  - Period locking with mutation blocking
  - Reporting + CSV export
- API endpoints for clients, workstreams, time entries, timer, locked periods, reports
- Stripe webhook scaffold for tenant provisioning on `checkout.session.completed`
- Supabase RLS migration starter at `supabase/migrations/0001_rls.sql`

## Quick start

1. Install dependencies

```bash
npm install
```

2. Configure env

```bash
cp .env.example .env
```

3. Generate Prisma client and run migrations

```bash
npm run prisma:generate
npm run prisma:migrate
```

4. Seed demo tenant

```bash
npm run prisma:seed
```

5. Run app

```bash
npm run dev
```

6. Open demo firm

- `http://localhost:3000/northstar-accounting/dashboard`

## API overview

- `GET/POST /api/clients?firmSlug=<slug>`
- `POST /api/workstreams?firmSlug=<slug>`
- `GET/POST/PATCH/DELETE /api/time-entries?firmSlug=<slug>`
- `POST /api/timer/start?firmSlug=<slug>`
- `POST /api/timer/stop?firmSlug=<slug>`
- `POST /api/timer/discard?firmSlug=<slug>`
- `GET/POST/DELETE /api/locked-periods?firmSlug=<slug>`
- `GET /api/reports/time-by-client?firmSlug=<slug>`
- `GET /api/reports/profitability?firmSlug=<slug>` (admin only)
- `GET /api/export/time-entries.csv?firmSlug=<slug>`
- `POST /api/stripe/webhook`

## Notes

- `AUTH_MODE=dev` uses seeded users for local dev without OAuth setup.
- User invites from settings require `SUPABASE_SERVICE_ROLE_KEY` so invited users can receive first-time auth emails.
- In production, configure Supabase Auth, set JWT claims for `tenant_id` and `role`, and apply RLS policies.
- Stripe Customer Portal and full subscription lifecycle endpoints are not yet wired in this MVP.
