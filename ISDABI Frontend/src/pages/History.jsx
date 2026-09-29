import { useMemo, useState } from 'react';

import { Link } from 'react-router-dom';

import { motion } from 'framer-motion';

import { calls as callsApi } from '../services/api';

import { useAsync, useDebounced } from '../hooks/useAsync';

import Button from '../components/Button';

import CallCard, { CallListHeader } from '../components/CallCard';

import EmptyState from '../components/EmptyState';

import ErrorState from '../components/ErrorState';

import Icon from '../components/Icon';

import LoadingSkeleton from '../components/LoadingSkeleton';

import PageHeader from '../components/PageHeader';

import Segmented from '../components/Segmented';

import { outcomeConfidence } from '../utils/callData';

import { friendlyError } from '../utils/errors';


const FILTERS = [
  { value: 'all', label: 'All' },
  { value: 'SUCCESS', label: 'Success' },
  { value: 'FAILURE', label: 'Failure' },
  { value: 'processing', label: 'Processing' },
  { value: 'failed', label: 'Failed' },
];


const SORTS = [
  { value: 'newest', label: 'Newest first' },
  { value: 'oldest', label: 'Oldest first' },
  { value: 'confidence', label: 'Highest confidence' },
  { value: 'duration', label: 'Longest duration' },
];


const stagger = {
  hidden: {},
  show: {
    transition: {
      staggerChildren: 0.035,
    },
  },
};


const time = (call) => new Date(call?.createdAt).getTime() || 0;


export default function History() {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [sort, setSort] = useState('newest');
  const [page, setPage] = useState(1);

  const q = useDebounced(search.trim(), 350);

  /*
   * SUCCESS / FAILURE map to the API's `outcome` parameter.
   * Processing / Failed are statuses and are filtered locally.
   */
  const outcome =
    filter === 'SUCCESS' || filter === 'FAILURE'
      ? filter
      : undefined;


  const {
    data,
    error,
    loading,
    reload,
  } = useAsync(
    () =>
      callsApi
        .list({
          page,
          limit: 15,
          q: q || undefined,
          outcome,
        })
        .then((response) => ({
          items: Array.isArray(response?.data?.data)
            ? response.data.data
            : [],

          pages:
            response?.data?.pagination?.pages || 1,

          total:
            response?.data?.pagination?.total,
        })),
    [page, q, outcome],
  );


  const items = useMemo(() => {
    let list = data?.items || [];


    if (filter === 'processing') {
      list = list.filter((call) =>
        ['uploaded', 'queued', 'processing'].includes(
          call?.processingStatus,
        ),
      );
    }


    if (filter === 'failed') {
      list = list.filter(
        (call) => call?.processingStatus === 'failed',
      );
    }


    const by = {
      newest: (a, b) => time(b) - time(a),

      oldest: (a, b) => time(a) - time(b),

      confidence: (a, b) =>
        (outcomeConfidence(b?.salesOutcome, b) ?? -1) -
        (outcomeConfidence(a?.salesOutcome, a) ?? -1),

      duration: (a, b) =>
        (b?.duration ?? b?.durationSeconds ?? -1) -
        (a?.duration ?? a?.durationSeconds ?? -1),
    }[sort];


    /*
     * Keep the API order for "Newest first".
     * Other sorting modes are applied only to the currently loaded page.
     */
    if (sort === 'newest') {
      return list;
    }


    return [...list].sort(by);
  }, [data, filter, sort]);


  const localOnly =
    filter === 'processing' ||
    filter === 'failed';


  const filtered =
    Boolean(q) ||
    filter !== 'all';


  const pages =
    data?.pages || 1;


  const clear = () => {
    setSearch('');
    setFilter('all');
    setSort('newest');
    setPage(1);
  };


  return (
    <>
      <PageHeader
        title="Call History"
        subtitle={
          data && Number.isFinite(data.total)
            ? `${data.total} ${
                data.total === 1 ? 'call' : 'calls'
              }`
            : 'Search and filter analyzed calls'
        }
        actions={
          <Link
            to="/analyze"
            className="btn btn-accent"
          >
            <Icon name="plus" />
            Analyze Call
          </Link>
        }
      />


      <div className="toolbar filters">
        <div className="search">
          <Icon name="search" />

          <input
            className="input"
            type="search"
            placeholder="Search filename or intent…"
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
            }}
            aria-label="Search calls"
          />
        </div>


        <label className="sort-select">
          <span className="sr-only">
            Sort calls
          </span>

          <select
            className="input"
            value={sort}
            onChange={(event) =>
              setSort(event.target.value)
            }
            aria-label="Sort calls"
          >
            {SORTS.map((item) => (
              <option
                key={item.value}
                value={item.value}
              >
                {item.label}
              </option>
            ))}
          </select>
        </label>
      </div>


      <div className="filter-row">
        <Segmented
          label="Filter calls"
          options={FILTERS}
          value={filter}
          onChange={(value) => {
            setFilter(value);
            setPage(1);
          }}
        />

        {(localOnly || sort !== 'newest') && (
          <span className="faint filter-note">
            {localOnly
              ? 'Filtering the calls on this page.'
              : 'Sorting the calls on this page.'}
          </span>
        )}
      </div>


      {loading && !data ? (
        <LoadingSkeleton variant="list" />
      ) : error && !data ? (
        <ErrorState
          title="Unable to load calls"
          message={friendlyError(error)}
          onRetry={reload}
        />
      ) : items.length === 0 ? (
        filtered ? (
          <EmptyState
            icon="search"
            title="No calls match"
            action={
              <Button onClick={clear}>
                Clear filters
              </Button>
            }
          >
            Try a different search or filter.
          </EmptyState>
        ) : (
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
            Upload your first sales call to start building
            your sales intelligence dashboard.
          </EmptyState>
        )
      ) : (
        <div
          className={
            loading ? 'is-refreshing' : ''
          }
        >
          <CallListHeader />

          <motion.ul
            key={`${page}-${q}-${filter}`}
            className="call-list"
            variants={stagger}
            initial="hidden"
            animate="show"
          >
            {items.map((call, index) => (
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
        </div>
      )}


      {pages > 1 && (
        <nav
          className="pager"
          aria-label="Pagination"
        >
          <Button
            size="sm"
            icon="chevronLeft"
            disabled={page <= 1}
            onClick={() =>
              setPage((current) => current - 1)
            }
          >
            Previous
          </Button>

          <span className="muted num">
            {page} / {pages}
          </span>

          <Button
            size="sm"
            disabled={page >= pages}
            onClick={() =>
              setPage((current) => current + 1)
            }
          >
            Next
            <Icon name="chevronRight" />
          </Button>
        </nav>
      )}
    </>
  );
}