# Accounting Firm Time Tracking App — Product Requirements

## Overview

A multi-tenant, web-based time tracking and profitability platform built exclusively for accounting firms. Inspired by tools like Double (doublehq.com), Karbon, BigTime, and Harvest — but laser-focused on the workflows of bookkeeping and CPA firms. The platform enables firms to track time by client and workstream, analyze profitability, manage their team, and generate billing-ready reports.

---

## Tech Stack

- **Framework:** Next.js (App Router) + TypeScript
- **Styling:** Tailwind CSS
- **Database & Auth:** Supabase (PostgreSQL with Row-Level Security + Supabase Auth)
- **Payments:** Stripe (subscriptions, Checkout, Customer Portal)
- **Hosting:** Vercel
- **ORM:** Prisma (pointed at Supabase Postgres)
- **Email:** Resend or Supabase SMTP (transactional emails — invites, notifications, password reset)

---

## Multi-Tenancy Architecture

- This is a **SaaS product** serving multiple paying accounting firms
- Each accounting firm is a **Tenant** with fully isolated data via Supabase Row-Level Security (RLS)
- All data (clients, team members, time entries, reports) is scoped to the tenant at the database level
- **Self-serve signup:** Firms sign up, pay via Stripe, and are provisioned automatically on successful payment
- Stripe webhook triggers tenant creation and Firm Admin account setup on `checkout.session.completed`
- Path-based routing per tenant: `app.domain.com/[firm-slug]/...`
- Subscription status is checked on each authenticated request; lapsed subscriptions redirect to billing page

---

## Roles & Permissions

### Super Admin (Platform Owner — You)
- Hardcoded or seeded account; cannot be created via self-registration
- Platform-wide dashboard: all firms, user counts, subscription status, MRR overview
- Can view, impersonate, or deactivate any tenant firm
- Can manually provision or cancel firm subscriptions
- Can view platform-wide usage and audit logs

### Firm Admin
- First user in a firm; created when Super Admin provisions a new firm
- Full access to all firm settings, clients, team members, and reports
- Can invite additional team members
- Can set billing rates, team member costs, and firm-level settings
- Can edit or delete any time entry within the firm

### Firm User (Team Member)
- Can track their own time
- Can view clients and workstreams assigned or visible to them
- Cannot change firm settings (billing rates, team member costs, firm profile)
- Cannot invite new team members
- Cannot delete other users' time entries
- Can view their own reports and summary stats
- Optional: Admin can restrict which clients a user can see

---

## Authentication

- **Google OAuth** ("Sign in with Google") — primary recommended method
- **Email + Password** — standard email/password with secure hashing (bcrypt)
- **Password Reset** via email link
- **Email Verification** on signup
- JWT-based sessions with refresh tokens
- Remember me / persistent sessions
- Invite-based onboarding: new users receive an email invite link tied to the firm

---

## Firm Settings

Accessible only to Firm Admin.

- Firm name, logo upload, timezone
- Default billing rate (fallback if no client/workstream rate set)
- Fiscal year start month
- Overtime threshold (hours per week) — for reporting
- Workday definition (e.g., 8 hours/day) — used in capacity reports
- Enable/disable features: expense tracking, rounding rules, approval workflows
- Time rounding rules: none, round to nearest 6 min, 15 min, etc.
- Require notes on time entries (toggle)

---

## Team Members

- Invite team members via email (generates a signup link tied to the firm)
- Assign role: Firm Admin or Firm User
- Per-member settings (Firm Admin only — never visible to the team member or exposed via API to non-admin roles):
  - **Internal Cost Rate** ($/hr) — used for profitability calculations; strictly admin-only
  - **Default Billing Rate** ($/hr) — used as fallback if no workstream rate exists
  - Start date / employment type (full-time, part-time, contractor)
  - Active / Inactive toggle (soft delete; preserves historical data)
- Team member profile: name, email, avatar, timezone, role
- List view of all team members with their current workload (hours this week/month)

---

## Clients

- Create clients with:
  - Client name (required)
  - Client code / short identifier (e.g., "SMITH-CO")
  - Contact name, email, phone
  - Industry / client type (e.g., Bookkeeping, Tax, Advisory, Payroll, CFO Services)
  - Status: Active / Inactive / Prospect
  - Notes / internal description
  - **Default Billing Rate** ($/hr) — applies to all workstreams unless overridden
  - Budget hours (optional monthly or annual cap)
  - Budget amount (optional dollar cap)
  - QBO/Xero client link (free-text URL or ID field for future integration)
  - Tags (e.g., "Monthly Close", "Tax Season", "High Priority")
