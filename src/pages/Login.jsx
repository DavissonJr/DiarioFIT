import { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { useAuth } from '../lib/auth';
import { Button, Field, ErrorNote } from '../components/ui';

export default function Login() {
  const { login, register } = useAuth();
  const [mode, setMode] = useState('login');
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [show, setShow] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const creating = mode === 'create';
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      if (creating) await register(form.name, form.email, form.password);
      else await login(form.email, form.password);
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-[100dvh] flex-col justify-center px-6 py-10">
      <div className="mx-auto w-full max-w-sm">
        <header className="mb-8">
          <svg viewBox="0 0 512 512" className="mb-5 h-12 w-12" aria-hidden="true">
            <rect width="512" height="512" rx="120" className="fill-brand-500" />
            <circle cx="256" cy="286" r="132" fill="none" className="stroke-brand-50" strokeWidth="26" />
            <path d="M256 288c0-54 36-94 88-101 5 52-29 97-88 101z" className="fill-brand-50" />
            <path d="M256 288c0-40-26-70-64-76-4 39 20 72 64 76z" className="fill-brand-200" />
            <rect x="245" y="288" width="22" height="106" rx="11" className="fill-brand-50" />
          </svg>
          <h1 className="font-display text-[34px] font-semibold leading-[1.1] tracking-tight">
            {creating ? 'Vamos começar' : 'Bom te ver de novo'}
          </h1>
          <p className="mt-2 text-[15px] leading-relaxed text-mute">
            {creating
              ? 'Uma conta só sua, para registrar o que comeu, a água e os hábitos do dia.'
              : 'Entre para ver o seu dia.'}
          </p>
        </header>

        <form onSubmit={submit} className="space-y-4">
          {creating && (
            <Field label="Como quer ser chamada">
              <input
                className="field"
                value={form.name}
                onChange={set('name')}
                autoComplete="name"
                required
              />
            </Field>
          )}

          <Field label="E-mail">
            <input
              type="email"
              className="field"
              value={form.email}
              onChange={set('email')}
              autoComplete="email"
              inputMode="email"
              required
            />
          </Field>

          <Field label="Senha" hint={creating ? 'Pelo menos 6 caracteres.' : undefined}>
            <div className="relative">
              <input
                type={show ? 'text' : 'password'}
                className="field pr-12"
                value={form.password}
                onChange={set('password')}
                autoComplete={creating ? 'new-password' : 'current-password'}
                required
              />
              <button
                type="button"
                onClick={() => setShow(!show)}
                className="absolute inset-y-0 right-0 grid w-12 place-items-center text-mute"
                aria-label={show ? 'Esconder senha' : 'Mostrar senha'}
              >
                {show ? <EyeOff size={20} /> : <Eye size={20} />}
              </button>
            </div>
          </Field>

          <ErrorNote>{error}</ErrorNote>

          <Button type="submit" size="lg" loading={busy} className="w-full">
            {creating ? 'Criar conta' : 'Entrar'}
          </Button>
        </form>

        <p className="mt-6 text-center text-[15px] text-mute">
          {creating ? 'Já tem uma conta?' : 'Ainda não tem conta?'}{' '}
          <button
            onClick={() => {
              setMode(creating ? 'login' : 'create');
              setError('');
            }}
            className="font-semibold text-brand-500 underline underline-offset-4"
          >
            {creating ? 'Entrar' : 'Criar agora'}
          </button>
        </p>
      </div>
    </div>
  );
}
