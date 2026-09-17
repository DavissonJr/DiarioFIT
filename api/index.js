import express from 'express';
import cors from 'cors';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL);
const JWT_SECRET = process.env.JWT_SECRET || 'troque-isto-em-producao';
const TOKEN_DAYS = 60;

const app = express();
app.use(cors());

// A Vercel já entrega o body parseado; só parseamos quando ele não veio pronto.
app.use((req, res, next) => {
  if (req.body !== undefined) return next();
  express.json({ limit: '256kb' })(req, res, next);
});

const r = express.Router();

/* ---------------------------------------------------------------- helpers */

// Campo ausente ou vazio devolve o valor de reserva, nunca zero.
const num = (v, fallback = 0) => {
  if (v === null || v === undefined || v === '') return fallback;
  const n = Number(String(v).replace(',', '.'));
  return Number.isFinite(n) ? n : fallback;
};
const round = (n, d = 1) => Math.round(n * 10 ** d) / 10 ** d;
const isDate = (s) => /^\d{4}-\d{2}-\d{2}$/.test(String(s || ''));

// A Vercel roda em UTC. Sem isto, depois das 21h no Brasil o servidor já estaria
// no dia seguinte. TZ_OFFSET é o fuso da pessoa, em horas.
const TZ_OFFSET = Number(process.env.TZ_OFFSET ?? -3);
const localDate = (ms = Date.now()) =>
  new Date(ms + TZ_OFFSET * 3600000).toISOString().slice(0, 10);
const today = () => localDate();
const weekdayOf = (iso) => new Date(iso + 'T12:00:00Z').getUTCDay();
const MEALS = ['cafe', 'almoco', 'lanche', 'jantar', 'ceia'];

function signToken(user) {
  return jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, {
    expiresIn: `${TOKEN_DAYS}d`,
  });
}

function auth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Faça login para continuar.' });
  try {
    req.uid = jwt.verify(token, JWT_SECRET).id;
    next();
  } catch {
    res.status(401).json({ error: 'Sua sessão expirou. Entre de novo.' });
  }
}

// Envolve rotas async para que qualquer erro caia no handler central.
const go = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

function publicUser(u) {
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    sex: u.sex,
    birthYear: u.birth_year,
    heightCm: u.height_cm === null ? null : Number(u.height_cm),
    activity: u.activity,
    goal: u.goal,
    targets: {
      kcal: Number(u.target_kcal),
      protein: Number(u.target_protein),
      carbs: Number(u.target_carbs),
      fat: Number(u.target_fat),
      fiber: Number(u.target_fiber),
      water: Number(u.target_water),
    },
  };
}

/* ------------------------------------------------------------- conta / jwt */

r.post(
  '/auth/register',
  go(async (req, res) => {
    const name = String(req.body?.name || '').trim();
    const email = String(req.body?.email || '').trim().toLowerCase();
    const password = String(req.body?.password || '');

    if (name.length < 2) return res.status(400).json({ error: 'Escreva seu nome.' });
    if (!/^\S+@\S+\.\S+$/.test(email)) return res.status(400).json({ error: 'E-mail inválido.' });
    if (password.length < 6)
      return res.status(400).json({ error: 'A senha precisa de pelo menos 6 caracteres.' });

    const [exists] = await sql`select id from users where email = ${email}`;
    if (exists) return res.status(409).json({ error: 'Esse e-mail já tem conta. Entre por aqui.' });

    const hash = await bcrypt.hash(password, 10);
    const [user] = await sql`
      insert into users (name, email, password_hash)
      values (${name}, ${email}, ${hash})
      returning *`;

    await seedNewUser(user.id);
    res.status(201).json({ token: signToken(user), user: publicUser(user) });
  })
);

r.post(
  '/auth/login',
  go(async (req, res) => {
    const email = String(req.body?.email || '').trim().toLowerCase();
    const password = String(req.body?.password || '');
    const [user] = await sql`select * from users where email = ${email}`;
    if (!user || !(await bcrypt.compare(password, user.password_hash)))
      return res.status(401).json({ error: 'E-mail ou senha não conferem.' });
    res.json({ token: signToken(user), user: publicUser(user) });
  })
);

r.get(
  '/auth/me',
  auth,
  go(async (req, res) => {
    const [user] = await sql`select * from users where id = ${req.uid}`;
    if (!user) return res.status(401).json({ error: 'Conta não encontrada.' });
    res.json({ user: publicUser(user) });
  })
);

