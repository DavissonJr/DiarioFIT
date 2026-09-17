import { useEffect, useState } from 'react';
import { Plus, LogOut, Calculator, Pencil, KeyRound } from 'lucide-react';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import {
  ACTIVITIES,
  GOALS,
  suggestTargets,
  ageFrom,
  parseNum,
  n0,
  todayISO,
} from '../lib/nutri';
import { Button, Sheet, Field, ErrorNote, Loading, toast } from '../components/ui';

const WEEKDAYS = [
  { id: '0', label: 'D' },
  { id: '1', label: 'S' },
  { id: '2', label: 'T' },
  { id: '3', label: 'Q' },
  { id: '4', label: 'Q' },
  { id: '5', label: 'S' },
  { id: '6', label: 'S' },
];

export default function Profile() {
  const { user, setUser, logout } = useAuth();
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [calc, setCalc] = useState(false);
  const [password, setPassword] = useState(false);

  useEffect(() => {
    setForm({
      name: user.name,
      sex: user.sex || 'f',
      birthYear: user.birthYear ? String(user.birthYear) : '',
      heightCm: user.heightCm ? String(user.heightCm) : '',
      activity: user.activity || 'moderada',
      goal: user.goal || 'manter',
      targets: {
        kcal: String(user.targets.kcal),
        protein: String(user.targets.protein),
        carbs: String(user.targets.carbs),
        fat: String(user.targets.fat),
        water: String(user.targets.water),
      },
    });
  }, [user]);

  if (!form) return <Loading />;

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const setTarget = (k) => (e) =>
    setForm((f) => ({ ...f, targets: { ...f.targets, [k]: e.target.value } }));

  async function save() {
    setSaving(true);
    setError('');
    try {
      const { user: updated } = await api('/profile', {
        method: 'PUT',
        body: {
          name: form.name,
          sex: form.sex,
          birthYear: form.birthYear || null,
          heightCm: form.heightCm || null,
          activity: form.activity,
          goal: form.goal,
          targets: {
            kcal: parseNum(form.targets.kcal),
            protein: parseNum(form.targets.protein),
            carbs: parseNum(form.targets.carbs),
            fat: parseNum(form.targets.fat),
            water: parseNum(form.targets.water),
          },
        },
      });
      setUser(updated);
      toast('Tudo salvo');
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  const targetField = (key, label, unit) => (
    <Field label={label}>
      <div className="relative">
        <input
          className="field tnum pr-12"
          value={form.targets[key]}
          onChange={setTarget(key)}
          inputMode="numeric"
        />
        <span className="absolute inset-y-0 right-4 grid place-items-center text-sm text-mute">
          {unit}
        </span>
      </div>
    </Field>
  );

  return (
    <div className="space-y-4 pb-8 pt-6 md:pt-10">
      <header>
        <h1 className="font-display text-3xl font-semibold tracking-tight">{user.name}</h1>
        <p className="mt-1 text-[15px] text-mute">{user.email}</p>
      </header>

      {/* Metas */}
      <section className="card p-5">
        <div className="mb-4">
          <h2 className="font-display text-lg font-semibold">Metas do dia</h2>
          <p className="mt-0.5 text-sm text-mute">
            Escreva os valores na mão ou peça uma sugestão a partir do seu gasto diário.
          </p>
          <Button variant="soft" size="sm" className="mt-3" onClick={() => setCalc(true)}>
            <Calculator size={16} /> Sugerir metas
          </Button>
        </div>

        <div className="space-y-3">
          {targetField('kcal', 'Calorias', 'kcal')}
          <div className="grid grid-cols-3 gap-3">
            {targetField('protein', 'Proteína', 'g')}
            {targetField('carbs', 'Carboidrato', 'g')}
            {targetField('fat', 'Gordura', 'g')}
          </div>
          {targetField('water', 'Água', 'ml')}
        </div>
      </section>

      {/* Sobre você */}
      <section className="card p-5">
        <h2 className="mb-4 font-display text-lg font-semibold">Sobre você</h2>

        <div className="space-y-3">
          <Field label="Nome">
            <input className="field" value={form.name} onChange={set('name')} />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Ano de nascimento">
              <input
                className="field tnum"
                value={form.birthYear}
                onChange={set('birthYear')}
                inputMode="numeric"
                placeholder="1998"
              />
            </Field>
            <Field label="Altura (cm)">
              <input
                className="field tnum"
                value={form.heightCm}
                onChange={set('heightCm')}
                inputMode="numeric"
                placeholder="165"
              />
            </Field>
          </div>

          <Field label="Sexo biológico" hint="Usado só na conta de gasto calórico.">
            <select className="field" value={form.sex} onChange={set('sex')}>
              <option value="f">Feminino</option>
              <option value="m">Masculino</option>
            </select>
          </Field>

          <Field label="Rotina de movimento">
            <select className="field" value={form.activity} onChange={set('activity')}>
              {ACTIVITIES.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.label} — {a.hint}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Objetivo">
            <select className="field" value={form.goal} onChange={set('goal')}>
              {GOALS.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.label}
                </option>
              ))}
            </select>
          </Field>
        </div>

        <ErrorNote>{error}</ErrorNote>

        <Button className="mt-4 w-full" loading={saving} onClick={save}>
          Salvar alterações
        </Button>
      </section>

      <HabitsCard />

      {/* Conta */}
      <section className="card p-5">
        <h2 className="mb-3 font-display text-lg font-semibold">Conta</h2>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button variant="outline" className="flex-1" onClick={() => setPassword(true)}>
            <KeyRound size={18} /> Trocar senha
          </Button>
          <Button variant="ghost" className="flex-1" onClick={logout}>
            <LogOut size={18} /> Sair
          </Button>
        </div>
      </section>

      <p className="px-2 text-center text-xs leading-relaxed text-mute">
        As metas daqui são estimativas para orientar o dia a dia. Para um plano feito para você,
        vale conversar com uma nutricionista.
      </p>

      <CalcSheet
        open={calc}
        onClose={() => setCalc(false)}
        profile={form}
        onApply={(t) =>
          setForm((f) => ({
            ...f,
            targets: {
              kcal: String(t.kcal),
              protein: String(t.protein),
              carbs: String(t.carbs),
              fat: String(t.fat),
              water: String(t.water),
            },
          }))
        }
      />

      <PasswordSheet open={password} onClose={() => setPassword(false)} />
    </div>
  );
}

