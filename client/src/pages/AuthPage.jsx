import { useState } from 'react';
import { api } from '../api.js';
import { Box, Notice, PageHeader } from '../components.jsx';
import { navigate, useApp } from '../util.js';

export default function AuthPage({ mode }) {
  const { account, setAccount } = useApp();
  const isRegister = mode === 'register';
  const title = isRegister ? 'Student registration' : 'Sign in';
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  if (account) {
    return (
      <>
        <PageHeader crumbs={[[title]]} title={title} />
        <div className="container content narrow">
          <p>You are signed in as <strong>{account.name}</strong> ({account.email}).</p>
          <p><a href={account.role === 'staff' ? '#/desk' : '#/'}>Continue</a></p>
        </div>
      </>
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
    <>
      <PageHeader crumbs={[[title]]} title={title} />
      <div className="container content narrow">
        <Box title={isRegister ? 'Create a student account' : 'Account details'} id="auth-title">
          <form className="form" onSubmit={submit} noValidate>
            {isRegister && (
              <div className="field">
                <label htmlFor="f-name">Full name</label>
                <input id="f-name" autoComplete="name" value={form.name} onChange={set('name')} required maxLength={100} />
              </div>
            )}
            <div className="field">
              <label htmlFor="f-email">Email</label>
              <input id="f-email" type="email" autoComplete="email" value={form.email} onChange={set('email')} required />
            </div>
            <div className="field">
              <label htmlFor="f-password">Password</label>
              <input id="f-password" type="password" autoComplete={isRegister ? 'new-password' : 'current-password'} value={form.password} onChange={set('password')} required aria-describedby={isRegister ? 'pw-hint' : undefined} />
              {isRegister && <p id="pw-hint" className="hint">At least 8 characters.</p>}
            </div>
            {error && (
              <Notice type="error" role="alert">
                {error.message}
                {error.details && <ul>{error.details.map((d) => <li key={d}>{d}</li>)}</ul>}
              </Notice>
            )}
            <div className="button-row">
              <button className="btn btn-primary" type="submit" disabled={busy}>{busy ? 'Please wait…' : isRegister ? 'Register' : 'Sign in'}</button>
            </div>
          </form>
        </Box>
        <p className="after-box">
          {isRegister ? <>Already registered? <a href="#/login">Sign in</a>.</> : <>No account yet? <a href="#/register">Register as a student</a>.</>}
        </p>
        <p className="hint">During the pilot, please use test accounts, not your university credentials.</p>
      </div>
    </>
  );
}
