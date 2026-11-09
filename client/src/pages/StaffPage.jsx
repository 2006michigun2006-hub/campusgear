import { Fragment, useState } from 'react';
import { api } from '../api.js';
import { Notice, PageHeader, StatusTag, Tabs } from '../components.jsx';
import { relativeHours, useApp, useLoad } from '../util.js';

const TABS = [['queue', 'Pickup queue'], ['on-loan', 'On loan'], ['overdue', 'Overdue'], ['assets', 'Inventory']];

function notes(r, fmt) {
  const now = Date.now();
  const out = [];
  if (r.status === 'confirmed' && new Date(r.start) < now) out.push(['warn', `Pickup time passed ${relativeHours(now - new Date(r.start))} ago.`]);
  if (r.assetUnavailable) out.push(['warn', 'Item withdrawn. Contact the student and resolve this booking.']);
  if (r.overdue) out.push(['error', `Overdue by ${relativeHours(now - new Date(r.plannedEnd))} (due ${fmt.dateTime(r.plannedEnd)}).`]);
  return out;
}

function ReservationTable({ path, empty, actions }) {
  const { fmt } = useApp();
  const { data, error, loading, reload } = useLoad(() => api(path), [path]);
  const [message, setMessage] = useState(null);
  const [busyId, setBusyId] = useState(null);

  const act = async (r, action) => {
    setBusyId(r.id);
    try {
      const res = await action.run(r);
      if (res) setMessage({ type: 'success', text: action.done(res.reservation) });
    } catch (e) {
      setMessage({ type: 'error', text: e.message });
    } finally {
      setBusyId(null);
      reload();
    }
  };

  const list = data?.reservations || [];
  return (
    <>
      <div aria-live="polite">{message && <Notice type={message.type}>{message.text}</Notice>}</div>
      {error && <Notice type="error" role="alert">{error.message}</Notice>}
      {loading && !data && <p>Loading…</p>}
      {data && list.length === 0 && <div className="empty-state"><p>{empty}</p></div>}
      {list.length > 0 && (
        <table className="data-table responsive">
          <thead>
            <tr>
              <th scope="col">No.</th><th scope="col">Item</th><th scope="col">Borrower</th>
              <th scope="col">Pickup</th><th scope="col">Return by</th><th scope="col">Status</th>
              <th scope="col"><span className="visually-hidden">Actions</span></th>
            </tr>
          </thead>
          <tbody>
            {list.map((r) => {
              const rowNotes = notes(r, fmt);
              return (
                <tr key={r.id} className={r.overdue ? 'row-alert' : undefined}>
                  <td data-label="No.">{r.id}</td>
                  <td data-label="Item">
                    {r.assetName}
                    <span className="item-id">{r.assetId} · {r.pickupLocation}</span>
                    {rowNotes.map(([kind, text]) => <span key={text} className={`row-note ${kind}`}>{text}</span>)}
                  </td>
                  <td data-label="Borrower">{r.student.name}<span className="item-id">{r.student.email}</span></td>
                  <td data-label="Pickup">{fmt.dateTime(r.start)}</td>
                  <td data-label="Return by">{fmt.dateTime(r.plannedEnd)}</td>
                  <td data-label="Status"><StatusTag status={r.status} /></td>
                  <td className="actions-cell">
                    {actions.filter((a) => !a.when || a.when(r)).map((a) => (
                      <button key={a.label} type="button" className={`btn btn-sm ${a.primary ? 'btn-primary' : 'btn-secondary'}`} disabled={busyId === r.id} onClick={() => act(r, a)}>
                        {a.label}
                      </button>
                    ))}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </>
  );
}

const post = (path) => api(path, { method: 'POST' });
const checkout = { label: 'Hand over', primary: true, when: (r) => !r.assetUnavailable, run: (r) => post(`/staff/reservations/${r.id}/checkout`), done: (r) => `${r.assetName} handed over to ${r.student.name}.` };
const cancelBooking = { label: 'Cancel booking', when: (r) => r.assetUnavailable, run: (r) => (window.confirm(`Cancel booking no. ${r.id} for ${r.student.name}?`) ? post(`/reservations/${r.id}/cancel`) : Promise.resolve(null)), done: (r) => `Booking no. ${r.id} cancelled.` };
const giveBack = { label: 'Record return', primary: true, run: (r) => post(`/staff/reservations/${r.id}/return`), done: (r) => `${r.assetName} returned${r.returnedLate ? ' late' : r.returnedEarly ? ' early; the remaining time is released' : ''}.` };

function InventoryTab() {
  const { fmt } = useApp();
  const { data, error, loading, reload } = useLoad(() => api('/staff/assets'), []);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ reason: '', publicNotice: '' });
  const [affected, setAffected] = useState(null);
  const [message, setMessage] = useState(null);

  const setStatus = async (asset, status) => {
    try {
      const res = await api(`/staff/assets/${encodeURIComponent(asset.id)}/status`, { method: 'POST', body: { status, ...form } });
      setMessage({ type: 'success', text: `${asset.id} is now ${status === 'available' ? 'available' : 'withdrawn'}.${status === 'unavailable' && res.affected.length ? ` ${res.affected.length} existing booking(s) are listed below.` : ''}` });
      setAffected(status === 'unavailable' ? { assetId: asset.id, list: res.affected } : null);
      setEditing(null);
      setForm({ reason: '', publicNotice: '' });
      reload();
    } catch (e) {
      setMessage({ type: 'error', text: e.message });
    }
  };

  const showAffected = async (asset) => {
    const res = await api(`/staff/assets/${encodeURIComponent(asset.id)}/affected`);
    setAffected({ assetId: asset.id, list: res.reservations });
  };

  return (
    <>
      <div aria-live="polite">{message && <Notice type={message.type}>{message.text}</Notice>}</div>
      {error && <Notice type="error" role="alert">{error.message}</Notice>}
      {loading && !data && <p>Loading…</p>}
      {data && (
        <table className="data-table responsive">
          <thead>
            <tr><th scope="col">Inventory no.</th><th scope="col">Item</th><th scope="col">Status</th><th scope="col">Staff note</th><th scope="col"><span className="visually-hidden">Actions</span></th></tr>
          </thead>
          <tbody>
            {data.assets.map((a) => (
              <Fragment key={a.id}>
                <tr>
                  <td data-label="Inventory no.">{a.id}</td>
                  <td data-label="Item">{a.name}<span className="item-id">{a.pickupLocation} · {a.condition}</span></td>
                  <td data-label="Status">{a.status === 'available' ? <span className="status-text ok">Available</span> : <span className="status-text warn">Withdrawn</span>}</td>
                  <td data-label="Staff note">
                    {a.status === 'unavailable' ? (
                      <>
                        {a.unavailableReason}
                        <span className="item-id">Students see: “{a.publicNotice}”</span>
                        <span className="item-id">Since {fmt.dateTime(a.statusChangedAt)}; {a.affectedCount} affected booking(s)</span>
                      </>
                    ) : '—'}
                  </td>
                  <td className="actions-cell">
                    {a.status === 'available' ? (
                      <button type="button" className="btn btn-secondary btn-sm" onClick={() => { setEditing(a.id); setForm({ reason: '', publicNotice: '' }); }}>Withdraw</button>
                    ) : (
                      <>
                        <button type="button" className="btn btn-secondary btn-sm" onClick={() => showAffected(a)}>Affected bookings</button>
                        <button type="button" className="btn btn-primary btn-sm" onClick={() => setStatus(a, 'available')}>Return to service</button>
                      </>
                    )}
                  </td>
                </tr>
                {editing === a.id && (
                  <tr className="sub-row">
                    <td colSpan={5}>
                      <form className="form inline-form" onSubmit={(e) => { e.preventDefault(); setStatus(a, 'unavailable'); }}>
                        <div className="field">
                          <label htmlFor={`reason-${a.id}`}>Reason (visible to staff only)</label>
                          <input id={`reason-${a.id}`} value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} required maxLength={500} />
                        </div>
                        <div className="field">
                          <label htmlFor={`notice-${a.id}`}>Notice for students (optional)</label>
                          <input id={`notice-${a.id}`} value={form.publicNotice} onChange={(e) => setForm({ ...form, publicNotice: e.target.value })} maxLength={200} placeholder="Temporarily unavailable for maintenance." />
                        </div>
                        <p className="hint">New bookings will be closed. Existing bookings are kept and flagged for follow-up.</p>
                        <div className="button-row">
                          <button type="submit" className="btn btn-primary">Withdraw item</button>
                          <button type="button" className="btn btn-secondary" onClick={() => setEditing(null)}>Cancel</button>
                        </div>
                      </form>
                    </td>
                  </tr>
                )}
                {affected?.assetId === a.id && (
                  <tr className="sub-row">
                    <td colSpan={5}>
                      <strong>Bookings affected on {a.id}</strong>
                      {affected.list.length === 0 ? <p className="hint">No confirmed bookings are affected.</p> : (
                        <ul className="plain-list">
                          {affected.list.map((r) => <li key={r.id}>No. {r.id}: {fmt.range(r.start, r.plannedEnd)}, {r.student.name} ({r.student.email})</li>)}
                        </ul>
                      )}
                      <p className="hint">Resolve them in the pickup queue: cancel the booking, or keep it if the item is repaired in time.</p>
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
          </tbody>
        </table>
      )}
    </>
  );
}

export default function StaffPage({ tab }) {
  const { account } = useApp();
  if (account?.role !== 'staff') {
    return (
      <>
        <PageHeader crumbs={[['Loan desk']]} title="Loan desk" />
        <div className="container content"><p>This section is for desk staff. Please <a href="#/login">sign in</a> with a staff account.</p></div>
      </>
    );
  }
  return (
    <>
      <PageHeader crumbs={[['Loan desk']]} title="Loan desk" />
      <div className="container content">
        <Tabs tab={tab} base="/desk" items={TABS} />
        {tab === 'queue' && <ReservationTable key="q" path="/staff/queue" empty="There are no confirmed bookings waiting for pickup." actions={[checkout, cancelBooking]} />}
        {tab === 'on-loan' && <ReservationTable key="l" path="/staff/on-loan" empty="No items are on loan at the moment." actions={[giveBack]} />}
        {tab === 'overdue' && <ReservationTable key="o" path="/staff/overdue" empty="There are no overdue loans." actions={[giveBack]} />}
        {tab === 'assets' && <InventoryTab />}
      </div>
    </>
  );
}
