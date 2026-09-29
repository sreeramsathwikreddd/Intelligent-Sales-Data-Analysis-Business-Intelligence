const dateTime = new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
const dateOnly = new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short', year: 'numeric' });

export const NOT_IDENTIFIED = 'Not identified from the conversation.';
export const NOT_AVAILABLE = 'Not available.';

const validDate = (v) => {
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
};

export const formatDateTime = (v) => { const d = validDate(v); return d ? dateTime.format(d) : '—'; };
export const formatDate = (v) => { const d = validDate(v); return d ? dateOnly.format(d) : '—'; };

export function formatDuration(seconds) {
  const n = Number(seconds);
  if (seconds === null || seconds === undefined || seconds === '' || !Number.isFinite(n)) return '—';
  const s = Math.round(n);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = s % 60;
  return h ? `${h}:${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}` : `${m}:${String(r).padStart(2, '0')}`;
}

export function formatBytes(n) {
  if (!Number.isFinite(n)) return '—';
  if (n < 1024 * 1024) return `${Math.max(1, Math.round(n / 1024))} KB`;
  return `${(n / 1024 / 1024).toFixed(2)} MB`;
}

/** Fraction (0..1) to "90.4%". */
export const fractionToPct = (v, digits = 1) => (typeof v === 'number' && Number.isFinite(v) ? `${(v * 100).toFixed(digits).replace(/\.0+$/, '')}%` : '—');

/** Value that already is a percentage number (e.g. metrics.successRate). */
export const trimNumber = (v, digits = 1) => Number(Number(v).toFixed(digits));

export function greeting(name) {
  const h = new Date().getHours();
  const part = h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
  const first = (name || '').trim().split(/\s+/)[0];
  return first ? `${part}, ${first}` : part;
}

export const formatLabel = (value) =>
  String(value).replace(/_/g, ' ').replace(/\s+/g, ' ').trim().replace(/\b\w/g, (c) => c.toUpperCase());

export const audioType = (name = '') => {
  const ext = name.split('.').pop()?.toUpperCase();
  return ext && ext.length <= 4 ? ext : 'Audio';
};
