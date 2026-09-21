/**
 * Temas do app. A escolha fica salva no aparelho, então o celular e o tablet
 * podem ter temas diferentes — o que costuma ser o desejado.
 */
export const THEMES = [
  { id: 'verde', label: 'Verde', canvas: '#EFF2ED', surface: '#FFFFFF', brand: '#1F6B47' },
  { id: 'oceano', label: 'Oceano', canvas: '#ECF1F7', surface: '#FFFFFF', brand: '#2461B5' },
  { id: 'rosa', label: 'Rosa', canvas: '#F9F0F3', surface: '#FFFFFF', brand: '#BE3C71' },
  { id: 'escuro', label: 'Escuro', canvas: '#101513', surface: '#1A211E', brand: '#5EBA8A' },
  { id: 'auto', label: 'Automático', canvas: '#EFF2ED', surface: '#1A211E', brand: '#1F6B47' },
];

const KEY = 'diario_tema';
const dark = window.matchMedia('(prefers-color-scheme: dark)');

export const savedTheme = () => {
  try {
    return localStorage.getItem(KEY) || 'verde';
  } catch {
    return 'verde';
  }
};

// "Automático" segue o modo claro/escuro do sistema.
const resolve = (id) => (id === 'auto' ? (dark.matches ? 'escuro' : 'verde') : id);

export function applyTheme(id = savedTheme()) {
  const real = resolve(id);
  document.documentElement.dataset.theme = real;
  const cor = THEMES.find((t) => t.id === real)?.canvas || '#EFF2ED';
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', cor);
}

export function setTheme(id) {
  try {
    localStorage.setItem(KEY, id);
  } catch {
    /* sem armazenamento, o tema vale só nesta sessão */
  }
  applyTheme(id);
}

// Se estiver no automático, acompanha a troca do sistema ao vivo.
dark.addEventListener?.('change', () => {
  if (savedTheme() === 'auto') applyTheme('auto');
});
