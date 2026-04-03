create table if not exists public.intervention_reports (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  created_by uuid null default auth.uid(),
  client_name text not null,
  city text null,
  report_number text not null,
  report_date date null,
  meals text null,
  km_auto text null,
  tolls text null,
  overnight_stays text null,
  notes text null,
  tested boolean not null default false,
  tested_date date null,
  tested_result text null default 'Positivo',
  technician_signature text null,
  client_signature text null,
  work_rows jsonb not null default '[]'::jsonb,
  machines jsonb not null default '[]'::jsonb,
  pdf_sent_at timestamptz null,
  pdf_file_name text null
);

alter table public.intervention_reports enable row level security;

create policy if not exists "intervention_reports_select_authenticated"
on public.intervention_reports
for select
using (auth.uid() is not null);

create policy if not exists "intervention_reports_insert_authenticated"
on public.intervention_reports
for insert
with check (auth.uid() is not null);

create policy if not exists "intervention_reports_update_authenticated"
on public.intervention_reports
for update
using (auth.uid() is not null)
with check (auth.uid() is not null);
