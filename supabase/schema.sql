-- =====================================================================
--  Cuaderno de cuidados — esquema de base de datos (PostgreSQL / Supabase)
--  Ejecutar completo en: Supabase → SQL Editor → New query → Run
--
--  Principios:
--   · Sin roles: todos los usuarios invitados a un paciente pueden leer,
--     crear, editar y borrar todo lo de ese paciente.
--   · Borrado lógico (deleted_at): nada se pierde de verdad.
--   · audit_log oculto: cada INSERT/UPDATE/DELETE queda registrado con
--     usuario, fecha, valores anteriores y nuevos. La app no lo muestra.
--   · Los campos complejos (síntomas, comidas, semáforos…) van en JSONB
--     para poder ampliar catálogos sin migraciones.
-- =====================================================================

create extension if not exists pgcrypto;

-- ---------- Perfiles y pertenencia -----------------------------------
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null,
  email text,
  color text,
  created_at timestamptz default now()
);

create table if not exists patients (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  birth_year int,
  hospital text,
  phone_oncology text,
  phone_emergency text,
  catheter_type text,
  catheter_since date,
  catheter_last_dressing date,
  catheter_dressing_days int,
  bsa_m2 numeric,
  protocol text,
  arm text,
  pgp text,
  necrosis_pct numeric,
  load_limits text,
  notes text,
  created_at timestamptz default now(),
  created_by uuid,
  updated_at timestamptz default now(),
  updated_by uuid,
  deleted_at timestamptz
);