- Client list view with search, filter by status/tag/type
- Client detail page showing all workstreams, recent time entries, and summary stats

---

## Workstreams

Workstreams are service categories within a client (e.g., "Monthly Bookkeeping," "Payroll," "Tax Return — 2024," "CFO Advisory").

- Create workstreams within a client:
  - Workstream name (required)
  - Service type / category (e.g., Bookkeeping, Tax Prep, Payroll, Advisory, Audit, Cleanup)
  - Description / scope notes
  - **Billing Rate** ($/hr) — overrides client default rate
  - Billing type: Hourly, Fixed Fee, Retainer/Recurring
  - Fixed fee amount (if applicable)
  - Retainer amount and frequency (monthly, quarterly)
  - Estimated hours budget
  - Start date / end date (optional, for project-based workstreams)
  - Status: Active / Paused / Complete / Archived
  - Assigned team members (optional — restrict who can log time here)
- Workstream detail page showing time entries, budget consumed vs. remaining, and team breakdown

---

## Time Tracking

### Live Timer
- Start/stop timer from any page via persistent floating/top-bar widget
- Timer auto-saves every 30 seconds to prevent data loss
- One active timer per user at a time (starting a new timer prompts to stop the current one)
- Timer shows elapsed time in real-time (HH:MM:SS)
- Before stopping, user must select: Client, Workstream, and optionally add a note
- Option to discard a running timer

### Manual Time Entry
- Add time entry with:
  - Date (defaults to today)
  - Client (required)
  - Workstream (required, filtered by selected client)
  - Duration: enter as hours:minutes (e.g., 1:30 or 1.5 hours)
  - Start time / End time (optional — computes duration automatically)
  - Billable toggle (default: billable; can mark as non-billable)
  - Notes / description (free text, 500 char limit)
  - Tag (optional — e.g., "Review," "Client Call," "Data Entry")
- Edit and delete own entries (Admins can edit/delete any entry)
- Bulk edit: change client/workstream/billable status for multiple entries at once

### Time Entry Views
- **Daily view:** All entries for a selected day, grouped by client
- **Weekly timesheet view:** Grid layout by day, grouped by client/workstream — similar to BigTime/Harvest; shows weekly totals
- **List view:** Paginated, filterable list of all entries
- Entries show: date, client, workstream, duration, billable status, notes, team member
- Color-coded by client or billable status
- Quick-add button on each day in the weekly view

### Time Entry Validation
- Warn if an entry exceeds 24 hours
- Warn if entries overlap (when start/end times provided)
- Warn if entry is logged on a weekend (soft warning, not a block)
- Require notes if firm setting is enabled
- **Block edits or new entries in a locked period** (see Period Locking below)

---

## Period Locking

Firm Admins can lock historical time periods (by month) to prevent edits after the books are closed.

- **Lock a period:** Admin selects a month/year and locks it; all time entries with a date in that period become read-only for all users including other admins
- **Unlock a period:** Only a Firm Admin can unlock a period; unlocking is logged in the audit trail with timestamp and admin name
- **Behavior when locked:**
  - Users cannot create, edit, or delete time entries dated within the locked period
  - Timers that span into a locked period are split at the lock boundary (or blocked with a warning)
  - Locked entries are visually marked in all time entry views (e.g., lock icon)
- **Locked period indicator** shown on the weekly timesheet view and daily view
- Locked periods do not affect reporting — historical data remains fully queryable
- Admin can view a list of all locked periods and their lock dates in Firm Settings

---

## Timesheets & Approval Workflow (Optional Feature, Admin Toggle)

- Users submit their weekly timesheet for approval
- Admin reviews and approves or rejects with comments
- Approved timesheets are locked (entries cannot be edited without Admin unlock)
- Status: Draft → Submitted → Approved / Rejected
- Email notification to Admin when timesheet is submitted
- Email notification to User when timesheet is approved/rejected

---

## Reporting

All reports should be exportable to CSV and PDF.

### Standard Reports

**1. Time by Client**
- Total hours and billable hours per client
- Filter by date range, team member, billable status
- Drill down to workstream and individual entries

**2. Time by Workstream**
- Total hours and billable hours per workstream
- Compare budget vs. actual hours consumed
- Remaining hours and projected completion

