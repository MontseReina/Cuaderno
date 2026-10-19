-- Huma v0.35.0 · Ventana «Cirugía» del semáforo de suplementos
-- Supabase → SQL Editor → New query → pegar → Run (una vez).
alter table patients add column if not exists surgery_from date;
alter table patients add column if not exists surgery_to date;
