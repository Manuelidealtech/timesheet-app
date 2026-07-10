-- Consente di rimuovere gli account di ex dipendenti mantenendo lo storico.
-- La Edge Function manage-users scollega questi campi prima di eliminare auth.users.

alter table if exists public.timesheets
  alter column created_by drop not null;

alter table if exists public.intervention_reports
  alter column created_by drop not null;

-- Rende robusti anche gli eventuali delete eseguiti direttamente sul database.
do $$
declare
  constraint_name text;
begin
  select tc.constraint_name into constraint_name
  from information_schema.table_constraints tc
  join information_schema.key_column_usage kcu
    on tc.constraint_name = kcu.constraint_name
   and tc.constraint_schema = kcu.constraint_schema
  where tc.table_schema = 'public'
    and tc.table_name = 'timesheets'
    and tc.constraint_type = 'FOREIGN KEY'
    and kcu.column_name = 'created_by'
  limit 1;

  if constraint_name is not null then
    execute format('alter table public.timesheets drop constraint %I', constraint_name);
  end if;

  alter table public.timesheets
    add constraint timesheets_created_by_fkey
    foreign key (created_by) references auth.users(id) on delete set null;
exception when duplicate_object then null;
end $$;

do $$
declare
  constraint_name text;
begin
  select tc.constraint_name into constraint_name
  from information_schema.table_constraints tc
  join information_schema.key_column_usage kcu
    on tc.constraint_name = kcu.constraint_name
   and tc.constraint_schema = kcu.constraint_schema
  where tc.table_schema = 'public'
    and tc.table_name = 'intervention_reports'
    and tc.constraint_type = 'FOREIGN KEY'
    and kcu.column_name = 'created_by'
  limit 1;

  if constraint_name is not null then
    execute format('alter table public.intervention_reports drop constraint %I', constraint_name);
  end if;

  alter table public.intervention_reports
    add constraint intervention_reports_created_by_fkey
    foreign key (created_by) references auth.users(id) on delete set null;
exception when duplicate_object then null;
end $$;