**3. Time by Team Member**
- Hours logged per team member
- Breakdown by client and workstream
- Billable vs. non-billable split
- Utilization rate (billable hours / available hours)

**4. Time by Date Range**
- Daily, weekly, monthly, or custom date range
- Aggregate totals and daily breakdown

**5. Detailed Time Log**
- All time entries for selected filters (date, client, workstream, team member, billable status)
- Exportable for client invoicing

**6. Weekly Timesheet Summary**
- Per-user weekly summary for payroll and compliance

### Profitability Reports (Firm Admin Only)

These reports use internal cost rates and billing rates to calculate firm profitability. Team member cost rates are **never exposed in any API response or UI to non-admin users** — enforced at both the API layer and Supabase RLS level.

**7. Client Profitability Report**
- Per client: Total hours, billed value (hours × billing rate), team cost (hours × member cost rate)
- Gross profit = billed value − team cost
- Gross margin % = gross profit / billed value
- Filter by date range

**8. Workstream Profitability Report**
- Same as client profitability, broken down by workstream
- Compare actual margin vs. budget margin (if fixed fee)
- Flag workstreams where cost exceeds revenue (margin alert)

**9. Team Member Utilization & Cost Report**
- Per team member: billable hours, non-billable hours, total hours
- Utilization rate = billable hours / (standard workday × working days)
- Revenue generated = billable hours × client billing rate
- Internal cost = total hours × member cost rate
- Net margin contribution per team member

**10. Firm Profitability Summary**
- Total revenue generated (all billable hours × respective rates)
- Total team cost
- Gross profit and gross margin for selected period
- Month-over-month or year-over-year comparison

**11. Budget vs. Actual Report**
- For clients and workstreams with budgets set
- Shows consumed hours/amount vs. budget
- % consumed, hours/dollars remaining
- Color-coded warnings at 80% and 100% of budget

**12. Realization Rate Report**
- For fixed-fee workstreams: effective hourly rate earned (fee ÷ actual hours)
- Compare against standard billing rate to show discount/premium

---

## Dashboard

### User Dashboard
- Total hours tracked today, this week, this month
- Quick-access: recently used clients and workstreams (one-click to start timer)
- Weekly timesheet progress bar (X of Y target hours logged)
- List of recent time entries
- Running timer widget (if active)

