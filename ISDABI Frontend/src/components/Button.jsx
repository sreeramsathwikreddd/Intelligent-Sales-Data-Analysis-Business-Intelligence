import { AnimatePresence, motion } from 'framer-motion';
import Icon from './Icon';

/** idle → loading → done label swap with a press effect. Disabled while loading. */
export default function Button({ variant = 'secondary', size, icon, loading, done, loadingLabel, doneLabel, className = '', children, disabled, type = 'button', ...rest }) {
  const state = done ? 'done' : loading ? 'loading' : 'idle';
  const content = {
    idle: <>{icon && <Icon name={icon} />}{children}</>,
    loading: <><span className="spinner" aria-hidden="true" />{loadingLabel || children}</>,
    done: <><Icon name="check" strokeWidth={2.4} />{doneLabel || children}</>,
  }[state];

  return (
    <motion.button
      type={type}
      whileTap={disabled || loading ? undefined : { scale: 0.975 }}
      transition={{ duration: 0.12 }}
      className={`btn btn-${variant} ${size ? `btn-${size}` : ''} ${done ? 'is-done' : ''} ${className}`}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...rest}
    >
      <AnimatePresence mode="wait" initial={false}>
        <motion.span key={state} className="btn-label" initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -5 }} transition={{ duration: 0.13 }}>
          {content}
        </motion.span>
      </AnimatePresence>
    </motion.button>
  );
}
