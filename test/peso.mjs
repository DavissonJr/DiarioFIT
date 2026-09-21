/** Testes das funções puras de meta de peso. Rode com: node test/peso.mjs */
import { weightTrend, analyzeGoal, directionOf } from '../api/_peso.js';

let falhas = 0;
let total = 0;
const check = (label, ok, extra) => {
  total++;
  console.log(ok ? `  ok   ${label}` : `  FALHA ${label} ${JSON.stringify(extra ?? '')}`);
  if (!ok) falhas++;
};

const TODAY = '2026-09-21';
const d = (offset) => new Date(Date.parse(TODAY) + offset * 86400000).toISOString().slice(0, 10);

// Perde 0,5 kg por semana, pesando toda semana, de 70 kg até hoje.
const semanal = (inicio, porSemana, semanas) =>
  Array.from({ length: semanas + 1 }, (_, i) => ({
    date: d(-7 * (semanas - i)),
    kg: Math.round((inicio + porSemana * i) * 10) / 10,
  }));

console.log('\nTendência');
{
  const t = weightTrend([
    { date: d(-3), kg: 60 },
    { date: d(-2), kg: 60 },
    { date: d(-1), kg: 62 }, // pico de retenção
    { date: d(0), kg: 60 },
  ]);
  check('um pico de 2 kg move a tendência bem menos que 2 kg', t[2].trend < 60.4, t);
  check('a tendência volta a se aproximar depois do pico', t[3].trend < t[2].trend, t);
  check('a primeira pesagem é o ponto de partida', t[0].trend === 60, t[0]);

  const semanalT = weightTrend([{ date: d(-7), kg: 60 }, { date: d(0), kg: 58 }]);
  check('pesagem semanal pesa mais que diária (~63%)', semanalT[1].trend < 58.8 && semanalT[1].trend > 58.6, semanalT);
}

console.log('\nRitmo e estimativa');
{
  const w = semanal(70, -0.5, 6); // 70 → 67
  const { goal } = analyzeGoal(w, { target: 64, startKg: 70, startDate: d(-42) }, 165, TODAY);
  check('mede ritmo de ~0,5 kg por semana', Math.abs(goal.ratePerWeek + 0.5) < 0.05, goal.ratePerWeek);
  check('direção é perder', goal.direction === 'perder');
  check('estimativa existe e é futura', goal.etaStatus === 'ok' && goal.eta > TODAY, goal);
  // Tendência atual fica um pouco acima de 67 (a média atrasa); faltam ~3,x kg a 0,5/semana → ~7 semanas.
  const semanas = (Date.parse(goal.eta) - Date.parse(TODAY)) / (7 * 86400000);
  check('estimativa coerente com o ritmo (entre 6 e 9 semanas)', semanas > 6 && semanas < 9, { semanas, goal });
  check('progresso entre 0 e 1', goal.progress > 0.4 && goal.progress < 0.6, goal.progress);
  check('não acende aviso de ritmo rápido a 0,5 kg/semana', goal.fast === false);
  check('não acende aviso de IMC para 64 kg em 1,65 m', goal.lowBmi === false, goal.targetBmi);
}

console.log('\nCasos sem estimativa');
{
  const poucos = analyzeGoal([{ date: d(-3), kg: 70 }, { date: d(0), kg: 69.8 }], { target: 65, startKg: 70 }, 165, TODAY);
  check('com duas pesagens em 3 dias: poucos dados', poucos.goal.etaStatus === 'poucos-dados' && poucos.goal.eta === null, poucos.goal);

  const subindo = analyzeGoal(semanal(66, 0.4, 5), { target: 62, startKg: 66 }, 165, TODAY);
  check('meta de perder com peso subindo: sem direção', subindo.goal.etaStatus === 'sem-direcao' && subindo.goal.eta === null, subindo.goal);

  const lento = analyzeGoal(semanal(80, -0.06, 6), { target: 60, startKg: 80 }, 165, TODAY);
  check('ritmo lento demais para chegar em 2 anos: muito longe', lento.goal.etaStatus === 'muito-longe', lento.goal);

  const antigo = semanal(70, -0.5, 4).map((p) => ({ ...p, date: d(Math.round((Date.parse(p.date) - Date.parse(TODAY)) / 86400000) - 30) }));
  const velho = analyzeGoal(antigo, { target: 64, startKg: 70 }, 165, TODAY);
  check('última pesagem há mais de 3 semanas: desatualizado', velho.goal.etaStatus === 'desatualizado', velho.goal);
}

console.log('\nAvisos');
{
  const rapido = analyzeGoal(semanal(70, -1.2, 5), { target: 60, startKg: 70 }, 165, TODAY);
  check('perda de 1,2 kg/semana em ~64 kg acende o aviso de ritmo rápido', rapido.goal.fast === true, rapido.goal);

  const imc = analyzeGoal(semanal(60, -0.3, 4), { target: 48, startKg: 60 }, 165, TODAY);
  check('meta de 48 kg em 1,65 m acende o aviso de IMC', imc.goal.lowBmi === true && imc.goal.targetBmi < 18.5, imc.goal.targetBmi);

  const semAltura = analyzeGoal(semanal(60, -0.3, 4), { target: 48, startKg: 60 }, null, TODAY);
  check('sem altura cadastrada, não calcula IMC', semAltura.goal.lowBmi === false && semAltura.goal.targetBmi === null);

  const ganho = analyzeGoal(semanal(55, 0.6, 5), { target: 60, startKg: 55 }, 165, TODAY);
  check('ganho rápido não aciona o aviso de perda', ganho.goal.fast === false && ganho.goal.direction === 'ganhar', ganho.goal);
}

console.log('\nChegada e manutenção');
{
  const chegou = analyzeGoal(semanal(66, -0.5, 8), { target: 62.5, startKg: 66 }, 165, TODAY);
  check('meta alcançada é reconhecida', chegou.goal.reached === true && chegou.goal.progress === 1, chegou.goal);

  const manter = analyzeGoal(semanal(60, 0.05, 4), { target: 60.2, startKg: 60 }, 165, TODAY);
  check('meta a menos de 0,5 kg do início é manutenção', manter.goal.direction === 'manter' && manter.goal.progress === null, manter.goal);
  check('manutenção dentro de 1 kg conta como na meta', manter.goal.reached === true, manter.goal);

  const sem = analyzeGoal(semanal(60, 0, 3), null, 165, TODAY);
  check('sem meta, devolve só a série', sem.goal === null && sem.series.length === 4);

  check('direção a partir do peso de referência', directionOf(58, 62) === 'perder' && directionOf(65, 62) === 'ganhar' && directionOf(62.3, 62) === 'manter');
}

console.log(`\n${total - falhas}/${total} verificações passaram.`);
process.exit(falhas ? 1 : 0);
