const BASE = import.meta.env.VITE_API_URL || '/api';
const KEY = 'diario_token';

let token = localStorage.getItem(KEY) || null;
let onExpired = () => {};

export const getToken = () => token;

export function setToken(value) {
  token = value;
  if (value) localStorage.setItem(KEY, value);
  else localStorage.removeItem(KEY);
}

export function onSessionExpired(fn) {
  onExpired = fn;
}

export async function api(path, { method = 'GET', body, signal } = {}) {
  let res;
  try {
    res = await fetch(BASE + path, {
      method,
      signal,
      headers: {
        ...(body ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch (err) {
    if (err?.name === 'AbortError') throw err;
    throw new Error('Sem conexão com o servidor. Verifique a internet.');
  }

  const data = await res.json().catch(() => null);

  if (res.status === 401) {
    setToken(null);
    onExpired();
  }
  if (!res.ok) throw new Error(data?.error || 'Não deu para completar essa ação.');
  return data;
}
