-- Core tenant isolation policy
alter table "Tenant" enable row level security;
alter table "User" enable row level security;
alter table "Client" enable row level security;
alter table "Workstream" enable row level security;
alter table "TimeEntry" enable row level security;
alter table "TimerSession" enable row level security;
alter table "LockedPeriod" enable row level security;
alter table "TimesheetApproval" enable row level security;
alter table "AuditLog" enable row level security;

create policy tenant_isolation_user on "User"
for select using (
  role = 'super_admin' or "tenantId"::text = coalesce(auth.jwt() ->> 'tenant_id', '')
);

create policy tenant_isolation_client on "Client"
for all using (
  "tenantId"::text = coalesce(auth.jwt() ->> 'tenant_id', '')
)
with check (
  "tenantId"::text = coalesce(auth.jwt() ->> 'tenant_id', '')
);

create policy tenant_isolation_workstream on "Workstream"
for all using (
  "tenantId"::text = coalesce(auth.jwt() ->> 'tenant_id', '')
)
with check (
  "tenantId"::text = coalesce(auth.jwt() ->> 'tenant_id', '')
);

create policy tenant_isolation_time_entry on "TimeEntry"
for all using (
  "tenantId"::text = coalesce(auth.jwt() ->> 'tenant_id', '')
)
with check (
  "tenantId"::text = coalesce(auth.jwt() ->> 'tenant_id', '')
);

create policy lock_period_read on "LockedPeriod"
for select using (
  "tenantId"::text = coalesce(auth.jwt() ->> 'tenant_id', '')
);

create policy lock_period_admin_write on "LockedPeriod"
for all using (
  "tenantId"::text = coalesce(auth.jwt() ->> 'tenant_id', '')
  and (auth.jwt() ->> 'role') in ('firm_admin', 'super_admin')
)
with check (
  "tenantId"::text = coalesce(auth.jwt() ->> 'tenant_id', '')
  and (auth.jwt() ->> 'role') in ('firm_admin', 'super_admin')
);

-- Cost rate column protection for non-admin roles.
revoke select ("costRate", "defaultBillingRate") on "User" from anon, authenticated;

grant select (id, "tenantId", email, name, "avatarUrl", timezone, role, "isActive", "createdAt", "updatedAt") on "User" to authenticated;
grant select ("costRate", "defaultBillingRate") on "User" to service_role;

-- Optional trigger function to block mutations in locked periods.
create or replace function block_locked_period_mutation()
returns trigger as $$
begin
  if exists (
    select 1 from "LockedPeriod" lp
    where lp."tenantId" = new."tenantId"
      and lp."periodYear" = extract(year from new.date)
      and lp."periodMonth" = extract(month from new.date)
      and lp."unlockedAt" is null
  ) then
    raise exception 'This period is locked';
  end if;
  return new;
end;
$$ language plpgsql;

drop trigger if exists time_entry_locked_period_guard on "TimeEntry";
create trigger time_entry_locked_period_guard
before insert or update on "TimeEntry"
for each row execute function block_locked_period_mutation();
