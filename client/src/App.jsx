import { useEffect, useMemo, useState } from 'react';
import { api } from './api.js';
import { PageHeader, UNIVERSITY_URL } from './components.jsx';
import { AppContext, formatters, navigate, useHashRoute } from './util.js';
import Catalogue from './pages/Catalogue.jsx';
import AssetPage from './pages/AssetPage.jsx';
import AuthPage from './pages/AuthPage.jsx';
import MyLoans from './pages/MyLoans.jsx';
import RulesPage from './pages/RulesPage.jsx';
import StaffPage from './pages/StaffPage.jsx';

function UtilityBar() {
  return (
    <div className="utility-bar">
      <div className="container utility-inner">
        <span>Student pilot project · not an official AITU service</span>
        <ul>
          <li><a href={UNIVERSITY_URL}>astanait.edu.kz</a></li>
          <li><a href="#/rules">Help</a></li>
          <li><span className="lang" title="English only during the pilot">EN</span></li>
        </ul>
      </div>
    </div>
  );
}

function SiteHeader({ account, onLogout }) {
  return (
    <header className="site-header">
      <div className="container header-inner">
        <a className="identity" href="#/">
          <img src="/aitu-logo.svg" alt="Astana IT University" className="logo" width="105" height="46" />
          <span className="identity-text">
            <span className="service-name">Equipment Loan Service</span>
            <span className="service-sub">Library &amp; IT Help Desk</span>
          </span>
        </a>
        <div className="account-area">
          {account ? (
            <>
              <span className="account-name">{account.name}<span className="account-role">{account.role === 'staff' ? 'Desk staff' : 'Student'}</span></span>
              <button type="button" className="btn btn-secondary btn-sm" onClick={onLogout}>Sign out</button>
            </>
          ) : (
            <>
              <a className="btn btn-primary btn-sm" href="#/login">Sign in</a>
              <a className="register-link" href="#/register">Register</a>
            </>
          )}
        </div>
      </div>
    </header>
  );
}

function MainNav({ account, route }) {
  const section = route.split('?')[0].split('/')[1] || '';
  const items = [
    ['', 'Catalogue', true],
    ['my', 'My loans', account?.role === 'student'],
    ['desk', 'Loan desk', account?.role === 'staff'],
    ['rules', 'Loan rules', true],
  ];
  const current = section === 'assets' ? '' : section;
  return (
    <nav className="main-nav" aria-label="Main">
      <div className="container">
        <ul>
          {items.filter(([, , show]) => show).map(([key, label]) => (
            <li key={key}><a href={`#/${key}`} aria-current={current === key ? 'page' : undefined}>{label}</a></li>
          ))}
        </ul>
      </div>
    </nav>
  );
}

function SiteFooter({ rules }) {
  return (
    <footer className="site-footer">
      <div className="container footer-grid">
        <div>
          <img src="/aitu-logo-white.svg" alt="Astana IT University" width="96" height="51" />
          <p className="footer-address">Astana IT University<br />55/1 Mangilik El Avenue, EXPO Business Center, Block C1<br />Astana, 010000</p>
        </div>
        <div>
          <h2>Service</h2>
          <ul>
            <li><a href="#/">Equipment catalogue</a></li>
            <li><a href="#/rules">Loan rules</a></li>
            <li><a href="#/login">Sign in</a></li>
          </ul>
        </div>
        <div>
          <h2>Pickup points</h2>
          <ul>
            <li>Library desk, ground floor</li>
            <li>IT help desk, block C</li>
            <li>Mon–Fri, {rules.openHour}:00–{rules.closeHour}:00</li>
          </ul>
        </div>
        <div>
          <h2>University</h2>
          <ul>
            <li><a href={UNIVERSITY_URL}>astanait.edu.kz</a></li>
          </ul>
        </div>
      </div>
      <div className="footer-bottom">
        <div className="container">
          © 2026 Astana IT University. CampusGear pilot by team Barcelona (SE-2420), Project Management course. Test data only.
        </div>
      </div>
    </footer>
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
  if (parts[0] === 'rules') return <RulesPage />;
  return (
    <>
      <PageHeader crumbs={[['Page not found']]} title="Page not found" />
      <div className="container content"><p>The page you requested does not exist. <a href="#/">Go to the equipment catalogue</a>.</p></div>
    </>
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
    return <div className="container content"><h1>The service is temporarily unavailable</h1><p role="alert">{bootError.message}</p></div>;
  }
  if (!ctx || account === undefined) return <div className="container content"><p>Loading…</p></div>;

  return (
    <AppContext.Provider value={ctx}>
      <a className="skip-link" href="#main" onClick={(e) => { e.preventDefault(); document.getElementById('main')?.focus(); }}>Skip to main content</a>
      <UtilityBar />
      <SiteHeader account={account} onLogout={logout} />
      <MainNav account={account} route={route} />
      <main id="main" tabIndex={-1}>
        <Page route={route} />
      </main>
      <SiteFooter rules={rules} />
    </AppContext.Provider>
  );
}
