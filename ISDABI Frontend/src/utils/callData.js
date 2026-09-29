import { formatLabel } from './format';

export const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null);

/** Confidence of the predicted class. Returns null rather than guessing when it is missing. */
export function outcomeConfidence(outcome, src = {}) {
  if (outcome === 'SUCCESS') return num(src.successConfidence);
  if (outcome === 'FAILURE') return num(src.failureConfidence);
  return null;
}

export function normalizeList(value) {
  if (Array.isArray(value)) {
    return value.filter((i) => i !== null && i !== undefined && String(i).trim() !== '').map((i) => (typeof i === 'object' ? textOf(i) : String(i)));
  }
  if (value !== null && value !== undefined && String(value).trim() !== '') return [String(value)];
  return [];
}

/** Buying signals / objections are strings today; objects are tolerated. */
export function textOf(item) {
  if (item === null || item === undefined) return '';
  if (typeof item === 'object') return String(item.label ?? item.name ?? item.signal ?? item.objection ?? item.text ?? '').trim();
  return String(item);
}

export const labelList = (value) => (Array.isArray(value) ? value.map(textOf).filter(Boolean).map(formatLabel) : []);

export function transcriptText(transcript) {
  if (typeof transcript === 'string') return transcript.trim();
  if (transcript && typeof transcript === 'object' && typeof transcript.text === 'string') return transcript.text.trim();
  return '';
}

export const isActiveStatus = (s) => s === 'uploaded' || s === 'queued' || s === 'processing';

export const healthTone = (v) => {
  const s = String(v ?? '').toLowerCase();
  if (v === true || /^(ok|up|connected|healthy|ready|running|online|available|true)$/.test(s)) return 'success';
  if (v === false || /(unavailable|down|error|fail|disconnected|offline|false)/.test(s)) return 'failure';
  return '';
};
