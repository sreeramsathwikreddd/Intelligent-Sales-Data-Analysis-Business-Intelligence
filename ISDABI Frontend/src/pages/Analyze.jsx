import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { calls as callsApi } from '../services/api';
import Button from '../components/Button';
import Icon from '../components/Icon';
import PageHeader from '../components/PageHeader';
import ProcessingTimeline from '../components/ProcessingTimeline';
import { useToast } from '../components/Toast';
import { friendlyError } from '../utils/errors';
import { audioType, formatBytes } from '../utils/format';
import { extractUploadedCallIds, isValidId } from '../utils/ids';

const ACCEPTED = /\.(wav|mp3|m4a|flac|ogg|webm)$/i;
const ACCEPTED_LABEL = 'WAV, MP3, M4A, FLAC, OGG or WEBM';
const POLL_MS = 1500;
const MAX_POLL_ATTEMPTS = 240; // six minutes of UI polling; server processing continues independently.

const safeMessage = (msg, fallback) => (
  typeof msg === 'string' && msg.trim() && msg.length < 220 && !/\n\s+at\s/.test(msg)
    ? msg
    : fallback
);

const pickCall = (response) => (
  response?.data?.data?.call
  || response?.data?.call
  || response?.data?.data
  || response?.data
  || {}
);