-- Quién puede ver a qué paciente. Sin roles: pertenecer = permiso total.
create table if not exists patient_members (
  patient_id uuid references patients(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  added_at timestamptz default now(),
  primary key (patient_id, user_id)
);

create or replace function is_member(p uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from patient_members m where m.patient_id = p and m.user_id = auth.uid())
$$;

-- ---------- Registro de actividad (oculto) ---------------------------
create table if not exists audit_log (
  id bigserial primary key,
  at timestamptz default now(),
  user_id uuid,
  user_email text,
  table_name text not null,
  row_id text,
  action text not null,           -- INSERT / UPDATE / DELETE
  old_row jsonb,
  new_row jsonb
);
alter table audit_log enable row level security;  -- sin políticas: nadie lo lee desde la app

create or replace function audit_trigger() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  rid text;
begin
  rid := coalesce((to_jsonb(coalesce(new, old))->>'id'), null);
  insert into audit_log(user_id, user_email, table_name, row_id, action, old_row, new_row)
  values (auth.uid(), (select email from auth.users where id = auth.uid()), tg_table_name, rid, tg_op,
          case when tg_op in ('UPDATE','DELETE') then to_jsonb(old) end,
          case when tg_op in ('INSERT','UPDATE') then to_jsonb(new) end);
  return coalesce(new, old);
end $$;

-- ---------- Plantilla común para tablas clínicas ---------------------
-- Cada tabla: id, patient_id, metadatos, deleted_at, y sus campos.
-- Se crean con una función auxiliar para no repetir 19 veces lo mismo.

create or replace function _mk(t text, cols text) returns void
language plpgsql as $$
begin
  execute format($f$
    create table if not exists %I (
      id uuid primary key default gen_random_uuid(),
      patient_id uuid not null references patients(id) on delete cascade,
      created_at timestamptz default now(),
      created_by uuid,
      updated_at timestamptz default now(),
      updated_by uuid,
      deleted_at timestamptz,
      %s
    )$f$, t, cols);
  execute format('create index if not exists %I on %I (patient_id)', t || '_patient_idx', t);
  execute format('alter table %I enable row level security', t);
  execute format('drop policy if exists %I on %I', t || '_members_all', t);
  execute format('create policy %I on %I for all using (is_member(patient_id)) with check (is_member(patient_id))', t || '_members_all', t);
  execute format('drop trigger if exists %I on %I', t || '_audit', t);
  execute format('create trigger %I after insert or update or delete on %I for each row execute function audit_trigger()', t || '_audit', t);
end $$;

select _mk('diagnoses', $c$
  name text not null, kind text not null default 'otro', date date not null, confirmed_by text,
  status text not null default 'activo', status_date date, watch_signs jsonb default '[]',
  treatment_ref text, evolution jsonb default '[]', findings jsonb not null default '[]'
$c$);

select _mk('cycles', $c$
  number int not null, protocol_week int, drugs jsonb not null default '[]',
  planned_date date not null, start_at timestamptz, end_at timestamptz,
  planned_dose text, actual_dose text, actual_dose_mg_m2 jsonb default '{}',
  delay_days int, delay_reason text, admission_at timestamptz, discharge_at timestamptz,
  fasting_last_meal_at timestamptz, infusion_meds text, corticoid_iv boolean default false, corticoid_detail text,
  rescue jsonb default '{}', antiemetic jsonb default '{}', other_meds jsonb default '{}', drug_watch jsonb default '{}',
  mtp jsonb default '{}', procedure jsonb default '{}', notes text
$c$);

select _mk('daily_logs', $c$
  date date not null, location text, temp_max numeric, weight numeric, height_cm numeric,
  urine_color int, urine_amount text, urine_count int, urine_ml int, urine_ph numeric,
  stools_n int, bristol int, stool_color text, pain_max int, pain_location text, fatigue int,
  symptoms jsonb not null default '{}', mood_child int, preventive jsonb not null default '{}',
  meals jsonb not null default '[]', fluids_total_ml int, water_ml int, seawater_ml int, broth_cups int,
  sleep_start text, sleep_end text, wakeups int, wakeup_cause text, nap_min int,
  ir_morning boolean, ir_night boolean, glasses boolean, daylight_morning boolean, daylight_afternoon boolean, sun_exposure boolean,
  activity jsonb not null default '{}', activity_min int, steps int, notes text,
  extra jsonb not null default '{}',
  unique (patient_id, date)
$c$);

select _mk('products', $c$
  name text not null, block text not null default 'sup_fuera', composition text, dose text,
  moments jsonb not null default '[]', start_date date, end_date date, end_reason text, prescribed_by text, lab text, outcome text, outcome_notes text,
  traffic jsonb not null default '{}', traffic_reason text, notes text
$c$);

select _mk('intakes', $c$
  product_id uuid not null references products(id) on delete cascade, date date not null, moment text not null, taken boolean not null default false,
  unique (product_id, date, moment)
$c$);

select _mk('lab_panels', $c$ date date not null, context text, lab_name text, notes text $c$);
select _mk('lab_results', $c$
  panel_id uuid not null references lab_panels(id) on delete cascade, analyte text not null, value numeric not null,
  unit text, ref_low numeric, ref_high numeric
$c$);
select _mk('organ_tests', $c$ type text not null, date date not null, result text, next_date date, notes text $c$);
select _mk('microbiome_tests', $c$ date date not null, lab_name text, test_type text, results jsonb not null default '[]', notes text $c$);

select _mk('calendar_events', $c$
  type text not null default 'otro', title text not null, start_at timestamptz not null, all_day boolean default false,
  place text, companion text, professional text, notes text, status text not null default 'previsto',
  expected_result_date date, parent_id uuid
$c$);

select _mk('todos', $c$
  title text not null, pillar text, assignees jsonb not null default '[]', due_date date,
  priority text not null default 'normal', origin text not null default 'manual', status text not null default 'pendiente',
  done_at timestamptz, done_by uuid, notes text
$c$);

select _mk('questions', $c$
  professional text not null, question text not null, pillar text, status text not null default 'pendiente',
  answer text, answered_by text, answered_at date
$c$);

select _mk('weekly_child', $c$
  week_start date not null, mood int, emotions jsonb not null default '{}', body_image int, psych_session boolean,
  friends_contact text, decided text, notes text, unique (patient_id, week_start)
$c$);
select _mk('weekly_caregiver', $c$
  week_start date not null, user_id uuid not null, zarit jsonb not null default '[]', relief boolean, self_time boolean, hardest text,
  unique (patient_id, week_start, user_id)
$c$);
select _mk('caregiver_daily', $c$
  date date not null, user_id uuid not null, sleep_h numeric, ate_ok boolean, tired int, unique (patient_id, date, user_id)
$c$);
select _mk('exercise_sessions', $c$
  date date not null, kind text not null, exercises jsonb not null default '[]', minutes int, intensity text, notes text
$c$);
select _mk('functional_weekly', $c$
  week_start date not null, stairs boolean, walk_min int, stands_alone boolean, falls text, unique (patient_id, week_start)
$c$);

select _mk('exposures_weekly', $c$ week_start date not null, items jsonb not null default '{}', notes text, unique (patient_id, week_start) $c$);
select _mk('practices', $c$ name text not null, safety text not null default 'ambar', safety_reason text, authorized_by text, active boolean default true, notes text $c$);
select _mk('weights', $c$ at timestamptz not null, kg numeric not null, height_cm numeric, source text not null default 'casa', muscle_kg numeric, fat_pct numeric, water_pct numeric, notes text $c$);
select _mk('practice_log', $c$ date date not null, practice_id uuid not null references practices(id) on delete cascade, unique (practice_id, date) $c$);

drop function _mk(text, text);

-- ---------- Políticas de las tablas que no siguen la plantilla -------
alter table patients enable row level security;
drop policy if exists patients_members on patients;
create policy patients_members on patients for all
  using (is_member(id) or not exists (select 1 from patient_members))  -- el primer usuario puede crear el primer paciente
  with check (true);
drop trigger if exists patients_audit on patients;
create trigger patients_audit after insert or update or delete on patients for each row execute function audit_trigger();

-- Al crear un paciente, quien lo crea pasa a ser miembro automáticamente.
create or replace function add_creator_as_member() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null then
    insert into patient_members(patient_id, user_id) values (new.id, auth.uid()) on conflict do nothing;
  end if;
  return new;
end $$;
drop trigger if exists patients_add_creator on patients;
create trigger patients_add_creator after insert on patients for each row execute function add_creator_as_member();

alter table patient_members enable row level security;
drop policy if exists members_read on patient_members;
create policy members_read on patient_members for select using (is_member(patient_id));
drop policy if exists members_insert on patient_members;
create policy members_insert on patient_members for insert with check (is_member(patient_id));

alter table profiles enable row level security;
drop policy if exists profiles_read on profiles;
create policy profiles_read on profiles for select using (auth.uid() is not null);
drop policy if exists profiles_own on profiles;
create policy profiles_own on profiles for all using (id = auth.uid()) with check (id = auth.uid());

-- Crear el perfil al registrarse.
create or replace function handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into profiles(id, name, email)
  values (new.id, coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)), new.email)
  on conflict (id) do nothing;
  return new;
end $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute function handle_new_user();

-- ---------- Tiempo real -----------------------------------------------
-- En Supabase → Database → Replication, activar "supabase_realtime" para
-- todas las tablas public.* (o ejecutar):
do $$
declare t text;
begin
  for t in select unnest(array['patients','profiles','diagnoses','cycles','daily_logs','products','intakes','lab_panels','lab_results','organ_tests','microbiome_tests','calendar_events','todos','questions','weekly_child','weekly_caregiver','caregiver_daily','exercise_sessions','functional_weekly','exposures_weekly','practices','practice_log','weights'])
  loop
    begin
      execute format('alter publication supabase_realtime add table %I', t);
    exception when duplicate_object then null;
    end;
  end loop;
end $$;

-- ---------- Invitar usuarios -----------------------------------------
-- 1) Supabase → Authentication → Users → "Invite user" (correo).
-- 2) Darle acceso al paciente:
--    insert into patient_members(patient_id, user_id)
--    select p.id, u.id from patients p, auth.users u where u.email = 'correo@ejemplo.com';
--
-- ---------- Consultar el registro de actividad (oculto en la app) -----
-- select at, user_email, table_name, action, row_id from audit_log order by at desc limit 200;
