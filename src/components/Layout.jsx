import { NavLink } from 'react-router-dom';
import { Home, Carrot, TrendingUp, User } from 'lucide-react';

const TABS = [
  { to: '/', label: 'Hoje', icon: Home, end: true },
  { to: '/alimentos', label: 'Alimentos', icon: Carrot },
  { to: '/progresso', label: 'Progresso', icon: TrendingUp },
  { to: '/perfil', label: 'Perfil', icon: User },
];

export default function Layout({ children }) {
  return (
    <div className="min-h-[100dvh] md:flex">
      {/* Tablet e desktop: trilho lateral */}
      <nav className="sticky top-0 hidden h-[100dvh] w-[232px] shrink-0 flex-col border-r border-line bg-surface px-4 py-6 md:flex">
        <div className="mb-8 flex items-center gap-2.5 px-2">
          <svg viewBox="0 0 512 512" className="h-9 w-9" aria-hidden="true">
            <rect width="512" height="512" rx="120" fill="#1F6B47" />
            <circle cx="256" cy="286" r="132" fill="none" stroke="#EAF3ED" strokeWidth="26" />
            <path d="M256 288c0-54 36-94 88-101 5 52-29 97-88 101z" fill="#EAF3ED" />
            <path d="M256 288c0-40-26-70-64-76-4 39 20 72 64 76z" fill="#A9CDB8" />
            <rect x="245" y="288" width="22" height="106" rx="11" fill="#EAF3ED" />
          </svg>
          <span className="font-display text-xl font-semibold">Diário</span>
        </div>

        <div className="flex flex-col gap-1">
          {TABS.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-2xl px-3 py-3 font-semibold transition ${
                  isActive ? 'bg-leaf-50 text-leaf-600' : 'text-mute hover:bg-base hover:text-ink'
                }`
              }
            >
              <Icon size={21} strokeWidth={2} />
              {label}
            </NavLink>
          ))}
        </div>
      </nav>

      <main className="min-w-0 flex-1 pb-[92px] md:pb-10">
        <div className="mx-auto w-full max-w-3xl px-4 md:px-8">{children}</div>
      </main>

      {/* Celular: barra inferior */}
      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface/95 backdrop-blur pb-safe md:hidden">
        <div className="flex">
          {TABS.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                `flex flex-1 flex-col items-center gap-1 py-2.5 text-[11px] font-semibold transition ${
                  isActive ? 'text-leaf-500' : 'text-mute'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <span
                    className={`grid h-8 w-14 place-items-center rounded-full transition ${
                      isActive ? 'bg-leaf-50' : ''
                    }`}
                  >
                    <Icon size={21} strokeWidth={isActive ? 2.4 : 2} />
                  </span>
                  {label}
                </>
              )}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  );
}
