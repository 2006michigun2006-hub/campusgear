import { useMemo, useRef, useState } from 'react';
import { validateInterval } from '../../../shared/rules.js';
import { addDaysToKey, campusDateKey, parseKey, weekdayOfKey, zonedToUtc } from '../../../shared/time.js';
import { api } from '../api.js';
import { Box, Notice, PageHeader } from '../components.jsx';
import { useApp, useLoad } from '../util.js';

const HOUR = 3600000;
const pad = (h) => `${String(h).padStart(2, '0')}:00`;

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
  const [result, setResult] = useState(null);
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
      announce({ type: 'success', message: `Your reservation for ${fmt.range(sel.start, sel.end)} is confirmed.` });
      setSel(null);
      idemKey.current = null;
      reload();
    } catch (e) {
      if (e.code === 'SLOT_TAKEN') {
        // US-11: refresh availability, keep the item, ask for another time.
        setSel(null);
        idemKey.current = null;
        await reload();
        announce({ type: 'error', message: `${e.message} The timetable has been updated.` });
      } else if (e.code === 'NETWORK') {
        announce({ type: 'error', message: `${e.message} You can press Reserve again; it will not create a second booking.` });
      } else {
        announce({ type: 'error', message: e.message });
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (error) {
    return (
      <>
        <PageHeader crumbs={[['Catalogue', '#/'], [id]]} title="Item not found" />
        <div className="container content"><Notice type="error" role="alert">{error.status === 404 ? 'There is no item with this inventory number.' : error.message}</Notice><p><a href="#/">Back to the catalogue</a></p></div>
      </>
    );
  }
  if (loading && !data) return <div className="container content"><p>Loading…</p></div>;

  const { asset } = data;
  const bookable = asset.status === 'available';
  const inSel = (c) => sel && c.start >= sel.start && c.end <= sel.end;
  const hours = sel ? Math.round((sel.end - sel.start) / HOUR) : 0;

  return (
    <>
      <PageHeader crumbs={[['Catalogue', '#/'], [asset.id]]} title={asset.name} />
      <div className="container content with-aside">
        <div>
          <table className="details-table">
            <tbody>
              <tr><th scope="row">Inventory no.</th><td>{asset.id}</td></tr>
              <tr><th scope="row">Category</th><td>{asset.type.charAt(0).toUpperCase() + asset.type.slice(1)}</td></tr>
              <tr><th scope="row">Condition</th><td>{asset.condition}</td></tr>
              <tr><th scope="row">Pickup point</th><td>{asset.pickupLocation}</td></tr>
              <tr><th scope="row">Specification</th><td>{asset.description}</td></tr>
            </tbody>
          </table>
          {!bookable && <Notice type="warning" role="status"><strong>This item is withdrawn from booking.</strong> {asset.publicNotice}</Notice>}

          <h2 className="section-heading">Timetable</h2>
          <p className="hint">
            Select the pickup hour, then the last hour of your loan. Grey cells are already booked.
            All times are {rules.timeZone} time.
          </p>
          <div className="table-scroll">
            <table className="timetable" style={{ '--cols': rules.closeHour - rules.openHour }}>
              <caption className="visually-hidden">Availability of {asset.name} by day and hour</caption>
              <thead>
                <tr>
                  <th scope="col">Date</th>
                  {days[0]?.cells.map((c) => <th scope="col" key={c.hour}>{pad(c.hour)}</th>)}
                </tr>
              </thead>
              <tbody>
                {days.map((d) => (
                  <tr key={d.key}>
                    <th scope="row">{fmt.day(d.cells[0].start)}</th>
                    {d.cells.map((c) => {
                      const isBusy = overlaps(c.start, c.end, busy);
                      const selected = inSel(c);
                      return (
                        <td key={c.key} className={isBusy ? 'busy' : selected ? 'selected' : 'free'}>
                          <button
                            type="button"
                            disabled={isBusy || !bookable}
                            aria-pressed={selected || undefined}
                            aria-label={`${fmt.day(c.start)}, ${pad(c.hour)} to ${pad(c.hour + 1)}, ${isBusy ? 'booked' : 'free'}`}
                            onClick={() => pick(c)}
                          />
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <ul className="legend" aria-hidden="true">
            <li><span className="key free" /> Free</li>
            <li><span className="key busy" /> Booked</li>
            <li><span className="key selected" /> Your selection</li>
          </ul>
        </div>

        <aside>
          <Box title="Reservation" id="reservation-title">
            {!sel && <p className="hint">No time selected.</p>}
            {sel && (
              <dl className="summary">
                <dt>Pickup</dt><dd>{fmt.dateTime(sel.start)}</dd>
                <dt>Return by</dt><dd>{fmt.dateTime(sel.end)}</dd>
                <dt>Duration</dt><dd>{hours} hour{hours === 1 ? '' : 's'}</dd>
                <dt>Pickup point</dt><dd>{asset.pickupLocation}</dd>
              </dl>
            )}
            {sel?.picking === 'end' && problems.length === 0 && <p className="hint">Select a later hour to extend the loan.</p>}
            {problems.length > 0 && <ul className="error-list">{problems.map((p) => <li key={p}>{p}</li>)}</ul>}

            {account?.role === 'student' ? (
              <div className="button-row">
                <button type="button" className="btn btn-primary" disabled={!sel || problems.length > 0 || submitting || !bookable} onClick={reserve}>
                  {submitting ? 'Sending…' : 'Reserve'}
                </button>
                {sel && <button type="button" className="btn btn-secondary" onClick={() => { setSel(null); setResult(null); }}>Clear</button>}
              </div>
            ) : account?.role === 'staff' ? (
              <p className="hint">Reservations are made by students.</p>
            ) : (
              <p><a href="#/login">Sign in</a> or <a href="#/register">register</a> to reserve this item.</p>
            )}
            <div ref={statusRef} tabIndex={-1} aria-live="polite">
              {result && (
                <Notice type={result.type}>
                  {result.message} {result.type === 'success' && <a href="#/my">View my loans</a>}
                </Notice>
              )}
            </div>
          </Box>
        </aside>
      </div>
    </>
  );
}
