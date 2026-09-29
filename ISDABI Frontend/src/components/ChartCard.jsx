import { motion } from 'framer-motion';

export default function ChartCard({ title, hint, children, delay = 0 }) {
  return (
    <motion.section className="card" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay, ease: [0.22, 1, 0.36, 1] }}>
      <div className="card-title"><h3>{title}</h3>{hint && <span className="hint">{hint}</span>}</div>
      {children}
    </motion.section>
  );
}