r.put(
  '/profile',
  auth,
  go(async (req, res) => {
    const b = req.body || {};
    const [atual] = await sql`select * from users where id = ${req.uid}`;
    if (!atual) return res.status(401).json({ error: 'Conta não encontrada.' });
    const t = b.targets || {};

    const [user] = await sql`
      update users set
        name           = ${String(b.name || '').trim() || atual.name},
        sex            = ${b.sex === 'm' || b.sex === 'f' ? b.sex : atual.sex},
        birth_year     = ${b.birthYear ? Math.trunc(num(b.birthYear)) : atual.birth_year},
        height_cm      = ${b.heightCm ? num(b.heightCm) : atual.height_cm},
        activity       = ${String(b.activity || atual.activity)},
        goal           = ${String(b.goal || atual.goal)},
        target_kcal    = ${Math.max(1000, Math.trunc(num(t.kcal, atual.target_kcal)))},
        target_protein = ${Math.max(0, Math.trunc(num(t.protein, atual.target_protein)))},
        target_carbs   = ${Math.max(0, Math.trunc(num(t.carbs, atual.target_carbs)))},
        target_fat     = ${Math.max(0, Math.trunc(num(t.fat, atual.target_fat)))},
        target_fiber   = ${Math.max(0, Math.trunc(num(t.fiber, atual.target_fiber)))},
        target_water   = ${Math.max(0, Math.trunc(num(t.water, atual.target_water)))}
      where id = ${req.uid}
      returning *`;
    res.json({ user: publicUser(user) });
  })
);

r.put(
  '/profile/password',
  auth,
  go(async (req, res) => {
    const current = String(req.body?.current || '');
    const next = String(req.body?.next || '');
    if (next.length < 6)
      return res.status(400).json({ error: 'A nova senha precisa de pelo menos 6 caracteres.' });
    const [user] = await sql`select * from users where id = ${req.uid}`;
    if (!(await bcrypt.compare(current, user.password_hash)))
      return res.status(401).json({ error: 'A senha atual não confere.' });
    const hash = await bcrypt.hash(next, 10);
    await sql`update users set password_hash = ${hash} where id = ${req.uid}`;
    res.json({ ok: true });
  })
);

/* ----------------------------------------------------------- alimentos */

const foodOut = (f) => ({
  id: f.id,
  name: f.name,
  brand: f.brand,
  baseQty: Number(f.base_qty),
  unit: f.unit,
  kcal: Number(f.kcal),
  protein: Number(f.protein),
  carbs: Number(f.carbs),
  fat: Number(f.fat),
  fiber: Number(f.fiber),
  favorite: f.favorite,
});

r.get(
  '/foods',
  auth,
  go(async (req, res) => {
    const q = String(req.query.q || '').trim();
    const rows = q
      ? await sql`select * from foods
          where user_id = ${req.uid} and (name ilike ${'%' + q + '%'} or brand ilike ${'%' + q + '%'})
          order by favorite desc, name asc limit 80`
      : await sql`select * from foods where user_id = ${req.uid}
          order by favorite desc, name asc limit 300`;
    res.json({ foods: rows.map(foodOut) });
  })
);

// Alimentos mais usados nos últimos 30 dias — alimenta os atalhos da tela do dia.
r.get(
  '/foods/recent',
  auth,
  go(async (req, res) => {
    const rows = await sql`
      select f.*, count(e.id) as uses
      from foods f join entries e on e.food_id = f.id
      where f.user_id = ${req.uid} and e.date > current_date - 30
      group by f.id order by uses desc limit 12`;
    res.json({ foods: rows.map(foodOut) });
  })
);

function readFood(body) {
  const name = String(body?.name || '').trim();
  if (!name) return { error: 'Dê um nome ao alimento.' };
  const baseQty = num(body?.baseQty, 100);
  if (baseQty <= 0) return { error: 'A medida base precisa ser maior que zero.' };
  const unit = ['g', 'ml', 'un'].includes(body?.unit) ? body.unit : 'g';
  return {
    data: {
      name,
      brand: String(body?.brand || '').trim() || null,
      baseQty,
      unit,
      kcal: Math.max(0, num(body?.kcal)),
      protein: Math.max(0, num(body?.protein)),
      carbs: Math.max(0, num(body?.carbs)),
      fat: Math.max(0, num(body?.fat)),
      fiber: Math.max(0, num(body?.fiber)),
      favorite: !!body?.favorite,
    },
  };
}

