import { Link } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { analytics as analyticsApi } from '../services/api';
import MetricCard from '../components/MetricCard';
import ChartCard from '../components/ChartCard';
import { BarList, Donut, outcomeColor } from '../components/Charts';
import EmptyState from '../components/EmptyState';
import ErrorState from '../components/ErrorState';
import LoadingSkeleton from '../components/LoadingSkeleton';
import PageHeader from '../components/PageHeader';
import Icon from '../components/Icon';
import { friendlyError } from '../utils/errors';
import { formatDuration, trimNumber } from '../utils/format';
import './Step2Pages.css';

const numberOrNull = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const pctFmt = (n) => `${trimNumber(n)}%`;

export default function CompleteAnalytics() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let live = true;
    analyticsApi.get()
      .then((response) => {
        if (live) setData(response?.data?.data || {});
      })
      .catch((err) => {
        if (live) setError(err);
      })
      .finally(() => {
        if (live) setLoading(false);
      });
    return () => { live = false; };
  }, []);

  const header = (
    <PageHeader
      title="Complete Analytics"
      subtitle="Full sales intelligence overview for the Head Analyst."
      actions={<Link to="/history" className="btn btn-ghost"><Icon name="history" />Call History</Link>}
    />
  );

  if (loading && !data) return <>{header}<LoadingSkeleton /></>;
  if (error && !data) return <>{header}<ErrorState title="Unable to load analytics" message={friendlyError(error)} onRetry={() => window.location.reload()} /></>;

  const metrics = data?.metrics || {};
  const recentCalls = Array.isArray(data?.recentCalls) ? data.recentCalls : [];
  const intents = Array.isArray(data?.intentDistribution) ? data.intentDistribution : [];
  const signals = Array.isArray(data?.buyingSignalDistribution) ? data.buyingSignalDistribution : [];
  const objections = Array.isArray(data?.objectionDistribution) ? data.objectionDistribution : [];
  const outcomes = Array.isArray(data?.outcomeDistribution) ? data.outcomeDistribution : [];
  const totalCalls = numberOrNull(metrics.totalCalls);

  if (totalCalls === 0 && !recentCalls.length) {
    return <>{header}<EmptyState icon="analytics" title="No analytics yet" action={<Link to="/analyze" className="btn btn-accent"><Icon name="plus" />Analyze Call</Link>}>Complete analytics will populate after sales calls are analyzed.</EmptyState></>;
  }

  return (
    <>
      {header}
      <div className="step2-shell">
        <div className="metric-grid">
          <MetricCard label="Total Calls" icon="wave" value={numberOrNull(metrics.totalCalls)} />
          <MetricCard label="Successful Calls" icon="check" tone="success" value={numberOrNull(metrics.successfulCalls)} />
          <MetricCard label="Failed Calls" icon="x" tone="failure" value={numberOrNull(metrics.failedCalls)} />
          <MetricCard label="Success Rate" icon="trendUp" tone="accent" value={numberOrNull(metrics.successRate)} format={pctFmt} />
          <MetricCard label="Avg Model Confidence" icon="target" value={numberOrNull(metrics.averageConfidence)} format={pctFmt} hint="Not a guaranteed probability" />
          <MetricCard label="Avg Call Duration" icon="clock" value={numberOrNull(metrics.averageDuration)} format={formatDuration} hint="min:sec" />
        </div>

        <section className="section">
          <div className="section-head"><h2>Sales Intelligence</h2></div>
          <div className="grid-2">
            <ChartCard title="Success vs Failure">
              <Donut items={outcomes} colorFor={outcomeColor} centerValue={numberOrNull(metrics.successRate) == null ? undefined : pctFmt(metrics.successRate)} centerLabel="success rate" empty="Not enough data." />
            </ChartCard>
            <ChartCard title="Customer Intent">
              <BarList items={intents.slice(0, 8)} color="var(--ink)" empty="No customer intents identified yet." />
            </ChartCard>
            <ChartCard title="Top Buying Signals">
              <BarList items={signals.slice(0, 8)} color="var(--success)" empty="No buying signals identified yet." />
            </ChartCard>
            <ChartCard title="Common Objections">
              <BarList items={objections.slice(0, 8)} color="#c98410" empty="No objections identified yet." />
            </ChartCard>
          </div>
        </section>
      </div>
    </>
  );
}