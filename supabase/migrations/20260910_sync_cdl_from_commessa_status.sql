-- Sincronizzazione automatica Gestione Commesse -> CDL Timesheet
--
-- Obiettivo:
-- ogni cartella che compare in public.commessa_document_status deve avere
-- immediatamente una riga attiva in public.cdl, cosi il menu Timesheet usa
-- sempre le stesse commesse viste in Gestione Commesse.
--
-- Le cartelle "0000 ..." sono revisioni senza numero commessa reale.
-- Per evitare conflitti su cdl.code, ricevono internamente un codice tecnico
-- stabile REV-XXXXXXXX. Nell'interfaccia viene mostrato semplicemente "REV".

create or replace function public.sync_commessa_status_to_cdl()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cdl_id bigint;
  v_is_revision boolean;
  v_code text;
begin
  v_is_revision := coalesce(btrim(new.commessa_code), '') in ('', '0000');

  if v_is_revision then
    v_code := 'REV-' || upper(substr(md5(new.commessa_folder), 1, 8));

    -- Per le revisioni il nome/cartella e' il riferimento univoco, non 0000.
    select c.id
      into v_cdl_id
    from public.cdl c
    where lower(btrim(coalesce(c.name, ''))) = lower(btrim(coalesce(new.commessa_name, '')))
    order by c.id
    limit 1;
  else
    v_code := btrim(new.commessa_code);

    -- Prima il codice reale, poi il nome come fallback.
    select c.id
      into v_cdl_id
    from public.cdl c
    where btrim(coalesce(c.code, '')) = v_code
    order by c.id
    limit 1;

    if v_cdl_id is null then
      select c.id
        into v_cdl_id
      from public.cdl c
      where lower(btrim(coalesce(c.name, ''))) = lower(btrim(coalesce(new.commessa_name, '')))
      order by c.id
      limit 1;
    end if;
  end if;

  if v_cdl_id is null then
    insert into public.cdl (code, name, client, is_active)
    values (
      v_code,
      coalesce(nullif(btrim(new.commessa_name), ''), new.commessa_folder),
      nullif(btrim(new.client), ''),
      true
    )
    returning id into v_cdl_id;
  else
    update public.cdl c
       set is_active = true,
           code = case
             when v_is_revision then v_code
             when coalesce(btrim(c.code), '') = '' then v_code
             else c.code
           end,
           name = case
             when coalesce(btrim(c.name), '') = '' then coalesce(nullif(btrim(new.commessa_name), ''), new.commessa_folder)
             else c.name
           end,
           client = case
             when coalesce(btrim(c.client), '') = '' then nullif(btrim(new.client), '')
             else c.client
           end
     where c.id = v_cdl_id;
  end if;

  new.cdl_id := v_cdl_id;
  return new;
end;
$$;

drop trigger if exists trg_sync_commessa_status_to_cdl
on public.commessa_document_status;

create trigger trg_sync_commessa_status_to_cdl
before insert or update of commessa_folder, commessa_code, commessa_name, client, cdl_id
on public.commessa_document_status
for each row
execute function public.sync_commessa_status_to_cdl();

-- Ripara subito tutte le commesse/revisioni gia presenti in Gestione Commesse.
-- L'UPDATE non cambia i dati visibili: serve solo a far scattare il trigger.
update public.commessa_document_status
set cdl_id = cdl_id;

-- Controllo finale utile nel SQL Editor.
select
  s.commessa_code as codice_server,
  s.commessa_name,
  s.cdl_id,
  c.code as codice_cdl,
  c.name as nome_cdl,
  c.is_active
from public.commessa_document_status s
left join public.cdl c on c.id = s.cdl_id
order by s.commessa_code nulls first, s.commessa_name;
