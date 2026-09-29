import { motion } from 'framer-motion';
import CountUp from './CountUp';
import Icon from './Icon';

/** value: number → animated counter; anything else renders as given; null → dash. */
export default function MetricCard({ label, value, format, icon, hint, tone, delay = 0 }) {
  return (
    <motion.div className="card metric-card" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay, duration: 0.4, ease: [0.22, 1, 0.36, 1] }}>
      <div className="metric-top">
        <span className="metric-label">{label}</span>
        {icon && <span className={`metric-icon ${tone ? `tone-${tone}` : ''}`}><Icon name={icon} /></span>}
      </div>
      <div className="metric-value">
        {typeof value === 'number' ? <CountUp value={value} format={format} /> : (value ?? <span className="faint">—</span>)}
      </div>
      {hint && <div className="metric-hint">{hint}</div>}
    </motion.div>
  );
}
