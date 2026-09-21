import { useCallback, useEffect, useState } from 'react';
import { CalendarCheck, Flame, Droplet } from 'lucide-react';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import { shortDate, weekdayShort, n0, n1 } from '../lib/nutri';
import { Segmented, Loading, ErrorNote, Empty } from '../components/ui';
import WeightCard from '../components/WeightCard';

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

          <WeightCard data={data} onChanged={load} />

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
