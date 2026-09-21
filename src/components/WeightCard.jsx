import { useEffect, useState } from 'react';
import { Plus, Target, Info } from 'lucide-react';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import { todayISO, shortDate, n1, parseNum, bmi } from '../lib/nutri';
import { Button, Sheet, Field, ErrorNote, toast } from './ui';

const mesAno = new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' });
const DAY = 86400000;

// "−0,5 kg por semana" com o sinal tipográfico de menos.
const ritmo = (r) => `${r > 0 ? '+' : '−'}${n1(Math.abs(r))} kg por semana`;

/** Frase da estimativa, uma para cada situação que o servidor identifica. */
function estimativa(g) {
  if (g.direction === 'manter') {
    return g.reached
      ? 'Dentro da faixa da meta. O trabalho agora é manter.'
      : `A ${n1(g.remaining)} kg da meta de manutenção.`;
  }
  if (g.reached) return 'Você chegou à meta. Agora o trabalho é manter.';

  switch (g.etaStatus) {
    case 'ok': {
      if (!g.eta) return null;
      const dias = (Date.parse(g.eta) - Date.parse(todayISO())) / DAY;
      const quando =
        dias <= 42
          ? `em cerca de ${Math.max(1, Math.round(dias / 7))} ${Math.round(dias / 7) > 1 ? 'semanas' : 'semana'}`
          : `por volta de ${mesAno.format(new Date(g.eta + 'T12:00:00'))}`;
      return `No ritmo atual (${ritmo(g.ratePerWeek)}), você chega lá ${quando}.`;
    }
    case 'sem-direcao':
      return 'Nas últimas semanas o peso não andou na direção da meta.';
    case 'muito-longe':
      return `No ritmo atual (${ritmo(g.ratePerWeek)}), a meta fica para daqui a mais de dois anos.`;
    case 'desatualizado':
      return 'Faz um tempo desde a última pesagem. Anote de novo para atualizar a estimativa.';
    default:
      return 'Anote o peso por mais algumas semanas para estimar quando chega lá.';
  }
}

export default function WeightCard({ data, onChanged }) {
  const { user } = useAuth();
  const [weighing, setWeighing] = useState(false);
  const [goalOpen, setGoalOpen] = useState(false);

  const weights = data.weights || [];
  const last = weights[weights.length - 1];
  const g = data.weightGoal;
  const imc = last ? bmi(last.trend ?? last.kg, user.heightCm) : null;

  return (
    <section className="card p-5">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="font-display text-lg font-semibold">Peso</h2>
          {last ? (
            <div className="mt-1">
              <p className="tnum font-display text-3xl font-semibold leading-none">
                {n1(last.trend ?? last.kg)} kg
              </p>
              <p className="tnum mt-1.5 text-sm text-mute">
                tendência · última pesagem {n1(last.kg)} kg em {shortDate(last.date)}
              </p>
            </div>
          ) : (
            <p className="mt-1 text-sm text-mute">Nenhum registro ainda.</p>
          )}
        </div>
        <Button variant="soft" size="sm" onClick={() => setWeighing(true)}>
          <Plus size={16} /> Anotar
        </Button>
      </div>

      {g && <GoalProgress g={g} onEdit={() => setGoalOpen(true)} />}

      {weights.length > 1 ? (
        <WeightChart points={weights.slice(-40)} target={g?.target ?? null} />
      ) : (
        <p className="text-sm text-mute">
          Anote o peso uma vez por semana, sempre no mesmo horário, para a linha ficar útil.
        </p>
      )}

      {weights.length > 1 && (
        <p className="mt-2 flex items-start gap-1.5 text-xs text-mute">
          <Info size={13} className="mt-px shrink-0" />
          Os pontos são as pesagens; a linha é a tendência, que suaviza as oscilações de água do
          dia a dia.
        </p>
      )}

      {g?.lowBmi && (
        <Aviso>
          Essa meta fica abaixo de IMC 18,5. Vale conversar com uma nutricionista ou um médico
          antes de seguir com ela.
        </Aviso>
      )}
      {g?.fast && (
        <Aviso>
          O peso está caindo mais de 1% por semana. Ritmos assim costumam cobrar em energia e
          massa muscular — pode valer rever a meta de calorias.
        </Aviso>
      )}

      {!g && (
        <Button variant="outline" className="mt-4 w-full" onClick={() => setGoalOpen(true)}>
          <Target size={18} /> Definir uma meta de peso
        </Button>
      )}

      {imc && (
        <p className="mt-3 text-xs text-mute">
          IMC {n1(imc)} — é só uma referência geral, não diz nada sobre composição corporal.
        </p>
      )}

      <WeightSheet open={weighing} onClose={() => setWeighing(false)} onSaved={onChanged} last={last} />
      <GoalSheet
        open={goalOpen}
        onClose={() => setGoalOpen(false)}
        onSaved={onChanged}
        last={last}
        goal={g}
      />
    </section>
  );
}

