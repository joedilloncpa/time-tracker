create or replace function block_locked_period_mutation()
returns trigger
language plpgsql
set search_path = public
as $$
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
$$;
