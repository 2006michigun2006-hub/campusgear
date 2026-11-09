import { useState } from 'react';
import { api } from '../api.js';
import { STATUS_LABEL, useApp, useLoad } from '../util.js';

function Tabs({ tab, items, base }) {
  return (
    <nav className="tabs" aria-label="Sections">
      {items.map(([key, label]) => (
        <a key={key} href={`#${base}/${key}`} aria-current={tab === key ? 'page' : undefined}>{label}</a>
      ))}
    </nav>
  );
}

export { Tabs };

export default function MyLoans({ tab }) {
  const { account, fmt } = useApp();
  const history = tab === 'history';
  const { data, error, loading, reload } = useLoad(
    () => (account?.role === 'student' ? api(`/reservations/${history ? 'history' : 'mine'}`) : Promise.resolve(null)),
    [history, account],
  );
  const [message, setMessage] = useState(null);

  if (account?.role !== 'student') {
    return <section className="wrap narrow"><h1>My loans</h1><p><a href="#/login">Sign in</a> with a student account to see your loans.</p></section>;
  }

  const cancel = async (r) => {
    if (!window.confirm(`Cancel your booking of ${r.assetName} (${fmt.range(r.start, r.plannedEnd)})?`)) return;
    try {
      await api(`/reservations/${r.id}/cancel`, { method: 'POST' });
      setMessage({ type: 'ok', text: 'Booking cancelled. The time is open for other students again.' });
    } catch (e) {
      setMessage({ type: 'error', text: e.message });
    }
    reload();
  };

  const list = data?.reservations || [];
  return (
    <section className="wrap">
      <div className="page-head"><h1>My loans</h1></div>
      <Tabs tab={history ? 'history' : 'active'} base="/my" items={[['active', 'Active'], ['history', 'History']]} />
      <div aria-live="polite">{message && <p className={`notice ${message.type}`}>{message.text}</p>}</div>
      {error && <p className="notice error" role="alert">{error.message}</p>}
      {loading && !data && <p className="muted">Loading…</p>}
      {data && list.length === 0 && (
        <div className="empty">
          <p>{history ? 'No returned or cancelled loans yet.' : 'You have no active bookings.'}</p>
          {!history && <a className="btn" href="#/">Browse equipment</a>}
        </div>
      )}
      <ul className="list">
        {list.map((r) => (
          <li key={r.id} className="card row-card">
            <div>
              <h2 className="card-title"><a href={`#/assets/${encodeURIComponent(r.assetId)}`}>{r.assetName}</a></h2>
              <p className="small">{fmt.range(r.start, r.plannedEnd)} · {r.pickupLocation}</p>
              {r.assetUnavailable && <p className="small warn-text">This asset was marked unavailable: {r.assetNotice}. The desk will contact you; your booking has not been deleted.</p>}
              {r.overdue && <p className="small error-text">Overdue — please return it to {r.pickupLocation}.</p>}
              {r.status === 'returned' && <p className="small muted">Returned {fmt.dateTime(r.returnedAt)}{r.returnedLate ? ' (late)' : r.returnedEarly ? ' (early)' : ''}</p>}
              {r.status === 'cancelled' && r.cancelledAt && <p className="small muted">Cancelled {fmt.dateTime(r.cancelledAt)}</p>}
            </div>
            <div className="row-side">
              <span className={`badge s-${r.status}`}>{STATUS_LABEL[r.status]}</span>
              {r.status === 'confirmed' && <button type="button" className="btn small-btn" onClick={() => cancel(r)}>Cancel</button>}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
