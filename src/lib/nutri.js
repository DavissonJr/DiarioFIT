/* Datas ------------------------------------------------------------------ */

export const todayISO = () => {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 10);
};

export function addDays(iso, n) {
  const d = new Date(iso + 'T12:00:00');
  d.setDate(d.getDate() + n);
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 10);
}

const DAY_NAMES = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];
const MONTHS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

export function dateLabel(iso) {
  if (iso === todayISO()) return 'Hoje';
  if (iso === addDays(todayISO(), -1)) return 'Ontem';
  if (iso === addDays(todayISO(), 1)) return 'Amanhã';
  const d = new Date(iso + 'T12:00:00');
  return `${DAY_NAMES[d.getDay()]}, ${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

export function shortDate(iso) {
  const d = new Date(iso + 'T12:00:00');
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export const weekdayShort = (iso) =>
  ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'][new Date(iso + 'T12:00:00').getDay()];

/* Números ---------------------------------------------------------------- */

const fmt = new Intl.NumberFormat('pt-BR');
const fmt1 = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 });

export const n0 = (v) => fmt.format(Math.round(v || 0));
export const n1 = (v) => fmt1.format(v || 0);

// Mostra 150 em vez de 150,0 e aceita vírgula na entrada.
export const qty = (v) => (Number.isInteger(v) ? String(v) : n1(v));
export const parseNum = (v) => {
  const n = Number(String(v ?? '').replace(',', '.'));
  return Number.isFinite(n) ? n : 0;
};

/* Refeições -------------------------------------------------------------- */

export const MEALS = [
  { id: 'cafe', label: 'Café da manhã' },
  { id: 'almoco', label: 'Almoço' },
  { id: 'lanche', label: 'Lanche' },
  { id: 'jantar', label: 'Jantar' },
  { id: 'ceia', label: 'Ceia' },
];

export const mealLabel = (id) => MEALS.find((m) => m.id === id)?.label || 'Refeição';

// Sugere a refeição pelo horário, para o botão de adicionar já vir certo.
export function mealNow() {
  const h = new Date().getHours();
  if (h < 10) return 'cafe';
  if (h < 15) return 'almoco';
  if (h < 18) return 'lanche';
  if (h < 22) return 'jantar';
  return 'ceia';
}

export const UNITS = [
  { id: 'g', label: 'gramas (g)' },
  { id: 'ml', label: 'mililitros (ml)' },
  { id: 'un', label: 'unidade' },
];

export const ACTIVITIES = [
  { id: 'sedentaria', label: 'Pouco movimento', hint: 'Trabalho sentada, sem treinos', factor: 1.2 },
  { id: 'leve', label: 'Leve', hint: 'Caminhadas ou treino 1 a 3x por semana', factor: 1.375 },
  { id: 'moderada', label: 'Moderada', hint: 'Treino 3 a 5x por semana', factor: 1.55 },
  { id: 'alta', label: 'Alta', hint: 'Treino 6 a 7x por semana', factor: 1.725 },
];

export const GOALS = [
  { id: 'perder', label: 'Perder peso', adjust: -0.15 },
  { id: 'manter', label: 'Manter o peso', adjust: 0 },
  { id: 'ganhar', label: 'Ganhar massa', adjust: 0.1 },
];

/**
 * Gasto estimado pela equação de Mifflin-St Jeor e uma divisão de macros
 * conservadora: 1,8 g de proteína por quilo, 25% das calorias em gordura,
 * o resto em carboidrato. É uma estimativa para começar, não uma prescrição.
 */
export function suggestTargets({ sex, weightKg, heightCm, age, activity, goal }) {
  if (!weightKg || !heightCm || !age) return null;

  const bmr = 10 * weightKg + 6.25 * heightCm - 5 * age + (sex === 'm' ? 5 : -161);
  const factor = ACTIVITIES.find((a) => a.id === activity)?.factor ?? 1.55;
  const adjust = GOALS.find((g) => g.id === goal)?.adjust ?? 0;

  const maintenance = bmr * factor;
  // Piso de segurança: nunca sugerir abaixo do metabolismo basal nem de 1200 kcal.
  const floor = Math.max(1200, Math.round(bmr));
  const kcal = Math.max(floor, Math.round((maintenance * (1 + adjust)) / 10) * 10);

  const protein = Math.round(weightKg * 1.8);
  const fat = Math.round((kcal * 0.25) / 9);
  const carbs = Math.max(0, Math.round((kcal - protein * 4 - fat * 9) / 4));
  const water = Math.round((weightKg * 35) / 100) * 100;

  return {
    kcal,
    protein,
    carbs,
    fat,
    water,
    maintenance: Math.round(maintenance),
    floored: kcal === floor && adjust < 0,
  };
}

export const ageFrom = (birthYear) =>
  birthYear ? new Date().getFullYear() - Number(birthYear) : null;

export function bmi(weightKg, heightCm) {
  if (!weightKg || !heightCm) return null;
  return weightKg / (heightCm / 100) ** 2;
}
