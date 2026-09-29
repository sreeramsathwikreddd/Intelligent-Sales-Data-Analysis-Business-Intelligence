import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { reports as reportsApi, calls as callsApi } from '../services/api';
import { useAuth } from '../hooks/useAuth';
import EmptyState from '../components/EmptyState';
import ErrorState from '../components/ErrorState';
import LoadingSkeleton from '../components/LoadingSkeleton';
import PageHeader from '../components/PageHeader';
import Icon from '../components/Icon';
import { useToast } from '../components/Toast';
import { friendlyError } from '../utils/errors';
import { formatDateTime, formatDuration } from '../utils/format';
import './Step2Pages.css';

const ROLE_LABELS = {
  analyst: 'Analyst',
  sales_representative: 'Sales Representative',
  head_analyst: 'Head Analyst'
};

const STATUS_LABELS = {
  uploaded: 'Uploaded',
  queued: 'Queued',
  processing: 'Processing',
  completed: 'Analyzed',
  failed: 'Failed'
};

function normalizeItems(response) {
  const data = response?.data?.data ?? response?.data ?? [];
  return Array.isArray(data) ? data : [];
}

function callIdOf(item) {
  return item?._id || item?.id || item?.callId?._id || item?.callId?.id || item?.callId;
}

function publicCallIdOf(item) {
  return item?.callId?.callId || item?.publicCallId || (
    typeof item?.callId === 'string' && !/^[a-f\d]{24}$/i.test(item.callId)
      ? item.callId
      : null
  );
}

function statusOf(item) {
  return item?.processingStatus || (
    item?.reportAvailable || item?.analysisAvailable ? 'completed' : 'uploaded'
  );
}

function ownerNameOf(item) {
  return (
    item?.uploadedBy?.name ||
    item?.uploadedBy?.email ||
    'Unknown user'
  );
}

function isAnalyzable(item) {
  return ['uploaded', 'queued', 'failed'].includes(statusOf(item));
}

