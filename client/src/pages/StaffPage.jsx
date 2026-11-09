import { useState } from 'react';
import { api } from '../api.js';
import { relativeHours, STATUS_LABEL, useApp, useLoad } from '../util.js';
import { Tabs } from './MyLoans.jsx';

const TABS = [['queue', 'Pickup queue'], ['on-loan', 'On loan'], ['overdue', 'Overdue'], ['assets', 'Assets']];

function ReservationRow({ r, children }) {
  const { fmt } = useApp();
  const now = Date.now();
  return (
    <li className="card row-card">
      <div>
        <h3 className="card-title">{r.assetName} <span className="muted small">{r.assetId}</span></h3>
        <p className="small">{fmt.range(r.start, r.plannedEnd)} · {r.pickupLocation}</p>
        <p className="small muted">{r.student.name} · {r.student.email} · #{r.id}</p>
        {r.status === 'confirmed' && new Date(r.start) < now && <p className="small warn-text">Pickup time passed {relativeHours(now - new Date(r.start))} ago.</p>}
        {r.assetUnavailable && <p className="small warn-text">Asset is marked unavailable — contact the student and resolve this booking.</p>}
        {r.overdue && <p className="small error-text">Overdue by {relativeHours(now - new Date(r.plannedEnd))} (planned return {fmt.dateTime(r.plannedEnd)}).</p>}
      </div>
      <div className="row-side">
        <span className={`badge s-${r.status}`}>{STATUS_LABEL[r.status]}</span>
        {children}
      </div>
    </li>
  );
}

