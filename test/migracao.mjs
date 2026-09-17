/**
 * Confere a migração de fibra sobre um banco no formato antigo,
 * como o que já está em produção.
 */
import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';

const db = new PGlite();

// Reconstrói o schema ANTIGO: sem users.target_fiber e sem entries.fiber.
const antigo = readFileSync(new URL('../db/schema.sql', import.meta.url), 'utf8')
  .replace('  target_fiber   int  default 25,\n', '')
  .replace('  fiber    numeric not null default 0,\n', '');
await db.exec(antigo);

let falhas = 0;
const check = (label, ok, extra) => {
  console.log(ok ? `  ok   ${label}` : `  FALHA ${label} ${JSON.stringify(extra ?? '')}`);
  if (!ok) falhas++;
};

await db.exec(`
  insert into users (id, name, email, password_hash) values (1, 'Ana', 'a@a.com', 'x');
  insert into foods (id, user_id, name, base_qty, unit, kcal, fiber)
    values (1, 1, 'Aveia', 100, 'g', 390, 10), (2, 1, 'Frango', 100, 'g', 159, 0);
  insert into entries (id, user_id, food_id, date, meal, quantity, name, unit, kcal)
    values (1, 1, 1, current_date, 'cafe', 50, 'Aveia', 'g', 195),
           (2, 1, 2, current_date, 'almoco', 170, 'Frango', 'g', 270),
           (3, 1, null, current_date, 'ceia', 100, 'Alimento apagado', 'g', 100);
`);

const antes = await db.query(`select column_name from information_schema.columns
  where table_name = 'entries' and column_name = 'fiber'`);
check('o banco antigo realmente não tinha a coluna', antes.rows.length === 0);

await db.exec(readFileSync(new URL('../db/migracao-fibra.sql', import.meta.url), 'utf8'));

const cols = await db.query(`select column_name from information_schema.columns
  where (table_name = 'entries' and column_name = 'fiber')
     or (table_name = 'users' and column_name = 'target_fiber')`);
check('a migração cria as duas colunas', cols.rows.length === 2, cols.rows);

const meta = await db.query('select target_fiber from users where id = 1');
check('usuários existentes ganham meta padrão de fibra', Number(meta.rows[0].target_fiber) === 25, meta.rows[0]);

const e = await db.query('select id, fiber::float8 as fiber from entries order by id');
check('registro antigo é preenchido na proporção certa (50 g → 5 g)', e.rows[0].fiber === 5, e.rows[0]);
check('alimento sem fibra continua em zero', e.rows[1].fiber === 0, e.rows[1]);
check('registro sem alimento de origem não quebra a migração', e.rows[2].fiber === 0, e.rows[2]);

// Rodar duas vezes não pode duplicar nem estragar nada.
await db.exec(readFileSync(new URL('../db/migracao-fibra.sql', import.meta.url), 'utf8'));
const dePois = await db.query('select fiber::float8 as fiber from entries where id = 1');
check('rodar a migração de novo é seguro', dePois.rows[0].fiber === 5, dePois.rows[0]);

console.log(falhas ? `\n${falhas} falha(s).` : '\nMigração validada.');
await db.close();
process.exit(falhas ? 1 : 0);
