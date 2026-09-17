import { useEffect, useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X, Check, AlertCircle, Loader2 } from 'lucide-react';
import { n0, n1 } from '../lib/nutri';

/* Botão ------------------------------------------------------------------ */

const VARIANTS = {
  primary: 'bg-leaf-500 text-white hover:bg-leaf-600 active:bg-leaf-600 shadow-card',
  soft: 'bg-leaf-50 text-leaf-600 hover:bg-leaf-100',
  outline: 'border border-line text-ink hover:bg-canvas',
  ghost: 'text-mute hover:bg-canvas hover:text-ink',
  danger: 'bg-prot/10 text-prot hover:bg-prot/15',
};

const SIZES = {
  lg: 'h-14 px-6 rounded-2xl text-[17px]',
  md: 'h-12 px-5 rounded-2xl',
  sm: 'h-9 px-3.5 rounded-xl text-sm',
  icon: 'h-11 w-11 rounded-full shrink-0',
  iconSm: 'h-9 w-9 rounded-full shrink-0',
};

export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  className = '',
  children,
  ...props
}) {
  return (
    <button
      {...props}
      disabled={props.disabled || loading}
      className={`inline-flex items-center justify-center gap-2 font-semibold transition
        active:scale-[.98] disabled:opacity-50 disabled:active:scale-100
        ${VARIANTS[variant]} ${SIZES[size]} ${className}`}
    >
      {loading ? <Loader2 size={18} className="animate-spin" /> : children}
    </button>
  );
}

/* Folha modal ------------------------------------------------------------ */
/* Sobe de baixo no celular, vira caixa centralizada no tablet. */

export function Sheet({ open, onClose, title, subtitle, children, footer }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div className="absolute inset-0 bg-ink/40" onClick={onClose} />
      <div
        className="relative flex max-h-[92dvh] w-full flex-col animate-rise bg-surface
                   rounded-t-[28px] shadow-lift sm:max-w-lg sm:rounded-[28px]"
      >
        <div className="shrink-0 px-5 pt-3">
          <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-line sm:hidden" />
          <div className="flex items-start justify-between gap-3 pb-3">
            <div className="min-w-0">
              <h2 className="font-display text-xl font-semibold leading-tight">{title}</h2>
              {subtitle && <p className="mt-0.5 text-sm text-mute">{subtitle}</p>}
            </div>
            <Button variant="ghost" size="iconSm" onClick={onClose} aria-label="Fechar">
              <X size={20} />
            </Button>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-2">{children}</div>

        {footer && (
          <div className="shrink-0 border-t border-line bg-surface px-5 py-4 pb-safe rounded-b-[28px]">
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}

/* Campos ----------------------------------------------------------------- */

export function Field({ label, hint, children, className = '' }) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-1.5 block text-sm font-medium text-mute">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-mute">{hint}</span>}
    </label>
  );
}

export function Segmented({ options, value, onChange, className = '' }) {
  return (
    <div className={`flex gap-1 rounded-2xl bg-canvas p-1 ${className}`}>
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          onClick={() => onChange(o.id)}
          className={`flex-1 rounded-xl px-2 py-2.5 text-sm font-semibold transition
            ${value === o.id ? 'bg-surface text-ink shadow-card' : 'text-mute'}`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/* Barra do dia ----------------------------------------------------------- */
/* Uma única barra dividida pelas refeições: quanto comeu e de onde veio. */

const SEGMENT_TONES = ['bg-leaf-400', 'bg-leaf-600', 'bg-leaf-500', 'bg-leaf-700', 'bg-leaf-400'];

export function DayBar({ segments, total, target }) {
  const scale = Math.max(target, total, 1);
  const over = total > target;

  return (
    <div className="relative">
      <div className="flex h-3.5 gap-[3px] overflow-hidden rounded-full bg-leaf-50">
        {segments.map((s, i) => (
          <div
            key={s.id}
            className={`${SEGMENT_TONES[i % SEGMENT_TONES.length]} first:rounded-l-full transition-[width] duration-500`}
            style={{ width: `${(s.kcal / scale) * 100}%` }}
            title={`${s.label}: ${n0(s.kcal)} kcal`}
          />
        ))}
      </div>
      {over && (
        <div
          className="absolute top-[-3px] h-[20px] w-[2px] rounded bg-ink/45"
          style={{ left: `${(target / scale) * 100}%` }}
          title="Sua meta"
        />
      )}
    </div>
  );
}

export function MacroBar({ label, value, target, colorClass }) {
  const pct = target > 0 ? Math.min(100, (value / target) * 100) : 0;
  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between text-sm">
        <span className="font-medium text-ink">{label}</span>
        <span className="tnum text-mute">
          {n1(value)}
          <span className="text-mute/70"> / {n0(target)} g</span>
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-canvas">
        <div
          className={`h-full rounded-full transition-[width] duration-500 ${colorClass}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

/* Estados ---------------------------------------------------------------- */

export function Empty({ icon: Icon, title, children, action }) {
  return (
    <div className="flex flex-col items-center px-6 py-10 text-center">
      {Icon && (
        <div className="mb-3 grid h-14 w-14 place-items-center rounded-full bg-leaf-50 text-leaf-500">
          <Icon size={24} />
        </div>
      )}
      <p className="font-display text-lg font-semibold">{title}</p>
      {children && <p className="mt-1 max-w-[34ch] text-sm text-mute">{children}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function Loading({ label = 'Carregando' }) {
  return (
    <div className="flex items-center justify-center gap-2 py-16 text-mute">
      <Loader2 size={18} className="animate-spin" />
      <span className="text-sm">{label}</span>
    </div>
  );
}

export function ErrorNote({ children, onRetry }) {
  if (!children) return null;
  return (
    <div className="flex items-start gap-2 rounded-2xl bg-prot/10 px-4 py-3 text-sm text-prot">
      <AlertCircle size={18} className="mt-0.5 shrink-0" />
      <div className="flex-1">
        {children}
        {onRetry && (
          <button onClick={onRetry} className="ml-2 font-semibold underline">
            Tentar de novo
          </button>
        )}
      </div>
    </div>
  );
}

/* Avisos rápidos --------------------------------------------------------- */

let listeners = [];
export function toast(message, tone = 'ok') {
  listeners.forEach((fn) => fn({ id: Math.random(), message, tone }));
}

export function Toaster() {
  const [items, setItems] = useState([]);
  const timers = useRef([]);

  useEffect(() => {
    const add = (item) => {
      setItems((v) => [...v.slice(-2), item]);
      timers.current.push(
        setTimeout(() => setItems((v) => v.filter((i) => i.id !== item.id)), 3000)
      );
    };
    listeners.push(add);
    return () => {
      listeners = listeners.filter((l) => l !== add);
      timers.current.forEach(clearTimeout);
    };
  }, []);

  return createPortal(
    <div className="pointer-events-none fixed inset-x-0 bottom-24 z-[60] flex flex-col items-center gap-2 px-4 md:bottom-auto md:right-6 md:top-6 md:items-end">
      {items.map((t) => (
        <div
          key={t.id}
          role="status"
          className={`animate-rise flex items-center gap-2 rounded-full px-4 py-2.5 text-sm font-medium shadow-lift
            ${t.tone === 'error' ? 'bg-prot text-white' : 'bg-ink text-white'}`}
        >
          {t.tone === 'error' ? <AlertCircle size={16} /> : <Check size={16} />}
          {t.message}
        </div>
      ))}
    </div>,
    document.body
  );
}
