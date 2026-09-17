import { useCallback, useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, Check, CopyPlus } from 'lucide-react';
import { api } from '../lib/api';
import { addDays, dateLabel, todayISO, MEALS, n0, qty } from '../lib/nutri';
import { Sheet, Button, Loading, Empty, ErrorNote, toast } from './ui';

/**
 * Abre outro dia, mostra o que foi comido e deixa escolher item por item
 * o que deve ser trazido para o dia atual.
 */
export default function ImportDay({ open, date, onClose, onImported }) {
  const [from, setFrom] = useState(addDays(date, -1));
  const [day, setDay] = useState(null);
  const [picked, setPicked] = useState(() => new Set());
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) setFrom(addDays(date, -1));
  }, [open, date]);

  const load = useCallback(async () => {
    setDay(null);
    setError('');
    try {
      const data = await api(`/day?date=${from}`);
      setDay(data);
      // Tudo já vem marcado: na maioria das vezes a pessoa quer o dia inteiro.
      setPicked(new Set(data.entries.map((e) => e.id)));
    } catch (err) {
      setError(err.message);
    }
  }, [from]);

  useEffect(() => {
    if (open) load();
  }, [open, load]);

  function toggle(id) {
    setPicked((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function toggleMeal(items) {
    const allPicked = items.every((e) => picked.has(e.id));
    setPicked((prev) => {
      const next = new Set(prev);
      items.forEach((e) => (allPicked ? next.delete(e.id) : next.add(e.id)));
      return next;
    });
  }

  async function bring() {
    setBusy(true);
    setError('');
    try {
      const { copied } = await api('/entries/copy', {
        method: 'POST',
        body: { ids: [...picked], to: date },
      });
      toast(copied === 1 ? '1 item trazido' : `${copied} itens trazidos`);
      onImported();
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  // "Hoje"/"Ontem" dispensam a preposição; uma data qualquer pede "em".
  const rotulo = dateLabel(date);
  const alvo = ['Hoje', 'Ontem', 'Amanhã'].includes(rotulo)
    ? rotulo.toLowerCase()
    : `em ${rotulo}`;

  const total = day
    ? day.entries.filter((e) => picked.has(e.id)).reduce((a, e) => a + e.kcal, 0)
    : 0;

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Trazer de outro dia"
      subtitle={`Escolha o que repetir ${alvo}.`}
      footer={
        <Button
          className="w-full"
          loading={busy}
          disabled={picked.size === 0}
          onClick={bring}
        >
          <CopyPlus size={18} />
          {picked.size === 0
            ? 'Escolha ao menos um item'
            : `Trazer ${picked.size} ${picked.size === 1 ? 'item' : 'itens'} · ${n0(total)} kcal`}
        </Button>
      }
    >
      <div className="pb-2">
        <div className="sticky top-0 z-10 -mx-1 flex items-center gap-1 bg-surface px-1 pb-3">
          <Button
            variant="ghost"
            size="iconSm"
            onClick={() => setFrom(addDays(from, -1))}
            aria-label="Dia anterior"
          >
            <ChevronLeft size={20} />
          </Button>
          <p className="flex-1 text-center font-display text-lg font-semibold">
            {dateLabel(from)}
          </p>
          <Button
            variant="ghost"
            size="iconSm"
            onClick={() => setFrom(addDays(from, 1))}
            disabled={from >= todayISO() || addDays(from, 1) === date}
            aria-label="Próximo dia"
          >
            <ChevronRight size={20} />
          </Button>
        </div>

        <ErrorNote onRetry={load}>{error}</ErrorNote>

        {!day ? (
          <Loading label="Buscando esse dia" />
        ) : day.entries.length === 0 ? (
          <Empty icon={CopyPlus} title="Esse dia está vazio">
            Use as setas acima para procurar um dia com registros.
          </Empty>
        ) : (
          MEALS.map((m) => {
            const items = day.entries.filter((e) => e.meal === m.id);
            if (items.length === 0) return null;
            const allPicked = items.every((e) => picked.has(e.id));

            return (
              <div key={m.id} className="mb-4 first:mt-1">
                <div className="mb-1 flex items-center justify-between">
                  <h3 className="font-display text-base font-semibold">{m.label}</h3>
                  <button
                    onClick={() => toggleMeal(items)}
                    className="text-sm font-semibold text-leaf-500"
                  >
                    {allPicked ? 'desmarcar' : 'marcar tudo'}
                  </button>
                </div>

                <ul className="divide-y divide-line">
                  {items.map((e) => {
                    const on = picked.has(e.id);
                    return (
                      <li key={e.id}>
                        <button
                          onClick={() => toggle(e.id)}
                          aria-pressed={on}
                          className="flex w-full items-center gap-3 py-2.5 text-left"
                        >
                          <span
                            className={`grid h-6 w-6 shrink-0 place-items-center rounded-md border-2 transition
                              ${on ? 'animate-pop border-leaf-500 bg-leaf-500 text-white' : 'border-line'}`}
                          >
                            {on && <Check size={14} strokeWidth={3} />}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className={`block truncate ${on ? 'font-medium' : 'text-mute'}`}>
                              {e.name}
                            </span>
                            <span className="tnum block text-sm text-mute">
                              {qty(e.quantity)} {e.unit === 'un' ? 'un' : e.unit}
                            </span>
                          </span>
                          <span
                            className={`tnum shrink-0 font-display font-semibold ${on ? '' : 'text-mute'}`}
                          >
                            {n0(e.kcal)}
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            );
          })
        )}
      </div>
    </Sheet>
  );
}
