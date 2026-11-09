import { useState } from 'react';
import { api } from '../api.js';
import { Box, Notice, PageHeader, Tabs } from '../components.jsx';
import { navigate, useApp } from '../util.js';

const homeFor = (account) => (account.role === 'staff' ? '/desk' : '/');

function ErrorNotice({ error }) {
  if (!error) return null;
  return (
    <Notice type="error" role="alert">
      {error.message}
      {error.details && <ul>{error.details.map((d) => <li key={d}>{d}</li>)}</ul>}
    </Notice>
  );
}

function SignedIn({ account, title }) {
  return (
    <>
      <PageHeader crumbs={[[title]]} title={title} />
      <div className="container content narrow">
        <p>You are signed in as <strong>{account.name}</strong> ({account.email}).</p>
        <p><a href={`#${homeFor(account)}`}>Continue</a></p>
      </div>
    </>
  );
}

/** US-03: ask for a single-use sign-in link. */
function LinkForm() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setSent(null);
    try {
      setSent(await api('/auth/link', { method: 'POST', body: { email } }));
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className="form" onSubmit={submit} noValidate>
      <p className="hint">We will email you a link. It works once and expires after a short time. You do not need a password.</p>
      <div className="field">
        <label htmlFor="f-link-email">Email</label>
        <input id="f-link-email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
      </div>
      <ErrorNotice error={error} />
      <div aria-live="polite">
        {sent && (
          <Notice type="success">
            {sent.message}
            {sent.devLink && (
              <> <br />Development server, no email is sent: <a href={sent.devLink}>open the sign-in link</a>.</>
            )}
          </Notice>
        )}
      </div>
      <div className="button-row">
        <button className="btn btn-primary" type="submit" disabled={busy}>{busy ? 'Please wait…' : 'Send sign-in link'}</button>
      </div>
    </form>
  );
}

function PasswordForm({ isRegister }) {
  const { setAccount } = useApp();
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const body = isRegister ? form : { email: form.email, password: form.password };
      const res = await api(`/auth/${isRegister ? 'register' : 'login'}`, { method: 'POST', body });
      setAccount(res.account);
      navigate(homeFor(res.account));
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  };

  return (
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
        {isRegister && <p id="pw-hint" className="hint">At least 8 characters. Afterwards you can also sign in with an email link.</p>}
      </div>
      <ErrorNotice error={error} />
      <div className="button-row">
        <button className="btn btn-primary" type="submit" disabled={busy}>{busy ? 'Please wait…' : isRegister ? 'Register' : 'Sign in'}</button>
      </div>
    </form>
  );
}

export default function AuthPage({ mode, method }) {
  const { account, emailSignIn } = useApp();
  const isRegister = mode === 'register';
  const title = isRegister ? 'Student registration' : 'Sign in';
  if (account) return <SignedIn account={account} title={title} />;

  const current = !emailSignIn ? 'password' : method === 'password' ? 'password' : 'link';
  return (
    <>
      <PageHeader crumbs={[[title]]} title={title} />
      <div className="container content narrow">
        {isRegister ? (
          <Box title="Create a student account" id="auth-title"><PasswordForm isRegister /></Box>
        ) : (
          <>
            {emailSignIn && <Tabs tab={current} base="/login" label="Sign-in method" items={[['link', 'Email link'], ['password', 'Password']]} />}
            <Box title={current === 'link' ? 'Sign in with an email link' : 'Sign in with a password'} id="auth-title">
              {current === 'link' ? <LinkForm /> : <PasswordForm />}
            </Box>
          </>
        )}
        <p className="after-box">
          {isRegister ? <>Already registered? <a href="#/login">Sign in</a>.</> : <>No account yet? <a href="#/register">Register as a student</a>.</>}
        </p>
        <p className="hint">During the pilot, please use test accounts, not your university credentials.</p>
      </div>
    </>
  );
}

/** Landing page of the emailed link. Sign-in needs a button press, so mail scanners that open links cannot use them up. */
export function SignInLinkPage({ token }) {
  const { account, setAccount } = useApp();
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const confirm = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await api('/auth/link/verify', { method: 'POST', body: { token } });
      setAccount(res.account);
      navigate(homeFor(res.account));
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <PageHeader crumbs={[['Sign in', '#/login'], ['Confirm']]} title="Confirm sign-in" />
      <div className="container content narrow">
        <Box title="Email sign-in link" id="link-title">
          {account && <p>You are currently signed in as {account.name}. Continuing will switch to the account this link belongs to.</p>}
          <p>Press Continue to sign in to the Equipment Loan Service in this browser.</p>
          <ErrorNotice error={error} />
          {error ? (
            <p><a href="#/login/link">Request a new sign-in link</a></p>
          ) : (
            <div className="button-row">
              <button type="button" className="btn btn-primary" onClick={confirm} disabled={busy}>{busy ? 'Signing in…' : 'Continue'}</button>
            </div>
          )}
        </Box>
      </div>
    </>
  );
}
