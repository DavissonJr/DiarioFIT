/**
 * Meta de peso: tendência, ritmo e estimativa de chegada.
 *
 * Funções puras, sem banco, para poderem ser testadas isoladamente.
 * O prefixo "_" no nome do arquivo impede a Vercel de publicá-lo como endpoint.
 */

const DAY = 86400000;
const days = (a, b) => (Date.parse(b) - Date.parse(a)) / DAY;

// Constante de tempo da média móvel, em dias. Com pesagens diárias cada nova
// pesagem pesa ~13%; com pesagens semanais, ~63%. Assim a curva acompanha o
// ritmo real sem pular a cada dia de retenção de líquido.
const TAU = 7;

/**
 * Média móvel exponencial que respeita o intervalo real entre as pesagens.
 * Recebe [{ date, kg }] em ordem crescente e devolve o mesmo com `trend`.
 */
export function weightTrend(weights) {
  let prev = null;
  return weights.map((w) => {
    const trend = prev
      ? prev.trend + (1 - Math.exp(-days(prev.date, w.date) / TAU)) * (w.kg - prev.trend)
      : w.kg;
    prev = { date: w.date, trend };
    return { date: w.date, kg: w.kg, trend: Math.round(trend * 100) / 100 };
  });
}

/** Inclinação por mínimos quadrados, em kg por dia. */
function slopePerDay(points) {
  const t0 = points[0].date;
  const xs = points.map((p) => days(t0, p.date));
  const ys = points.map((p) => p.kg);
  const mx = xs.reduce((a, b) => a + b, 0) / xs.length;
  const my = ys.reduce((a, b) => a + b, 0) / ys.length;
  let num = 0;
  let den = 0;
  xs.forEach((x, i) => {
    num += (x - mx) * (ys[i] - my);
    den += (x - mx) ** 2;
  });
  return den ? num / den : 0;
}

export const WINDOW_DAYS = 35; // janela usada para medir o ritmo
export const STALE_DAYS = 21; // sem pesar há mais que isso, não estima
export const MIN_POINTS = 3;
export const MIN_SPAN_DAYS = 10;
export const MAX_ETA_DAYS = 730;
export const REACHED_KG = 0.3;
export const MAINTAIN_KG = 0.5;

/**
 * Tudo que o cartão de peso precisa saber sobre a meta.
 *
 * @param weights  [{ date, kg }] em ordem crescente
 * @param goal     { target, startKg, startDate } ou null
 * @param heightCm altura, para o aviso de IMC
 * @param today    'YYYY-MM-DD' no fuso da pessoa
 */
export function analyzeGoal(weights, goal, heightCm, today) {
  const series = weightTrend(weights);
  const last = series[series.length - 1] || null;
  if (!goal || goal.target === null || goal.target === undefined) return { series, goal: null };

  const target = Number(goal.target);
  const startKg = Number(goal.startKg ?? last?.trend ?? target);
  const current = last ? last.trend : startKg;

  const diffStart = target - startKg;
  const direction =
    Math.abs(diffStart) < MAINTAIN_KG ? 'manter' : diffStart < 0 ? 'perder' : 'ganhar';

  const remaining = target - current; // negativo = precisa perder
  const reached =
    direction === 'perder'
      ? current <= target + REACHED_KG
      : direction === 'ganhar'
        ? current >= target - REACHED_KG
        : Math.abs(remaining) <= 1;

  const progress =
    direction === 'manter'
      ? null
      : Math.min(1, Math.max(0, (startKg - current) / (startKg - target)));

  // Ritmo: só as pesagens da janela mais recente, contada a partir da última pesagem.
  let ratePerWeek = null;
  let eta = null;
  let etaStatus = 'poucos-dados';

  if (last && days(last.date, today) > STALE_DAYS) {
    etaStatus = 'desatualizado';
  } else if (last) {
    const recent = weights.filter((w) => days(w.date, last.date) <= WINDOW_DAYS);
    const span = recent.length ? days(recent[0].date, last.date) : 0;

    if (recent.length >= MIN_POINTS && span >= MIN_SPAN_DAYS) {
      const perDay = slopePerDay(recent);
      ratePerWeek = Math.round(perDay * 7 * 100) / 100;

      if (reached || direction === 'manter') {
        etaStatus = 'ok';
      } else if (Math.sign(perDay) !== Math.sign(remaining) || Math.abs(ratePerWeek) < 0.05) {
        etaStatus = 'sem-direcao';
      } else {
        const toGo = remaining / perDay;
        if (toGo > MAX_ETA_DAYS) {
          etaStatus = 'muito-longe';
        } else {
          etaStatus = 'ok';
          eta = new Date(Date.parse(today) + Math.round(toGo) * DAY).toISOString().slice(0, 10);
        }
      }
    }
  }

  // Avisos: IMC da meta abaixo de 18,5 e perda acima de 1% do peso por semana.
  const targetBmi = heightCm ? target / (heightCm / 100) ** 2 : null;
  const lowBmi = targetBmi !== null && targetBmi < 18.5;
  const fast = ratePerWeek !== null && ratePerWeek < 0 && -ratePerWeek > current * 0.01;

  return {
    series,
    goal: {
      target,
      startKg: Math.round(startKg * 10) / 10,
      startDate: goal.startDate || null,
      direction,
      current: Math.round(current * 10) / 10,
      lastKg: last?.kg ?? null,
      lastDate: last?.date ?? null,
      remaining: Math.round(Math.abs(remaining) * 10) / 10,
      progress: progress === null ? null : Math.round(progress * 100) / 100,
      reached,
      ratePerWeek,
      eta,
      etaStatus,
      fast,
      lowBmi,
      targetBmi: targetBmi === null ? null : Math.round(targetBmi * 10) / 10,
    },
  };
}

/** Direção da meta em relação a um peso de referência, no vocabulário do perfil. */
export function directionOf(target, reference) {
  const d = target - reference;
  return Math.abs(d) < MAINTAIN_KG ? 'manter' : d < 0 ? 'perder' : 'ganhar';
}