/* Sugestão de metas ------------------------------------------------------ */

function CalcSheet({ open, onClose, profile, onApply }) {
  const [weight, setWeight] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setError('');
    api('/weights')
      .then(({ weights }) => {
        const last = weights[weights.length - 1];
        if (last) setWeight(String(last.kg));
      })
      .catch(() => {});
  }, [open]);

  const age = ageFrom(profile.birthYear);
  const result = suggestTargets({
    sex: profile.sex,
    weightKg: parseNum(weight),
    heightCm: parseNum(profile.heightCm),
    age,
    activity: profile.activity,
    goal: profile.goal,
  });

  const missing = [];
  if (!parseNum(weight)) missing.push('peso');
  if (!parseNum(profile.heightCm)) missing.push('altura');
  if (!age) missing.push('ano de nascimento');

  async function apply() {
    setBusy(true);
    try {
      // Aproveita e guarda o peso informado.
      await api('/weights', { method: 'PUT', body: { date: todayISO(), kg: parseNum(weight) } });
    } catch {
      /* se falhar, as metas ainda são aplicadas */
    }
    onApply(result);
    setBusy(false);
    toast('Metas preenchidas. Confira e salve.');
    onClose();
  }

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Sugerir metas"
      subtitle="Uma estimativa a partir do seu gasto diário."
      footer={
        <Button className="w-full" disabled={!result} loading={busy} onClick={apply}>
          Usar estas metas
        </Button>
      }
    >
      <div className="space-y-4 pb-2">
        <Field label="Peso atual (kg)">
          <input
            className="field tnum text-xl font-semibold"
            value={weight}
            onChange={(e) => setWeight(e.target.value)}
            inputMode="decimal"
            placeholder="0,0"
          />
        </Field>

        {missing.length > 0 ? (
          <p className="rounded-2xl bg-base px-4 py-3 text-sm text-mute">
            Para calcular, falta preencher: {missing.join(', ')}. Complete em “Sobre você” e volte
            aqui.
          </p>
        ) : (
          <div className="space-y-3">
            <div className="rounded-2xl bg-leaf-50 p-4">
              <p className="text-sm text-leaf-600">
                Seu gasto estimado é de{' '}
                <span className="tnum font-semibold">{n0(result.maintenance)} kcal</span> por dia.
              </p>
              <p className="mt-2 font-display text-3xl font-semibold tnum text-leaf-700">
                {n0(result.kcal)} <span className="text-base font-medium">kcal por dia</span>
              </p>
            </div>

            <div className="grid grid-cols-3 gap-3 text-center">
              <Macro label="Proteína" value={result.protein} tone="text-prot" />
              <Macro label="Carboidrato" value={result.carbs} tone="text-carb" />
              <Macro label="Gordura" value={result.fat} tone="text-fat" />
            </div>

            {result.floored && (
              <p className="rounded-2xl bg-base px-4 py-3 text-sm text-mute">
                Esse é o valor mínimo que faz sentido sugerir para o seu corpo. Cortes maiores
                costumam cobrar caro em energia e humor.
              </p>
            )}
          </div>
        )}

        <ErrorNote>{error}</ErrorNote>
      </div>
    </Sheet>
  );
}

function Macro({ label, value, tone }) {
  return (
    <div className="rounded-2xl bg-base p-3">
      <p className={`font-display text-xl font-semibold tnum ${tone}`}>{value} g</p>
      <p className="mt-0.5 text-xs text-mute">{label}</p>
    </div>
  );
}

/* Hábitos ---------------------------------------------------------------- */

