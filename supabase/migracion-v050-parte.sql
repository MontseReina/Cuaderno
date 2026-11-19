-- =====================================================================
--  Huma — migración v0.50 (19/11/2026): parte de la mañana
--  Ejecutar UNA VEZ en: Supabase → SQL Editor → New query → pegar → Run
--  Se puede ejecutar varias veces sin romper nada.
--
--  push_subscriptions.perfil: qué recibe cada móvil.
--    'cuidador' (por defecto) → todos los avisos (recordatorios del día y parte de las 8:00).
--    'parte'                  → solo el parte de las 8:00 (y los avisos de tendencia cuando estén).
--  Cada usuario lo elige en Más → 🔔 Avisos al móvil.
-- =====================================================================
alter table push_subscriptions add column if not exists perfil text not null default 'cuidador';
do $$ begin
  alter table push_subscriptions add constraint push_subscriptions_perfil_chk check (perfil in ('cuidador', 'parte'));
exception when duplicate_object then null; end $$;

select 'migración v0.50 (parte de la mañana) aplicada' as resultado;
