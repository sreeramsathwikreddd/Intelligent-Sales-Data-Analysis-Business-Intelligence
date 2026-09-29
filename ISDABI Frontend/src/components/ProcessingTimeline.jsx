import { useRef } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import Icon from './Icon';
import './ProcessingTimeline.css';

/*
 * Keys match the backend `processingStage` values exactly
 * (transcribing, analyzing, signals, objections, report, finalizing).
 * The screen only follows what the server reports. No timers.
 */
const PIPELINE = [
  { key: 'transcribing', label: 'Writing out the call' },
  { key: 'analyzing', label: 'Understanding the customer' },
  { key: 'signals', label: 'Finding buying signals' },
  { key: 'objections', label: 'Finding objections' },
  { key: 'report', label: 'Writing the manager report' },
  { key: 'finalizing', label: 'Finishing up' }
];

const STAGE_ORDER = PIPELINE.map((item) => item.key);
const TOTAL = PIPELINE.length + 1; // +1 for the audio upload step

const ALIASES = {
  transcription: 'transcribing',
  transcribing_conversation: 'transcribing',
  analysis: 'analyzing',
  analyzing_customer_intent: 'analyzing',
  buying_signals: 'signals',
  detecting_buying_signals: 'signals',
  detecting_objections: 'objections',
  manager_report: 'report',
  generating_manager_report: 'report',
  final: 'finalizing',
  finalizing_report: 'finalizing'
};

function normalizeStage(stage) {
  if (!stage) return null;
  const value = String(stage).trim().toLowerCase().replace(/[\s-]+/g, '_');
  const mapped = ALIASES[value] || value;
  return STAGE_ORDER.includes(mapped) ? mapped : null;
}

function buildView({ phase, backendStatus, stage, error, uploadFailed, progress }) {
  const failed = phase === 'error';
  const uploading = phase === 'uploading';
  const complete = !failed && (
    backendStatus === 'completed' || (phase === 'done' && !error)
  );
  // Screen gave up waiting, but the server is still working.
  const detached = !failed && !complete && phase === 'done' && !!error;

  const activeIndex = stage ? STAGE_ORDER.indexOf(stage) : -1;

  let audioState = 'done';
  if (uploading) audioState = 'active';
  if (failed && uploadFailed) audioState = 'failed';

  const steps = PIPELINE.map((step, index) => {
    let state = 'pending';
    if (complete) state = 'done';
    else if (uploading || (failed && uploadFailed)) state = 'pending';
    else if (activeIndex >= 0) {
      if (index < activeIndex) state = 'done';
      else if (index === activeIndex) state = failed ? 'failed' : 'active';
    } else if (failed && index === 0) {
      state = 'failed';
    }
    return { key: step.key, label: step.label, state };
  });

  const rows = [
    {
      key: 'audio',
      label: uploading ? 'Uploading the audio' : 'Audio received',
      state: audioState,
      hint: uploading ? `${Math.round((progress || 0) * 100)}%` : null
    },
    ...steps
  ];

  const doneCount = rows.filter((row) => row.state === 'done').length;
  let ratio = doneCount / TOTAL;
  if (uploading) ratio = (progress || 0) / TOTAL;
  if (complete) ratio = 1;

  const activeRow = rows.find((row) => row.state === 'active');
  const activePosition = rows.findIndex((row) => row.state === 'active') + 1;

  let title = 'Getting ready';
  let eyebrow = 'Starting';
  if (complete) {
    title = 'Analysis complete';
    eyebrow = 'All steps done';
  } else if (failed) {
    title = uploadFailed ? 'Upload stopped' : 'Analysis stopped';
    eyebrow = 'Something went wrong';
  } else if (detached) {
    title = 'Still working on the server';
    eyebrow = 'You can check Call History';
  } else if (activeRow) {
    title = activeRow.label;
    eyebrow = `Step ${activePosition} of ${TOTAL}`;
  }

  return { rows, ratio, title, eyebrow, failed, complete, detached };
}

const HINTS = { done: 'Done', active: 'In progress', failed: 'Failed', pending: '' };

function Node({ state }) {
  return (
    <span className={`ca-node is-${state}`} aria-hidden="true">
      {state === 'done' && <Icon name="check" strokeWidth={3} />}
      {state === 'failed' && <Icon name="x" strokeWidth={3} />}
      {state === 'active' && <span className="ca-spin" />}
    </span>
  );
}

export default function ProcessingTimeline({
  phase,
  backendStatus,
  stage,
  error,
  filename,
  progress = 0,
  uploadFailed = false
}) {
  const reduce = useReducedMotion();
  const lastStage = useRef(null);

  // Remember the last real stage the server reported, so a failure
  // can point at the step that was actually running.
  if (phase === 'uploading') lastStage.current = null;
  const reported = normalizeStage(stage);
  if (reported) lastStage.current = reported;

  const view = buildView({
    phase,
    backendStatus,
    stage: reported || lastStage.current,
    error,
    uploadFailed,
    progress
  });

  const percent = Math.round(view.ratio * 100);

  return (
    <motion.section
      className="ca-card"
      initial={reduce ? false : { opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
      aria-live="polite"
    >
      <header className="ca-head">
        <p className="ca-eyebrow">{view.eyebrow}</p>
        <AnimatePresence mode="wait" initial={false}>
          <motion.h2
            key={view.title}
            className="ca-title"
            initial={reduce ? false : { opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, y: -6 }}
            transition={{ duration: 0.18 }}
          >
            {view.title}
          </motion.h2>
        </AnimatePresence>
        {filename && <p className="ca-file truncate">{filename}</p>}
      </header>

      <div
        className={`ca-bar ${view.failed ? 'is-failed' : ''}`}
        role="progressbar"
        aria-label="Analysis progress"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent}
      >
        <span className="ca-bar-fill" style={{ transform: `scaleX(${view.ratio})` }} />
      </div>

      <ol className="ca-steps">
        {view.rows.map((row) => (
          <li
            key={row.key}
            className={`ca-row is-${row.state}`}
            aria-current={row.state === 'active' ? 'step' : undefined}
          >
            <Node state={row.state} />
            <span className="ca-label">{row.label}</span>
            <span className="ca-hint">{row.hint || HINTS[row.state]}</span>
          </li>
        ))}
      </ol>

      <AnimatePresence>
        {(view.failed || view.detached) && error && (
          <motion.div
            className={`ca-note ${view.failed ? 'is-error' : ''}`}
            role={view.failed ? 'alert' : 'status'}
            initial={reduce ? false : { opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
          >
            <Icon name={view.failed ? 'alert' : 'info'} />
            <span>{error}</span>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.section>
  );
}