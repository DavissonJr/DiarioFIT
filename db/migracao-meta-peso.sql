-- Migração: meta de peso.
-- Rode uma única vez no SQL Editor do Neon, ANTES de publicar esta versão.
-- Em bancos novos não é necessária. Pode rodar de novo sem problema.

alter table users add column if not exists target_weight   numeric;
alter table users add column if not exists goal_start_kg   numeric;
alter table users add column if not exists goal_start_date date;
