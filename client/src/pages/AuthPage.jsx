import { useState } from 'react';
import { api } from '../api.js';
import { navigate, useApp } from '../util.js';

export default function AuthPage({ mode }) {
  const { account, setAccount } = useApp();
  const isRegister = mode === 'register';
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  if (account) {
    return (
      <section className="wrap narrow">
        <h1>You are signed in</h1>
        <p>Signed in as {account.name} ({account.email}).</p>
        <a className="btn" href={account.role === 'staff' ? '#/desk' : '#/'}>Continue</a>
      </section>
    );
  }

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const body = isRegister ? form : { email: form.email, password: form.password };
      const res = await api(`/auth/${isRegister ? 'register' : 'login'}`, { method: 'POST', body });
      setAccount(res.account);
      navigate(res.account.role === 'staff' ? '/desk' : '/');
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="wrap narrow">
      <h1>{isRegister ? 'Create a student account' : 'Sign in'}</h1>
      <form className="card form" onSubmit={submit} noValidate>
        {isRegister && (
          <label>Full name
            <input autoComplete="name" value={form.name} onChange={set('name')} required maxLength={100} />
          </label>
        )}
        <label>Email
          <input type="email" autoComplete="email" value={form.email} onChange={set('email')} required />
        </label>
        <label>Password
          <input type="password" autoComplete={isRegister ? 'new-password' : 'current-password'} value={form.password} onChange={set('password')} required minLength={isRegister ? 8 : undefined} aria-describedby={isRegister ? 'pw-hint' : undefined} />
          {isRegister && <span id="pw-hint" className="small muted">At least 8 characters.</span>}
        </label>
        {error && (
          <div className="notice error" role="alert">
            {error.message}
            {error.details && <ul>{error.details.map((d) => <li key={d}>{d}</li>)}</ul>}
          </div>
        )}
        <button className="btn primary" type="submit" disabled={busy}>{busy ? 'Please wait…' : isRegister ? 'Create account' : 'Sign in'}</button>
      </form>
      <p className="small">
        {isRegister ? <>Already have an account? <a href="#/login">Sign in</a></> : <>New student? <a href="#/register">Create an account</a></>}
      </p>
      {!isRegister && <p className="small muted">Pilot: use test accounts only, not real campus credentials.</p>}
    </section>
  );
}
