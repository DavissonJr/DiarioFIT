import { useEffect, useState } from 'react';
import { Trash2 } from 'lucide-react';
import { api } from '../lib/api';
import { UNITS, parseNum, n0 } from '../lib/nutri';
import { Sheet, Button, Field, ErrorNote, toast } from './ui';

// Mostra decimais com vírgula ao editar (3.2 → 3,2); a leitura aceita os dois.
const br = (v) => (v === null || v === undefined ? '' : String(v).replace('.', ','));

const EMPTY = {
  name: '',
  brand: '',
  baseQty: '100',
  unit: 'g',
  kcal: '',
  protein: '',
  carbs: '',
  fat: '',
  fiber: '',
  portionQty: '',
  portionLabel: '',
};

export default function FoodForm({ open, food, onClose, onSaved, onDeleted }) {
  const [form, setForm] = useState(EMPTY);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const editing = !!food?.id;

  useEffect(() => {
    if (!open) return;
    setError('');
    setForm(
      food
        ? {
            name: food.name || '',
            brand: food.brand || '',
            baseQty: br(food.baseQty ?? 100),
            unit: food.unit || 'g',
            kcal: br(food.kcal),
            protein: br(food.protein),
            carbs: br(food.carbs),
            fat: br(food.fat),
            fiber: br(food.fiber),
            portionQty: food.portionQty ? br(food.portionQty) : '',
            portionLabel: food.portionLabel || '',
          }
        : EMPTY
    );
  }, [open, food]);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const unitLabel = form.unit === 'un' ? 'unidade' : form.unit;

  async function save() {
    setBusy(true);
    setError('');
    try {
      const body = {
        name: form.name,
        brand: form.brand,
        baseQty: parseNum(form.baseQty),
        unit: form.unit,
        kcal: parseNum(form.kcal),
        protein: parseNum(form.protein),
        carbs: parseNum(form.carbs),
        fat: parseNum(form.fat),
        fiber: parseNum(form.fiber),
        portionQty: form.unit !== 'un' && parseNum(form.portionQty) > 0 ? parseNum(form.portionQty) : null,
        portionLabel: form.portionLabel,
        favorite: !!food?.favorite,
      };
      const data = editing
        ? await api(`/foods/${food.id}`, { method: 'PUT', body })
        : await api('/foods', { method: 'POST', body });
      toast(editing ? 'Alimento atualizado' : 'Alimento cadastrado');
      onSaved?.(data.food);
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!confirm(`Apagar "${food.name}"? Os registros já feitos continuam no histórico.`)) return;
    setBusy(true);
    try {
      await api(`/foods/${food.id}`, { method: 'DELETE' });
      toast('Alimento apagado');
      onDeleted?.(food.id);
      onClose();
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  const macroField = (key, label, color) => (
    <Field label={label}>
      <input
        className={`field tnum ${color}`}
        value={form[key]}
        onChange={set(key)}
        inputMode="decimal"
        placeholder="0"
      />
    </Field>
  );

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={editing ? 'Editar alimento' : 'Novo alimento'}
      subtitle="Use os valores da tabela nutricional da embalagem."
      footer={
        <div className="flex gap-3">
          {editing && (
            <Button variant="danger" size="md" onClick={remove} aria-label="Apagar alimento">
              <Trash2 size={18} />
            </Button>
          )}
          <Button className="flex-1" loading={busy} onClick={save}>
            Salvar
          </Button>
        </div>
      }
    >
      <div className="space-y-4 pb-2">
        <Field label="Nome">
          <input
            className="field"
            value={form.name}
            onChange={set('name')}
            placeholder="Peito de frango grelhado"
          />
        </Field>

        <Field label="Marca (opcional)">
          <input className="field" value={form.brand} onChange={set('brand')} placeholder="Sadia" />
        </Field>

        <div>
          <span className="mb-1.5 block text-sm font-medium text-mute">
            Os valores abaixo valem para
          </span>
          <div className="flex gap-2">
            <input
              className="field tnum w-28"
              value={form.baseQty}
              onChange={set('baseQty')}
              inputMode="decimal"
            />
            <select
              className="field flex-1"
              value={form.unit}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  unit: e.target.value,
                  baseQty: e.target.value === 'un' ? '1' : f.baseQty === '1' ? '100' : f.baseQty,
                }))
              }
            >
              {UNITS.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.label}
                </option>
              ))}
            </select>
          </div>
          <p className="mt-1.5 text-xs text-mute">
            Para ovo, pão ou fruta inteira escolha unidade. Para o resto, deixe em 100 g.
          </p>
        </div>

        {form.unit !== 'un' && (
          <div className="rounded-2xl border border-dashed border-line p-4">
            <p className="text-sm font-semibold">Medida caseira (opcional)</p>
            <p className="mt-0.5 text-xs text-mute">
              Preencha para registrar por unidade, como “3 ovos” ou “2 biscoitos”, sem pesar.
            </p>
            <div className="mt-3 flex items-center gap-2">
              <span className="font-display text-lg text-mute">1</span>
              <input
                className="field min-w-0 flex-1"
                value={form.portionLabel}
                onChange={set('portionLabel')}
                placeholder="ex.: fatia"
                maxLength={24}
                aria-label="Nome da medida caseira"
              />
              <span className="text-mute">=</span>
              <input
                className="field tnum w-20"
                value={form.portionQty}
                onChange={set('portionQty')}
                inputMode="decimal"
                placeholder="50"
                aria-label="Tamanho da medida caseira"
              />
              <span className="text-mute">{form.unit}</span>
            </div>
          </div>
        )}

        <Field label={`Calorias em ${form.baseQty || 0} ${unitLabel}`}>
          <input
            className="field tnum"
            value={form.kcal}
            onChange={set('kcal')}
            inputMode="decimal"
            placeholder="0"
          />
        </Field>

        <div className="grid grid-cols-3 gap-3">
          {macroField('carbs', 'Carboidrato (g)', 'text-carb')}
          {macroField('protein', 'Proteína (g)', 'text-prot')}
          {macroField('fat', 'Gordura (g)', 'text-fat')}
        </div>

        {macroField('fiber', 'Fibra (g), opcional', '')}

        {parseNum(form.kcal) > 0 && parseNum(form.baseQty) > 0 && (
          <p className="rounded-2xl bg-brand-50 px-4 py-3 text-sm text-brand-600">
            Cada {form.baseQty} {unitLabel} vai contar como{' '}
            <strong className="tnum">{n0(parseNum(form.kcal))} kcal</strong>.
          </p>
        )}

        <ErrorNote>{error}</ErrorNote>
      </div>
    </Sheet>
  );
}
