const OUTCOME = {
  SUCCESS: ['pill-success', 'Success'],
  FAILURE: ['pill-failure', 'Failure'],
};

export function OutcomeBadge({ outcome }) {
  const [tone, label] = OUTCOME[outcome] || ['', outcome ? String(outcome).charAt(0) + String(outcome).slice(1).toLowerCase() : 'Unknown'];
  return <span className={`pill pill-dot ${tone}`}>{label}</span>;
}

const STATUS = {
  completed: ['', 'Completed'],
  processing: ['pill-accent pill-pulse', 'Processing'],
  queued: ['pill-accent pill-pulse', 'Queued'],
  uploaded: ['pill-warning', 'Uploaded'],
  failed: ['pill-failure', 'Failed'],
};

export function StatusBadge({ status }) {
  const [tone, label] = STATUS[status] || ['', status ? String(status) : 'Unknown'];
  return <span className={`pill pill-dot ${tone}`}>{label}</span>;
}
