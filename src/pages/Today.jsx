import { useCallback, useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, Plus, CopyPlus, Check, Droplet, Minus } from 'lucide-react';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import { todayISO, addDays, dateLabel, MEALS, mealNow, n0, n1, qty } from '../lib/nutri';
import { Button, DayBar, MacroBar, Loading, ErrorNote, Empty, toast } from '../components/ui';
import AddEntry from '../components/AddEntry';
import Fab from '../components/Fab';

const MOODS = ['Ótimo', 'Bem', 'Normal', 'Cansada', 'Difícil'];

export default function Today() {
  const { user } = useAuth();
  const [date, setDate] = useState(todayISO());
  const [day, setDay] = useState(null);
  const [error, setError] = useState('');
  const [adding, setAdding] = useState(null); // { meal } ou { entry }
  const [note, setNote] = useState('');

  const targets = user.targets;

  const load = useCallback(async () => {
    try {
      setError('');
      const data = await api(`/day?date=${date}`);
      setDay(data);
      setNote(data.note?.body || '');
    } catch (err) {
      setError(err.message);
    }
  }, [date]);

  useEffect(() => {
    setDay(null);
    load();
  }, [load]);

  /* ações ---------------------------------------------------------------- */

  function toggleHabit(habit) {
    setDay((d) => ({
      ...d,
      habits: d.habits.map((h) => (h.id === habit.id ? { ...h, done: !h.done } : h)),
    }));
    api(`/habits/${habit.id}/toggle`, { method: 'POST', body: { date } }).catch((err) => {
      toast(err.message, 'error');
      load();
    });
  }

  function setWater(ml) {
    const value = Math.max(0, ml);
    setDay((d) => ({ ...d, water: value }));
    api('/water', { method: 'PUT', body: { date, ml: value } }).catch((err) =>
      toast(err.message, 'error')
    );
  }

  function saveNote(mood) {
    const body = { date, body: note, mood: mood ?? day.note?.mood ?? null };
    setDay((d) => ({ ...d, note: { mood: body.mood, body: body.body } }));
    api('/note', { method: 'PUT', body }).catch((err) => toast(err.message, 'error'));
  }

  async function repeatYesterday() {
    try {
      const { copied } = await api('/entries/copy', {
        method: 'POST',
        body: { from: addDays(date, -1), to: date },
      });
      toast(copied ? `${copied} itens copiados` : 'Ontem não tem registros');
      load();
    } catch (err) {
      toast(err.message, 'error');
    }
  }

  /* render --------------------------------------------------------------- */

  const isToday = date === todayISO();
  const totals = day?.totals;
  const remaining = day ? targets.kcal - totals.kcal : 0;
  const glasses = Math.min(12, Math.max(6, Math.ceil(targets.water / 250)));
  const filled = day ? Math.round(day.water / 250) : 0;

  return (
    <div className="pt-4 md:pt-8">
      <header className="sticky top-0 z-30 -mx-4 mb-4 flex items-center gap-1 bg-base px-4 py-2 md:-mx-8 md:px-8">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setDate(addDays(date, -1))}
          aria-label="Dia anterior"
        >
          <ChevronLeft size={22} />
        </Button>

        <div className="flex-1 text-center">
          <h1 className="font-display text-xl font-semibold leading-tight">{dateLabel(date)}</h1>
          {!isToday && (
            <button
              onClick={() => setDate(todayISO())}
              className="text-xs font-semibold text-leaf-500"
            >
              voltar para hoje
            </button>
          )}
        </div>

        <Button
          variant="ghost"
          size="icon"
          onClick={() => setDate(addDays(date, 1))}
          disabled={date >= todayISO()}
          aria-label="Próximo dia"
        >
          <ChevronRight size={22} />
        </Button>
      </header>

      <ErrorNote onRetry={load}>{error}</ErrorNote>

      {!day ? (
        <Loading label="Abrindo seu dia" />
      ) : (
        <div className="space-y-4 pb-6">
          {/* Resumo do dia */}
          <section className="card p-5">
            <div className="flex items-end justify-between gap-4">
              <div>
                <p className="font-display text-[46px] font-semibold leading-none tnum">
                  {n0(Math.abs(remaining))}
                </p>
                <p className="mt-1.5 text-sm text-mute">
                  {remaining >= 0 ? 'kcal para a meta de ' : 'kcal acima da meta de '}
                  <span className="tnum">{n0(targets.kcal)}</span>
                </p>
              </div>
              <div className="text-right">
                <p className="font-display text-2xl font-semibold tnum">{n0(totals.kcal)}</p>
                <p className="text-xs text-mute">no dia</p>
              </div>
            </div>

            <div className="mt-4">
              <DayBar
                total={totals.kcal}
                target={targets.kcal}
                segments={MEALS.map((m) => ({
                  id: m.id,
                  label: m.label,
                  kcal: day.entries
                    .filter((e) => e.meal === m.id)
                    .reduce((a, e) => a + e.kcal, 0),
                }))}
              />
            </div>

            <div className="mt-5 space-y-3">
              <MacroBar
                label="Proteína"
                value={totals.protein}
                target={targets.protein}
                colorClass="bg-prot"
              />
              <MacroBar
                label="Carboidrato"
                value={totals.carbs}
                target={targets.carbs}
                colorClass="bg-carb"
              />
              <MacroBar
                label="Gordura"
                value={totals.fat}
                target={targets.fat}
                colorClass="bg-fat"
              />
            </div>
          </section>

          <div className="grid items-start gap-4 md:grid-cols-2">
            {/* Água */}
            <section className="card p-5">
              <div className="mb-3 flex items-baseline justify-between">
                <h2 className="font-display text-lg font-semibold">Água</h2>
                <span className="tnum text-sm text-mute">
                  {n1(day.water / 1000)} de {n1(targets.water / 1000)} L
                </span>
              </div>

              <div className="grid grid-cols-6 gap-2 sm:grid-cols-8">
                {Array.from({ length: glasses }, (_, i) => {
                  const full = i < filled;
                  return (
                    <button
                      key={i}
                      onClick={() => setWater(full && i === filled - 1 ? i * 250 : (i + 1) * 250)}
                      aria-label={`${(i + 1) * 250} mililitros`}
                      className={`grid h-11 w-full place-items-center rounded-lg border-2 transition active:scale-95
                        ${full ? 'border-water bg-water/15 text-water animate-pop' : 'border-line text-line'}`}
                    >
                      <Droplet size={18} className={full ? 'fill-water/40' : ''} />
                    </button>
                  );
                })}
              </div>

              <div className="mt-3 flex gap-2">
                <Button variant="soft" size="sm" onClick={() => setWater(day.water - 250)}>
                  <Minus size={16} /> 250 ml
                </Button>
                <Button variant="soft" size="sm" onClick={() => setWater(day.water + 250)}>
                  <Plus size={16} /> 250 ml
                </Button>
              </div>
            </section>

            {/* Hábitos */}
            <section className="card p-5">
              <div className="mb-3 flex items-baseline justify-between">
                <h2 className="font-display text-lg font-semibold">Hábitos</h2>
                <span className="tnum text-sm text-mute">
                  {day.habits.filter((h) => h.done).length} de {day.habits.length}
                </span>
              </div>

              {day.habits.length === 0 ? (
                <p className="text-sm text-mute">
                  Nenhum hábito para hoje. Você cria os seus no Perfil.
                </p>
              ) : (
                <ul className="-my-1">
                  {day.habits.map((h) => (
                    <li key={h.id}>
                      <button
                        onClick={() => toggleHabit(h)}
                        className="flex w-full items-center gap-3 py-2.5 text-left"
                        aria-pressed={h.done}
                      >
                        <span
                          className={`grid h-7 w-7 shrink-0 place-items-center rounded-full border-2 transition
                            ${h.done ? 'animate-pop border-leaf-500 bg-leaf-500 text-white' : 'border-line'}`}
                        >
                          {h.done && <Check size={16} strokeWidth={3} />}
                        </span>
                        <span className={h.done ? 'text-mute line-through' : 'font-medium'}>
                          {h.name}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>

          {/* Refeições */}
          <section className="card overflow-hidden">
            {day.entries.length === 0 && (
              <div className="border-b border-line">
                <Empty
                  icon={Plus}
                  title="Nada anotado ainda"
                  action={
                    <div className="flex flex-wrap justify-center gap-2">
                      <Button onClick={() => setAdding({ meal: mealNow() })}>
                        Anotar o que comeu
                      </Button>
                      <Button variant="outline" onClick={repeatYesterday}>
                        <CopyPlus size={18} /> Repetir ontem
                      </Button>
                    </div>
                  }
                >
                  Registre uma refeição e o total do dia se atualiza sozinho.
                </Empty>
              </div>
            )}

            {MEALS.map((m) => {
              const items = day.entries.filter((e) => e.meal === m.id);
              // Só aparece a refeição que já tem algo, mais a do horário atual.
              if (items.length === 0 && m.id !== mealNow()) return null;
              const kcal = items.reduce((a, e) => a + e.kcal, 0);

              return (
                <div key={m.id} className="border-b border-line last:border-0">
                  <div className="flex items-center justify-between px-5 pb-1 pt-4">
                    <h3 className="font-display text-lg font-semibold">{m.label}</h3>
                    <div className="flex items-center gap-1">
                      {kcal > 0 && (
                        <span className="tnum mr-1 text-sm text-mute">{n0(kcal)} kcal</span>
                      )}
                      <Button
                        variant="soft"
                        size="iconSm"
                        onClick={() => setAdding({ meal: m.id })}
                        aria-label={`Adicionar em ${m.label}`}
                      >
                        <Plus size={18} />
                      </Button>
                    </div>
                  </div>

                  {items.length === 0 ? (
                    <p className="px-5 pb-4 text-sm text-mute">Nada aqui ainda.</p>
                  ) : (
                    <ul className="px-5 pb-3">
                      {items.map((e) => (
                        <li key={e.id}>
                          <button
                            onClick={() => setAdding({ entry: e })}
                            className="flex w-full items-center gap-3 rounded-xl py-2.5 text-left transition active:bg-base"
                          >
                            <div className="min-w-0 flex-1">
                              <p className="truncate font-medium">{e.name}</p>
                              <p className="tnum text-sm text-mute">
                                {qty(e.quantity)} {e.unit === 'un' ? 'un' : e.unit} ·{' '}
                                {n1(e.protein)} P · {n1(e.carbs)} C · {n1(e.fat)} G
                              </p>
                            </div>
                            <span className="tnum shrink-0 font-display font-semibold">
                              {n0(e.kcal)}
                            </span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              );
            })}
          </section>

          {/* Como foi o dia */}
          <section className="card p-5">
            <h2 className="font-display text-lg font-semibold">Como foi o dia?</h2>
            <div className="mt-3 flex flex-wrap gap-2">
              {MOODS.map((m) => (
                <button
                  key={m}
                  onClick={() => saveNote(day.note?.mood === m ? null : m)}
                  className={`rounded-full px-4 py-2 text-sm font-semibold transition active:scale-[.97] ${
                    day.note?.mood === m ? 'bg-leaf-500 text-white' : 'bg-base text-mute'
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>
            <textarea
              className="field mt-3 min-h-[84px] resize-y"
              placeholder="Algo que você queira lembrar sobre hoje."
              value={note}
              onChange={(e) => setNote(e.target.value)}
              onBlur={() => saveNote()}
            />
          </section>

          {day.entries.length > 0 && (
            <Button variant="outline" className="w-full" onClick={repeatYesterday}>
              <CopyPlus size={18} /> Copiar os itens de ontem para cá
            </Button>
          )}
        </div>
      )}

      <Fab onClick={() => setAdding({ meal: mealNow() })} label="Anotar alimento" />

      <AddEntry
        open={!!adding}
        date={date}
        meal={adding?.meal}
        entry={adding?.entry}
        onClose={() => setAdding(null)}
        onSaved={load}
      />
    </div>
  );
}
