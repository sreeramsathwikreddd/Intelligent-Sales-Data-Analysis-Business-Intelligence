import { motion } from 'framer-motion';

const ease = [0.22, 1, 0.36, 1];
export const PALETTE = ['#1f5eff', '#0b0d12', '#6f97ff', '#8a93a5', '#b9cbff', '#cfd4dc'];
const OUTCOME = { SUCCESS: '#12804f', FAILURE: '#d0281c', UNKNOWN: '#8a93a5' };

export const outcomeColor = (name, i = 0) => OUTCOME[String(name).toUpperCase()] || PALETTE[i % PALETTE.length];
const clean = (items) => (Array.isArray(items) ? items.filter((i) => i && typeof i.value === 'number' && i.value > 0) : []);
const Empty = ({ text = 'Not enough data.' }) => <div className="chart-empty">{text}</div>;

/** Ranked horizontal bars. */
export function BarList({ items, color = 'var(--accent)', empty }) {
  const data = clean(items);
  if (!data.length) return <Empty text={empty} />;
  const max = Math.max(...data.map((d) => d.value));
  const total = data.reduce((s, d) => s + d.value, 0);
  return (
    <ul className="bar-list">
      {data.map((d, i) => (
        <li key={d.name} className="bar-item">
          <div className="bar-head">
            <span className="truncate">{d.name}</span>
            <span className="faint num">{d.value} <span aria-hidden="true">·</span> {Math.round((d.value / total) * 100)}%</span>
          </div>
          <div className="bar-track" role="img" aria-label={`${d.name}: ${d.value}`}>
            <motion.div className="bar-fill" style={{ background: color }} initial={{ scaleX: 0 }} animate={{ scaleX: d.value / max }} transition={{ duration: 0.7, ease, delay: 0.06 + i * 0.05 }} />
          </div>
        </li>
      ))}
    </ul>
  );
}

/** Donut with animated arcs and a legend. */
export function Donut({ items, colorFor = (n, i) => PALETTE[i % PALETTE.length], centerValue, centerLabel, empty }) {
  const data = clean(items);
  const total = data.reduce((s, d) => s + d.value, 0);
  if (!total) return <Empty text={empty} />;
  let acc = 0;
  return (
    <div className="donut-wrap">
      <svg viewBox="0 0 120 120" width="164" height="164" role="img" aria-label="Distribution">
        <circle cx="60" cy="60" r="46" fill="none" stroke="var(--surface-secondary)" strokeWidth="13" />
        {data.map((d, i) => {
          const frac = d.value / total;
          const start = acc;
          acc += frac;
          return (
            <motion.circle key={d.name} cx="60" cy="60" r="46" fill="none" stroke={colorFor(d.name, i)} strokeWidth="13"
              transform={`rotate(${-90 + start * 360} 60 60)`}
              initial={{ pathLength: 0 }} animate={{ pathLength: Math.max(0.002, frac - (data.length > 1 ? 0.012 : 0)) }}
              transition={{ duration: 0.85, ease, delay: 0.08 + i * 0.1 }} />
          );
        })}
        {centerValue !== undefined && <text x="60" y="61" textAnchor="middle" style={{ fontSize: 21, fontWeight: 650, fill: 'var(--text)' }}>{centerValue}</text>}
        {centerLabel && <text x="60" y="76" textAnchor="middle" style={{ fontSize: 8, fill: 'var(--text-tertiary)' }}>{centerLabel}</text>}
      </svg>
      <ul className="legend">
        {data.map((d, i) => (
          <li key={d.name}><i style={{ background: colorFor(d.name, i) }} /><span className="truncate">{d.name}</span><span className="faint num">{d.value}</span></li>
        ))}
      </ul>
    </div>
  );
}
