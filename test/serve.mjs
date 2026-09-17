/** Sobe a API com Postgres em WASM e uma conta de exemplo, só para revisar a tela. */
import { PGlite } from '@electric-sql/pglite';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';

const db = new PGlite();
await db.exec(readFileSync(new URL('../db/schema.sql', import.meta.url), 'utf8'));

mkdirSync(new URL('./tmp/', import.meta.url), { recursive: true });
writeFileSync(
  new URL('./tmp/neon-shim.mjs', import.meta.url),
  `export function neon() { return globalThis.__sql; }`
);
globalThis.__sql = async (strings, ...values) => {
  const text = strings.reduce((a, p, i) => a + p + (i < values.length ? `$${i + 1}` : ''), '');
  return (await db.query(text, values)).rows;
};

const source = readFileSync(new URL('../api/index.js', import.meta.url), 'utf8').replace(
  `from '@neondatabase/serverless'`,
  `from '../test/tmp/neon-shim.mjs'`
);
writeFileSync(new URL('../api/index.test.mjs', import.meta.url), source);

process.env.JWT_SECRET = 'demo';
const { default: app } = await import('../api/index.test.mjs');

const server = app.listen(3001, async () => {
  const base = 'http://127.0.0.1:3001/api';
  const post = (p, body, token) =>
    fetch(base + p, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(body),
    }).then((r) => r.json());
  const put = (p, body, token) =>
    fetch(base + p, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
    }).then((r) => r.json());

  const { token } = await post('/auth/register', {
    name: 'Marina',
    email: 'demo@demo.com',
    password: 'demo123',
  });

  const iso = (o = 0) => new Date(Date.now() - 3 * 36e5 + o * 864e5).toISOString().slice(0, 10);
  const { foods } = await fetch(base + '/foods', {
    headers: { Authorization: `Bearer ${token}` },
  }).then((r) => r.json());
  const find = (n) => foods.find((f) => f.name.includes(n));

  await put('/profile', {
    name: 'Marina',
    sex: 'f',
    birthYear: 1997,
    heightCm: 165,
    activity: 'moderada',
    goal: 'perder',
    targets: { kcal: 1850, protein: 115, carbs: 190, fat: 55, water: 2200 },
  }, token);

  const plan = [
    ['Aveia', 40, 'cafe'],
    ['Leite integral', 200, 'cafe'],
    ['Banana', 90, 'cafe'],
    ['Arroz', 120, 'almoco'],
    ['Feijão', 90, 'almoco'],
    ['Peito de frango', 170, 'almoco'],
    ['Brócolis', 80, 'almoco'],
    ['Iogurte', 170, 'lanche'],
  ];
  for (const [name, q, meal] of plan) {
    const f = find(name);
    if (f) await post('/entries', { foodId: f.id, date: iso(), meal, quantity: q }, token);
  }

  // Histórico para os gráficos.
  for (let i = 1; i < 14; i++) {
    const f = find('Peito de frango');
    const r = find('Arroz');
    await post('/entries', { foodId: f.id, date: iso(-i), meal: 'almoco', quantity: 120 + i * 9 }, token);
    await post('/entries', { foodId: r.id, date: iso(-i), meal: 'almoco', quantity: 300 + i * 22 }, token);
    await put('/water', { date: iso(-i), ml: 1500 + (i % 4) * 250 }, token);
    if (i % 3 === 0) await put('/weights', { date: iso(-i), kg: 63.4 - i * 0.08 }, token);
  }
  await put('/weights', { date: iso(), kg: 62.3 }, token);
  await put('/water', { date: iso(), ml: 1250 }, token);

  const day = await fetch(base + `/day?date=${iso()}`, {
    headers: { Authorization: `Bearer ${token}` },
  }).then((r) => r.json());
  for (const h of day.habits.slice(0, 3))
    await post(`/habits/${h.id}/toggle`, { date: iso() }, token);
  for (let i = 1; i < 12; i++)
    for (const h of day.habits.slice(0, i % 4))
      await post(`/habits/${h.id}/toggle`, { date: iso(-i) }, token);

  console.log('pronto');
});

process.on('SIGTERM', () => {
  server.close();
  process.exit(0);
});
