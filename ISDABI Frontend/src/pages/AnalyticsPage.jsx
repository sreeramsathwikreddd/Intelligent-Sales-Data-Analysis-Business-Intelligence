import { Link } from 'react-router-dom';
import { analytics as analyticsApi } from '../services/api';
import { useAsync } from '../hooks/useAsync';
import { BarList, Donut, outcomeColor } from '../components/Charts';
import ChartCard from '../components/ChartCard';
import EmptyState from '../components/EmptyState';
import ErrorState from '../components/ErrorState';
import LoadingSkeleton from '../components/LoadingSkeleton';
import MetricCard from '../components/MetricCard';
import PageHeader from '../components/PageHeader';
import { friendlyError } from '../utils/errors';
import { formatDuration, trimNumber } from '../utils/format';

const numberOrNull = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const pctFmt = (n) => `${trimNumber(n)}%`;

export default function AnalyticsPage() {
  const { data, error, loading, reload } = useAsync(() => analyticsApi.get().then((r) => r.data.data || {}), []);
  const header = <PageHeader title="Sales Analytics" subtitle="Distributions from completed analyses" />;

  if (loading && !data) return <>{header}<LoadingSkeleton /></>;
  if (error && !data) return <>{header}<ErrorState title="Unable to load analytics" message={friendlyError(error)} onRetry={reload} /></>;

  const m = data?.metrics || {};
  const outcomes = data?.outcomeDistribution || [];
  const intents = data?.intentDistribution || [];
  const signals = data?.buyingSignalDistribution || [];
  const objections = data?.objectionDistribution || [];
  const hasAnything = numberOrNull(m.totalCalls) > 0 || [outcomes, intents, signals, objections].some((d) => d.length);

  if (!hasAnything) {
    return <>{header}<EmptyState icon="analytics" title="Not enough data" action={<Link to="/analyze" className="btn btn-accent">Analyze Call</Link>}>Analytics appear once calls have been analyzed.</EmptyState></>;
  }

  return (
    <>
      {header}
      <div className="metric-grid">
        <MetricCard delay={0.02} label="Total Calls" icon="wave" value={numberOrNull(m.totalCalls)} />
        <MetricCard delay={0.06} label="Success Rate" icon="trendUp" tone="accent" value={numberOrNull(m.successRate)} format={pctFmt} />
        <MetricCard delay={0.1} label="Avg Model Confidence" icon="target" value={numberOrNull(m.averageConfidence)} format={pctFmt} hint="Not a guaranteed probability" />
        <MetricCard delay={0.14} label="Avg Call Duration" icon="clock" value={numberOrNull(m.averageDuration)} format={formatDuration} hint="min:sec" />
      </div>

      <div className="grid-2 section">
        <ChartCard title="Success vs Failure" hint="Outcome distribution" delay={0.05}>
          <Donut items={outcomes} colorFor={outcomeColor} centerValue={numberOrNull(m.successRate) === null ? undefined : pctFmt(m.successRate)} centerLabel="success rate" empty="Not enough data." />
        </ChartCard>
        <ChartCard title="Intent Distribution" delay={0.1}>
          <BarList items={intents} color="var(--ink)" empty="No customer intents identified yet." />
        </ChartCard>
        <ChartCard title="Buying Signals" delay={0.15}>
          <BarList items={signals} color="var(--success)" empty="No buying signals identified yet." />
        </ChartCard>
        <ChartCard title="Objections" delay={0.2}>
          <BarList items={objections} color="#c98410" empty="No objections identified yet." />
        </ChartCard>
      </div>
    </>
  );
}
