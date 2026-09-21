/**
 * Testa a API de ponta a ponta contra um Postgres real (PGlite, em WASM).
 * Não faz parte do app: roda só aqui, com `node test/run.mjs`.
 */
import { PGlite } from '@electric-sql/pglite';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { createServer } from 'node:http';

const db = new PGlite();
await db.exec(readFileSync(new URL('../db/schema.sql', import.meta.url), 'utf8'));

// Adapta o template `sql` do driver do Neon para o PGlite.
const shim = `
export function neon() {
  return globalThis.__sql;
}
`;
mkdirSync(new URL('./tmp/', import.meta.url), { recursive: true });
writeFileSync(new URL('./tmp/neon-shim.mjs', import.meta.url), shim);

globalThis.__sql = async (strings, ...values) => {
  const text = strings.reduce(
    (acc, part, i) => acc + part + (i < values.length ? `$${i + 1}` : ''),
    ''
  );
  const res = await db.query(text, values);
  return res.rows;
};

const source = readFileSync(new URL('../api/index.js', import.meta.url), 'utf8').replace(
  `from '@neondatabase/serverless'`,
  `from '../test/tmp/neon-shim.mjs'`
);
writeFileSync(new URL('../api/index.test.mjs', import.meta.url), source);

process.env.JWT_SECRET = 'segredo-de-teste';
const { default: app } = await import('../api/index.test.mjs');

const server = createServer(app);
await new Promise((r) => server.listen(0, r));
const base = `http://127.0.0.1:${server.address().port}/api`;

/* ----------------------------------------------------------------- ajuda */

let token = null;
let failures = 0;
let count = 0;

