import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import Icon from './Icon';
import { OutcomeBadge, StatusBadge } from './StatusBadge';
import { callRef } from '../utils/ids';
import { outcomeConfidence } from '../utils/callData';
import { formatDateTime, formatDuration, fractionToPct } from '../utils/format';

export const rise = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0, transition: { duration: 0.35, ease: [0.22, 1, 0.36, 1] } },
};

export function CallListHeader() {
  return (
    <div className="call-head" aria-hidden="true">
      <span>Call</span><span>Date</span><span>Duration</span><span>Outcome</span><span>Confidence</span><span>Status</span><span />
    </div>
  );
}

/** One call: table-style row on desktop, stacked card on mobile. Never links with an invalid ID. */
export default function CallCard({ call }) {
  const ref = callRef(call);
  const done = call.processingStatus === 'completed';
  const conf = done ? outcomeConfidence(call.salesOutcome, call) : null;
  const name = call.originalFilename || call.callId || 'Untitled call';

  const inner = (
    <>
      <span className="call-main">
        <span className="call-name truncate">{name}</span>
        <span className="call-sub truncate">{call.callId || '—'}</span>
      </span>
      <span className="call-cell d-only">{formatDateTime(call.createdAt)}</span>
      <span className="call-cell d-only num">{formatDuration(call.duration ?? call.durationSeconds)}</span>
      <span className="d-only">{done ? <OutcomeBadge outcome={call.salesOutcome} /> : <span className="faint">—</span>}</span>
      <span className="call-cell d-only num">{fractionToPct(conf)}</span>
      <span className="d-only"><StatusBadge status={call.processingStatus} /></span>
      <span className="d-only call-go"><Icon name="chevronRight" /></span>

      <span className="m-only call-badge">{done ? <OutcomeBadge outcome={call.salesOutcome} /> : <StatusBadge status={call.processingStatus} />}</span>
      <span className="m-only call-meta">
        <span>{formatDateTime(call.createdAt)}</span>
        <span className="num">{formatDuration(call.duration ?? call.durationSeconds)}</span>
        {conf !== null && <span className="num">{fractionToPct(conf)} confidence</span>}
      </span>
    </>
  );

  return (
    <motion.li variants={rise} layout="position">
      {ref ? (
        <Link to={`/history/${encodeURIComponent(ref)}`} className="call-row" aria-label={`Open ${name}`}>{inner}</Link>
      ) : (
        <div className="call-row is-static">{inner}</div>
      )}
    </motion.li>
  );
}
