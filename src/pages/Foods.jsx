import { useEffect, useMemo, useState } from 'react';
import { Search, Star, Carrot } from 'lucide-react';
import { api } from '../lib/api';
import { n0, n1, qty } from '../lib/nutri';
import { Button, Loading, Empty, ErrorNote, toast } from '../components/ui';
import FoodForm from '../components/FoodForm';
import Fab from '../components/Fab';

const norm = (s) =>
  String(s || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

export default function Foods() {
  const [foods, setFoods] = useState(null);
  const [search, setSearch] = useState('');
  const [error, setError] = useState('');
  const [editing, setEditing] = useState(null); // objeto ou 'novo'

  async function load() {
    try {
      setError('');
      const data = await api('/foods');
      setFoods(data.foods);
    } catch (err) {
      setError(err.message);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const list = useMemo(() => {
    if (!foods) return [];
    const q = norm(search);
    return q ? foods.filter((f) => norm(f.name).includes(q) || norm(f.brand).includes(q)) : foods;
  }, [foods, search]);

  async function toggleFavorite(food, e) {
    e.stopPropagation();
    setFoods((v) => v.map((f) => (f.id === food.id ? { ...f, favorite: !f.favorite } : f)));
    try {
      await api(`/foods/${food.id}/favorite`, { method: 'POST' });
    } catch (err) {
      toast(err.message, 'error');
      load();
    }
  }

  return (
    <div className="pt-6 md:pt-10">
      <header className="mb-4">
        <h1 className="font-display text-3xl font-semibold tracking-tight">Alimentos</h1>
        <p className="mt-1 text-[15px] text-mute">
          Cadastre uma vez com as calorias por porção. Depois é só informar a quantidade.
        </p>
      </header>

      <div className="relative mb-4">
        <Search
          size={19}
          className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-mute"
        />
        <input
          className="field pl-11"
          placeholder="Buscar pelo nome ou marca"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <ErrorNote onRetry={load}>{error}</ErrorNote>

      {!foods ? (
        <Loading label="Buscando seus alimentos" />
      ) : list.length === 0 ? (
        <div className="card">
          <Empty
            icon={Carrot}
            title={search ? 'Nenhum resultado' : 'Sua lista está vazia'}
            action={<Button onClick={() => setEditing('novo')}>Cadastrar alimento</Button>}
          >
            {search
              ? 'Tente outro nome ou cadastre esse alimento agora.'
              : 'Comece pelos alimentos que você come com frequência.'}
          </Empty>
        </div>
      ) : (
        <ul className="card divide-y divide-line overflow-hidden pb-2">
          {list.map((f) => (
            <li key={f.id}>
              <div className="flex items-center gap-1 px-2">
                <button
                  onClick={(e) => toggleFavorite(f, e)}
                  className="grid h-11 w-11 shrink-0 place-items-center rounded-full transition active:scale-90"
                  aria-label={f.favorite ? 'Tirar dos favoritos' : 'Marcar como favorito'}
                  aria-pressed={f.favorite}
                >
                  <Star
                    size={19}
                    className={f.favorite ? 'fill-carb text-carb' : 'text-line'}
                    strokeWidth={2}
                  />
                </button>

                <button
                  onClick={() => setEditing(f)}
                  className="flex min-w-0 flex-1 items-center gap-3 rounded-xl py-3 pr-3 text-left transition active:bg-canvas"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{f.name}</span>
                    <span className="block truncate text-sm text-mute tnum">
                      {f.brand ? `${f.brand} · ` : ''}
                      {n1(f.carbs)} C · {n1(f.protein)} P · {n1(f.fat)} G
                    </span>
                  </span>
                  <span className="shrink-0 text-right">
                    <span className="block font-display font-semibold tnum">
                      {n0(f.kcal)} <span className="text-xs font-medium text-mute">kcal</span>
                    </span>
                    <span className="block text-xs text-mute tnum">
                      por {qty(f.baseQty)} {f.unit === 'un' ? 'un' : f.unit}
                    </span>
                  </span>
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <Fab onClick={() => setEditing('novo')} label="Cadastrar alimento" />

      <FoodForm
        open={!!editing}
        food={editing === 'novo' ? null : editing}
        onClose={() => setEditing(null)}
        onSaved={load}
        onDeleted={load}
      />
    </div>
  );
}