/* Progresso até a meta --------------------------------------------------- */

function GoalProgress({ g, onEdit }) {
  const texto = estimativa(g);

  return (
    <div className="mb-4 rounded-2xl bg-canvas p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-lg font-semibold">
          {g.reached ? (
            'Meta alcançada'
          ) : g.direction === 'manter' ? (
            'Manter o peso'
          ) : (
            <>
              Faltam <span className="tnum">{n1(g.remaining)} kg</span>
            </>
          )}
        </p>
        <button
          onClick={onEdit}
          className="tnum flex shrink-0 items-center gap-1.5 rounded-full bg-surface px-3 py-1 text-sm font-semibold text-brand-600 transition active:scale-95"
          aria-label="Editar meta de peso"
        >
          <Target size={14} /> meta {n1(g.target)} kg
        </button>
      </div>

      {g.progress !== null && (
        <>
          <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-surface">
            <div
              className="h-full rounded-full bg-brand-500 transition-[width] duration-700"
              style={{ width: `${Math.max(2, g.progress * 100)}%` }}
            />
          </div>
          <div className="tnum mt-1.5 flex justify-between text-xs text-mute">
            <span>início {n1(g.startKg)} kg</span>
            <span>{Math.round(g.progress * 100)}%</span>
          </div>
        </>
      )}

      {texto && <p className="mt-3 text-sm leading-relaxed text-mute">{texto}</p>}
    </div>
  );
}

function Aviso({ children }) {
  return (
    <p className="mt-3 flex items-start gap-2 rounded-2xl bg-canvas px-4 py-3 text-sm leading-relaxed text-mute">
      <Info size={16} className="mt-0.5 shrink-0 text-brand-600" />
      <span>{children}</span>
    </p>
  );
}

/* Gráfico ---------------------------------------------------------------- */
/* Eixo X no tempo real (pesagens irregulares ficam no lugar certo). A linha é
   SVG esticado; pontos e rótulos são HTML por cima, para não virarem elipses. */

function WeightChart({ points, target }) {
  const t0 = Date.parse(points[0].date);
  const t1 = Date.parse(points[points.length - 1].date);
  const span = t1 - t0 || 1;

  const valores = points.flatMap((p) => [p.kg, p.trend ?? p.kg]);
  if (target !== null) valores.push(target);
  const min = Math.min(...valores);
  const max = Math.max(...valores);
  const pad = Math.max(0.5, (max - min) * 0.15);
  const lo = min - pad;
  const hi = max + pad;

  const x = (date) => ((Date.parse(date) - t0) / span) * 100;
  const y = (kg) => 100 - ((kg - lo) / (hi - lo)) * 100;

  const linha = points.map((p) => `${(x(p.date) * 3).toFixed(1)},${y(p.trend ?? p.kg).toFixed(1)}`).join(' ');
  const area = `0,100 ${linha} 300,100`;

  return (
    <div>
      <div className="relative h-36">
        <svg
          viewBox="0 0 300 100"
          preserveAspectRatio="none"
          className="absolute inset-0 h-full w-full overflow-visible"
          role="img"
          aria-label="Evolução do peso"
        >
          <polygon points={area} className="fill-brand-500" opacity="0.08" />
          {target !== null && (
            <line
              x1="0"
              x2="300"
              y1={y(target)}
              y2={y(target)}
              className="stroke-ink"
              strokeOpacity="0.35"
              strokeWidth="1.5"
              strokeDasharray="5 4"
              vectorEffect="non-scaling-stroke"
            />
          )}
          <polyline
            points={linha}
            fill="none"
            className="stroke-brand-500"
            strokeWidth="2.5"
            strokeLinejoin="round"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />
        </svg>

        {points.map((p) => (
          <span
            key={p.date}
            className="absolute h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-brand-500 bg-surface"
            style={{ left: `${x(p.date)}%`, top: `${y(p.kg)}%` }}
            title={`${shortDate(p.date)}: ${n1(p.kg)} kg`}
          />
        ))}

        {target !== null && (
          <span
            className="tnum absolute right-0 -translate-y-full rounded-md bg-surface/90 px-1.5 text-[11px] font-semibold text-mute"
            style={{ top: `${y(target)}%` }}
          >
            meta {n1(target)}
          </span>
        )}
      </div>

      <div className="tnum mt-1.5 flex justify-between text-[11px] text-mute">
        <span>{shortDate(points[0].date)}</span>
        <span>{shortDate(points[points.length - 1].date)}</span>
      </div>
    </div>
  );
}