r.post(
  '/foods',
  auth,
  go(async (req, res) => {
    const { data, error } = readFood(req.body);
    if (error) return res.status(400).json({ error });
    const [f] = await sql`
      insert into foods (user_id, name, brand, base_qty, unit, kcal, protein, carbs, fat, fiber, favorite)
      values (${req.uid}, ${data.name}, ${data.brand}, ${data.baseQty}, ${data.unit},
              ${data.kcal}, ${data.protein}, ${data.carbs}, ${data.fat}, ${data.fiber}, ${data.favorite})
      returning *`;
    res.status(201).json({ food: foodOut(f) });
  })
);

r.put(
  '/foods/:id',
  auth,
  go(async (req, res) => {
    const { data, error } = readFood(req.body);
    if (error) return res.status(400).json({ error });
    const [f] = await sql`
      update foods set name = ${data.name}, brand = ${data.brand}, base_qty = ${data.baseQty},
        unit = ${data.unit}, kcal = ${data.kcal}, protein = ${data.protein}, carbs = ${data.carbs},
        fat = ${data.fat}, fiber = ${data.fiber}, favorite = ${data.favorite}
      where id = ${Number(req.params.id)} and user_id = ${req.uid}
      returning *`;
    if (!f) return res.status(404).json({ error: 'Alimento não encontrado.' });
    res.json({ food: foodOut(f) });
  })
);

r.post(
  '/foods/:id/favorite',
  auth,
  go(async (req, res) => {
    const [f] = await sql`
      update foods set favorite = not favorite
      where id = ${Number(req.params.id)} and user_id = ${req.uid} returning *`;
    if (!f) return res.status(404).json({ error: 'Alimento não encontrado.' });
    res.json({ food: foodOut(f) });
  })
);

r.delete(
  '/foods/:id',
  auth,
  go(async (req, res) => {
    await sql`delete from foods where id = ${Number(req.params.id)} and user_id = ${req.uid}`;
    res.json({ ok: true });
  })
);

/* --------------------------------------------------------------- o dia */

r.get(
  '/day',
  auth,
  go(async (req, res) => {
    const date = isDate(req.query.date) ? req.query.date : today();
    const dow = weekdayOf(date);

    const [entries, habits, done, water, weight, note] = await Promise.all([
      sql`select id, meal, quantity, name, unit, kcal::float8, protein::float8,
                 carbs::float8, fat::float8, fiber::float8, food_id
          from entries where user_id = ${req.uid} and date = ${date} order by id`,
      sql`select * from habits where user_id = ${req.uid} and archived = false order by position, id`,
      sql`select habit_id from habit_logs where user_id = ${req.uid} and date = ${date}`,
      sql`select ml from water_logs where user_id = ${req.uid} and date = ${date}`,
      sql`select weight_kg::float8 as kg from weights where user_id = ${req.uid} and date = ${date}`,
      sql`select mood, body from notes where user_id = ${req.uid} and date = ${date}`,
    ]);

    const doneIds = new Set(done.map((d) => d.habit_id));
    const totals = entries.reduce(
      (acc, e) => ({
        kcal: acc.kcal + e.kcal,
        protein: acc.protein + e.protein,
        carbs: acc.carbs + e.carbs,
        fat: acc.fat + e.fat,
        fiber: acc.fiber + e.fiber,
      }),
      { kcal: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 }
    );

    res.json({
      date,
      entries: entries.map((e) => ({
        id: e.id,
        foodId: e.food_id,
        meal: e.meal,
        quantity: Number(e.quantity),
        name: e.name,
        unit: e.unit,
        kcal: round(e.kcal, 0),
        protein: round(e.protein),
        carbs: round(e.carbs),
        fat: round(e.fat),
        fiber: round(e.fiber),
      })),
      totals: {
        kcal: Math.round(totals.kcal),
        protein: round(totals.protein),
        carbs: round(totals.carbs),
        fat: round(totals.fat),
        fiber: round(totals.fiber),
      },
      habits: habits
        .filter((h) => h.weekdays.includes(String(dow)))
        .map((h) => ({ id: h.id, name: h.name, icon: h.icon, done: doneIds.has(h.id) })),
      water: water[0]?.ml ?? 0,
      weight: weight[0]?.kg ?? null,
      note: note[0] ? { mood: note[0].mood, body: note[0].body } : { mood: null, body: '' },
    });
  })
);