export default function Analyze() {
  const navigate = useNavigate();
  const toast = useToast();
  const inputRef = useRef(null);

  const [file, setFile] = useState(null);
  const [drag, setDrag] = useState(false);
  const [phase, setPhase] = useState('idle');
  const [progress, setProgress] = useState(0);
  const [backend, setBackend] = useState({ status: null, stage: null });
  const [error, setError] = useState('');
  const [callCreated, setCallCreated] = useState(false);
  const [viewId, setViewId] = useState(null);

  const runningRef = useRef(false);
  const mountedRef = useRef(true);
  const pollRef = useRef(null);
  const attemptRef = useRef(0);
  const idsRef = useRef({ mongoId: null, publicId: null });

  const stopPolling = useCallback(() => {
    clearTimeout(pollRef.current);
    pollRef.current = null;
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      runningRef.current = false;
      clearTimeout(pollRef.current);
    };
  }, []);

  const onFile = (selected) => {
    if (!selected || runningRef.current) return;
    if (!ACCEPTED.test(selected.name)) {
      setError(`Unsupported audio format. Use ${ACCEPTED_LABEL}.`);
      return;
    }
    setError('');
    setFile(selected);
    setPhase('ready');
    setProgress(0);
    setBackend({ status: null, stage: null });
    setCallCreated(false);
    setViewId(null);
  };

  const reset = () => {
    stopPolling();
    runningRef.current = false;
    attemptRef.current = 0;
    idsRef.current = { mongoId: null, publicId: null };
    setFile(null);
    setPhase('idle');
    setError('');
    setProgress(0);
    setBackend({ status: null, stage: null });
    setCallCreated(false);
    setViewId(null);
    if (inputRef.current) inputRef.current.value = '';
  };

  const fail = useCallback((message) => {
    stopPolling();
    runningRef.current = false;
    if (!mountedRef.current) return;
    setError(message);
    setPhase('error');
  }, [stopPolling]);

  const navigateToCall = useCallback(async (id) => {
    const candidates = [id, idsRef.current.mongoId, idsRef.current.publicId].filter(isValidId);
    const unique = [...new Set(candidates)];

    for (const candidate of unique) {
      try {
        const response = await callsApi.get(candidate);
        const call = pickCall(response);
        if (call?._id || call?.id || call?.callId) {
          const stableId = call?._id || call?.id || candidate;
          if (mountedRef.current) {
            setViewId(String(stableId));
            setPhase('done');
          }
          return true;
        }
      } catch (err) {
        console.warn('[ISDABI] Final call lookup failed:', candidate, err?.response?.status || err?.message);
      }
    }
    return false;
  }, []);

  const poll = useCallback(async () => {
    if (!runningRef.current || !mountedRef.current) return;

    attemptRef.current += 1;
    if (attemptRef.current > MAX_POLL_ATTEMPTS) {
      // Do not mark the server job as failed. The user can safely leave the page.
      runningRef.current = false;
      setPhase('done');
      setError('The server is still processing this call. You can continue in Call History.');
      return;
    }

    const candidates = [idsRef.current.mongoId, idsRef.current.publicId].filter(isValidId);
    let call = null;
    let lastError = null;

    for (const candidate of [...new Set(candidates)]) {
      try {
        call = pickCall(await callsApi.get(candidate));
        if (call && (call.processingStatus || call._id || call.callId)) break;
      } catch (err) {
        lastError = err;
      }
    }

    if (!call) {
      // A very short creation/read race can happen immediately after the 202 response.
      // Keep polling instead of turning that temporary 404 into "Call not found".
      if (attemptRef.current % 10 === 0) console.warn('[ISDABI] Call status not visible yet:', lastError?.response?.status || lastError?.message);
      pollRef.current = setTimeout(poll, POLL_MS);
      return;
    }

    if (!runningRef.current || !mountedRef.current) return;

    const status = call.processingStatus;
    setBackend({ status, stage: call.processingStage ?? null });

    if (status === 'completed') {
      runningRef.current = false;
      stopPolling();
      const stableId = call._id || call.id || idsRef.current.mongoId || call.callId || idsRef.current.publicId;
      const found = await navigateToCall(stableId);
      if (!found) {
        setPhase('done');
        setViewId(stableId);
        toast.success('Analysis complete. Open it from Call History.');
        return;
      }
      toast.success('Analysis complete');
      return;
    }

    if (status === 'failed') {
      fail(safeMessage(call.processingError, 'Analysis failed. Open Call History for the saved failure details.'));
      return;
    }

    pollRef.current = setTimeout(poll, POLL_MS);
  }, [fail, navigateToCall, stopPolling, toast]);

  const startAnalysis = async () => {
    if (!file || runningRef.current) return;
    runningRef.current = true;
    attemptRef.current = 0;
    stopPolling();
    setPhase('uploading');
    setError('');
    setProgress(0);
    setCallCreated(false);
    setViewId(null);
    setBackend({ status: null, stage: null });

    try {
      const response = await callsApi.upload(file, (e) => {
        if (mountedRef.current && e.total) setProgress(Math.min(1, e.loaded / e.total));
      });

      if (!mountedRef.current) return;

      const ids = extractUploadedCallIds(response);
      if (!ids.mongoId && !ids.publicId) {
        throw new Error('Analysis started, but the backend did not return a valid call ID.');
      }

      idsRef.current = ids;
      setCallCreated(true);
      setProgress(1);

      /*
       * Version 04 separates uploading from analysis.
       * The Analyze page keeps its original behavior by
       * explicitly starting analysis after the upload succeeds.
       */
      const analysisId =
        ids.mongoId ||
        ids.publicId;

      if (!analysisId) {
        throw new Error(
          'Upload succeeded, but no valid call ID was returned.'
        );
      }

      await callsApi.analyze(
        analysisId
      );

      setPhase('processing');
      poll();
    } catch (err) {
      console.error('[ISDABI] Upload failed:', err);
      fail(friendlyError(err, 'Upload failed.'));
    }
  };

  const busy = phase === 'uploading' || phase === 'processing';
  const showPicker = phase === 'idle' || phase === 'ready';
  const completedId = viewId || idsRef.current.mongoId || idsRef.current.publicId;

  return (
    <>
      <PageHeader title="Call Analysis" subtitle="Upload a sales call to transcribe it and generate intelligence." />

      <AnimatePresence mode="wait" initial={false}>
        {showPicker ? (
          <motion.div key="pick" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.25 }} className="analyze-wrap">
            {!file ? (
              <div
                className={`dropzone ${drag ? 'is-over' : ''}`}
                role="button"
                tabIndex={0}
                aria-label="Upload a sales call audio file"
                onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
                onDragLeave={() => setDrag(false)}
                onDrop={(e) => { e.preventDefault(); setDrag(false); onFile(e.dataTransfer.files?.[0]); }}
                onClick={() => inputRef.current?.click()}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); inputRef.current?.click(); } }}
              >
                <div className="dropzone-mark"><Icon name="upload" /></div>
                <h2>Upload a sales call</h2>
                <p className="muted">Drag &amp; drop your audio file here</p>
                <span className="dropzone-or">or</span>
                <span className="btn btn-secondary">Choose a file</span>
                <p className="faint dropzone-formats">{ACCEPTED_LABEL}</p>
              </div>
            ) : (
              <motion.div className="card file-card" initial={{ opacity: 0, scale: 0.985 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.25 }}>
                <div className="file-icon"><Icon name="file" /></div>
                <div className="file-info">
                  <strong className="truncate">{file.name}</strong>
                  <span className="muted num">{formatBytes(file.size)} <span aria-hidden="true">·</span> {audioType(file.name)}</span>
                </div>
                <span className="pill pill-accent">Ready to analyze</span>
                <button type="button" className="icon-btn" onClick={reset} aria-label="Remove file" data-tip="Remove"><Icon name="x" /></button>
              </motion.div>
            )}
            <input ref={inputRef} type="file" accept=".wav,.mp3,.m4a,.flac,.ogg,.webm,audio/*" hidden onChange={(e) => { onFile(e.target.files?.[0]); e.target.value = ''; }} />

            <AnimatePresence>
              {error && (
                <motion.div className="notice notice-error" role="alert" style={{ marginTop: 14 }} initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                  <Icon name="alert" />{error}
                </motion.div>
              )}
            </AnimatePresence>

            {phase === 'ready' && (
              <div className="cta-row">
                <Button variant="accent" size="lg" icon="wave" onClick={startAnalysis} disabled={busy}>Analyze Call</Button>
                <Button size="lg" variant="secondary" onClick={reset}>Clear</Button>
              </div>
            )}
          </motion.div>
        ) : (
          <motion.div key="run" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }} className="analyze-wrap">
            <ProcessingTimeline
              filename={file?.name}
              phase={phase}
              progress={progress}
              backendStatus={backend.status}
              stage={backend.stage}
              error={error}
              uploadFailed={phase === 'error' && !callCreated}
            />
            {phase === 'processing' && <p className="faint analyze-note">The analysis continues on the server. You can safely leave this page; the call remains available in Call History.</p>}
            {phase === 'done' && completedId && (
              <div className="cta-row is-center">
                <Button variant="accent" size="lg" icon="reports" onClick={() => navigate(`/history/${encodeURIComponent(completedId)}`)}>View Analysis</Button>
                <Button size="lg" variant="secondary" onClick={() => navigate('/history')}>Call History</Button>
              </div>
            )}
            {(phase === 'uploading' || phase === 'processing') && (
              <div className="cta-row is-center">
                <Button variant="accent" size="lg" loading={busy} loadingLabel="Analyzing…">Analysis running</Button>
              </div>
            )}
            {phase === 'error' && (
              <div className="cta-row is-center">
                <Button variant="accent" onClick={() => { runningRef.current = false; startAnalysis(); }}>Try again</Button>
                <Button onClick={reset}>Choose another file</Button>
                {callCreated && completedId && <Button variant="secondary" onClick={() => navigate('/history')}>Open Call History</Button>}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
