import { createContext, useCallback, useContext, useEffect, useState } from 'react';

export const AppContext = createContext(null);
export const useApp = () => useContext(AppContext);

export function useHashRoute() {
  const read = () => (window.location.hash.replace(/^#/, '') || '/');
  const [route, setRoute] = useState(read);
  useEffect(() => {
    const onChange = () => {
      setRoute(read());
      window.scrollTo(0, 0);
    };
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);
  return route;
}

export const navigate = (path) => {
  window.location.hash = path;
};

/** Loads data with an async function; returns {data, error, loading, reload}. */
export function useLoad(fn, deps) {
  const [state, setState] = useState({ data: null, error: null, loading: true });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const load = useCallback(fn, deps);
  const reload = useCallback(async () => {
    setState((s) => ({ ...s, loading: true }));
    try {
      setState({ data: await load(), error: null, loading: false });
    } catch (error) {
      setState({ data: null, error, loading: false });
    }
  }, [load]);
  useEffect(() => {
    reload();
  }, [reload]);
  return { ...state, reload };
}

export function formatters(timeZone) {
  const dt = new Intl.DateTimeFormat('en-GB', { timeZone, weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
  const day = new Intl.DateTimeFormat('en-GB', { timeZone, weekday: 'short', day: 'numeric', month: 'short' });
  const time = new Intl.DateTimeFormat('en-GB', { timeZone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
  return {
    dateTime: (d) => dt.format(new Date(d)),
    day: (d) => day.format(new Date(d)),
    time: (d) => time.format(new Date(d)),
    range(a, b) {
      const sameDay = day.format(new Date(a)) === day.format(new Date(b));
      return sameDay ? `${dt.format(new Date(a))}–${time.format(new Date(b))}` : `${dt.format(new Date(a))} → ${dt.format(new Date(b))}`;
    },
  };
}

export function relativeHours(ms) {
  const h = Math.round(Math.abs(ms) / 3600000);
  if (h < 1) return 'less than an hour';
  if (h < 48) return `${h} hour${h === 1 ? '' : 's'}`;
  return `${Math.round(h / 24)} days`;
}

export const STATUS_LABEL = {
  confirmed: 'Confirmed',
  checked_out: 'Checked out',
  returned: 'Returned',
  cancelled: 'Cancelled',
};
