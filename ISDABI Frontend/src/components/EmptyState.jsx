import { motion } from 'framer-motion';
import Icon from './Icon';

export default function EmptyState({ icon = 'file', title, children, action, bare }) {
  const body = (
    <motion.div className="empty-state" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
      <div className="empty-mark"><Icon name={icon} /></div>
      <h3>{title}</h3>
      {children && <p>{children}</p>}
      {action}
    </motion.div>
  );
  return bare ? body : <div className="card">{body}</div>;
}