export default function RoleBasedReports() {
  const { user } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();

  const [items, setItems] = useState(null);
  const [roleFilter, setRoleFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [workingId, setWorkingId] = useState('');
  const [error, setError] = useState(null);

  const isOrganizationViewer =
    ['analyst', 'head_analyst'].includes(user?.role);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await reportsApi.roleBased(roleFilter ? { role: roleFilter } : undefined);

      setItems(normalizeItems(response));
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  }, [roleFilter]);

  useEffect(() => {
    load();
  }, [load]);

  const summary = useMemo(() => {
    const list = items || [];

    return {
      total: list.length,
      analyzed: list.filter(
        (item) => statusOf(item) === 'completed'
      ).length,
      pending: list.filter(
        (item) => statusOf(item) !== 'completed'
      ).length
    };
  }, [items]);

  const analyzeCall = async (item) => {
    const id = callIdOf(item) || publicCallIdOf(item);

    if (!id || workingId) return;

    setWorkingId(String(id));

    try {
      await callsApi.analyze(id);

      toast.success(
        'Analysis started. The call will update automatically.'
      );

      await load();
    } catch (err) {
      toast.error(
        friendlyError(
          err,
          'Unable to start analysis for this recording.'
        )
      );
    } finally {
      setWorkingId('');
    }
  };

  const download = (item) => {
    const blob = new Blob(
      [JSON.stringify(item, null, 2)],
      { type: 'application/json' }
    );

    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');

    anchor.href = url;
    anchor.download = `role_report_${callIdOf(item) || 'call'}.json`;

    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();

    window.setTimeout(
      () => URL.revokeObjectURL(url),
      1000
    );

    toast.success('JSON downloaded');
  };

  const header = (
    <PageHeader
      title="Role Based Reports"
      subtitle="Uploaded sales recordings and their analysis, grouped by role."
      actions={
        <Link
          to="/history"
          className="btn btn-ghost"
        >
          <Icon name="history" />
          Call History
        </Link>
      }
    />
  );

  if (loading && !items) {
    return (
      <>
        {header}
        <LoadingSkeleton
          variant="list"
          rows={5}
        />
      </>
    );
  }

  if (error && !items) {
    return (
      <>
        {header}
        <ErrorState
          title="Unable to load role based reports"
          message={friendlyError(
            error,
            'The role based reports service could not be reached.'
          )}
          onRetry={load}
        />
      </>
    );
  }

  return (
    <>
      {header}

      <div className="step2-toolbar step2-report-toolbar">
        <div className="step2-report-summary">
          <span>
            <strong>{summary.total}</strong> recordings
          </span>
          <span>
            <strong>{summary.analyzed}</strong> analyzed
          </span>
          <span>
            <strong>{summary.pending}</strong> awaiting analysis
          </span>
        </div>

        <label className="step2-filter">
          <span className="sr-only">Filter by role</span>
          <select
            className="input"
            value={roleFilter}
            onChange={(event) => setRoleFilter(event.target.value)}
            disabled={loading}
            aria-label="Filter recordings by role"
          >
            <option value="">All Roles</option>
            <option value="sales_representative">Sales Representatives</option>
            <option value="analyst">Analysts</option>
          </select>
        </label>
      </div>

      {!items?.length ? (
        <EmptyState
          icon="reports"
          title="No recordings yet"
        >
          Uploaded sales recordings will appear here.
        </EmptyState>
      ) : (
        <div className="step2-report-list">
          <div className="step2-report-list-head">
            <span>Recording</span>
            <span>Uploaded By</span>
            <span>Date</span>
            <span>Duration</span>
            <span>Status</span>
            <span>Action</span>
          </div>

          <ul className="step2-report-list-body">
            {items.map((item, index) => {
              const id =
                callIdOf(item) ||
                publicCallIdOf(item) ||
                index;

              const status =
                statusOf(item);

              const canAnalyze =
                isAnalyzable(item);

              const ref =
                callIdOf(item) ||
                publicCallIdOf(item);

              return (
                <li
                  key={String(id)}
                  className={"step2-report-row" + (ref ? " is-clickable" : "")}
                  onClick={(event) => {
                    if (!ref) return;

                    if (
                      event.target.closest(
                        ".step2-report-actions"
                      )
                    ) {
                      return;
                    }

                    navigate(
                      "/history/" +
                      encodeURIComponent(ref)
                    );
                  }}
                  onKeyDown={(event) => {
                    if (!ref) return;

                    if (
                      event.key === "Enter" ||
                      event.key === " "
                    ) {
                      event.preventDefault();

                      navigate(
                        "/history/" +
                        encodeURIComponent(ref)
                      );
                    }
                  }}
                  tabIndex={ref ? 0 : undefined}
                  role={ref ? "link" : undefined}
                >
                  <div className="step2-report-main">
                    <strong
                      title={
                        item.originalFilename ||
                        'Untitled recording'
                      }
                    >
                      {item.originalFilename ||
                        item.callId?.callId ||
                        item.callId ||
                        'Untitled recording'}
                    </strong>

                    <span>
                      {item.salesOutcome &&
                      status === 'completed'
                        ? item.salesOutcome
                        : 'Sales recording'}
                    </span>
                  </div>

                  <div className="step2-report-owner">
                    <strong>
                      {ownerNameOf(item)}
                    </strong>

                    <span>
                      {ROLE_LABELS[
                        item?.uploadedBy?.role
                      ] ||
                        item?.uploadedBy?.role ||
                        'Unknown role'}
                    </span>
                  </div>

                  <div className="step2-report-cell">
                    {formatDateTime(
                      item.createdAt
                    )}
                  </div>

                  <div className="step2-report-cell">
                    {formatDuration(
                      item.durationSeconds
                    )}
                  </div>

                  <div>
                    <span
                      className={`step2-report-status status-${status}`}
                    >
                      <span
                        className="step2-status-dot"
                        aria-hidden="true"
                      />
                      {STATUS_LABELS[status] ||
                        status}
                    </span>
                  </div>

                  <div className="step2-report-actions">
                    {canAnalyze ? (
                      <button
                        type="button"
                        className="btn btn-accent btn-sm"
                        disabled={
                          String(workingId) ===
                          String(id)
                        }
                        onClick={() =>
                          analyzeCall(item)
                        }
                      >
                        <Icon name="wave" />
                        {String(workingId) ===
                        String(id)
                          ? 'Starting...'
                          : 'Analyze This Call'}
                      </button>
                    ) : (
                      <>
                        {ref && (
                          <Link
                            to={`/history/${encodeURIComponent(
                              ref
                            )}`}
                            className="btn btn-secondary btn-sm"
                          >
                            Open
                            <Icon name="chevronRight" />
                          </Link>
                        )}

                        <button
                          type="button"
                          className="btn btn-ghost btn-sm"
                          onClick={() =>
                            download(item)
                          }
                        >
                          <Icon name="download" />
                          JSON
                        </button>
                      </>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </>
  );
}