r.post(
  '/entries',
  auth,
  go(async (req, res) => {
    const date = isDate(req.body?.date) ? req.body.date : today();
    const meal = MEALS.includes(req.body?.meal) ? req.body.meal : 'almoco';
    const quantity = num(req.body?.quantity);
    if (quantity <= 0) return res.status(400).json({ error: 'Informe a quantidade.' });

    const [food] = await sql`
      select * from foods where id = ${Number(req.body?.foodId)} and user_id = ${req.uid}`;
    if (!food) return res.status(404).json({ error: 'Alimento não encontrado.' });

    const f = quantity / Number(food.base_qty);
    const [e] = await sql`
      insert into entries (user_id, food_id, date, meal, quantity, name, unit, kcal, protein, carbs, fat, fiber)
      values (${req.uid}, ${food.id}, ${date}, ${meal}, ${quantity}, ${food.name}, ${food.unit},
              ${Number(food.kcal) * f}, ${Number(food.protein) * f},
              ${Number(food.carbs) * f}, ${Number(food.fat) * f}, ${Number(food.fiber) * f})
      returning id`;
    res.status(201).json({ id: e.id });
  })
);

r.put(
  '/entries/:id',
  auth,
  go(async (req, res) => {
    const quantity = num(req.body?.quantity);
    if (quantity <= 0) return res.status(400).json({ error: 'Informe a quantidade.' });
    const [entry] = await sql`
      select * from entries where id = ${Number(req.params.id)} and user_id = ${req.uid}`;
    if (!entry) return res.status(404).json({ error: 'Registro não encontrado.' });

    // Recalcula a partir do alimento atual; se ele foi apagado, usa a proporção antiga.
    const [food] = entry.food_id
      ? await sql`select * from foods where id = ${entry.food_id} and user_id = ${req.uid}`
      : [null];
    const base = food
      ? {
          per: Number(food.base_qty),
          kcal: Number(food.kcal),
          protein: Number(food.protein),
          carbs: Number(food.carbs),
          fat: Number(food.fat),
          fiber: Number(food.fiber),
        }
      : {
          per: Number(entry.quantity),
          kcal: Number(entry.kcal),
          protein: Number(entry.protein),
          carbs: Number(entry.carbs),
          fat: Number(entry.fat),
          fiber: Number(entry.fiber),
        };
    const f = quantity / base.per;
    const meal = MEALS.includes(req.body?.meal) ? req.body.meal : entry.meal;

    await sql`update entries set quantity = ${quantity}, meal = ${meal},
        kcal = ${base.kcal * f}, protein = ${base.protein * f},
        carbs = ${base.carbs * f}, fat = ${base.fat * f}, fiber = ${base.fiber * f}
      where id = ${entry.id}`;
    res.json({ ok: true });
  })
);

r.delete(
  '/entries/:id',
  auth,
  go(async (req, res) => {
    await sql`delete from entries where id = ${Number(req.params.id)} and user_id = ${req.uid}`;
    res.json({ ok: true });
  })
);

// Traz registros de outro dia: uma lista escolhida (ids) ou o dia inteiro (from).
r.post(
  '/entries/copy',
  auth,
  go(async (req, res) => {
    const to = isDate(req.body?.to) ? req.body.to : null;
    if (!to) return res.status(400).json({ error: 'Data de destino inválida.' });

    const ids = Array.isArray(req.body?.ids)
      ? req.body.ids.map((n) => Math.trunc(num(n))).filter((n) => n > 0).slice(0, 200)
      : null;

    if (ids) {
      if (ids.length === 0) return res.status(400).json({ error: 'Escolha ao menos um item.' });
      const rows = await sql`
        insert into entries (user_id, food_id, date, meal, quantity, name, unit, kcal, protein, carbs, fat, fiber)
        select user_id, food_id, ${to}, meal, quantity, name, unit, kcal, protein, carbs, fat, fiber
        from entries where user_id = ${req.uid} and id = any(${ids})
        returning id`;
      return res.json({ copied: rows.length });
    }

    const from = isDate(req.body?.from) ? req.body.from : null;
    if (!from) return res.status(400).json({ error: 'Data de origem inválida.' });
    const rows = await sql`
      insert into entries (user_id, food_id, date, meal, quantity, name, unit, kcal, protein, carbs, fat, fiber)
      select user_id, food_id, ${to}, meal, quantity, name, unit, kcal, protein, carbs, fat, fiber
      from entries where user_id = ${req.uid} and date = ${from}
      returning id`;
    res.json({ copied: rows.length });
  })
);

