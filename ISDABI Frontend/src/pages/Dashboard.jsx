import { Link } from 'react-router-dom';

import { motion } from 'framer-motion';

import { analytics as analyticsApi } from '../services/api';

import { useAuth } from '../hooks/useAuth';

import { useAsync } from '../hooks/useAsync';

import Icon from '../components/Icon';

import CallCard, {
  CallListHeader,
} from '../components/CallCard';

import {
  BarList,
  Donut,
  outcomeColor,
} from '../components/Charts';

import ChartCard from '../components/ChartCard';

import EmptyState from '../components/EmptyState';

import ErrorState from '../components/ErrorState';

import LoadingSkeleton from '../components/LoadingSkeleton';

import MetricCard from '../components/MetricCard';

import PageHeader from '../components/PageHeader';

import { friendlyError } from '../utils/errors';

import {
  formatDuration,
  greeting,
  trimNumber,
} from '../utils/format';


const numberOrNull = (value) =>
  typeof value === 'number' &&
  Number.isFinite(value)
    ? value
    : null;


const pctFmt = (number) =>
  `${trimNumber(number)}%`;


const stagger = {
  hidden: {},

  show: {
    transition: {
      staggerChildren: 0.05,
    },
  },
};


export default function Dashboard() {
  const { user } = useAuth();


  const {
    data,
    error,
    loading,
    reload,
  } = useAsync(
    () =>
      analyticsApi
        .get()
        .then(
          (response) =>
            response?.data?.data || {},
        ),
    [],
  );


  const analyzeButton = (
    <Link
      to="/analyze"
      className="btn btn-accent"
    >
      <Icon name="plus" />
      Analyze Call
    </Link>
  );


  const header = (
    <PageHeader
      title={greeting(user?.name)}
      subtitle="Here is your sales intelligence overview."
      actions={analyzeButton}
    />
  );


  if (loading && !data) {
    return (
      <>
        {header}
        <LoadingSkeleton />
      </>
    );
  }


  if (error && !data) {
    return (
      <>
        {header}

        <ErrorState
          title="Unable to load the overview"
          message={friendlyError(error)}
          onRetry={reload}
        />
      </>
    );
  }


  const metrics =
    data?.metrics || {};


  const recent =
    Array.isArray(data?.recentCalls)
      ? data.recentCalls
      : [];


  const signals =
    Array.isArray(
      data?.buyingSignalDistribution,
    )
      ? data.buyingSignalDistribution
      : [];


  const objections =
    Array.isArray(
      data?.objectionDistribution,
    )
      ? data.objectionDistribution
      : [];


  const intents =
    Array.isArray(data?.intentDistribution)
      ? data.intentDistribution
      : [];


  const outcomes =
    Array.isArray(
      data?.outcomeDistribution,
    )
      ? data.outcomeDistribution
      : [];


  const noCalls =
    numberOrNull(metrics.totalCalls) === 0 &&
    !recent.length;


  if (noCalls) {
    return (
      <>
        {header}

        <EmptyState
          icon="wave"
          title="No calls yet"
          action={
            <Link
              to="/analyze"
              className="btn btn-accent"
            >
              Analyze Call
            </Link>
          }
        >
          Upload your first sales call to start
          building your sales intelligence dashboard.
        </EmptyState>
      </>
    );
  }


  return (
    <>
      {header}


      <div className="metric-grid">
        <MetricCard
          delay={0.02}
          label="Total Calls"
          icon="wave"
          value={numberOrNull(
            metrics.totalCalls,
          )}
        />

        <MetricCard
          delay={0.06}
          label="Successful Calls"
          icon="check"
          tone="success"
          value={numberOrNull(
            metrics.successfulCalls,
          )}
        />

        <MetricCard
          delay={0.1}
          label="Failed Calls"
          icon="x"
          tone="failure"
          value={numberOrNull(
            metrics.failedCalls,
          )}
        />

        <MetricCard
          delay={0.14}
          label="Success Rate"
          icon="trendUp"
          tone="accent"
          value={numberOrNull(
            metrics.successRate,
          )}
          format={pctFmt}
        />

        <MetricCard
          delay={0.18}
          label="Avg Model Confidence"
          icon="target"
          value={numberOrNull(
            metrics.averageConfidence,
          )}
          format={pctFmt}
          hint="Not a guaranteed probability"
        />

        <MetricCard
          delay={0.22}
          label="Avg Call Duration"
          icon="clock"
          value={numberOrNull(
            metrics.averageDuration,
          )}
          format={formatDuration}
          hint="min:sec"
        />
      </div>


      <section className="section">
        <div className="section-head">
          <h2>Recent Calls</h2>

          <Link
            to="/history"
            className="btn btn-ghost btn-sm"
          >
            View all
          </Link>
        </div>


        {recent.length ? (
          <>
            <CallListHeader />

            <motion.ul
              className="call-list"
              variants={stagger}
              initial="hidden"
              animate="show"
            >
              {recent.map((call, index) => (
                <CallCard
                  key={
                    call?._id ||
                    call?.id ||
                    call?.callId ||
                    index
                  }
                  call={call}
                />
              ))}
            </motion.ul>
          </>
        ) : (
          <EmptyState
            icon="history"
            title="No recent calls"
          >
            Recent calls will appear here.
          </EmptyState>
        )}
      </section>


      <section className="section">
        <div className="section-head">
          <h2>Sales Performance</h2>
        </div>


        <div className="grid-2">
          <ChartCard
            title="Success vs Failure"
            delay={0.05}
          >
            <Donut
              items={outcomes}
              colorFor={outcomeColor}
              centerValue={
                numberOrNull(
                  metrics.successRate,
                ) === null
                  ? undefined
                  : pctFmt(metrics.successRate)
              }
              centerLabel="success rate"
              empty="Not enough data."
            />
          </ChartCard>


          <ChartCard
            title="Customer Intent"
            delay={0.1}
          >
            <BarList
              items={intents.slice(0, 6)}
              color="var(--ink)"
              empty="No customer intents identified yet."
            />
          </ChartCard>


          <ChartCard
            title="Top Buying Signals"
            delay={0.15}
          >
            <BarList
              items={signals.slice(0, 6)}
              color="var(--success)"
              empty="No buying signals identified yet."
            />
          </ChartCard>


          <ChartCard
            title="Common Objections"
            delay={0.2}
          >
            <BarList
              items={objections.slice(0, 6)}
              color="var(--accent)"
              empty="No objections identified yet."
            />
          </ChartCard>
        </div>
      </section>
    </>
  );
}