function ReservationList({ path, empty, actions }) {
  const { data, error, loading, reload } = useLoad(() => api(path), [path]);
  const [message, setMessage] = useState(null);
  const [busyId, setBusyId] = useState(null);

  const act = async (r, action) => {
    setBusyId(r.id);
    try {
      const res = await action.run(r);
      if (res) setMessage({ type: 'ok', text: action.done(res.reservation) });
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
      <div aria-live="polite">{message && <p className={`notice ${message.type}`}>{message.text}</p>}</div>
      {error && <p className="notice error" role="alert">{error.message}</p>}
      {loading && !data && <p className="muted">Loading…</p>}
      {data && list.length === 0 && <div className="empty"><p>{empty}</p></div>}
      <ul className="list">
        {list.map((r) => (
          <ReservationRow key={r.id} r={r}>
            {actions.filter((a) => !a.when || a.when(r)).map((a) => (
              <button key={a.label} type="button" className={`btn small-btn ${a.primary ? 'primary' : ''}`} disabled={busyId === r.id} onClick={() => act(r, a)}>
                {a.label}
              </button>
            ))}
          </ReservationRow>
        ))}
      </ul>
    </>
  );
}

const post = (path) => api(path, { method: 'POST' });
const checkout = { label: 'Check out', primary: true, when: (r) => !r.assetUnavailable, run: (r) => post(`/staff/reservations/${r.id}/checkout`), done: (r) => `${r.assetName} checked out to ${r.student.name}.` };
const cancelBooking = { label: 'Cancel booking', when: (r) => r.assetUnavailable, run: (r) => (window.confirm(`Cancel booking #${r.id} for ${r.student.name}?`) ? post(`/reservations/${r.id}/cancel`) : Promise.resolve(null)), done: (r) => `Booking #${r.id} cancelled.` };
const giveBack = { label: 'Record return', primary: true, run: (r) => post(`/staff/reservations/${r.id}/return`), done: (r) => `${r.assetName} returned${r.returnedLate ? ' late' : r.returnedEarly ? ' early — remaining time released' : ''}.` };

function AssetsTab() {
  const { fmt } = useApp();
  const { data, error, loading, reload } = useLoad(() => api('/staff/assets'), []);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ reason: '', publicNotice: '' });
  const [affected, setAffected] = useState(null);
  const [message, setMessage] = useState(null);

  const setStatus = async (asset, status) => {
    try {
      const res = await api(`/staff/assets/${encodeURIComponent(asset.id)}/status`, { method: 'POST', body: { status, ...form } });
      setMessage({ type: 'ok', text: `${asset.id} is now ${status}.${status === 'unavailable' && res.affected.length ? ` ${res.affected.length} existing booking(s) flagged below.` : ''}` });
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
      <div aria-live="polite">{message && <p className={`notice ${message.type}`}>{message.text}</p>}</div>
      {error && <p className="notice error" role="alert">{error.message}</p>}
      {loading && !data && <p className="muted">Loading…</p>}
      <ul className="list">
        {(data?.assets || []).map((a) => (
          <li key={a.id} className="card">
            <div className="row-card flat">
              <div>
                <h3 className="card-title">{a.name} <span className="muted small">{a.id}</span></h3>
                <p className="small muted">{a.pickupLocation} · condition: {a.condition}</p>
                {a.status === 'unavailable' && (
                  <p className="small">
                    <strong>Staff reason:</strong> {a.unavailableReason}<br />
                    <strong>Students see:</strong> {a.publicNotice}<br />
                    <span className="muted">Since {fmt.dateTime(a.statusChangedAt)} · {a.affectedCount} affected booking(s)</span>
                  </p>
                )}
              </div>
              <div className="row-side">
                <span className={`badge ${a.status === 'available' ? 'ok' : 'warn'}`}>{a.status === 'available' ? 'Available' : 'Unavailable'}</span>
                {a.status === 'available' ? (
                  <button type="button" className="btn small-btn" onClick={() => { setEditing(a.id); setForm({ reason: '', publicNotice: '' }); }}>Mark unavailable</button>
                ) : (
                  <>
                    <button type="button" className="btn small-btn" onClick={() => showAffected(a)}>Affected bookings</button>
                    <button type="button" className="btn small-btn primary" onClick={() => setStatus(a, 'available')}>Mark available</button>
                  </>
                )}
              </div>
            </div>
            {editing === a.id && (
              <form className="form inline-form" onSubmit={(e) => { e.preventDefault(); setStatus(a, 'unavailable'); }}>
                <label>Reason (staff only)
                  <input value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} required maxLength={500} />
                </label>
                <label>Notice for students (optional)
                  <input value={form.publicNotice} onChange={(e) => setForm({ ...form, publicNotice: e.target.value })} maxLength={200} placeholder="Temporarily unavailable for maintenance." />
                </label>
                <p className="small muted">New bookings will be blocked. Existing bookings stay and are flagged for follow-up.</p>
                <div className="actions">
                  <button type="submit" className="btn primary">Confirm</button>
                  <button type="button" className="btn" onClick={() => setEditing(null)}>Cancel</button>
                </div>
              </form>
            )}
            {affected?.assetId === a.id && (
              <div className="affected">
                <h4>Bookings affected on {a.id}</h4>
                {affected.list.length === 0 ? <p className="small muted">No confirmed bookings are affected.</p> : (
                  <ul className="small">
                    {affected.list.map((r) => <li key={r.id}>#{r.id} · {fmt.range(r.start, r.plannedEnd)} · {r.student.name} ({r.student.email})</li>)}
                  </ul>
                )}
                <p className="small muted">Resolve them from the pickup queue (cancel explicitly or wait for repair).</p>
              </div>
            )}
          </li>
        ))}
      </ul>
    </>
  );
}

export default function StaffPage({ tab }) {
  const { account } = useApp();
  if (account?.role !== 'staff') {
    return <section className="wrap narrow"><h1>Desk</h1><p>This area is for desk staff. <a href="#/login">Sign in</a> with a staff account.</p></section>;
  }
  return (
    <section className="wrap">
      <div className="page-head"><h1>Desk</h1><p className="muted">Pickup, return and exceptions.</p></div>
      <Tabs tab={tab} base="/desk" items={TABS} />
      {tab === 'queue' && <ReservationList key="q" path="/staff/queue" empty="No confirmed bookings waiting for pickup." actions={[checkout, cancelBooking]} />}
      {tab === 'on-loan' && <ReservationList key="l" path="/staff/on-loan" empty="Nothing is checked out right now." actions={[giveBack]} />}
      {tab === 'overdue' && <ReservationList key="o" path="/staff/overdue" empty="No overdue loans." actions={[giveBack]} />}
      {tab === 'assets' && <AssetsTab />}
    </section>
  );
}