/* Anotar peso ------------------------------------------------------------ */

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

/* Definir meta ----------------------------------------------------------- */

function GoalSheet({ open, onClose, onSaved, last, goal }) {
  const { user, setUser } = useAuth();
  const [atual, setAtual] = useState('');
  const [mexeuNoAtual, setMexeuNoAtual] = useState(false);
  const [meta, setMeta] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;
    setAtual(last ? String(Math.round((last.trend ?? last.kg) * 10) / 10).replace('.', ',') : '');
    setMexeuNoAtual(false);
    setMeta(goal ? String(goal.target).replace('.', ',') : '');
    setError('');
  }, [open, last, goal]);

  const kgAtual = parseNum(atual);
  const kgMeta = parseNum(meta);
  const diff = kgMeta && kgAtual ? kgMeta - kgAtual : null;
  const imcMeta = kgMeta ? bmi(kgMeta, user.heightCm) : null;

  async function save(target) {
    setBusy(true);
    setError('');
    try {
      const body = { target };
      // Só registra uma pesagem nova se ela mudou o valor ou ainda não tem nenhuma,
      // para não inventar uma pesagem de hoje com o número da semana passada.
      if (target !== null && (mexeuNoAtual || !last)) body.currentKg = kgAtual;
      const { user: novo } = await api('/weight-goal', { method: 'PUT', body });
      setUser(novo);
      toast(target === null ? 'Meta removida' : 'Meta salva');
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
      title="Meta de peso"
      subtitle="Sem prazo: o app estima quando você chega lá pelo seu ritmo real."
      footer={
        <div className="flex gap-3">
          {goal && (
            <Button variant="danger" onClick={() => save(null)} disabled={busy}>
              Remover
            </Button>
          )}
          <Button className="flex-1" loading={busy} disabled={!kgMeta || !kgAtual} onClick={() => save(kgMeta)}>
            Salvar meta
          </Button>
        </div>
      }
    >
      <div className="space-y-4 pb-2">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Peso atual (kg)" hint={last ? 'Pela sua tendência.' : undefined}>
            <input
              className="field tnum text-xl font-semibold"
              value={atual}
              onChange={(e) => {
                setAtual(e.target.value);
                setMexeuNoAtual(true);
              }}
              inputMode="decimal"
              placeholder="0,0"
            />
          </Field>
          <Field label="Meta (kg)">
            <input
              className="field tnum text-xl font-semibold"
              value={meta}
              onChange={(e) => setMeta(e.target.value)}
              inputMode="decimal"
              placeholder="0,0"
              autoFocus
            />
          </Field>
        </div>

        {diff !== null && Math.abs(diff) >= 0.5 && (
          <p className="rounded-2xl bg-brand-50 px-4 py-3 text-sm text-brand-700">
            Uma meta de <strong className="tnum">{diff < 0 ? 'perder' : 'ganhar'} {n1(Math.abs(diff))} kg</strong>.
            O objetivo do seu perfil passa a ser “{diff < 0 ? 'Perder peso' : 'Ganhar massa'}”.
          </p>
        )}
        {diff !== null && Math.abs(diff) < 0.5 && kgMeta > 0 && (
          <p className="rounded-2xl bg-brand-50 px-4 py-3 text-sm text-brand-700">
            Uma meta de manutenção: ficar por volta de <strong className="tnum">{n1(kgMeta)} kg</strong>.
          </p>
        )}

        {imcMeta !== null && imcMeta < 18.5 && (
          <p className="flex items-start gap-2 rounded-2xl bg-canvas px-4 py-3 text-sm leading-relaxed text-mute">
            <Info size={16} className="mt-0.5 shrink-0 text-brand-600" />
            <span>
              Essa meta fica abaixo de IMC 18,5 para a sua altura. Vale conversar com uma
              nutricionista ou um médico antes de seguir com ela.
            </span>
          </p>
        )}

        <ErrorNote>{error}</ErrorNote>
      </div>
    </Sheet>
  );
}