/* ------------------------------------------------------------- hábitos */

r.get(
  '/habits',
  auth,
  go(async (req, res) => {
    const rows = await sql`
      select * from habits where user_id = ${req.uid} and archived = false order by position, id`;
    res.json({
      habits: rows.map((h) => ({
        id: h.id,
        name: h.name,
        icon: h.icon,
        weekdays: h.weekdays,
        position: h.position,
      })),
    });
  })
);

r.post(
  '/habits',
  auth,
  go(async (req, res) => {
    const name = String(req.body?.name || '').trim();
    if (!name) return res.status(400).json({ error: 'Dê um nome ao hábito.' });
    const weekdays = /^[0-6]{1,7}$/.test(req.body?.weekdays || '') ? req.body.weekdays : '0123456';
    const [h] = await sql`
      insert into habits (user_id, name, icon, weekdays, position)
      values (${req.uid}, ${name}, ${String(req.body?.icon || 'check')}, ${weekdays},
              coalesce((select max(position) + 1 from habits where user_id = ${req.uid}), 0))
      returning *`;
    res.status(201).json({ habit: { id: h.id, name: h.name, icon: h.icon, weekdays: h.weekdays } });
  })
);

r.put(
  '/habits/:id',
  auth,
  go(async (req, res) => {
    const name = String(req.body?.name || '').trim();
    if (!name) return res.status(400).json({ error: 'Dê um nome ao hábito.' });
    const weekdays = /^[0-6]{1,7}$/.test(req.body?.weekdays || '') ? req.body.weekdays : '0123456';
    const [h] = await sql`
      update habits set name = ${name}, icon = ${String(req.body?.icon || 'check')}, weekdays = ${weekdays}
      where id = ${Number(req.params.id)} and user_id = ${req.uid} returning *`;
    if (!h) return res.status(404).json({ error: 'Hábito não encontrado.' });
    res.json({ habit: { id: h.id, name: h.name, icon: h.icon, weekdays: h.weekdays } });
  })
);

r.delete(
  '/habits/:id',
  auth,
  go(async (req, res) => {
    await sql`update habits set archived = true
      where id = ${Number(req.params.id)} and user_id = ${req.uid}`;
    res.json({ ok: true });
  })
);

r.post(
  '/habits/:id/toggle',
  auth,
  go(async (req, res) => {
    const id = Number(req.params.id);
    const date = isDate(req.body?.date) ? req.body.date : today();
    const [h] = await sql`select id from habits where id = ${id} and user_id = ${req.uid}`;
    if (!h) return res.status(404).json({ error: 'Hábito não encontrado.' });
    const [log] = await sql`select id from habit_logs where habit_id = ${id} and date = ${date}`;
    if (log) {
      await sql`delete from habit_logs where id = ${log.id}`;
      return res.json({ done: false });
    }
    await sql`insert into habit_logs (user_id, habit_id, date) values (${req.uid}, ${id}, ${date})`;
    res.json({ done: true });
  })
);

/* --------------------------------------------------------- água, peso, nota */

r.put(
  '/water',
  auth,
  go(async (req, res) => {
    const date = isDate(req.body?.date) ? req.body.date : today();
    const ml = Math.max(0, Math.min(20000, Math.trunc(num(req.body?.ml))));
    await sql`insert into water_logs (user_id, date, ml) values (${req.uid}, ${date}, ${ml})
      on conflict (user_id, date) do update set ml = ${ml}`;
    res.json({ ml });
  })
);

r.get(
  '/weights',
  auth,
  go(async (req, res) => {
    const rows = await sql`
      select to_char(date, 'YYYY-MM-DD') as date, weight_kg::float8 as kg
      from weights where user_id = ${req.uid} order by date asc limit 400`;
    res.json({ weights: rows });
  })
);

r.put(
  '/weights',
  auth,
  go(async (req, res) => {
    const date = isDate(req.body?.date) ? req.body.date : today();
    const kg = num(req.body?.kg);
    if (kg <= 0 || kg > 400) return res.status(400).json({ error: 'Peso inválido.' });
    await sql`insert into weights (user_id, date, weight_kg) values (${req.uid}, ${date}, ${kg})
      on conflict (user_id, date) do update set weight_kg = ${kg}`;
    res.json({ ok: true });
  })
);

