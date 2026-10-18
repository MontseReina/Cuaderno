-- =====================================================================
--  Huma — migración v0.34 (18/10/2026): avisos al móvil
--  Ejecutar UNA VEZ en: Supabase → SQL Editor → New query → pegar → Run
--  Se puede ejecutar varias veces sin romper nada.
--
--  1. push_subscriptions: los móviles con los avisos activados (uno por
--     móvil y usuario). Cada uno ve todos (para saber quién los recibe),
--     pero solo puede dar de alta o quitar los suyos.
--  2. avisos: cada control de las 12, 16 y 19 h, el cierre del día y cada
--     aviso enviado. Lo escribe SOLO la función del servidor «avisos»; la
--     app lo lee en Evaluaciones (ritmo del día y desviaciones).
--  3. Reloj: cada 5 minutos la base de datos llama a la función «avisos».
--     Sustituir <CRON_SECRET> por el mismo valor del secreto CRON_SECRET de
--     la función (Edge Functions → Secrets). No subir el valor real a GitHub.
-- =====================================================================

create table if not exists push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references patients(id) on delete cascade,
  created_at timestamptz default now(),
  created_by uuid,
  updated_at timestamptz default now(),
  updated_by uuid,
  deleted_at timestamptz,
  user_id uuid not null default auth.uid(),
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  device text,
  last_ok_at timestamptz,
  last_error text
);
create index if not exists push_subscriptions_patient_idx on push_subscriptions (patient_id);
alter table push_subscriptions enable row level security;
drop policy if exists push_subscriptions_read on push_subscriptions;
create policy push_subscriptions_read on push_subscriptions for select using (is_member(patient_id));
drop policy if exists push_subscriptions_own on push_subscriptions;
create policy push_subscriptions_own on push_subscriptions for insert with check (is_member(patient_id) and user_id = auth.uid());
drop policy if exists push_subscriptions_own_upd on push_subscriptions;
create policy push_subscriptions_own_upd on push_subscriptions for update using (is_member(patient_id) and user_id = auth.uid()) with check (is_member(patient_id) and user_id = auth.uid());
drop trigger if exists push_subscriptions_audit on push_subscriptions;
create trigger push_subscriptions_audit after insert or update or delete on push_subscriptions for each row execute function audit_trigger();

create table if not exists avisos (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references patients(id) on delete cascade,
  created_at timestamptz default now(),
  created_by uuid,
  updated_at timestamptz default now(),
  updated_by uuid,
  deleted_at timestamptz,
  date date not null,
  momento text not null,   -- 12 · 16 · 19 · final · 21 · 2130 · ayuno11 · ayuno12 · prueba
  area text not null,      -- agua · comidas · temperatura · peso · deposiciones · registro · envio
  valor numeric,
  meta numeric,
  ok boolean,
  texto text,
  titulo text,
  modo text,               -- quimio · nadir
  lugar text,              -- casa · ingreso · hospital_dia · urgencias
  enviados int,
  errores text
);
create unique index if not exists avisos_unico on avisos (patient_id, date, momento, area);
create index if not exists avisos_patient_date_idx on avisos (patient_id, date);
alter table avisos enable row level security;
drop policy if exists avisos_read on avisos;
create policy avisos_read on avisos for select using (is_member(patient_id));

do $$ begin
  execute 'alter publication supabase_realtime add table push_subscriptions';
exception when duplicate_object then null; end $$;
do $$ begin
  execute 'alter publication supabase_realtime add table avisos';
exception when duplicate_object then null; end $$;

-- Reloj: cada 5 minutos (la función decide qué toca según la hora de Madrid).
create extension if not exists pg_cron;
create extension if not exists pg_net;
select cron.unschedule(jobid) from cron.job where jobname = 'huma-avisos';
select cron.schedule('huma-avisos', '*/5 * * * *', $cron$
  select net.http_post(
    url := 'https://czzxfrgcyvfarvoeyamg.supabase.co/functions/v1/avisos',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN6enhmcmdjeXZmYXJ2b2V5YW1nIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODk2NjE0ODYsImV4cCI6MjEwNTIzNzQ4Nn0.U9cpToTD_fi_IkCXhq7B_ASPeLTLsIU-wxYxr-hXbSE',
      'x-cron-secret', '<CRON_SECRET>'),
    body := '{"accion":"tick"}'::jsonb,
    timeout_milliseconds := 25000)
$cron$);

select 'migración v0.34 (avisos) aplicada' as resultado;
