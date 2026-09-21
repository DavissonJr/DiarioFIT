import { useCallback, useEffect, useState } from 'react';
import { CalendarCheck, Flame, Droplet, Plus } from 'lucide-react';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import { todayISO, shortDate, weekdayShort, n0, n1, parseNum, bmi } from '../lib/nutri';
import { Button, Sheet, Field, Segmented, Loading, ErrorNote, Empty, toast } from '../components/ui';

const RANGES = [
  { id: '7', label: '7 dias' },
  { id: '14', label: '14 dias' },
  { id: '30', label: '30 dias' },
];

export default function Progress() {
  const { user } = useAuth();
  const [days, setDays] = useState('14');
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [weighing, setWeighing] = useState(false);

  const load = useCallback(async () => {
    try {
      setError('');
      setData(await api(`/stats?days=${days}`));
    } catch (err) {
      setError(err.message);
    }
  }, [days]);

  useEffect(() => {
    setData(null);
    load();
  }, [load]);

  const target = user.targets.kcal;
  const weights = data?.weights || [];
  const last = weights[weights.length - 1];
  const first = weights[0];
  const change = last && first ? last.kg - first.kg : 0;
  const imc = last ? bmi(last.kg, user.heightCm) : null;

  const maxKcal = Math.max(target * 1.15, ...(data?.series.map((s) => s.kcal) || [0]), 1);

  return (
    <div className="pt-6 md:pt-10">
      <header className="mb-4">
        <h1 className="font-display text-3xl font-semibold tracking-tight">Progresso</h1>
        <p className="mt-1 text-[15px] text-mute">
          O que importa aqui é a tendência ao longo das semanas, não um dia isolado.
        </p>
      </header>

      <Segmented options={RANGES} value={days} onChange={setDays} className="mb-4" />

      <ErrorNote onRetry={load}>{error}</ErrorNote>

      {!data ? (
        <Loading label="Somando os dias" />
      ) : (
        <div className="space-y-4 pb-6">
          {/* Médias */}
          <section className="grid grid-cols-3 gap-3">
            <Stat icon={Flame} value={n0(data.averages.kcal)} unit="kcal" label="média por dia" />
            <Stat
              icon={Droplet}
              value={n1(data.averages.water / 1000)}
              unit="L"
              label="água por dia"
            />
            <Stat
              icon={CalendarCheck}
              value={`${data.averages.daysLogged}`}
              unit={`de ${data.days}`}
              label="dias anotados"
            />
          </section>

          {/* Calorias por dia */}
          <section className="card p-5">
            <div className="mb-4 flex items-baseline justify-between">
              <h2 className="font-display text-lg font-semibold">Calorias por dia</h2>
              <span className="tnum text-sm text-mute">meta {n0(target)}</span>
            </div>

            <div className="relative h-40">
              <div
                className="absolute inset-x-0 z-10 border-t border-dashed border-ink/25"
                style={{ bottom: `${(target / maxKcal) * 100}%` }}
              />
              <div className="flex h-full items-end gap-[3px]">
                {data.series.map((d) => (
                  <div
                    key={d.date}
                    className="group flex h-full flex-1 items-end"
                    title={`${shortDate(d.date)}: ${n0(d.kcal)} kcal`}
                  >
                    <div
                      className={`w-full rounded-t-[4px] transition-[height] duration-500 ${
                        d.kcal === 0 ? 'bg-line' : 'bg-brand-500'
                      }`}
                      style={{ height: `${Math.max(d.kcal === 0 ? 2 : 4, (d.kcal / maxKcal) * 100)}%` }}
                    />
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-2 flex gap-[3px] text-center text-[10px] text-mute">
              {data.series.map((d, i) => (
                <span key={d.date} className="flex-1 tnum">
                  {data.series.length <= 14
                    ? weekdayShort(d.date)
                    : i % 7 === 0
                      ? shortDate(d.date)
                      : ''}
                </span>
              ))}
            </div>
          </section>

          {/* Peso */}
          <section className="card p-5">
            <div className="mb-3 flex items-start justify-between gap-3">
              <div>
                <h2 className="font-display text-lg font-semibold">Peso</h2>
                {last ? (
                  <div className="mt-1">
                    <p className="tnum font-display text-2xl font-semibold leading-none">
                      {n1(last.kg)} kg
                    </p>
                    {weights.length > 1 && (
                      <p className="tnum mt-1 text-sm text-mute">
                        {change > 0 ? '+' : ''}
                        {n1(change)} kg desde {shortDate(first.date)}
                      </p>
                    )}
                  </div>
                ) : (
                  <p className="mt-1 text-sm text-mute">Nenhum registro ainda.</p>
                )}
              </div>
              <Button variant="soft" size="sm" onClick={() => setWeighing(true)}>
                <Plus size={16} /> Anotar
              </Button>
            </div>

            {weights.length > 1 ? (
              <WeightChart points={weights.slice(-40)} />
            ) : (
              <p className="text-sm text-mute">
                Anote o peso uma vez por semana, sempre no mesmo horário, para a linha ficar útil.
              </p>
            )}

            {imc && (
              <p className="mt-3 text-xs text-mute">
                IMC {n1(imc)} — é só uma referência geral, não diz nada sobre composição corporal.
              </p>
            )}
          </section>

          {/* Hábitos */}
          <section className="card p-5">
            <h2 className="mb-3 font-display text-lg font-semibold">Hábitos</h2>
            {data.habits.length === 0 ? (
              <Empty title="Nenhum hábito ativo">Crie os seus na aba Perfil.</Empty>
            ) : (
              <ul className="space-y-4">
                {data.habits.map((h) => {
                  const pct = h.planned ? Math.round((h.done / h.planned) * 100) : 0;
                  return (
                    <li key={h.id}>
                      <div className="mb-1.5 flex items-baseline justify-between gap-3">
                        <span className="min-w-0 flex-1 truncate font-medium">{h.name}</span>
                        <span className="tnum shrink-0 text-sm text-mute">
                          {h.done} de {h.planned}
                        </span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-canvas">
                        <div
                          className="h-full rounded-full bg-brand-500 transition-[width] duration-500"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      {h.streak > 1 && (
                        <p className="mt-1 text-xs font-semibold text-brand-500">
                          {h.streak} dias seguidos
                        </p>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </div>
      )}

      <WeightSheet open={weighing} onClose={() => setWeighing(false)} onSaved={load} last={last} />
    </div>
  );
}

/* ------------------------------------------------------------------------ */

function Stat({ icon: Icon, value, unit, label }) {
  return (
    <div className="card p-4">
      <Icon size={18} className="mb-2 text-brand-500" />
      <p className="font-display text-xl font-semibold leading-none tnum">
        {value} <span className="text-sm font-medium text-mute">{unit}</span>
      </p>
      <p className="mt-1 text-xs leading-tight text-mute">{label}</p>
    </div>
  );
}

function WeightChart({ points }) {
  const values = points.map((p) => p.kg);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const pad = span * 0.2;
  const lo = min - pad;
  const hi = max + pad;

  const coords = points.map((p, i) => ({
    x: (i / Math.max(1, points.length - 1)) * 300,
    y: 100 - ((p.kg - lo) / (hi - lo)) * 100,
  }));
  const line = coords.map((c) => `${c.x.toFixed(1)},${c.y.toFixed(1)}`).join(' ');
  const area = `0,100 ${line} 300,100`;

  return (
    <div>
      <svg viewBox="0 0 300 100" preserveAspectRatio="none" className="h-28 w-full" role="img"
           aria-label="Evolução do peso">
        <polygon points={area} className="fill-brand-500" opacity="0.1" />
        <polyline
          points={line}
          fill="none"
          className="stroke-brand-500"
          strokeWidth="2"
          strokeLinejoin="round"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
      <div className="mt-1 flex justify-between text-[11px] text-mute tnum">
        <span>{shortDate(points[0].date)}</span>
        <span>
          {n1(min)} – {n1(max)} kg
        </span>
        <span>{shortDate(points[points.length - 1].date)}</span>
      </div>
    </div>
  );
}

function WeightSheet({ open, onClose, onSaved, last }) {
  const [kg, setKg] = useState('');
  const [date, setDate] = useState(todayISO());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (open) {
      setKg(last ? String(last.kg).replace('.', ',') : '');
      setDate(todayISO());
      setError('');
    }
  }, [open, last]);

  async function save() {
    const value = parseNum(kg);
    if (value <= 0) return setError('Informe um peso válido.');
    setBusy(true);
    try {
      await api('/weights', { method: 'PUT', body: { date, kg: value } });
      toast('Peso anotado');
      onSaved();
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
      title="Anotar peso"
      footer={
        <Button className="w-full" loading={busy} onClick={save}>
          Salvar
        </Button>
      }
    >
      <div className="space-y-4 pb-2">
        <Field label="Peso em quilos">
          <input
            className="field tnum text-2xl font-semibold"
            value={kg}
            onChange={(e) => setKg(e.target.value)}
            inputMode="decimal"
            placeholder="0,0"
            autoFocus
          />
        </Field>
        <Field label="Data">
          <input
            type="date"
            className="field"
            value={date}
            max={todayISO()}
            onChange={(e) => setDate(e.target.value)}
          />
        </Field>
        <ErrorNote>{error}</ErrorNote>
      </div>
    </Sheet>
  );
}
