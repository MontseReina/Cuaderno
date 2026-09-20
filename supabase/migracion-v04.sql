-- =====================================================================
--  Cuaderno de cuidados — migración v0.4 (cambios del documento LOOK AND FEEL)
--  Ejecutar UNA VEZ en: Supabase → SQL Editor → New query → pegar → Run
--  Se puede ejecutar varias veces sin romper nada.
-- =====================================================================

-- 1) Registro diario: bolsa JSON para los campos nuevos (modo de semana,
--    horas de ayuno, infusiones, horarios de los sincronizadores).
alter table daily_logs add column if not exists extra jsonb not null default '{}';

-- 2) Pesadas (báscula InBody, hospital o casa) con fecha, hora y altura.
create table if not exists weights (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references patients(id) on delete cascade,
  created_at timestamptz default now(),
  created_by uuid,
  updated_at timestamptz default now(),
  updated_by uuid,
  deleted_at timestamptz,
  at timestamptz not null,
  kg numeric not null,
  height_cm numeric,
  source text not null default 'casa',
  muscle_kg numeric,
  fat_pct numeric,
  water_pct numeric,
  notes text
);
create index if not exists weights_patient_idx on weights (patient_id);
alter table weights enable row level security;
drop policy if exists weights_members_all on weights;
create policy weights_members_all on weights for all using (is_member(patient_id)) with check (is_member(patient_id));
drop trigger if exists weights_audit on weights;
create trigger weights_audit after insert or update or delete on weights for each row execute function audit_trigger();
do $$ begin
  execute 'alter publication supabase_realtime add table weights';
exception when duplicate_object then null; end $$;

-- 3) Diagnósticos: los que estaban "en seguimiento" pasan a "activo".
update diagnoses set status = 'activo' where status = 'seguimiento';

select 'migración v0.4 aplicada' as resultado;
