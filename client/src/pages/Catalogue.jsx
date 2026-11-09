import { api } from '../api.js';
import { navigate, useLoad } from '../util.js';

const TYPE_LABEL = { laptop: 'Laptops', projector: 'Projectors' };
const label = (t) => TYPE_LABEL[t] || t.charAt(0).toUpperCase() + t.slice(1);

export default function Catalogue({ query }) {
  const type = query.get('type') || '';
  const { data, error, loading } = useLoad(() => api(`/assets${type ? `?type=${encodeURIComponent(type)}` : ''}`), [type]);
  const setType = (t) => navigate(t ? `/?type=${encodeURIComponent(t)}` : '/');

  return (
    <section className="wrap">
      <div className="page-head">
        <h1>Borrow equipment</h1>
        <p className="muted">Browse campus laptops and projectors, check when they are free and reserve a pickup slot.</p>
      </div>

      <div className="filters" role="group" aria-label="Filter by type">
        <button type="button" className="chip" aria-pressed={!type} onClick={() => setType('')}>All</button>
        {(data?.types || []).map((t) => (
          <button key={t} type="button" className="chip" aria-pressed={type === t} onClick={() => setType(t)}>{label(t)}</button>
        ))}
        {type && <button type="button" className="link-button" onClick={() => setType('')}>Clear filter</button>}
      </div>

      {error && <p className="notice error" role="alert">{error.message}</p>}
      {loading && !data && <p className="muted">Loading equipment…</p>}
      {data && (
        <>
          <p className="muted small" aria-live="polite">{data.assets.length} item{data.assets.length === 1 ? '' : 's'}{type ? ` in ${label(type).toLowerCase()}` : ''}</p>
          {data.assets.length === 0 ? (
            <div className="empty">
              <p>No equipment matches this filter.</p>
              <button type="button" className="btn" onClick={() => setType('')}>Show all equipment</button>
            </div>
          ) : (
            <ul className="grid-cards">
              {data.assets.map((a) => (
                <li key={a.id} className="card asset-card">
                  <div className="asset-top">
                    <span className={`type-icon ${a.type}`} aria-hidden="true" />
                    <span className={`badge ${a.status === 'available' ? 'ok' : 'warn'}`}>{a.status === 'available' ? 'Bookable' : 'Unavailable'}</span>
                  </div>
                  <h2 className="card-title"><a href={`#/assets/${encodeURIComponent(a.id)}`}>{a.name}</a></h2>
                  <dl className="meta">
                    <div><dt>ID</dt><dd>{a.id}</dd></div>
                    <div><dt>Condition</dt><dd>{a.condition}</dd></div>
                    <div><dt>Pickup</dt><dd>{a.pickupLocation}</dd></div>
                  </dl>
                  {a.publicNotice && <p className="small warn-text">{a.publicNotice}</p>}
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </section>
  );
}