async function call(path, { method = 'GET', body } = {}) {
  const res = await fetch(base + path, {
    method,
    headers: {
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: res.status, data: await res.json().catch(() => null) };
}

function check(label, condition, detail) {
  count++;
  if (condition) {
    console.log(`  ok   ${label}`);
  } else {
    failures++;
    console.log(`  FALHA ${label}${detail ? ` → ${JSON.stringify(detail)}` : ''}`);
  }
}

const iso = (offset = 0) => {
  const d = new Date(Date.now() - 3 * 3600000 + offset * 86400000);
  return d.toISOString().slice(0, 10);
};

/* ----------------------------------------------------------------- casos */

console.log('\nConta e sessão');
{
  const r = await call('/auth/register', {
    method: 'POST',
    body: { name: 'Ana', email: 'ANA@Teste.com', password: 'segredo123' },
  });
  check('cria conta e devolve token', r.status === 201 && !!r.data.token, r.data);
  token = r.data.token;

  const dup = await call('/auth/register', {
    method: 'POST',
    body: { name: 'Ana', email: 'ana@teste.com', password: 'segredo123' },
  });
  check('bloqueia e-mail repetido', dup.status === 409, dup.data);

  const weak = await call('/auth/register', {
    method: 'POST',
    body: { name: 'Bia', email: 'bia@teste.com', password: '123' },
  });
  check('recusa senha curta', weak.status === 400, weak.data);

  const bad = await call('/auth/login', {
    method: 'POST',
    body: { email: 'ana@teste.com', password: 'errada' },
  });
  check('recusa senha errada', bad.status === 401, bad.data);

  const good = await call('/auth/login', {
    method: 'POST',
    body: { email: 'ana@teste.com', password: 'segredo123' },
  });
  check('entra com a senha certa', good.status === 200 && !!good.data.token, good.data);

  const saved = token;
  token = null;
  const anon = await call('/foods');
  check('bloqueia acesso sem token', anon.status === 401);
  token = 'abc.invalido.xyz';
  const fake = await call('/foods');
  check('bloqueia token inválido', fake.status === 401);
  token = saved;
}

console.log('\nAlimentos');
let frango, ovo;
{
  const seeded = await call('/foods');
  check('conta nova já vem com alimentos', seeded.data.foods.length >= 20, seeded.data.foods.length);

  const r = await call('/foods', {
    method: 'POST',
    body: { name: 'Frango teste', baseQty: 100, unit: 'g', kcal: 160, protein: 32, carbs: 0, fat: 3.2 },
  });
  frango = r.data.food;
  check('cadastra alimento', r.status === 201 && frango.kcal === 160, r.data);

  const u = await call('/foods', {
    method: 'POST',
    body: { name: 'Ovo teste', baseQty: 1, unit: 'un', kcal: 74, protein: 6.3, carbs: 0.6, fat: 5 },
  });
  ovo = u.data.food;
  check('cadastra alimento por unidade', ovo.unit === 'un' && ovo.baseQty === 1, u.data);

  const invalid = await call('/foods', { method: 'POST', body: { name: '', kcal: 10 } });
  check('recusa alimento sem nome', invalid.status === 400);

  const fav = await call(`/foods/${frango.id}/favorite`, { method: 'POST' });
  check('marca favorito', fav.data.food.favorite === true);

  const search = await call('/foods?q=frang');
  check('busca por nome', search.data.foods.some((f) => f.id === frango.id));
}

console.log('\nRegistro do dia e cálculo');
{
  const a = await call('/entries', {
    method: 'POST',
    body: { foodId: frango.id, date: iso(), meal: 'almoco', quantity: 170 },
  });
  check('registra 170 g', a.status === 201, a.data);

  const day = await call(`/day?date=${iso()}`);
  const entry = day.data.entries[0];
  // 170 g de um alimento com 160 kcal/100 g = 272 kcal
  check('calcula 170 g × 160 kcal/100 g = 272', entry.kcal === 272, entry);
  check('calcula proteína proporcional', Math.abs(entry.protein - 54.4) < 0.05, entry.protein);
  check('soma o total do dia', day.data.totals.kcal === 272, day.data.totals);

  const b = await call('/entries', {
    method: 'POST',
    body: { foodId: ovo.id, date: iso(), meal: 'cafe', quantity: 2 },
  });
  check('registra 2 unidades', b.status === 201);

  const day2 = await call(`/day?date=${iso()}`);
  check('2 ovos = 148 kcal', day2.data.entries.find((e) => e.meal === 'cafe').kcal === 148, day2.data.entries);
  check('total acumula as refeições', day2.data.totals.kcal === 420, day2.data.totals);

  const edit = await call(`/entries/${entry.id}`, { method: 'PUT', body: { quantity: 100 } });
  check('edita a quantidade', edit.status === 200);
  const day3 = await call(`/day?date=${iso()}`);
  check('recalcula após editar (100 g = 160)', day3.data.totals.kcal === 308, day3.data.totals);

  // Apagar o alimento não pode alterar o histórico.
  await call(`/foods/${frango.id}`, { method: 'DELETE' });
  const day4 = await call(`/day?date=${iso()}`);
  check('histórico sobrevive ao apagar o alimento', day4.data.totals.kcal === 308, day4.data.totals);

  const copy = await call('/entries/copy', {
    method: 'POST',
    body: { from: iso(), to: iso(1) },
  });
  check('copia o dia inteiro', copy.data.copied === 2, copy.data);

  // Cópia escolhida item a item.
  const dayIds = await call(`/day?date=${iso()}`);
  const um = dayIds.data.entries[0].id;
  const sel = await call('/entries/copy', { method: 'POST', body: { ids: [um], to: iso(2) } });
  check('copia só os itens escolhidos', sel.data.copied === 1, sel.data);
  const alvo = await call(`/day?date=${iso(2)}`);
  check('o destino recebe apenas o escolhido', alvo.data.entries.length === 1, alvo.data.entries);
  check('o item copiado mantém a refeição', alvo.data.entries[0].meal === dayIds.data.entries[0].meal, alvo.data.entries[0]);
  const vazio = await call('/entries/copy', { method: 'POST', body: { ids: [], to: iso(2) } });
  check('recusa cópia sem nenhum item', vazio.status === 400, vazio.data);
  await call(`/entries/${alvo.data.entries[0].id}`, { method: 'DELETE' });

  // Fibra acompanha a mesma proporção dos outros nutrientes.
  const aveia = await call('/foods', {
    method: 'POST',
    body: { name: 'Aveia teste', baseQty: 100, unit: 'g', kcal: 390, protein: 14, carbs: 66, fat: 8, fiber: 10 },
  });
  await call('/entries', {
    method: 'POST',
    body: { foodId: aveia.data.food.id, date: iso(), meal: 'cafe', quantity: 50 },
  });
  const comFibra = await call(`/day?date=${iso()}`);
  const reg = comFibra.data.entries.find((e) => e.name === 'Aveia teste');
  check('50 g de um alimento com 10 g de fibra = 5 g', reg.fiber === 5, reg);
  check('fibra entra no total do dia', comFibra.data.totals.fiber === 5, comFibra.data.totals);
  await call(`/entries/${reg.id}`, { method: 'PUT', body: { quantity: 100 } });
  const recalc = await call(`/day?date=${iso()}`);
  check('fibra recalcula ao editar a quantidade', recalc.data.totals.fiber === 10, recalc.data.totals);
  await call(`/entries/${reg.id}`, { method: 'DELETE' });

  const del = await call(`/entries/${entry.id}`, { method: 'DELETE' });
  check('apaga um registro', del.status === 200);
  const day5 = await call(`/day?date=${iso()}`);
  check('total cai após apagar', day5.data.totals.kcal === 148, day5.data.totals);
}

console.log('\nHábitos, água e peso');
{
  const day = await call(`/day?date=${iso()}`);
  check('conta nova já vem com hábitos', day.data.habits.length >= 3, day.data.habits.length);

  const habit = day.data.habits[0];
  const on = await call(`/habits/${habit.id}/toggle`, { method: 'POST', body: { date: iso() } });
  check('marca hábito', on.data.done === true);
  const off = await call(`/habits/${habit.id}/toggle`, { method: 'POST', body: { date: iso() } });
  check('desmarca hábito', off.data.done === false);
  await call(`/habits/${habit.id}/toggle`, { method: 'POST', body: { date: iso() } });

  const created = await call('/habits', {
    method: 'POST',
    body: { name: 'Alongar', weekdays: '135' },
  });
  check('cria hábito com dias escolhidos', created.data.habit.weekdays === '135', created.data);

  const water = await call('/water', { method: 'PUT', body: { date: iso(), ml: 1500 } });
  check('salva água', water.data.ml === 1500);
  const dayW = await call(`/day?date=${iso()}`);
  check('água aparece no dia', dayW.data.water === 1500);

  await call('/weights', { method: 'PUT', body: { date: iso(-2), kg: 62.4 } });
  await call('/weights', { method: 'PUT', body: { date: iso(), kg: 61.8 } });
  const w = await call('/weights');
  check('guarda a série de peso em ordem', w.data.weights.length === 2 && w.data.weights[1].kg === 61.8, w.data);

  const over = await call('/weights', { method: 'PUT', body: { date: iso(), kg: 900 } });
  check('recusa peso absurdo', over.status === 400);

  const note = await call('/note', { method: 'PUT', body: { date: iso(), mood: 'Bem', body: 'dia tranquilo' } });
  check('salva a nota do dia', note.status === 200);
  const dayN = await call(`/day?date=${iso()}`);
  check('nota volta no dia', dayN.data.note.mood === 'Bem' && dayN.data.note.body === 'dia tranquilo', dayN.data.note);
}

console.log('\nResumo');
{
  const s = await call('/stats?days=7');
  check('série cobre os 7 dias', s.data.series.length === 7, s.data.series.length);
  check('último item da série é hoje', s.data.series[6].date === iso(), s.data.series[6]);
  check('hoje tem calorias na série', s.data.series[6].kcal === 148, s.data.series[6]);
  check('traz o peso', s.data.weights.length === 2);
  check('calcula sequência do hábito', s.data.habits.some((h) => h.streak >= 1), s.data.habits);
  check('média considera só dias anotados', s.data.averages.daysLogged >= 1, s.data.averages);
}


console.log('\nRegistro por unidade (medida caseira)');
{
  const r = await call('/foods', {
    method: 'POST',
    body: { name: 'Ovo teste', baseQty: 100, unit: 'g', kcal: 146, protein: 13.3, carbs: 0.6,
            fat: 9.5, portionQty: 50, portionLabel: 'ovo' },
  });
  const ovo = r.data.food;
  check('guarda a medida caseira do alimento', ovo.portionQty === 50 && ovo.portionLabel === 'ovo', ovo);

  const semRotulo = await call('/foods', {
    method: 'POST',
    body: { name: 'Biscoito teste', baseQty: 100, unit: 'g', kcal: 380, portionQty: 7.5 },
  });
  check('rótulo padrão "unidade" quando não informado', semRotulo.data.food.portionLabel === 'unidade', semRotulo.data.food);

  const un = await call('/foods', {
    method: 'POST',
    body: { name: 'Pão teste', baseQty: 1, unit: 'un', kcal: 150, portionQty: 50 },
  });
  check('alimento por unidade ignora medida caseira', un.data.food.portionQty === null, un.data.food);

  const d = iso(5);
  const add = await call('/entries', {
    method: 'POST',
    body: { foodId: ovo.id, date: d, meal: 'cafe', portions: 3 },
  });
  check('registra 3 ovos de uma vez', add.status === 201, add.data);
  let day = await call(`/day?date=${d}`);
  let e = day.data.entries[0];
  check('3 × 50 g = 150 g calculado no servidor', e.quantity === 150, e);
  check('3 ovos = 219 kcal', e.kcal === 219, e);
  check('o registro lembra que foram 3 ovos', e.portions === 3 && e.portionLabel === 'ovo', e);

  // O cliente não consegue impor um total diferente do que as unidades dão.
  const burla = await call('/entries', {
    method: 'POST',
    body: { foodId: ovo.id, date: d, meal: 'cafe', portions: 1, quantity: 999 },
  });
  day = await call(`/day?date=${d}`);
  const burlado = day.data.entries.find((x) => x.id === burla.data.id);
  check('unidades prevalecem sobre quantidade enviada junto', burlado.quantity === 50, burlado);
  await call(`/entries/${burla.data.id}`, { method: 'DELETE' });

  await call(`/entries/${e.id}`, { method: 'PUT', body: { portions: 2 } });
  day = await call(`/day?date=${d}`);
  e = day.data.entries[0];
  check('editar para 2 ovos recalcula para 100 g', e.quantity === 100 && e.portions === 2, e);

  await call(`/entries/${e.id}`, { method: 'PUT', body: { quantity: 80 } });
  day = await call(`/day?date=${d}`);
  e = day.data.entries[0];
  check('trocar para gramas limpa as unidades', e.quantity === 80 && e.portions === null, e);

  const semMedida = await call('/entries', {
    method: 'POST',
    body: { foodId: un.data.food.id, date: d, meal: 'cafe', portions: 2 },
  });
  check('recusa unidades em alimento sem medida caseira', semMedida.status === 400, semMedida.data);

  const zero = await call('/entries', {
    method: 'POST',
    body: { foodId: ovo.id, date: d, meal: 'cafe', portions: 0 },
  });
  check('recusa zero unidades', zero.status === 400, zero.data);

  // Com o alimento apagado, a proporção guardada no registro continua valendo.
  await call(`/entries/${e.id}`, { method: 'PUT', body: { portions: 2 } });
  await call(`/foods/${ovo.id}`, { method: 'DELETE' });
  await call(`/entries/${e.id}`, { method: 'PUT', body: { portions: 4 } });
  day = await call(`/day?date=${d}`);
  e = day.data.entries[0];
  check('alimento apagado: 4 ovos ainda viram 200 g', e.quantity === 200 && e.kcal === 292, e);

  const cp = await call('/entries/copy', { method: 'POST', body: { ids: [e.id], to: iso(6) } });
  const copiado = (await call(`/day?date=${iso(6)}`)).data.entries[0];
  check('copiar de outro dia preserva as unidades', cp.data.copied === 1 && copiado.portions === 4 && copiado.portionLabel === 'ovo', copiado);
}

console.log('\nSugestões por refeição');
{
  const leite = (await call('/foods', { method: 'POST', body: { name: 'Leite teste', baseQty: 100, unit: 'ml', kcal: 42 } })).data.food;
  const chia = (await call('/foods', { method: 'POST', body: { name: 'Chia teste', baseQty: 100, unit: 'g', kcal: 490 } })).data.food;
  const bolo = (await call('/foods', { method: 'POST', body: { name: 'Bolo teste', baseQty: 100, unit: 'g', kcal: 350 } })).data.food;

  // Leite no café 3 vezes (200, 200, 300 ml); chia 2 vezes; bolo só 1 vez; leite 2 vezes na ceia.
  const plano = [
    [leite, -20, 'cafe', 200], [leite, -21, 'cafe', 200], [leite, -22, 'cafe', 300],
    [chia, -20, 'cafe', 15], [chia, -23, 'cafe', 15],
    [bolo, -20, 'cafe', 80],
    [leite, -20, 'ceia', 150], [leite, -21, 'ceia', 150],
  ];
  for (const [f, off, meal, q] of plano)
    await call('/entries', { method: 'POST', body: { foodId: f.id, date: iso(off), meal, quantity: q } });

  const cafe = await call('/foods/suggestions?meal=cafe');
  const nomes = cafe.data.suggestions.map((x) => x.food.name);
  check('sugere o que é comum no café', nomes.includes('Leite teste') && nomes.includes('Chia teste'), nomes);
  check('não sugere o que apareceu uma vez só', !nomes.includes('Bolo teste'), nomes);
  check('o mais frequente vem primeiro', nomes[0] === 'Leite teste', nomes);
  const s0 = cafe.data.suggestions[0];
  check('traz a quantidade de costume (200 ml, não 300)', s0.quantity === 200 && s0.uses === 3, s0);

  const ceia = await call('/foods/suggestions?meal=ceia');
  const sc = ceia.data.suggestions.find((x) => x.food.name === 'Leite teste');
  check('cada refeição tem sua própria quantidade de costume', sc && sc.quantity === 150, ceia.data.suggestions);
  check('ceia não herda sugestões do café', !ceia.data.suggestions.some((x) => x.food.name === 'Chia teste'), ceia.data.suggestions);

  const invalida = await call('/foods/suggestions?meal=lanchinho');
  check('recusa refeição inválida', invalida.status === 400);
}


console.log('\nMeta de peso');
{
  const anterior = token;
  const nova = await call('/auth/register', {
    method: 'POST',
    body: { name: 'Carla', email: 'carla@teste.com', password: 'segredo123' },
  });
  token = nova.data.token;

  const semPeso = await call('/weight-goal', { method: 'PUT', body: { target: 60 } });
  check('sem nenhuma pesagem, pede o peso atual', semPeso.status === 400, semPeso.data);

  const define = await call('/weight-goal', { method: 'PUT', body: { target: 60, currentKg: 66 } });
  check('define a meta junto com o peso atual', define.status === 200 && define.data.user.weightGoal.target === 60, define.data);
  check('o ponto de partida é o peso daquele momento', define.data.user.weightGoal.startKg === 66, define.data.user.weightGoal);
  check('o objetivo do perfil vira "perder"', define.data.user.goal === 'perder', define.data.user.goal);
  const pesos = await call('/weights');
  check('o peso atual informado é anotado', pesos.data.weights.some((w) => w.date === iso() && w.kg === 66), pesos.data);

  // Cinco semanas de histórico perdendo 0,5 kg por semana.
  for (const [off, kg] of [[-35, 68.5], [-28, 68], [-21, 67.5], [-14, 67], [-7, 66.5]])
    await call('/weights', { method: 'PUT', body: { date: iso(off), kg } });

  const st = await call('/stats?days=14');
  const g = st.data.weightGoal;
  check('o resumo traz a análise da meta', g && g.target === 60 && g.direction === 'perder', g);
  check('mede o ritmo real (~0,5 kg/semana)', Math.abs(g.ratePerWeek + 0.5) < 0.06, g.ratePerWeek);
  check('estima uma data de chegada futura', g.etaStatus === 'ok' && g.eta > iso(), g);
  check('cada pesagem vem com o valor de tendência', st.data.weights.every((w) => typeof w.trend === 'number'), st.data.weights);

  const ajuste = await call('/weight-goal', { method: 'PUT', body: { target: 59 } });
  check('ajustar na mesma direção mantém o ponto de partida', ajuste.data.user.weightGoal.startKg === 66, ajuste.data.user.weightGoal);

  const inverte = await call('/weight-goal', { method: 'PUT', body: { target: 70 } });
  check('inverter a direção recomeça do peso atual', inverte.data.user.weightGoal.startKg !== 66 && inverte.data.user.goal === 'ganhar', inverte.data.user);

  const absurda = await call('/weight-goal', { method: 'PUT', body: { target: 10 } });
  check('recusa meta fora de 25 a 300 kg', absurda.status === 400, absurda.data);

  await call('/profile', { method: 'PUT', body: { heightCm: 165 } });
  await call('/weight-goal', { method: 'PUT', body: { target: 48 } });
  const baixa = await call('/stats?days=7');
  check('meta abaixo de IMC 18,5 acende o aviso', baixa.data.weightGoal.lowBmi === true, baixa.data.weightGoal);

  const remove = await call('/weight-goal', { method: 'PUT', body: { target: null } });
  check('remove a meta', remove.data.user.weightGoal === null, remove.data.user);
  const semMeta = await call('/stats?days=7');
  check('sem meta, o resumo não traz análise', semMeta.data.weightGoal === null, semMeta.data.weightGoal);

  token = anterior;
  const outra = await call('/stats?days=7');
  check('a meta de uma conta não aparece na outra', outra.data.weightGoal === null, outra.data.weightGoal);
}

console.log('\nIsolamento entre contas');
{
  const other = await call('/auth/register', {
    method: 'POST',
    body: { name: 'Bia', email: 'bia2@teste.com', password: 'segredo123' },
  });
  const anaToken = token;
  token = other.data.token;

  const foods = await call('/foods');
  check('a outra conta não vê o alimento alheio', !foods.data.foods.some((f) => f.name === 'Ovo teste'), foods.data.foods.map((f) => f.name));

  const day = await call(`/day?date=${iso()}`);
  check('a outra conta não vê o dia alheio', day.data.totals.kcal === 0, day.data.totals);

  const sug = await call('/foods/suggestions?meal=cafe');
  check('a outra conta não recebe sugestões alheias', sug.data.suggestions.length === 0, sug.data);

  const steal = await call(`/entries/${1}`, { method: 'PUT', body: { quantity: 5 } });
  check('não edita registro de outra conta', steal.status === 404, steal.data);

  const stealCopy = await call('/entries/copy', {
    method: 'POST',
    body: { ids: [1, 2, 3], to: iso() },
  });
  check('não copia registros de outra conta', stealCopy.data.copied === 0, stealCopy.data);

  token = anaToken;
}

console.log('\nPerfil');
{
  const p = await call('/profile', {
    method: 'PUT',
    body: {
      name: 'Ana',
      sex: 'f',
      birthYear: 1998,
      heightCm: 165,
      activity: 'moderada',
      goal: 'perder',
      targets: { kcal: 1800, protein: 120, carbs: 180, fat: 55, fiber: 28, water: 2200 },
    },
  });
  check('salva perfil e metas', p.data.user.targets.kcal === 1800 && p.data.user.heightCm === 165, p.data.user);
  check('salva a meta de fibra', p.data.user.targets.fiber === 28, p.data.user.targets);

  const floor = await call('/profile', {
    method: 'PUT',
    body: { name: 'Ana', targets: { kcal: 300 } },
  });
  check('impõe piso de calorias no servidor', floor.data.user.targets.kcal === 1000, floor.data.user.targets);

  // Atualização parcial não pode zerar nem apagar o que já estava salvo.
  const parcial = await call('/profile', { method: 'PUT', body: { name: 'Ana Maria' } });
  check('atualização parcial preserva as metas', parcial.data.user.targets.fiber === 28 && parcial.data.user.targets.protein === 120, parcial.data.user.targets);
  check('atualização parcial preserva a altura', parcial.data.user.heightCm === 165, parcial.data.user);
  check('atualização parcial troca só o que foi enviado', parcial.data.user.name === 'Ana Maria', parcial.data.user);

  const wrong = await call('/profile/password', {
    method: 'PUT',
    body: { current: 'errada', next: 'novasenha1' },
  });
  check('recusa troca de senha com senha atual errada', wrong.status === 401);

  const ok = await call('/profile/password', {
    method: 'PUT',
    body: { current: 'segredo123', next: 'novasenha1' },
  });
  check('troca a senha', ok.status === 200);

  const relogin = await call('/auth/login', {
    method: 'POST',
    body: { email: 'ana@teste.com', password: 'novasenha1' },
  });
  check('entra com a senha nova', relogin.status === 200);
}

console.log(`\n${count - failures}/${count} verificações passaram.`);
server.close();
await db.close();
process.exit(failures ? 1 : 0);
