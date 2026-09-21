-- Migração: registro por unidade (medida caseira) e sugestões por refeição.
-- Rode uma única vez no SQL Editor do Neon, ANTES de publicar esta versão.
-- Em bancos novos não é necessária: o schema.sql já vem completo.
-- Pode rodar de novo sem problema.

alter table foods   add column if not exists portion_qty   numeric;
alter table foods   add column if not exists portion_label text;

alter table entries add column if not exists portions      numeric;
alter table entries add column if not exists portion_label text;

create index if not exists entries_user_meal_idx on entries(user_id, meal, date);
