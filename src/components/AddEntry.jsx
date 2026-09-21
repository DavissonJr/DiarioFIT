import { useEffect, useMemo, useRef, useState } from 'react';
import { Search, Plus, Minus, ChevronLeft, Star, Trash2, Check, Ruler } from 'lucide-react';
import { api } from '../lib/api';
import { MEALS, mealOf, parseNum, n0, n1, qty as fmtQty, plural } from '../lib/nutri';
import { Sheet, Button, Empty, ErrorNote, Loading, Segmented, toast } from './ui';
import MealIcon from './MealIcon';
import FoodForm from './FoodForm';

const norm = (s) =>
  String(s || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

const QUICK = {
  g: [50, 100, 150, 200],
  ml: [100, 200, 250, 300],
};

const unitText = (u) => (u === 'un' ? 'un' : u);

// Tamanho de uma "unidade" do alimento: 1 para os medidos em un, a medida caseira para os demais.
const perPortionOf = (food) => (food?.unit === 'un' ? 1 : food?.portionQty || null);

/** Calorias e nutrientes para uma quantidade na unidade base do alimento. */
function nutrition(food, quantity) {
  const f = food && food.baseQty > 0 ? quantity / food.baseQty : 0;
  return {
    kcal: food ? food.kcal * f : 0,
    carbs: food ? food.carbs * f : 0,
    protein: food ? food.protein * f : 0,
    fat: food ? food.fat * f : 0,
    fiber: food ? (food.fiber || 0) * f : 0,
  };
}

export default function AddEntry({
  open,
  date,
  meal = 'almoco',
  entry,
  dayEntries = [],
  onClose,
  onSaved,
}) {
  const editing = !!entry;

  const [step, setStep] = useState('pick');
  const [foods, setFoods] = useState([]);
  const [recent, setRecent] = useState([]);
  const [suggestions, setSuggestions] = useState(null);
  const [justAdded, setJustAdded] = useState(() => new Set());
  const [search, setSearch] = useState('');
  const [picked, setPicked] = useState(null);
  const [mode, setMode] = useState('weight'); // 'count' (por unidade) | 'weight' (g/ml)
  const [count, setCount] = useState('1');
  const [quantity, setQuantity] = useState('');
  const [mealId, setMealId] = useState(meal);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState(null); // null | { food } — cadastro/edição de alimento
  const qtyRef = useRef(null);

  /* abertura ------------------------------------------------------------- */

  useEffect(() => {
    if (!open) return;
    setError('');
    setSearch('');
    setJustAdded(new Set());
    setMealId(entry?.meal || meal);
    setStep(editing ? 'qty' : 'pick');
    setPicked(null);
    let vivo = true;

    Promise.all([api('/foods'), api('/foods/recent')])
      .then(([a, b]) => {
        if (!vivo) return;
        setFoods(a.foods);
        setRecent(b.foods);
        if (!editing) return;

        const found = a.foods.find((f) => f.id === entry.foodId);
        // Alimento apagado: reconstrói a proporção a partir do próprio registro.
        const food = found || {
          id: null,
          name: entry.name,
          unit: entry.unit,
          baseQty: entry.quantity,
          kcal: entry.kcal,
          protein: entry.protein,
          carbs: entry.carbs,
          fat: entry.fat,
          fiber: entry.fiber,
          portionQty: entry.portions ? entry.quantity / entry.portions : null,
          portionLabel: entry.portionLabel,
        };
        setPicked(food);
        // Se a medida caseira foi removida do alimento depois, volta a editar em gramas.
        if (entry.portions && perPortionOf(food)) {
          setMode('count');
          setCount(String(entry.portions));
        } else if (entry.unit === 'un') {
          setMode('count');
          setCount(String(entry.quantity));
        } else {
          setMode('weight');
          setQuantity(String(entry.quantity));
        }
      })
      .catch((err) => vivo && setError(err.message));
    return () => {
      vivo = false;
    };
  }, [open, entry, meal, editing]);

  // Sugestões acompanham a refeição escolhida. Ao trocar de refeição rápido, uma
  // resposta antiga pode chegar depois da nova; "vivo" descarta a que ficou obsoleta.
  useEffect(() => {
    if (!open || editing) return;
    let vivo = true;
    setSuggestions(null);
    api(`/foods/suggestions?meal=${mealId}`)
      .then((d) => vivo && setSuggestions(d.suggestions))
      .catch(() => vivo && setSuggestions([]));
    return () => {
      vivo = false;
    };
  }, [open, editing, mealId]);

  /* derivados ------------------------------------------------------------ */

  const results = useMemo(() => {
    const q = norm(search);
    if (!q) return foods;
    return foods.filter((f) => norm(f.name).includes(q) || norm(f.brand).includes(q));
  }, [foods, search]);

  // Não sugere o que já está nesta refeição hoje.
  const visibleSuggestions = useMemo(() => {
    if (!suggestions) return [];
    const taken = new Set(
      dayEntries.filter((e) => e.meal === mealId && e.foodId).map((e) => e.foodId)
    );
    return suggestions.filter((s) => !taken.has(s.food.id) && !justAdded.has(s.food.id));
  }, [suggestions, dayEntries, mealId, justAdded]);

  const per = perPortionOf(picked);
  const counting = mode === 'count' && !!per;
  const countNum = parseNum(count);
  const amount = counting ? countNum * per : parseNum(quantity);
  const preview = nutrition(picked, amount);
  const m = mealOf(mealId);

  /* ações ---------------------------------------------------------------- */

  function choose(food, preset) {
    setPicked(food);
    setError('');
    const p = perPortionOf(food);

    if (preset?.portions && food.portionQty) {
      setMode('count');
      setCount(String(preset.portions));
    } else if (preset?.quantity && food.unit === 'un') {
      setMode('count');
      setCount(String(preset.quantity));
    } else if (preset?.quantity) {
      setMode('weight');
      setQuantity(String(preset.quantity));
    } else if (p) {
      setMode('count');
      setCount('1');
    } else {
      setMode('weight');
      setQuantity(String(food.baseQty));
    }
    setStep('qty');
    setTimeout(() => qtyRef.current?.select(), 80);
  }

  // Alterna entre unidades e gramas mantendo a mesma quantidade real.
  function switchMode(next) {
    if (next === mode || !per) return;
    if (next === 'weight') setQuantity(String(Math.round(countNum * per * 10) / 10));
    else setCount(String(Math.max(0.5, Math.round((parseNum(quantity) / per) * 2) / 2)));
    setMode(next);
  }

  function bodyFor(food, useCount, n, q) {
    // Alimento em "un" não tem medida caseira: a contagem já é a quantidade.
    if (useCount && food.unit !== 'un') return { portions: n };
    return { quantity: useCount ? n : q };
  }

  async function save() {
    if (amount <= 0) return setError('Informe a quantidade.');
    setBusy(true);
    setError('');
    try {
      const body = { ...bodyFor(picked, counting, countNum, amount), meal: mealId };
      if (editing) {
        await api(`/entries/${entry.id}`, { method: 'PUT', body });
      } else {
        await api('/entries', {
          method: 'POST',
          body: { ...body, foodId: picked.id, date },
        });
        toast(`${picked.name} anotado`);
      }
      onSaved?.();
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  // Um toque na sugestão: registra com a quantidade de costume e mantém a folha aberta,
  // para montar a refeição inteira em sequência.
  async function quickAdd(s) {
    setJustAdded((v) => new Set(v).add(s.food.id));
    try {
      const useCount = !!s.portions && !!s.food.portionQty;
      await api('/entries', {
        method: 'POST',
        body: {
          ...bodyFor(s.food, useCount, s.portions, s.quantity),
          foodId: s.food.id,
          date,
          meal: mealId,
        },
      });
      toast(`${s.food.name} anotado`);
      onSaved?.();
    } catch (err) {
      setJustAdded((v) => {
        const n = new Set(v);
        n.delete(s.food.id);
        return n;
      });
      toast(err.message, 'error');
    }
  }

  async function removeEntry() {
    setBusy(true);
    try {
      await api(`/entries/${entry.id}`, { method: 'DELETE' });
      toast('Registro apagado');
      onSaved?.();
      onClose();
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  /* render --------------------------------------------------------------- */

  const suggestionText = (s) => {
    const kcal = n0(nutrition(s.food, s.quantity).kcal);
    const how =
      s.portions && s.food.portionQty
        ? `${fmtQty(s.portions)} ${plural(s.food.portionLabel, s.portions)}`
        : `${fmtQty(s.quantity)} ${unitText(s.food.unit)}`;
    return `${how} · ${kcal} kcal`;
  };

  const countLabel = picked?.unit === 'un'
    ? countNum === 1 ? 'unidade' : 'unidades'
    : plural(picked?.portionLabel || 'unidade', countNum);

  return (
    <>
      <Sheet
        open={open && !form}
        onClose={onClose}
        title={step === 'pick' ? 'O que você comeu?' : picked?.name || 'Quantidade'}
        subtitle={step === 'qty' ? picked?.brand || undefined : undefined}
        footer={
          step === 'qty' ? (
            <div className="flex gap-3">
              {editing && (
                <Button variant="danger" onClick={removeEntry} disabled={busy}>
                  <Trash2 size={18} /> Remover
                </Button>
              )}
              <Button className="flex-1" loading={busy} disabled={!picked} onClick={save}>
                {editing ? 'Salvar' : `Adicionar ${n0(preview.kcal)} kcal`}
              </Button>
            </div>
          ) : (
            <Button variant="outline" className="w-full" onClick={() => setForm({ food: null })}>
              <Plus size={18} /> Cadastrar um alimento novo
            </Button>
          )
        }
      >
        {step === 'pick' ? (
          <div className="pb-2">
            <div className="sticky top-0 z-10 -mx-1 space-y-3 bg-surface px-1 pb-3">
              {/* Refeição: define para onde vai e quais sugestões aparecem */}
              <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-0.5 [scrollbar-width:none]">
                {MEALS.map((meal) => {
                  const on = meal.id === mealId;
                  return (
                    <button
                      key={meal.id}
                      onClick={() => setMealId(meal.id)}
                      aria-pressed={on}
                      className={`flex shrink-0 items-center gap-1.5 rounded-full border-2 px-3 py-1.5 text-sm font-semibold transition
                        ${on ? `${meal.ring} ${meal.soft} ${meal.text}` : 'border-transparent bg-canvas text-mute'}`}
                    >
                      <span className={`h-2 w-2 rounded-full ${meal.dot}`} />
                      {meal.short}
                    </button>
                  );
                })}
              </div>

              <div className="relative">
                <Search
                  size={19}
                  className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-mute"
                />
                <input
                  className="field pl-11"
                  placeholder="Buscar alimento"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  autoComplete="off"
                />
              </div>
            </div>

            <ErrorNote>{error}</ErrorNote>

            {!search && visibleSuggestions.length > 0 && (
              <section className={`mb-5 rounded-3xl p-3 ${m.soft}`}>
                <div className="mb-2 flex items-center gap-2 px-1">
                  <MealIcon meal={mealId} size="sm" />
                  <p className={`text-sm font-semibold ${m.text}`}>
                    Você costuma adicionar no {m.label.toLowerCase()}
                  </p>
                </div>
                <ul className="space-y-1.5">
                  {visibleSuggestions.map((s) => (
                    <li key={s.food.id} className="flex items-center gap-2 rounded-2xl bg-surface p-1.5 pl-3.5">
                      <button
                        onClick={() => choose(s.food, s)}
                        className="min-w-0 flex-1 py-1 text-left"
                      >
                        <span className="block truncate font-medium">{s.food.name}</span>
                        <span className="tnum block truncate text-sm text-mute">
                          {suggestionText(s)}
                        </span>
                      </button>
                      <button
                        onClick={() => quickAdd(s)}
                        aria-label={`Adicionar ${s.food.name} agora`}
                        className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl transition active:scale-90 ${m.soft} ${m.text}`}
                      >
                        <Plus size={20} strokeWidth={2.5} />
                      </button>
                    </li>
                  ))}
                </ul>
                <p className="mt-2 px-1 text-xs text-mute">
                  O + anota na hora, com a quantidade de sempre.
                </p>
              </section>
            )}

            {!search && suggestions && visibleSuggestions.length === 0 && recent.length > 0 && (
              <div className="mb-4">
                <p className="mb-2 text-sm font-medium text-mute">Você usa bastante</p>
                <div className="flex flex-wrap gap-2">
                  {recent.slice(0, 8).map((f) => (
                    <button
                      key={f.id}
                      onClick={() => choose(f)}
                      className="rounded-full bg-brand-50 px-3.5 py-2 text-sm font-semibold text-brand-600 transition active:scale-[.97]"
                    >
                      {f.name}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {justAdded.size > 0 && (
              <p className="mb-3 flex items-center gap-1.5 text-sm font-medium text-brand-600">
                <Check size={16} strokeWidth={2.5} />
                {justAdded.size === 1 ? '1 item anotado' : `${justAdded.size} itens anotados`} nesta
                refeição
              </p>
            )}

            {results.length === 0 ? (
              <Empty icon={Search} title="Nenhum alimento com esse nome">
                Cadastre agora e ele fica salvo para as próximas vezes.
              </Empty>
            ) : (
              <>
                {!search && <p className="mb-1 text-sm font-medium text-mute">Todos os alimentos</p>}
                <ul className="divide-y divide-line">
                  {results.map((f) => (
                    <li key={f.id}>
                      <button
                        onClick={() => choose(f)}
                        className="flex w-full items-center gap-3 py-3 text-left transition active:bg-canvas"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-medium">
                            {f.favorite && (
                              <Star
                                size={13}
                                className="mr-1 inline fill-carb text-carb"
                                aria-label="Favorito"
                              />
                            )}
                            {f.name}
                          </p>
                          <p className="truncate text-sm text-mute">
                            {f.brand ? `${f.brand} · ` : ''}
                            <span className="tnum">
                              {n0(f.kcal)} kcal por {fmtQty(f.baseQty)} {unitText(f.unit)}
                              {f.portionQty ? ` · 1 ${f.portionLabel} = ${fmtQty(f.portionQty)} ${f.unit}` : ''}
                            </span>
                          </p>
                        </div>
                        <Plus size={18} className="shrink-0 text-brand-500" />
                      </button>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>
        ) : !picked ? (
          <Loading label="Abrindo o registro" />
        ) : (
          <div className="space-y-5 pb-2">
            {!editing && (
              <button
                onClick={() => setStep('pick')}
                className="-ml-1 flex items-center gap-1 text-sm font-semibold text-mute"
              >
                <ChevronLeft size={16} /> Escolher outro alimento
              </button>
            )}

            {/* Alterna só quando o alimento tem medida caseira */}
            {picked.unit !== 'un' && picked.portionQty && (
              <Segmented
                value={mode}
                onChange={switchMode}
                options={[
                  { id: 'count', label: `Por ${picked.portionLabel || 'unidade'}` },
                  { id: 'weight', label: `Em ${picked.unit === 'ml' ? 'ml' : 'gramas'}` },
                ]}
              />
            )}

            {counting ? (
              <div>
                <div className="flex items-center justify-center gap-4">
                  <button
                    onClick={() => setCount(String(countNum > 1 ? countNum - 1 : 0.5))}
                    disabled={countNum <= 0.5}
                    aria-label="Menos uma"
                    className="grid h-14 w-14 place-items-center rounded-2xl bg-canvas text-ink transition active:scale-95 disabled:opacity-40"
                  >
                    <Minus size={22} strokeWidth={2.5} />
                  </button>
                  <input
                    ref={qtyRef}
                    value={count.replace('.', ',')}
                    onChange={(e) => setCount(e.target.value.replace(',', '.'))}
                    inputMode="decimal"
                    aria-label="Quantidade de unidades"
                    className="tnum w-24 bg-transparent text-center font-display text-5xl font-semibold outline-none"
                  />
                  <button
                    onClick={() => setCount(String(countNum < 1 ? 1 : countNum + 1))}
                    aria-label="Mais uma"
                    className="grid h-14 w-14 place-items-center rounded-2xl bg-brand-500 text-on-brand transition active:scale-95"
                  >
                    <Plus size={22} strokeWidth={2.5} />
                  </button>
                </div>
                <p className="mt-2 text-center text-mute">
                  {countLabel}
                  {picked.unit !== 'un' && (
                    <span className="tnum">
                      {' '}· {fmtQty(Math.round(amount * 10) / 10)} {picked.unit}
                    </span>
                  )}
                </p>
              </div>
            ) : (
              <div>
                <div className="flex items-end gap-3">
                  <input
                    ref={qtyRef}
                    className="field tnum flex-1 text-2xl font-semibold"
                    value={quantity}
                    onChange={(e) => setQuantity(e.target.value)}
                    inputMode="decimal"
                    aria-label="Quantidade"
                  />
                  <span className="pb-3.5 font-display text-xl text-mute">{unitText(picked.unit)}</span>
                </div>

                <div className="mt-3 flex flex-wrap gap-2">
                  {(QUICK[picked.unit] || QUICK.g).map((v) => (
                    <button
                      key={v}
                      onClick={() => setQuantity(String(v))}
                      className={`rounded-full px-4 py-2 text-sm font-semibold transition active:scale-[.97] ${
                        amount === v ? 'bg-brand-500 text-on-brand' : 'bg-canvas text-mute'
                      }`}
                    >
                      {v} {unitText(picked.unit)}
                    </button>
                  ))}
                </div>

                {/* Sem medida caseira: mostra como passar a registrar por unidade */}
                {!picked.portionQty && picked.id && (
                  <button
                    onClick={() => setForm({ food: picked })}
                    className="mt-3 flex items-center gap-2 text-left text-sm font-semibold text-brand-600"
                  >
                    <Ruler size={16} className="shrink-0" /> Prefere contar por unidade? Defina a medida
                  </button>
                )}
              </div>
            )}

            <div className="rounded-2xl bg-canvas p-4">
              <p className="font-display text-3xl font-semibold tnum">
                {n0(preview.kcal)} <span className="text-lg text-mute">kcal</span>
              </p>
              <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm tnum">
                <span className="text-carb">{n1(preview.carbs)} g carbo</span>
                <span className="text-prot">{n1(preview.protein)} g proteína</span>
                <span className="text-fat">{n1(preview.fat)} g gordura</span>
                <span className="text-fiber">{n1(preview.fiber)} g fibra</span>
              </div>
            </div>

            <div>
              <p className="mb-2 text-sm font-medium text-mute">Refeição</p>
              <div className="grid grid-cols-3 gap-2">
                {MEALS.map((meal) => {
                  const on = mealId === meal.id;
                  return (
                    <button
                      key={meal.id}
                      onClick={() => setMealId(meal.id)}
                      aria-pressed={on}
                      className={`flex items-center justify-center gap-1.5 rounded-2xl border-2 px-2 py-2.5 text-sm font-semibold transition
                        ${on ? `${meal.ring} ${meal.soft} ${meal.text}` : 'border-transparent bg-canvas text-mute'}`}
                    >
                      <span className={`h-2 w-2 shrink-0 rounded-full ${meal.dot}`} />
                      {meal.short}
                    </button>
                  );
                })}
              </div>
            </div>

            <ErrorNote>{error}</ErrorNote>
          </div>
        )}
      </Sheet>

      <FoodForm
        open={!!form}
        food={form?.food || null}
        onClose={() => setForm(null)}
        onSaved={(food) => {
          setFoods((v) => {
            const exists = v.some((f) => f.id === food.id);
            return exists ? v.map((f) => (f.id === food.id ? food : f)) : [...v, food];
          });
          // Voltando da medida caseira, já abre no modo por unidade.
          choose(food);
        }}
      />
    </>
  );
}
