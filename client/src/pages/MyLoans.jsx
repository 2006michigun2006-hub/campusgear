import { useState } from 'react';
import { api } from '../api.js';
import { Notice, PageHeader, StatusTag, Tabs } from '../components.jsx';
import { useApp, useLoad } from '../util.js';

export default function MyLoans({ tab }) {
  const { account, fmt } = useApp();
  const history = tab === 'history';
  const { data, error, loading, reload } = useLoad(
    () => (account?.role === 'student' ? api(`/reservations/${history ? 'history' : 'mine'}`) : Promise.resolve(null)),
    [history, account],
  );
  const [message, setMessage] = useState(null);

  if (account?.role !== 'student') {
    return (
      <>
        <PageHeader crumbs={[['My loans']]} title="My loans" />
        <div className="container content"><p>Please <a href="#/login">sign in</a> with a student account to see your loans.</p></div>
      </>
    );
  }

  const cancel = async (r) => {
    if (!window.confirm(`Cancel your booking of ${r.assetName} (${fmt.range(r.start, r.plannedEnd)})?`)) return;
    try {
      await api(`/reservations/${r.id}/cancel`, { method: 'POST' });
      setMessage({ type: 'success', text: 'The booking has been cancelled and the time is free for other students.' });
    } catch (e) {
      setMessage({ type: 'error', text: e.message });
    }
    reload();
  };

  const list = data?.reservations || [];
  return (
    <>
      <PageHeader crumbs={[['My loans']]} title="My loans" />
      <div className="container content">
        <Tabs tab={history ? 'history' : 'active'} base="/my" items={[['active', 'Current bookings'], ['history', 'History']]} />
        <div aria-live="polite">{message && <Notice type={message.type}>{message.text}</Notice>}</div>
        {error && <Notice type="error" role="alert">{error.message}</Notice>}
        {loading && !data && <p>Loading…</p>}
        {data && list.length === 0 && (
          <div className="empty-state">
            <p>{history ? 'You have no returned or cancelled loans yet.' : 'You have no current bookings.'}</p>
            {!history && <p><a href="#/">Browse the equipment catalogue</a></p>}
          </div>
        )}
        {list.length > 0 && (
          <table className="data-table responsive">
            <thead>
              <tr>
                <th scope="col">Item</th><th scope="col">Pickup</th><th scope="col">Return by</th>
                <th scope="col">Pickup point</th><th scope="col">Status</th>{!history && <th scope="col"><span className="visually-hidden">Actions</span></th>}
              </tr>
            </thead>
            <tbody>
              {list.map((r) => (
                <tr key={r.id} className={r.overdue ? 'row-alert' : undefined}>
                  <td data-label="Item">
                    <a className="item-link" href={`#/assets/${encodeURIComponent(r.assetId)}`}>{r.assetName}</a>
                    <span className="item-id">Booking no. {r.id}</span>
                    {r.assetUnavailable && <span className="row-note warn">This item has been withdrawn ({r.assetNotice}). The desk will contact you; your booking is kept.</span>}
                    {r.overdue && <span className="row-note error">Overdue. Please return it to {r.pickupLocation}.</span>}
                  </td>
                  <td data-label="Pickup">{fmt.dateTime(r.start)}</td>
                  <td data-label="Return by">{fmt.dateTime(r.plannedEnd)}</td>
                  <td data-label="Pickup point">{r.pickupLocation}</td>
                  <td data-label="Status">
                    <StatusTag status={r.status} />
                    {r.status === 'returned' && <span className="row-note">{fmt.dateTime(r.returnedAt)}{r.returnedLate ? ', late' : r.returnedEarly ? ', early' : ''}</span>}
                    {r.status === 'cancelled' && r.cancelledAt && <span className="row-note">{fmt.dateTime(r.cancelledAt)}</span>}
                  </td>
                  {!history && (
                    <td className="actions-cell">
                      {r.status === 'confirmed' && <button type="button" className="btn btn-secondary btn-sm" onClick={() => cancel(r)}>Cancel booking</button>}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
