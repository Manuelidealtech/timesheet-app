-- ESEGUIRE IN SQL EDITOR SU SUPABASE

alter table if exists public.profiles
  add column if not exists email text,
  add column if not exists department text check (department in ('produzione', 'ufficio')),
  add column if not exists employee_id bigint,
  add column if not exists is_active boolean not null default true;

alter table if exists public.employees
  add column if not exists department text not null default 'produzione' check (department in ('produzione', 'ufficio'));

alter table if exists public.timesheets
  add column if not exists department text,
  add column if not exists created_by uuid;

update public.timesheets t
set department = e.department
from public.employees e
where e.id = t.employee_id
  and t.department is null;

update public.profiles p
set email = coalesce(p.email, u.email)
from auth.users u
where u.id = p.user_id
  and (p.email is null or p.email = '');

create index if not exists idx_profiles_department on public.profiles(department);
create index if not exists idx_profiles_employee_id on public.profiles(employee_id);
create index if not exists idx_employees_department on public.employees(department);
create index if not exists idx_timesheets_department on public.timesheets(department);
create index if not exists idx_timesheets_created_by on public.timesheets(created_by);

-- facoltativo ma consigliato: riallinea il reparto del timesheet al dipendente collegato
create or replace function public.set_timesheet_department()
returns trigger
language plpgsql
as $$
begin
  if new.department is null then
    select e.department into new.department
    from public.employees e
    where e.id = new.employee_id;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_set_timesheet_department on public.timesheets;
create trigger trg_set_timesheet_department
before insert or update on public.timesheets
for each row execute function public.set_timesheet_department();

-- RLS DI ESEMPIO
alter table public.profiles enable row level security;
alter table public.timesheets enable row level security;

-- rimuovi o adatta policy precedenti se entrano in conflitto

do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='profiles' and policyname='profiles_select_own_or_admin'
  ) then
    create policy profiles_select_own_or_admin on public.profiles
    for select
    using (
      auth.uid() = user_id
      or exists (
        select 1 from public.profiles p
        where p.user_id = auth.uid() and p.role = 'admin' and p.is_active = true
      )
    );
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='profiles' and policyname='profiles_update_own_or_admin'
  ) then
    create policy profiles_update_own_or_admin on public.profiles
    for update
    using (
      auth.uid() = user_id
      or exists (
        select 1 from public.profiles p
        where p.user_id = auth.uid() and p.role = 'admin' and p.is_active = true
      )
    )
    with check (
      auth.uid() = user_id
      or exists (
        select 1 from public.profiles p
        where p.user_id = auth.uid() and p.role = 'admin' and p.is_active = true
      )
    );
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='timesheets' and policyname='timesheets_select_scoped'
  ) then
    create policy timesheets_select_scoped on public.timesheets
    for select
    using (
      exists (
        select 1 from public.profiles p
        where p.user_id = auth.uid()
          and p.role = 'admin'
          and p.is_active = true
      )
      or exists (
        select 1 from public.profiles p
        where p.user_id = auth.uid()
          and p.is_active = true
          and p.department = public.timesheets.department
      )
    );
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='timesheets' and policyname='timesheets_insert_scoped'
  ) then
    create policy timesheets_insert_scoped on public.timesheets
    for insert
    with check (
      exists (
        select 1 from public.profiles p
        where p.user_id = auth.uid()
          and p.role = 'admin'
          and p.is_active = true
      )
      or exists (
        select 1 from public.profiles p
        where p.user_id = auth.uid()
          and p.is_active = true
          and p.department = public.timesheets.department
      )
    );
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='timesheets' and policyname='timesheets_update_scoped'
  ) then
    create policy timesheets_update_scoped on public.timesheets
    for update
    using (
      exists (
        select 1 from public.profiles p
        where p.user_id = auth.uid()
          and p.role = 'admin'
          and p.is_active = true
      )
      or exists (
        select 1 from public.profiles p
        where p.user_id = auth.uid()
          and p.is_active = true
          and p.department = public.timesheets.department
      )
    )
    with check (
      exists (
        select 1 from public.profiles p
        where p.user_id = auth.uid()
          and p.role = 'admin'
          and p.is_active = true
      )
      or exists (
        select 1 from public.profiles p
        where p.user_id = auth.uid()
          and p.is_active = true
          and p.department = public.timesheets.department
      )
    );
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='timesheets' and policyname='timesheets_delete_admin_only'
  ) then
    create policy timesheets_delete_admin_only on public.timesheets
    for delete
    using (
      exists (
        select 1 from public.profiles p
        where p.user_id = auth.uid()
          and p.role = 'admin'
          and p.is_active = true
      )
    );
  end if;
end $$;
