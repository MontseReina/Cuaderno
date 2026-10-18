-- =====================================================================
--  Huma — migración v0.31 (18/10/2026): apartado «Pautas y aprendizajes»
--  Ejecutar UNA VEZ en: Supabase → SQL Editor → New query → pegar → Run
--  Se puede ejecutar varias veces sin romper nada.
--
--  Crea la tabla donde se apuntan las pautas que dan los profesionales
--  por email, en sesiones privadas, en consulta o por mensaje. Las
--  respuestas a las preguntas siguen en «questions» (no cambia nada).
--  Misma seguridad que el resto: solo los usuarios invitados al paciente,
--  borrado lógico y registro oculto de cambios (audit_log).
-- =====================================================================

create table if not exists guidelines (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references patients(id) on delete cascade,
  created_at timestamptz default now(),
  created_by uuid,
  updated_at timestamptz default now(),
  updated_by uuid,
  deleted_at timestamptz,
  date date not null,
  professional text not null,
  who text,
  source text not null default 'email',
  title text not null,
  detail text,
  pillar text,
  active boolean not null default true
);
create index if not exists guidelines_patient_idx on guidelines (patient_id);
alter table guidelines enable row level security;
drop policy if exists guidelines_members_all on guidelines;
create policy guidelines_members_all on guidelines for all using (is_member(patient_id)) with check (is_member(patient_id));
drop trigger if exists guidelines_audit on guidelines;
create trigger guidelines_audit after insert or update or delete on guidelines for each row execute function audit_trigger();
do $$ begin
  execute 'alter publication supabase_realtime add table guidelines';
exception when duplicate_object then null; end $$;

select 'migración v0.31 (pautas) aplicada' as resultado;