r.delete(
  '/weights/:date',
  auth,
  go(async (req, res) => {
    if (!isDate(req.params.date)) return res.status(400).json({ error: 'Data inválida.' });
    await sql`delete from weights where user_id = ${req.uid} and date = ${req.params.date}`;
    res.json({ ok: true });
  })
);

r.put(
  '/note',
  auth,
  go(async (req, res) => {
    const date = isDate(req.body?.date) ? req.body.date : today();
    const mood = req.body?.mood ? String(req.body.mood).slice(0, 16) : null;
    const body = String(req.body?.body || '').slice(0, 2000);
    await sql`insert into notes (user_id, date, mood, body) values (${req.uid}, ${date}, ${mood}, ${body})
      on conflict (user_id, date) do update set mood = ${mood}, body = ${body}`;
    res.json({ ok: true });
  })
);

/* -------------------------------------------------------------- resumo */

r.get(
  '/stats',
  auth,
  go(async (req, res) => {
    const days = Math.min(120, Math.max(7, Math.trunc(num(req.query.days, 14))));
    const from = localDate(Date.now() - (days - 1) * 86400000);

    const [daily, water, weights, habits, logs] = await Promise.all([
      sql`select to_char(date, 'YYYY-MM-DD') as date,
                 sum(kcal)::float8 as kcal, sum(protein)::float8 as protein,
                 sum(carbs)::float8 as carbs, sum(fat)::float8 as fat,
                 sum(fiber)::float8 as fiber
          from entries where user_id = ${req.uid} and date >= ${from}
          group by date order by date`,
      sql`select to_char(date, 'YYYY-MM-DD') as date, ml
          from water_logs where user_id = ${req.uid} and date >= ${from} order by date`,
      sql`select to_char(date, 'YYYY-MM-DD') as date, weight_kg::float8 as kg
          from weights where user_id = ${req.uid} order by date asc limit 400`,
      sql`select id, name, weekdays from habits where user_id = ${req.uid} and archived = false
          order by position, id`,
      sql`select habit_id, to_char(date, 'YYYY-MM-DD') as date from habit_logs
          where user_id = ${req.uid} and date >= current_date - 120`,
    ]);

    const byDate = Object.fromEntries(daily.map((d) => [d.date, d]));
    const waterBy = Object.fromEntries(water.map((w) => [w.date, w.ml]));
    const series = [];
    for (let i = days - 1; i >= 0; i--) {
      const date = localDate(Date.now() - i * 86400000);
      const d = byDate[date];
      series.push({
        date,
        kcal: Math.round(d?.kcal || 0),
        protein: round(d?.protein || 0),
        carbs: round(d?.carbs || 0),
        fat: round(d?.fat || 0),
        fiber: round(d?.fiber || 0),
        water: waterBy[date] || 0,
      });
    }

    // Sequência atual e taxa de conclusão por hábito.
    const logSet = new Set(logs.map((l) => `${l.habit_id}:${l.date}`));
    const habitStats = habits.map((h) => {
      let streak = 0;
      let firstChecked = true;
      for (let i = 0; i < 120; i++) {
        const iso = localDate(Date.now() - i * 86400000);
        if (!h.weekdays.includes(String(weekdayOf(iso)))) continue;
        const marked = logSet.has(`${h.id}:${iso}`);
        if (marked) streak++;
        // O dia de hoje ainda pode ser marcado, então não encerra a sequência.
        else if (!firstChecked) break;
        firstChecked = false;
      }
      let planned = 0;
      let done = 0;
      for (let i = 0; i < days; i++) {
        const iso = localDate(Date.now() - i * 86400000);
        if (!h.weekdays.includes(String(weekdayOf(iso)))) continue;
        planned++;
        if (logSet.has(`${h.id}:${iso}`)) done++;
      }
      return { id: h.id, name: h.name, streak, planned, done };
    });

    const logged = series.filter((s) => s.kcal > 0);
    res.json({
      days,
      series,
      weights,
      habits: habitStats,
      averages: {
        kcal: logged.length ? Math.round(logged.reduce((a, s) => a + s.kcal, 0) / logged.length) : 0,
        protein: logged.length
          ? round(logged.reduce((a, s) => a + s.protein, 0) / logged.length)
          : 0,
        water: logged.length
          ? Math.round(series.reduce((a, s) => a + s.water, 0) / series.length)
          : 0,
        daysLogged: logged.length,
      },
    });
  })
);

