import { useEffect, useMemo, useState } from 'react';
import { api } from './api.js';
import { AppContext, formatters, navigate, useHashRoute } from './util.js';
import Catalogue from './pages/Catalogue.jsx';
import AssetPage from './pages/AssetPage.jsx';
import AuthPage from './pages/AuthPage.jsx';
import MyLoans from './pages/MyLoans.jsx';
import StaffPage from './pages/StaffPage.jsx';

function Header({ account, onLogout, route }) {
  const link = (href, label) => (
    <a href={`#${href}`} aria-current={route === href || route.startsWith(`${href}/`) ? 'page' : undefined}>{label}</a>
  );
  return (
    <header className="site-header">
      <div className="wrap header-inner">
        <a className="brand" href="#/">
          <span className="brand-mark" aria-hidden="true" />
          CampusGear
        </a>
        <nav aria-label="Main">
          {link('/', 'Catalogue')}
          {account?.role === 'student' && link('/my', 'My loans')}
          {account?.role === 'staff' && link('/desk', 'Desk')}
          {account ? (
            <button type="button" className="link-button" onClick={onLogout}>Sign out</button>
          ) : (
            link('/login', 'Sign in')
          )}
        </nav>
      </div>
    </header>
  );
}

function Page({ route }) {
  const [path, query = ''] = route.split('?');
  const parts = path.split('/').filter(Boolean);
  if (parts.length === 0) return <Catalogue query={new URLSearchParams(query)} />;
  if (parts[0] === 'assets' && parts[1]) return <AssetPage id={decodeURIComponent(parts[1])} />;
  if (parts[0] === 'login') return <AuthPage mode="login" />;
  if (parts[0] === 'register') return <AuthPage mode="register" />;
  if (parts[0] === 'my') return <MyLoans tab={parts[1] || 'active'} />;
  if (parts[0] === 'desk') return <StaffPage tab={parts[1] || 'queue'} />;
  return (
    <section className="wrap narrow">
      <h1>Page not found</h1>
      <p><a href="#/">Back to the catalogue</a></p>
    </section>
  );
}

export default function App() {
  const route = useHashRoute();
  const [account, setAccount] = useState(undefined);
  const [rules, setRules] = useState(null);
  const [bootError, setBootError] = useState(null);

  useEffect(() => {
    Promise.all([api('/auth/me'), api('/config')])
      .then(([me, cfg]) => {
        setAccount(me.account);
        setRules(cfg.rules);
      })
      .catch((e) => setBootError(e));
  }, []);

  const ctx = useMemo(() => (rules ? { account, setAccount, rules, fmt: formatters(rules.timeZone) } : null), [account, rules]);

  const logout = async () => {
    await api('/auth/logout', { method: 'POST' }).catch(() => {});
    setAccount(null);
    navigate('/');
  };

  if (bootError) {
    return <main className="wrap narrow"><h1>CampusGear is unavailable</h1><p role="alert">{bootError.message}</p></main>;
  }
  if (!ctx || account === undefined) return <main className="wrap narrow"><p className="muted">Loading…</p></main>;

  return (
    <AppContext.Provider value={ctx}>
      <a className="skip-link" href="#main" onClick={(e) => { e.preventDefault(); document.getElementById('main')?.focus(); }}>Skip to content</a>
      <Header account={account} onLogout={logout} route={route} />
      <main id="main" tabIndex={-1}>
        <Page route={route} />
      </main>
      <footer className="site-footer">
        <div className="wrap">
          CampusGear pilot · synthetic inventory and test accounts only · times shown in {rules.timeZone}
        </div>
      </footer>
    </AppContext.Provider>
  );
}
