import { Link } from 'react-router-dom';
import { reports as reportsApi, calls as callsApi } from '../services/api';
import { useAsync } from '../hooks/useAsync';
import EmptyState from '../components/EmptyState';
import ErrorState from '../components/ErrorState';
import LoadingSkeleton from '../components/LoadingSkeleton';
import PageHeader from '../components/PageHeader';
import ReportCard from '../components/ReportCard';
import Icon from '../components/Icon';
import { useToast } from '../components/Toast';
import { friendlyError } from '../utils/errors';

function normalizeReports(payload) {
  const raw = payload?.data?.data ?? payload?.data?.reports ?? payload?.data ?? [];
  return Array.isArray(raw) ? raw : [];
}

export default function Reports() {
  const toast = useToast();
  const { data, error, loading, reload } = useAsync(async () => {
    try {
      const response = await reportsApi.list({ page: 1, limit: 50 });
      const reports = normalizeReports(response);
      return reports.map((report) => ({ ...report, __source: 'report' }));
    } catch (reportError) {
      // The page remains useful if an older backend does not expose /reports.
      // Build report cards from completed calls without changing any backend data.
      const fallback = await callsApi.list({ page: 1, limit: 50 });
      const calls = Array.isArray(fallback?.data?.data) ? fallback.data.data : [];
      const completed = calls.filter((call) => call.processingStatus === 'completed');
      if (!completed.length) throw reportError;
      return completed.map((call) => ({ ...call, __source: 'call-fallback' }));
    }
  }, []);

  const download = (item) => {
    const blob = new Blob([JSON.stringify(item, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `report_${item?.callId || item?._id || 'call'}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    toast.success('JSON downloaded');
  };

  const header = <PageHeader title="Reports" subtitle="Manager reports from analyzed calls" actions={<Link to="/analyze" className="btn btn-accent"><Icon name="plus" />Analyze Call</Link>} />;
  if (loading && !data) return <>{header}<LoadingSkeleton variant="list" rows={4} /></>;
  if (error && !data) return <>{header}<ErrorState title="Unable to load reports" message={friendlyError(error, 'The reports service could not be reached.')} onRetry={reload} /></>;

  return (
    <>
      {header}
      <div className="luxury-page-intro">
        <span className="luxury-eyebrow">MANAGER INTELLIGENCE</span>
        <span className="luxury-intro-note">Grounded summaries generated from completed sales calls.</span>
      </div>
      {!data?.length ? (
        <EmptyState icon="reports" title="No reports yet" action={<Link to="/analyze" className="btn btn-accent">Analyze Call</Link>}>Reports will appear after calls are analyzed.</EmptyState>
      ) : (
        <ul className="report-grid">
          {data.map((item, i) => <ReportCard key={item._id || item.callId || item.callId?._id || i} item={item} index={i} onDownload={download} />)}
        </ul>
      )}
    </>
  );
}
