import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import Icon from './Icon';
import { OutcomeBadge } from './StatusBadge';
import { callRef } from '../utils/ids';
import { labelList } from '../utils/callData';
import { NOT_IDENTIFIED, formatDateTime } from '../utils/format';

const populatedCall = (item) => (item?.callId && typeof item.callId === 'object' ? item.callId : null);
const pick = (item, ...keys) => {
  const nestedCall = populatedCall(item);
  for (const src of [item, item?.report, item?.managerReport, nestedCall]) {
    if (!src) continue;
    for (const key of keys) if (src[key] !== undefined) return src[key];
  }
  return undefined;
};

export default function ReportCard({ item, onDownload, index = 0 }) {
  const nestedCall = populatedCall(item);
  const ref = callRef(item);
  const situation = pick(item, 'customerSituation');
  const signalsRaw = pick(item, 'buyingSignals', 'keyBuyingSignals');
  const objectionsRaw = pick(item, 'objections', 'mainObjections');
  const signals = labelList(signalsRaw);
  const objections = labelList(objectionsRaw);
  const filename = item.originalFilename || nestedCall?.originalFilename || item.callId?.callId || item.callId || 'Untitled call';
  const createdAt = item.createdAt || nestedCall?.createdAt;
  const outcome = item.salesOutcome || nestedCall?.salesOutcome;

  return (
    <motion.li className="card card-lift report-item" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, delay: Math.min(index, 8) * 0.04, ease: [0.22, 1, 0.36, 1] }}>
      <div className="report-item-head">
        <div className="call-main">
          <span className="call-name truncate">{filename}</span>
          <span className="call-sub">{formatDateTime(createdAt)}</span>
        </div>
        <OutcomeBadge outcome={outcome} />
      </div>

      {situation !== undefined && (
        <div className="report-field">
          <span className="metric-label">Customer situation</span>
          <p className={`clamp-2 ${situation ? '' : 'faint'}`}>{situation || NOT_IDENTIFIED}</p>
        </div>
      )}
      {signalsRaw !== undefined && (
        <div className="report-field">
          <span className="metric-label">Buying signals</span>
          {signals.length ? <div className="pill-row">{signals.slice(0, 5).map((s, i) => <span key={`${s}-${i}`} className="pill pill-success">{s}</span>)}</div> : <p className="faint">{NOT_IDENTIFIED}</p>}
        </div>
      )}
      {objectionsRaw !== undefined && (
        <div className="report-field">
          <span className="metric-label">Objections</span>
          {objections.length ? <div className="pill-row">{objections.slice(0, 5).map((s, i) => <span key={`${s}-${i}`} className="pill pill-warning">{s}</span>)}</div> : <p className="faint">{NOT_IDENTIFIED}</p>}
        </div>
      )}

      <div className="report-item-actions">
        {ref && <Link to={`/history/${encodeURIComponent(ref)}`} className="btn btn-secondary btn-sm">Open report<Icon name="chevronRight" /></Link>}
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => onDownload(item)} data-tip="Download JSON"><Icon name="download" />JSON</button>
      </div>
    </motion.li>
  );
}