r.get(
  '/health',
  go(async (req, res) => {
    const [row] = await sql`select now() as now`;
    res.json({ ok: true, db: !!row });
  })
);

/* --------------------------------------------------------------- seed */

// Alimentos e hábitos iniciais para que o app já sirva no primeiro acesso.
// Valores por 100 g/ml, exceto onde a unidade é "un". Fontes: TACO / USDA.
const SEED_FOODS = [
  ['Arroz branco cozido', 100, 'g', 128, 2.5, 28.1, 0.2, 1.6],
  ['Feijão carioca cozido', 100, 'g', 76, 4.8, 13.6, 0.5, 8.5],
  ['Peito de frango grelhado', 100, 'g', 159, 32, 0, 3.2, 0],
  ['Patinho moído cozido', 100, 'g', 219, 26.7, 0, 11.9, 0],
  ['Tilápia grelhada', 100, 'g', 128, 26.1, 0, 2.6, 0],
  ['Ovo de galinha cozido', 1, 'un', 74, 6.3, 0.6, 5.0, 0],
  ['Batata doce cozida', 100, 'g', 77, 0.6, 18.4, 0.1, 2.2],
  ['Macarrão cozido', 100, 'g', 158, 5.8, 30.0, 0.9, 1.8],
  ['Pão francês', 1, 'un', 150, 4.7, 29.3, 1.5, 1.2],
  ['Aveia em flocos', 100, 'g', 394, 13.9, 66.6, 8.5, 9.1],
  ['Leite integral', 100, 'ml', 61, 3.2, 4.7, 3.3, 0],
  ['Iogurte natural integral', 100, 'g', 51, 4.1, 4.5, 1.9, 0],
  ['Queijo mussarela', 100, 'g', 289, 21.0, 3.0, 22.0, 0],
  ['Banana prata', 100, 'g', 98, 1.3, 26.0, 0.1, 2.0],
  ['Maçã com casca', 100, 'g', 56, 0.3, 15.2, 0.1, 1.3],
  ['Mamão papaia', 100, 'g', 40, 0.5, 10.4, 0.1, 1.0],
  ['Brócolis cozido', 100, 'g', 25, 2.1, 4.4, 0.5, 3.4],
  ['Tomate cru', 100, 'g', 15, 1.1, 3.1, 0.2, 1.2],
  ['Alface crespa', 100, 'g', 11, 1.3, 1.7, 0.2, 1.8],
  ['Azeite de oliva', 100, 'ml', 884, 0, 0, 100, 0],
  ['Whey protein (medida)', 30, 'g', 120, 24, 3, 1.5, 0],
  ['Café coado sem açúcar', 100, 'ml', 2, 0.1, 0.3, 0, 0],
];

const SEED_HABITS = [
  ['Tomar café da manhã', 'sun', '0123456'],
  ['Comer sem pressa, longe da tela', 'utensils', '0123456'],
  ['Treinar', 'dumbbell', '12345'],
  ['Caminhar 20 minutos', 'footprints', '0123456'],
  ['Dormir 7 a 8 horas', 'moon', '0123456'],
];

async function seedNewUser(userId) {
  await Promise.all([
    ...SEED_FOODS.map(
      ([name, base, unit, kcal, p, c, f, fib]) => sql`
        insert into foods (user_id, name, base_qty, unit, kcal, protein, carbs, fat, fiber, favorite)
        values (${userId}, ${name}, ${base}, ${unit}, ${kcal}, ${p}, ${c}, ${f}, ${fib}, false)`
    ),
    ...SEED_HABITS.map(
      ([name, icon, weekdays], i) => sql`
        insert into habits (user_id, name, icon, weekdays, position)
        values (${userId}, ${name}, ${icon}, ${weekdays}, ${i})`
    ),
  ]);
}

/* ------------------------------------------------------------- montagem */

app.use('/api', r);
app.use(r); // também responde sem o prefixo, para rodar local

app.use((req, res) => res.status(404).json({ error: 'Rota não encontrada.' }));

app.use((err, req, res, _next) => {
  console.error(err);
  const missingDb = /DATABASE_URL|connection string/i.test(String(err?.message));
  res.status(500).json({
    error: missingDb
      ? 'O banco não está configurado. Confira a variável DATABASE_URL.'
      : 'Algo quebrou aqui do lado. Tente de novo.',
  });
});

export default app;
