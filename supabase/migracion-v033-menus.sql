-- =====================================================================
--  Huma — migración v0.33 (18/10/2026): menú de la nutricionista
--  Ejecutar UNA VEZ en: Supabase → SQL Editor → New query → pegar → Run
--  Se puede ejecutar varias veces sin romper nada.
--
--  Crea la tabla donde se guarda el menú (platos de cada día y sus
--  kilocalorías estimadas). El menú se carga desde la app, en
--  Nutrición → Menú; no está en el código, que es público.
--  Misma seguridad que el resto: solo los usuarios invitados al paciente,
--  borrado lógico y registro oculto de cambios (audit_log).
-- =====================================================================

create table if not exists menus (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references patients(id) on delete cascade,
  created_at timestamptz default now(),
  created_by uuid,
  updated_at timestamptz default now(),
  updated_by uuid,
  deleted_at timestamptz,
  name text not null,
  data jsonb not null,
  active boolean not null default true
);
create index if not exists menus_patient_idx on menus (patient_id);
alter table menus enable row level security;
drop policy if exists menus_members_all on menus;
create policy menus_members_all on menus for all using (is_member(patient_id)) with check (is_member(patient_id));
drop trigger if exists menus_audit on menus;
create trigger menus_audit after insert or update or delete on menus for each row execute function audit_trigger();
do $$ begin
  execute 'alter publication supabase_realtime add table menus';
exception when duplicate_object then null; end $$;

select 'migración v0.33 (menús) aplicada' as resultado;
