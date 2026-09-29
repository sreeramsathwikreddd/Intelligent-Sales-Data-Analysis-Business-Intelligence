import { useId } from 'react';
import { motion } from 'framer-motion';

export default function Segmented({ options, value, onChange, label }) {
  const id = useId();
  return (
    <div className="segmented" role="tablist" aria-label={label}>
      {options.map((o) => (
        <button key={o.value} type="button" role="tab" aria-selected={o.value === value} onClick={() => onChange(o.value)}>
          {o.value === value && <motion.span layoutId={`seg-${id}`} className="seg-thumb" transition={{ type: 'spring', stiffness: 520, damping: 40 }} />}
          <span className="seg-label">{o.label}</span>
        </button>
      ))}
    </div>
  );
}