function HabitsCard() {
  const [habits, setHabits] = useState(null);
  const [editing, setEditing] = useState(null);

  async function load() {
    try {
      const { habits } = await api('/habits');
      setHabits(habits);
    } catch (err) {
      toast(err.message, 'error');
    }
  }

  useEffect(() => {
    load();
  }, []);

  return (
    <section className="card p-5">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h2 className="font-display text-lg font-semibold">Hábitos</h2>
          <p className="mt-0.5 text-sm text-mute">Aparecem na tela do dia para marcar.</p>
        </div>
        <Button variant="soft" size="iconSm" onClick={() => setEditing('novo')} aria-label="Novo hábito">
          <Plus size={18} />
        </Button>
      </div>

      {!habits ? (
        <p className="text-sm text-mute">Carregando…</p>
      ) : habits.length === 0 ? (
        <p className="text-sm text-mute">
          Nenhum hábito por enquanto. Comece com um só, daqueles fáceis de cumprir.
        </p>
      ) : (
        <ul className="divide-y divide-line">
          {habits.map((h) => (
            <li key={h.id}>
              <button
                onClick={() => setEditing(h)}
                className="flex w-full items-center gap-3 py-3 text-left transition active:bg-base"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{h.name}</p>
                  <p className="text-sm text-mute">
                    {h.weekdays.length === 7
                      ? 'Todos os dias'
                      : WEEKDAYS.filter((d) => h.weekdays.includes(d.id))
                          .map((d) => d.label)
                          .join(' · ')}
                  </p>
                </div>
                <Pencil size={16} className="shrink-0 text-mute" />
              </button>
            </li>
          ))}
        </ul>
      )}

      <HabitSheet
        open={!!editing}
        habit={editing === 'novo' ? null : editing}
        onClose={() => setEditing(null)}
        onSaved={load}
      />
    </section>
  );
}

function HabitSheet({ open, habit, onClose, onSaved }) {
  const [name, setName] = useState('');
  const [weekdays, setWeekdays] = useState('0123456');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;
    setName(habit?.name || '');
    setWeekdays(habit?.weekdays || '0123456');
    setError('');
  }, [open, habit]);

  function toggleDay(id) {
    setWeekdays((w) =>
      w.includes(id)
        ? w
            .split('')
            .filter((d) => d !== id)
            .join('')
        : (w + id).split('').sort().join('')
    );
  }

  async function save() {
    if (!name.trim()) return setError('Dê um nome ao hábito.');
    if (!weekdays) return setError('Escolha pelo menos um dia.');
    setBusy(true);
    try {
      const body = { name, weekdays };
      if (habit) await api(`/habits/${habit.id}`, { method: 'PUT', body });
      else await api('/habits', { method: 'POST', body });
      toast('Hábito salvo');
      onSaved();
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!confirm(`Remover "${habit.name}"? O histórico dos dias anteriores fica guardado.`)) return;
    setBusy(true);
    try {
      await api(`/habits/${habit.id}`, { method: 'DELETE' });
      toast('Hábito removido');
      onSaved();
      onClose();
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={habit ? 'Editar hábito' : 'Novo hábito'}
      footer={
        <div className="flex gap-3">
          {habit && (
            <Button variant="danger" onClick={remove}>
              Remover
            </Button>
          )}
          <Button className="flex-1" loading={busy} onClick={save}>
            Salvar
          </Button>
        </div>
      }
    >
      <div className="space-y-4 pb-2">
        <Field label="O que você quer fazer">
          <input
            className="field"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Caminhar 20 minutos"
          />
        </Field>

        <div>
          <span className="mb-2 block text-sm font-medium text-mute">Em quais dias</span>
          <div className="flex gap-2">
            {WEEKDAYS.map((d) => (
              <button
                key={d.id}
                onClick={() => toggleDay(d.id)}
                className={`h-11 flex-1 rounded-xl font-semibold transition active:scale-95 ${
                  weekdays.includes(d.id) ? 'bg-leaf-500 text-white' : 'bg-base text-mute'
                }`}
                aria-pressed={weekdays.includes(d.id)}
              >
                {d.label}
              </button>
            ))}
          </div>
        </div>

        <ErrorNote>{error}</ErrorNote>
      </div>
    </Sheet>
  );
}

/* Senha ------------------------------------------------------------------ */

function PasswordSheet({ open, onClose }) {
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (open) {
      setCurrent('');
      setNext('');
      setError('');
    }
  }, [open]);

  async function save() {
    setBusy(true);
    setError('');
    try {
      await api('/profile/password', { method: 'PUT', body: { current, next } });
      toast('Senha trocada');
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Trocar senha"
      footer={
        <Button className="w-full" loading={busy} onClick={save}>
          Salvar senha
        </Button>
      }
    >
      <div className="space-y-4 pb-2">
        <Field label="Senha atual">
          <input
            type="password"
            className="field"
            value={current}
            onChange={(e) => setCurrent(e.target.value)}
            autoComplete="current-password"
          />
        </Field>
        <Field label="Nova senha" hint="Pelo menos 6 caracteres.">
          <input
            type="password"
            className="field"
            value={next}
            onChange={(e) => setNext(e.target.value)}
            autoComplete="new-password"
          />
        </Field>
        <ErrorNote>{error}</ErrorNote>
      </div>
    </Sheet>
  );
}
