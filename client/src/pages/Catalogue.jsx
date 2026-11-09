import { api } from '../api.js';
import { Notice, PageHeader } from '../components.jsx';
import { useApp, useLoad } from '../util.js';

const TYPE_LABEL = { laptop: 'Laptops', projector: 'Projectors' };
const label = (t) => TYPE_LABEL[t] || t.charAt(0).toUpperCase() + t.slice(1);

export default function Catalogue({ query }) {
  const { rules } = useApp();
  const type = query.get('type') || '';
  const { data, error, loading } = useLoad(() => api('/assets'), []);
  const all = data?.assets || [];
  const shown = type ? all.filter((a) => a.type === type) : all;

  return (
    <>
      <PageHeader
        crumbs={[['Catalogue']]}
        title="Equipment catalogue"
        lead="Laptops and projectors available to AITU students for short-term loan. Choose an item to see when it is free and reserve a pickup time."
      />
      <div className="container content with-sidebar">
        <aside className="sidebar" aria-label="Filters">
          <h2 className="sidebar-title">Category</h2>
          <ul className="sidebar-nav">
            <li><a href="#/" aria-current={!type ? 'true' : undefined}>All equipment <span className="count">{all.length}</span></a></li>
            {(data?.types || []).map((t) => (
              <li key={t}>
                <a href={`#/?type=${encodeURIComponent(t)}`} aria-current={type === t ? 'true' : undefined}>
                  {label(t)} <span className="count">{all.filter((a) => a.type === t).length}</span>
                </a>
              </li>
            ))}
          </ul>
          <h2 className="sidebar-title">How to borrow</h2>
          <ol className="steps">
            <li>Sign in with your student account.</li>
            <li>Open an item and pick a time {rules.minLeadDays}–{rules.maxLeadDays} days ahead.</li>
            <li>Collect it at the pickup point at the booked time.</li>
          </ol>
          <p className="sidebar-more"><a href="#/rules">Full loan rules</a></p>
        </aside>

        <div>
          {error && <Notice type="error" role="alert">{error.message}</Notice>}
          {loading && !data && <p>Loading catalogue…</p>}
          {data && (
            <>
              <div className="results-bar" aria-live="polite">
                <span>{shown.length} item{shown.length === 1 ? '' : 's'}{type ? ` in ${label(type)}` : ''}</span>
                {type && <a href="#/">Clear filter</a>}
              </div>
              {shown.length === 0 ? (
                <div className="empty-state">
                  <p>No equipment in this category.</p>
                  <p><a href="#/">Show all equipment</a></p>
                </div>
              ) : (
                <table className="data-table responsive">
                  <thead>
                    <tr><th scope="col">Item</th><th scope="col">Category</th><th scope="col">Condition</th><th scope="col">Pickup point</th><th scope="col">Status</th></tr>
                  </thead>
                  <tbody>
                    {shown.map((a) => (
                      <tr key={a.id}>
                        <td data-label="Item">
                          <a className="item-link" href={`#/assets/${encodeURIComponent(a.id)}`}>{a.name}</a>
                          <span className="item-id">Inventory no. {a.id}</span>
                        </td>
                        <td data-label="Category">{label(a.type).replace(/s$/, '')}</td>
                        <td data-label="Condition">{a.condition}</td>
                        <td data-label="Pickup point">{a.pickupLocation}</td>
                        <td data-label="Status">
                          {a.status === 'available'
                            ? <span className="status-text ok">Available</span>
                            : <span className="status-text warn">Withdrawn{a.publicNotice ? `: ${a.publicNotice}` : ''}</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </>
          )}
        </div>
      </div>
    </>
  );
}
