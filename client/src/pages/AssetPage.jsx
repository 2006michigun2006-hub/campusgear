import { useMemo, useRef, useState } from 'react';
import { validateInterval } from '../../../shared/rules.js';
import { addDaysToKey, campusDateKey, parseKey, weekdayOfKey, zonedToUtc } from '../../../shared/time.js';
import { api } from '../api.js';
import { useApp, useLoad } from '../util.js';

const HOUR = 3600000;

function buildDays(rules) {
  const today = campusDateKey(new Date(), rules.timeZone);
  const days = [];
  for (let i = rules.minLeadDays; i <= rules.maxLeadDays; i++) {
    const key = addDaysToKey(today, i);
    if (rules.weekdaysOnly && weekdayOfKey(key) > 5) continue;
    const cells = [];
    for (let h = rules.openHour; h < rules.closeHour; h++) {
      const start = zonedToUtc({ ...parseKey(key), hour: h }, rules.timeZone).getTime();
      cells.push({ key: `${key}T${h}`, hour: h, start, end: start + HOUR });
    }
    days.push({ key, cells });
  }
  return days;
}

const overlaps = (aStart, aEnd, busy) => busy.some((b) => aStart < b.end && b.start < aEnd);
const newKey = () => (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`);

export default function AssetPage({ id }) {
  const { account, rules, fmt } = useApp();
  const { data, error, loading, reload } = useLoad(() => api(`/assets/${encodeURIComponent(id)}`), [id]);
  const [sel, setSel] = useState(null); // {start, end, picking: 'end' | null}
  const [result, setResult] = useState(null); // {type: 'ok'|'error', message}
  const [submitting, setSubmitting] = useState(false);
  const idemKey = useRef(null);
  const statusRef = useRef(null);

  const days = useMemo(() => buildDays(rules), [rules]);
  const busy = useMemo(
    () => (data?.busy || []).map((b) => ({ start: new Date(b.start).getTime(), end: new Date(b.end).getTime() })),
    [data],
  );

  const pick = (cell) => {
    setResult(null);
    idemKey.current = newKey(); // a new selection is a new request
    if (sel?.picking === 'end' && cell.start >= sel.start) {
      setSel({ start: sel.start, end: cell.end, picking: null });
    } else {
      setSel({ start: cell.start, end: cell.end, picking: 'end' });
    }
  };

  const problems = useMemo(() => {
    if (!sel) return [];
    const list = validateInterval(new Date(sel.start), new Date(sel.end), new Date(), rules);
    if (overlaps(sel.start, sel.end, busy)) list.unshift('The selected period includes time that is already booked.');
    return list;
  }, [sel, busy, rules]);

  const announce = (r) => {
    setResult(r);
    setTimeout(() => statusRef.current?.focus(), 0);
  };

  const reserve = async () => {
    if (!sel || problems.length) return;
    setSubmitting(true);
    try {
      const body = { assetId: id, start: new Date(sel.start).toISOString(), end: new Date(sel.end).toISOString(), idempotencyKey: idemKey.current };
      await api('/reservations', { method: 'POST', body });
      announce({ type: 'ok', message: `Reserved ${fmt.range(sel.start, sel.end)}.` });
      setSel(null);
      idemKey.current = null;
      reload();
    } catch (e) {
      if (e.code === 'SLOT_TAKEN') {
        // US-11: refresh availability, keep the asset, ask for another time.
        setSel(null);
        idemKey.current = null;
        await reload();
        announce({ type: 'error', message: `${e.message} Availability has been refreshed.` });
      } else if (e.code === 'NETWORK') {
        announce({ type: 'error', message: `${e.message} Retrying is safe — it will not create a duplicate booking.` });
      } else {
        announce({ type: 'error', message: e.message });
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (error) {
    return <section className="wrap narrow"><p className="notice error" role="alert">{error.status === 404 ? 'This asset does not exist.' : error.message}</p><a href="#/">Back to catalogue</a></section>;
  }
  if (loading && !data) return <section className="wrap"><p className="muted">Loading…</p></section>;
  const { asset } = data;
  const bookable = asset.status === 'available';
  const inSel = (c) => sel && c.start >= sel.start && c.end <= sel.end;
  const hours = sel ? Math.round((sel.end - sel.start) / HOUR) : 0;

  return (
    <section className="wrap">
      <p className="crumbs"><a href="#/">Catalogue</a> / {asset.id}</p>
      <div className="asset-layout">
        <div>
          <h1>{asset.name}</h1>
          <p className="muted">{asset.description}</p>
          <dl className="meta wide">
            <div><dt>Asset ID</dt><dd>{asset.id}</dd></div>
            <div><dt>Type</dt><dd>{asset.type}</dd></div>
            <div><dt>Condition</dt><dd>{asset.condition}</dd></div>
            <div><dt>Pickup point</dt><dd>{asset.pickupLocation}</dd></div>
          </dl>
          {!bookable && <p className="notice warn" role="status"><strong>Not bookable right now.</strong> {asset.publicNotice}</p>}

          <h2 className="section-title">Availability</h2>
          <p className="small muted">
            Times in {rules.timeZone}. Choose a pickup hour, then the hour you will return it by.
            Weekdays {rules.openHour}:00–{rules.closeHour}:00, {rules.minLeadDays}–{rules.maxLeadDays} days ahead, {rules.minHours}–{rules.maxHours} hours.
          </p>
          <div className="legend small" aria-hidden="true">
            <span><i className="sw free" />Free</span><span><i className="sw busy" />Booked</span><span><i className="sw sel" />Your selection</span>
          </div>
          <div className="avail" role="grid" aria-label="Availability by day and hour" style={{ "--cols": rules.closeHour - rules.openHour }}>
            <div className="avail-row head" role="row">
              <span role="columnheader" className="day-label">Day</span>
              {days[0]?.cells.map((c) => <span role="columnheader" key={c.hour}>{c.hour}</span>)}
            </div>
            {days.map((d) => (
              <div className="avail-row" role="row" key={d.key}>
                <span role="rowheader" className="day-label">{fmt.day(d.cells[0].start)}</span>
                {d.cells.map((c) => {
                  const isBusy = overlaps(c.start, c.end, busy);
                  const selected = inSel(c);
                  return (
                    <span role="gridcell" key={c.key}>
                      <button
                        type="button"
                        className={`cell ${isBusy ? 'busy' : 'free'} ${selected ? 'sel' : ''}`}
                        disabled={isBusy || !bookable}
                        aria-pressed={selected || undefined}
                        aria-label={`${fmt.day(c.start)} ${c.hour}:00 to ${c.hour + 1}:00, ${isBusy ? 'booked' : 'free'}`}
                        onClick={() => pick(c)}
                      />
                    </span>
                  );
                })}
              </div>
            ))}
          </div>
        </div>

        <aside className="card booking-panel" aria-labelledby="booking-title">
          <h2 id="booking-title" className="card-title">Your booking</h2>
          {!sel && <p className="muted small">No period selected yet.</p>}
          {sel && (
            <>
              <p><strong>{fmt.range(sel.start, sel.end)}</strong><br /><span className="muted small">{hours} hour{hours === 1 ? '' : 's'}{sel.picking === 'end' ? ' · click a later hour to extend' : ''}</span></p>
              {problems.length > 0 && <ul className="problems small">{problems.map((p) => <li key={p}>{p}</li>)}</ul>}
            </>
          )}
          {account?.role === 'student' ? (
            <div className="actions">
              <button type="button" className="btn primary" disabled={!sel || problems.length > 0 || submitting || !bookable} onClick={reserve}>
                {submitting ? 'Reserving…' : 'Reserve'}
              </button>
              {sel && <button type="button" className="btn" onClick={() => { setSel(null); setResult(null); }}>Clear</button>}
            </div>
          ) : account?.role === 'staff' ? (
            <p className="small muted">Signed in as desk staff. Students make reservations.</p>
          ) : (
            <p className="small"><a href="#/login">Sign in</a> or <a href="#/register">create a student account</a> to reserve.</p>
          )}
          <div ref={statusRef} tabIndex={-1} aria-live="polite">
            {result && (
              <p className={`notice ${result.type === 'ok' ? 'ok' : 'error'}`}>
                {result.message} {result.type === 'ok' && <a href="#/my">See my loans</a>}
              </p>
            )}
          </div>
        </aside>
      </div>
    </section>
  );
}
