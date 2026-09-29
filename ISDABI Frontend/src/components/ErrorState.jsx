import { motion } from 'framer-motion';
import Icon from './Icon';
import Button from './Button';

export default function ErrorState({ title = 'Something went wrong', message, onRetry, action, bare }) {
  const body = (
    <motion.div className="empty-state" role="alert" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
      <div className="empty-mark is-error"><Icon name="alert" /></div>
      <h3>{title}</h3>
      {message && <p>{message}</p>}
      {action || (onRetry && <Button icon="refresh" onClick={onRetry}>Try again</Button>)}
    </motion.div>
  );
  return bare ? body : <div className="card">{body}</div>;
}
