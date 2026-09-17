import { useEffect, useMemo, useRef, useState } from 'react';
import { Search, Plus, ChevronLeft, Star, Trash2 } from 'lucide-react';
import { api } from '../lib/api';
import { MEALS, parseNum, n0, n1, qty as fmtQty } from '../lib/nutri';
import { Sheet, Button, Empty, ErrorNote, Loading, toast } from './ui';
import FoodForm from './FoodForm';

const norm = (s) =>
  String(s || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

const QUICK = {
  g: [50, 100, 150, 200],
  ml: [100, 200, 250, 300],
  un: [1, 2, 3, 4],
};

export default function AddEntry({ open, date, meal = 'almoco', entry, onClose, onSaved }) {
  const editing = !!entry;

  const [step, setStep] = useState('pick');
  const [foods, setFoods] = useState([]);
  const [recent, setRecent] = useState([]);
  const [search, setSearch] = useState('');
  const [picked, setPicked] = useState(null);
  const [quantity, setQuantity] = useState('');
  const [mealId, setMealId] = useState(meal);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const qtyRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    setError('');
    setSearch('');
    setMealId(entry?.meal || meal);
    setStep(editing ? 'qty' : 'pick');
    setQuantity(editing ? String(entry.quantity) : '');
    setPicked(null);

    Promise.all([api('/foods'), api('/foods/recent')])
      .then(([a, b]) => {
        setFoods(a.foods);
        setRecent(b.foods);
        if (editing) {
          const found = a.foods.find((f) => f.id === entry.foodId);
          setPicked(
            found || {
              id: null,
              name: entry.name,
              unit: entry.unit,
              baseQty: entry.quantity,
              kcal: entry.kcal,
              protein: entry.protein,
              carbs: entry.carbs,
              fat: entry.fat,
              fiber: entry.fiber,
            }
          );
        }
      })
      .catch((err) => setError(err.message));
  }, [open, entry, meal, editing]);

  const results = useMemo(() => {
    const q = norm(search);
    if (!q) return foods;
    return foods.filter((f) => norm(f.name).includes(q) || norm(f.brand).includes(q));
  }, [foods, search]);

  const amount = parseNum(quantity);
  const factor = picked && picked.baseQty > 0 ? amount / picked.baseQty : 0;
  const preview = picked
    ? {
        kcal: picked.kcal * factor,
        protein: picked.protein * factor,
        carbs: picked.carbs * factor,
        fat: picked.fat * factor,
        fiber: (picked.fiber || 0) * factor,
      }
    : null;

  function choose(food) {
    setPicked(food);
    setQuantity(food.unit === 'un' ? '1' : String(food.baseQty));
    setStep('qty');
    setTimeout(() => qtyRef.current?.select(), 80);
  }

  async function save() {
    if (amount <= 0) return setError('Informe a quantidade.');
    setBusy(true);
    setError('');
    try {
      if (editing) {
        await api(`/entries/${entry.id}`, {
          method: 'PUT',
          body: { quantity: amount, meal: mealId },
        });
      } else {
        await api('/entries', {
          method: 'POST',
          body: { foodId: picked.id, date, meal: mealId, quantity: amount },
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

  const quickValues = QUICK[picked?.unit] || QUICK.g;
  const unitLabel = picked?.unit === 'un' ? 'un' : picked?.unit;

  return (
    <>
      <Sheet
        open={open && !formOpen}
        onClose={onClose}
        title={step === 'pick' ? 'O que você comeu?' : picked?.name || 'Quantidade'}
        subtitle={
          step === 'pick'
            ? 'Toque no alimento para informar a quantidade.'
            : picked?.brand || undefined
        }
        footer={
          step === 'qty' ? (
            <div className="flex gap-3">
              {editing && (
                <Button variant="danger" onClick={removeEntry} disabled={busy}>
                  <Trash2 size={18} /> Remover
                </Button>
              )}
              <Button className="flex-1" loading={busy} disabled={!picked} onClick={save}>
                {editing ? 'Salvar' : `Adicionar ${n0(preview?.kcal || 0)} kcal`}
              </Button>
            </div>
          ) : (
            <Button variant="outline" className="w-full" onClick={() => setFormOpen(true)}>
              <Plus size={18} /> Cadastrar um alimento novo
            </Button>
          )
        }
      >
        {step === 'pick' ? (
          <div className="pb-2">
            <div className="sticky top-0 z-10 -mx-1 bg-surface px-1 pb-3">
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

            {!search && recent.length > 0 && (
              <div className="mb-4">
                <p className="mb-2 text-sm font-medium text-mute">Você usa bastante</p>
                <div className="flex flex-wrap gap-2">
                  {recent.slice(0, 8).map((f) => (
                    <button
                      key={f.id}
                      onClick={() => choose(f)}
                      className="rounded-full bg-leaf-50 px-3.5 py-2 text-sm font-semibold text-leaf-600 transition active:scale-[.97]"
                    >
                      {f.name}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <ErrorNote>{error}</ErrorNote>

            {results.length === 0 ? (
              <Empty icon={Search} title="Nenhum alimento com esse nome">
                Cadastre agora e ele fica salvo para as próximas vezes.
              </Empty>
            ) : (
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
                            {n0(f.kcal)} kcal por {fmtQty(f.baseQty)}{' '}
                            {f.unit === 'un' ? 'un' : f.unit}
                          </span>
                        </p>
                      </div>
                      <Plus size={18} className="shrink-0 text-leaf-500" />
                    </button>
                  </li>
                ))}
              </ul>
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
                <span className="pb-3.5 font-display text-xl text-mute">{unitLabel}</span>
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                {quickValues.map((v) => (
                  <button
                    key={v}
                    onClick={() => setQuantity(String(v))}
                    className={`rounded-full px-4 py-2 text-sm font-semibold transition active:scale-[.97] ${
                      amount === v ? 'bg-leaf-500 text-white' : 'bg-canvas text-mute'
                    }`}
                  >
                    {v} {unitLabel}
                  </button>
                ))}
              </div>
            </div>

            <div className="rounded-2xl bg-canvas p-4">
              <p className="font-display text-3xl font-semibold tnum">
                {n0(preview.kcal)} <span className="text-lg text-mute">kcal</span>
              </p>
              <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm tnum">
                <span className="text-prot">{n1(preview.protein)} g proteína</span>
                <span className="text-carb">{n1(preview.carbs)} g carbo</span>
                <span className="text-fat">{n1(preview.fat)} g gordura</span>
                <span className="text-fiber">{n1(preview.fiber)} g fibra</span>
              </div>
            </div>

            <div>
              <p className="mb-2 text-sm font-medium text-mute">Refeição</p>
              <div className="grid grid-cols-3 gap-2">
                {MEALS.map((m) => (
                  <button
                    key={m.id}
                    onClick={() => setMealId(m.id)}
                    className={`rounded-2xl px-2 py-3 text-sm font-semibold transition ${
                      mealId === m.id ? 'bg-leaf-500 text-white' : 'bg-canvas text-mute'
                    }`}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
            </div>

            <ErrorNote>{error}</ErrorNote>
          </div>
        )}
      </Sheet>

      <FoodForm
        open={formOpen}
        onClose={() => setFormOpen(false)}
        onSaved={(food) => {
          setFoods((v) => [...v, food]);
          choose(food);
        }}
      />
    </>
  );
}
