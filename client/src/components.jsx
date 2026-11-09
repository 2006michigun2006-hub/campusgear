import { STATUS_LABEL } from './util.js';

export const UNIVERSITY_URL = 'https://astanait.edu.kz/en/';

/** Grey title band with breadcrumbs, as on the university site. crumbs: [label, href?][] */
export function PageHeader({ crumbs = [], title, lead }) {
  return (
    <div className="title-band">
      <div className="container">
        <nav className="breadcrumbs" aria-label="Breadcrumb">
          <ol>
            <li><a href={UNIVERSITY_URL}>AITU</a></li>
            <li><a href="#/">Equipment Loan Service</a></li>
            {crumbs.map(([label, href]) => (
              <li key={label}>{href ? <a href={href}>{label}</a> : <span aria-current="page">{label}</span>}</li>
            ))}
          </ol>
        </nav>
        <h1>{title}</h1>
        {lead && <p className="lead">{lead}</p>}
      </div>
    </div>
  );
}

export function Tabs({ tab, items, base, label = 'Sections' }) {
  return (
    <nav className="tabs" aria-label={label}>
      {items.map(([key, label]) => (
        <a key={key} href={`#${base}/${key}`} aria-current={tab === key ? 'page' : undefined}>{label}</a>
      ))}
    </nav>
  );
}

export function StatusTag({ status }) {
  return <span className={`tag tag-${status}`}>{STATUS_LABEL[status] || status}</span>;
}

export function Notice({ type = 'info', children, role }) {
  return <div className={`notice notice-${type}`} role={role}>{children}</div>;
}

export function Box({ title, children, id }) {
  return (
    <section className="box" aria-labelledby={id}>
      <h2 className="box-title" id={id}>{title}</h2>
      <div className="box-body">{children}</div>
    </section>
  );
}
