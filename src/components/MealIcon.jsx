import { Coffee, UtensilsCrossed, Apple, Soup, Moon } from 'lucide-react';
import { mealOf } from '../lib/nutri';

const ICONS = {
  cafe: Coffee,
  almoco: UtensilsCrossed,
  lanche: Apple,
  jantar: Soup,
  ceia: Moon,
};

/** Selo redondo com o ícone da refeição, na cor dela. */
export default function MealIcon({ meal, size = 'md' }) {
  const m = mealOf(meal);
  const Icon = ICONS[m.id];
  const box = size === 'sm' ? 'h-7 w-7' : 'h-9 w-9';
  return (
    <span className={`grid ${box} shrink-0 place-items-center rounded-full ${m.soft} ${m.text}`}>
      <Icon size={size === 'sm' ? 15 : 18} strokeWidth={2.2} />
    </span>
  );
}
