-- Email cliente e firma manuale salvata come immagine PNG (data URL).
-- La migration è idempotente e può essere eseguita anche su database già in produzione.
alter table if exists public.intervention_reports
  add column if not exists client_email text null,
  add column if not exists client_signature_image text null;

comment on column public.intervention_reports.client_email is
  'Indirizzo email indicato dal cliente per ricevere il foglio intervento.';

comment on column public.intervention_reports.client_signature_image is
  'Firma manuale del cliente acquisita da canvas e salvata come data URL PNG.';
