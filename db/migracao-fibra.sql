-- Migração: acrescenta fibra às metas e ao histórico.
-- Rode uma única vez no SQL Editor do Neon, em bancos que já estão em uso.
-- Em bancos novos não é necessária: o schema.sql já vem com as colunas.

alter table users   add column if not exists target_fiber int default 25;
alter table entries add column if not exists fiber numeric not null default 0;

-- Preenche a fibra dos registros antigos a partir do alimento de origem,
-- na mesma proporção da quantidade consumida.
update entries e
   set fiber = f.fiber * e.quantity / f.base_qty
  from foods f
 where e.food_id = f.id
   and e.fiber = 0
   and f.fiber > 0
   and f.base_qty > 0;