### Admin Dashboard
- Firm-wide hours summary: today, this week, this month
- Billable vs. non-billable hours split (pie chart)
- Top clients by hours (this month)
- Team utilization summary (each member's hours vs. target)
- Budget alerts: clients/workstreams approaching or over budget
- Unapproved timesheets pending review (if approval workflow enabled)
- Monthly revenue trend (last 6 months bar chart)

---

## Invoicing (Phase 2 / Nice-to-Have)

- Generate draft invoices from tracked billable time
- Invoice line items: client, workstream, hours, rate, amount
- Invoice statuses: Draft, Sent, Paid, Void
- Mark time entries as invoiced to prevent double-billing
- Invoice PDF export with firm logo and branding
- Basic invoice tracking (not full AR management)
- Optional: Stripe payment link integration

---

## Notifications & Reminders

- Email reminder to team members who haven't logged time by EOD Friday
- Email alert to Admin when a client/workstream hits 80% and 100% of budget
- Email notification for timesheet approvals/rejections
- In-app notification center for alerts
- Admin can configure which notifications are enabled

---

## Data & Export

- Export any report to CSV (Excel-compatible)
- Export any report to PDF
- Bulk export all time entries for a date range
- Data retention: all data preserved indefinitely (soft deletes only)

---

## Accounting-Firm-Specific Considerations

- **Service type taxonomy** pre-loaded with common accounting services: Bookkeeping, Monthly Close, Payroll, Tax Preparation, Tax Planning, Sales Tax, CFO/Advisory, Cleanup/Catchup, Audit, Entity Formation, Consulting
- **Tax season mode**: Flag a date range as "tax season" for reporting context
- **Recurring workstreams**: Mark a workstream as recurring (monthly, quarterly, annually); auto-creates new workstream instance for the next period
- **Client fiscal year tracking**: Store client's fiscal year end for context
- **Non-billable categories**: predefined non-billable types — Internal Admin, Business Development, Training, PTO, Firm Meetings
- **Retainer tracking**: Track hours consumed against a monthly retainer cap; alert when hours exceed retainer

---

## Security & Compliance

- All data encrypted at rest and in transit (TLS 1.2+)
- Role-based access control enforced at API layer
- Internal cost rates never exposed in API responses to non-admin roles
- Audit log: track who created/edited/deleted time entries and key settings changes
- GDPR-friendly: data export and account deletion capabilities
- Session timeout after configurable inactivity period (default: 8 hours)
- Password strength requirements

---

## Implementation Phases

### Phase 1 — MVP (Build First)
1. Supabase project setup with RLS policies for multi-tenancy
2. Stripe integration: subscription plans, Checkout flow, webhook → tenant provisioning
3. Auth: Google OAuth + email/password via Supabase Auth; invite-based team member onboarding
4. Super Admin dashboard (platform-wide view)
5. Firm Settings (name, logo, timezone, fiscal year, time rounding, notes requirement)
6. Team member management (invite, roles; cost rates strictly admin-only)
7. Client and workstream CRUD
8. Live timer and manual time entry
9. Period locking (lock/unlock by month, enforced on all entry mutations)
10. Daily and weekly timesheet views
11. Basic reports: time by client, workstream, team member, date range
12. Admin profitability report (client and firm level)
13. CSV export

### Phase 2 — Enhanced
14. Budget tracking and alerts (80% / 100% warnings)
15. Timesheet approval workflow
16. PDF report export
17. Dashboard charts and visualizations (Recharts or Chart.js)
18. Recurring workstreams
19. Notification system (email via Resend + in-app)
20. Realization rate and utilization reports
21. Stripe Customer Portal (self-serve plan changes and cancellation)

### Phase 3 — Advanced
22. Invoicing module (generate from tracked time, mark as invoiced)
23. QBO/Xero integration (sync clients, push invoices)
24. API for third-party integrations
25. Mobile-responsive PWA (no native app at launch)

---

## Data Models (Simplified)

```
Tenant
  id, name, slug, logo_url, timezone, fiscal_year_start, settings_json
  stripe_customer_id, stripe_subscription_id, subscription_status, created_at

User
  id, tenant_id, supabase_auth_id, email, name, avatar_url
  role (super_admin | firm_admin | firm_user)
  cost_rate (admin-only — RLS restricts reads to firm_admin+)
  default_billing_rate, start_date, employment_type, is_active, created_at

Client
  id, tenant_id, name, code, contact_name, contact_email, phone
  industry, status, default_billing_rate, budget_hours, budget_amount
  notes, tags, created_at

Workstream
  id, client_id, tenant_id, name, service_type, description
  billing_type (hourly | fixed | retainer), billing_rate, fixed_fee_amount
  retainer_amount, retainer_frequency, estimated_hours
  start_date, end_date, status, created_at

TimeEntry
  id, tenant_id, user_id, client_id, workstream_id
  date, start_time, end_time, duration_minutes
  is_billable, notes, tags, is_invoiced
  created_at, updated_at, deleted_at

TimerSession (active timer state)
  id, user_id, started_at, client_id (nullable), workstream_id (nullable), notes

LockedPeriod
  id, tenant_id, period_year, period_month
  locked_at, locked_by_user_id, unlocked_at, unlocked_by_user_id

TimesheetApproval
  id, tenant_id, user_id, week_start_date, status, submitted_at, reviewed_at
  reviewer_id, reviewer_notes

AuditLog
  id, tenant_id, user_id, action, entity_type, entity_id, old_value, new_value, created_at
```

### Supabase RLS Key Policies
- All tenant tables: `tenant_id = auth.jwt() ->> 'tenant_id'`
- `User.cost_rate` and `User.default_billing_rate`: readable only when `role IN ('firm_admin', 'super_admin')`
- `LockedPeriod`: readable by all firm users; writable only by firm_admin+
- `TimeEntry`: insert/update/delete blocked if a matching `LockedPeriod` row exists for that entry's month/year

---

## Resolved Product Decisions

| # | Question | Decision |
|---|----------|----------|
| 1 | SaaS or single-firm? | **SaaS** — multiple paying firms, fully multi-tenant |
| 2 | Tech stack? | **Next.js + Supabase + Stripe + Vercel** |
| 3 | Cost rate visibility? | **Strictly admin-only** — enforced at API and RLS layer; never returned to firm_user role |
| 4 | Period locking? | **Yes** — Firm Admin can lock/unlock months; locked entries are read-only for all users |
| 5 | Mobile at launch? | **No** — desktop web only at launch; mobile PWA in Phase 3 |
| 6 | Firm signup flow? | **Self-serve** — firm signs up, pays via Stripe Checkout; tenant provisioned automatically via webhook |
