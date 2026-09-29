import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import Button from './Button';
import CopyButton from './CopyButton';
import Icon from './Icon';
import { NOT_IDENTIFIED } from '../utils/format';

const collapse = {
  initial: { height: 0, opacity: 0 },
  animate: { height: 'auto', opacity: 1, transition: { height: { duration: 0.3, ease: [0.22, 1, 0.36, 1] }, opacity: { duration: 0.2, delay: 0.05 } } },
  exit: { height: 0, opacity: 0, transition: { duration: 0.2 } },
};

function Section({ title, icon, tone, children }) {
  const [open, setOpen] = useState(true);
  return (
    <section className="rp-section">
      <button type="button" className="rp-head" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        <span className={`rp-icon ${tone ? `tone-${tone}` : ''}`}><Icon name={icon} /></span>
        <h3>{title}</h3>
        <Icon name="chevronDown" className="rp-chev" style={{ transform: open ? 'rotate(180deg)' : 'none' }} />
      </button>
      <AnimatePresence initial={false}>
        {open && <motion.div {...collapse} style={{ overflow: 'hidden' }}><div className="rp-body">{children}</div></motion.div>}
      </AnimatePresence>
    </section>
  );
}

const Bullets = ({ items }) => (items.length
  ? <ul className="rp-list">{items.map((t, i) => <li key={`${t}-${i}`}>{t}</li>)}</ul>
  : <p className="faint">{NOT_IDENTIFIED}</p>);

const Tags = ({ items, tone }) => (items.length
  ? <div className="pill-row">{items.map((t, i) => <span key={`${t}-${i}`} className={`pill ${tone}`}>{t}</span>)}</div>
  : <p className="faint">{NOT_IDENTIFIED}</p>);

export default function ManagerReport({ situation, signals, objections, wentWell, needsImprovement, followUp, getCopyText, onDownload }) {
  return (
    <div className="card report-card">
      <div className="card-title">
        <h3>Manager Report</h3>
        <div className="report-actions">
          <CopyButton getText={getCopyText} toastMessage="Report copied">Copy Report</CopyButton>
          <Button size="sm" icon="download" onClick={onDownload}>Download JSON</Button>
        </div>
      </div>
      <div className="rp-grid">
        <Section title="What Went Well" icon="check" tone="success"><Bullets items={wentWell} /></Section>
        <Section title="What Needs Improvement" icon="trendUp" tone="warning"><Bullets items={needsImprovement} /></Section>
        <Section title="Recommended Follow-up" icon="target" tone="accent"><Bullets items={followUp} /></Section>
        <Section title="Key Buying Signals" icon="wave" tone="success"><Tags items={signals} tone="pill-success" /></Section>
        <Section title="Main Objections" icon="alert" tone="warning"><Tags items={objections} tone="pill-warning" /></Section>
        <Section title="Customer Situation" icon="user"><p className="rp-text">{situation || <span className="faint">{NOT_IDENTIFIED}</span>}</p></Section>
      </div>
    </div>
  );
}
