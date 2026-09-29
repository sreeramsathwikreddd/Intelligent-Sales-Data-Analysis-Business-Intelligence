import { useEffect, useMemo, useState } from 'react';

import {
  useNavigate,
  useParams,
  Link,
} from 'react-router-dom';

import {
  AnimatePresence,
  motion,
} from 'framer-motion';

import { calls as callsApi } from '../services/api';

import { useAsync } from '../hooks/useAsync';

import Button from '../components/Button';

import ErrorState from '../components/ErrorState';

import Icon from '../components/Icon';

import LoadingSkeleton from '../components/LoadingSkeleton';

import ManagerReport from '../components/ManagerReport';

import Modal from '../components/Modal';

import ProcessingTimeline from '../components/ProcessingTimeline';

import Segmented from '../components/Segmented';

import { StatusBadge } from '../components/StatusBadge';

import { useToast } from '../components/Toast';

import TranscriptViewer from '../components/TranscriptViewer';

import {
  isActiveStatus,
  labelList,
  normalizeList,
  num,
  outcomeConfidence,
  transcriptText,
} from '../utils/callData';

import { friendlyError } from '../utils/errors';

import {
  NOT_IDENTIFIED,
  formatBytes,
  formatDateTime,
  formatDuration,
  formatLabel,
  fractionToPct,
} from '../utils/format';

import {
  isValidId,
  callRef,
} from '../utils/ids';


const TABS = [
  {
    value: 'overview',
    label: 'Overview',
  },
  {
    value: 'report',
    label: 'Manager Report',
  },
  {
    value: 'transcript',
    label: 'Transcript',
  },
];


const stagger = {
  hidden: {},

  show: {
    transition: {
      staggerChildren: 0.06,
    },
  },
};


const rise = {
  hidden: {
    opacity: 0,
    y: 12,
  },

  show: {
    opacity: 1,
    y: 0,

    transition: {
      duration: 0.4,
      ease: [0.22, 1, 0.36, 1],
    },
  },
};


const safeMessage = (
  message,
  fallback,
) =>
  typeof message === 'string' &&
  message.trim() &&
  message.length < 200 &&
  !/\n\s+at\s/.test(message)
    ? message
    : fallback;


/*
 * The backend detail response normally looks like:
 *
 * {
 *   data: {
 *     call,
 *     analysis,
 *     report
 *   }
 * }
 *
 * The function also accepts the flat response form so
 * existing backend response variations remain compatible.
 */
function readPayload(response) {
  const payload =
    response?.data?.data;


  if (
    !payload ||
    typeof payload !== 'object'
  ) {
    throw new Error(
      'Call data was not returned by the server.',
    );
  }


  return {
    call:
      payload.call ||
      payload.callData ||
      payload,

    analysis:
      payload.analysis ||
      {},

    report:
      payload.report ||
      payload.managerReport ||
      {},
  };
}


/*
 * Evidence can arrive as:
 *
 * - string
 * - array
 * - object
 *
 * Keep the UI defensive so one malformed evidence
 * field cannot break the complete Call Detail page.
 */
function evidenceRows(ev) {
  const text = (value) => {
    if (typeof value === 'string') {
      return value;
    }


    if (
      value &&
      typeof value === 'object'
    ) {
      return String(
        value.text ??
        value.quote ??
        value.evidence ??
        value.excerpt ??
        value.snippet ??
        '',
      );
    }


    return '';
  };


  if (!ev) {
    return [];
  }


  if (typeof ev === 'string') {
    return [
      {
        text: ev,
      },
    ];
  }


  if (Array.isArray(ev)) {
    return ev
      .map((item) =>
        typeof item === 'string'
          ? {
              text: item,
            }
          : {
              label:
                item?.label ??
                item?.signal ??
                item?.objection ??
                item?.type ??
                item?.name,

              text: text(item),
            },
      )
      .filter(
        (row) =>
          row.text ||
          row.label,
      );
  }


  if (
    typeof ev === 'object'
  ) {
    return Object.entries(ev)
      .flatMap(
        ([key, value]) =>
          Array.isArray(value)
            ? value.map((item) => ({
                label: key,
                text: text(item),
              }))
            : typeof value === 'string'
              ? [
                  {
                    label: key,
                    text: value,
                  },
                ]
              : [],
      )
      .filter(
        (row) => row.text,
      );
  }


  return [];
}


function InfoCard({
  title,
  icon,
  tone,
  children,
  wide,
}) {
  return (
    <motion.section
      variants={rise}
      className={`card info-card ${
        wide ? 'is-wide' : ''
      }`}
    >
      <div className="info-head">
        <span
          className={`info-icon ${
            tone
              ? `tone-${tone}`
              : ''
          }`}
        >
          <Icon name={icon} />
        </span>

        <h3>{title}</h3>
      </div>

      {children}
    </motion.section>
  );
}


const Tags = ({
  items,
  tone,
}) =>
  items.length ? (
    <div className="pill-row">
      {items.map(
        (item, index) => (
          <span
            key={`${item}-${index}`}
            className={`pill ${tone}`}
          >
            {item}
          </span>
        ),
      )}
    </div>
  ) : (
    <p className="faint">
      {NOT_IDENTIFIED}
    </p>
  );


function Evidence({
  rows,
}) {
  const [all, setAll] =
    useState(false);


  const shown =
    all
      ? rows
      : rows.slice(0, 6);


  return (
    <>
      <ul className="evidence-list">
        {shown.map(
          (row, index) => (
            <li key={index}>
              {row.label && (
                <span className="evidence-label">
                  {formatLabel(
                    row.label,
                  )}
                </span>
              )}

              {row.text && (
                <span>
                  {row.text}
                </span>
              )}
            </li>
          ),
        )}
      </ul>


      {rows.length > 6 && (
        <Button
          size="sm"
          variant="ghost"
          onClick={() =>
            setAll(
              (current) =>
                !current,
            )
          }
        >
          {all
            ? 'Show less'
            : `Show all ${rows.length}`}
        </Button>
      )}
    </>
  );
}


/*
 * MongoDB _id:
 *
 * 24 hexadecimal characters.
 *
 * Public callId:
 *
 * call_xxxxxxxxxxxxxxxx
 *
 * The detail page supports both, but ALWAYS resolves
 * public IDs to Mongo _id before calling the detail API.
 */
const isMongoId = (value) =>
  /^[a-f0-9]{24}$/i.test(
    String(value || '').trim(),
  );


/*
 * Load the authenticated call list and find the exact
 * call represented by the route.
 *
 * This is deliberately kept in the frontend.
 * No backend/API behaviour is changed.
 */
async function findCallInHistory(routeId) {
  const response =
    await callsApi.list({
      page: 1,
      limit: 100,
    });


  const items =
    Array.isArray(
      response?.data?.data,
    )
      ? response.data.data
      : [];


  const normalizedRouteId =
    String(routeId || '').trim();


  return (
    items.find((item) => {
      const mongoId =
        item?._id ||
        item?.id ||
        null;


      const publicId =
        item?.callId ||
        null;


      const ref =
        callRef(item);


      return (
        String(mongoId || '') ===
          normalizedRouteId ||

        String(publicId || '') ===
          normalizedRouteId ||

        String(ref || '') ===
          normalizedRouteId
      );
    }) || null
  );
}


/*
 * Resolve any route identifier into the MongoDB _id
 * that the existing backend detail endpoint expects.
 *
 * Important:
 * We do NOT change the backend.
 */
async function resolveMongoCallId(routeId) {
  const normalized =
    String(routeId || '').trim();


  if (!normalized) {
    return null;
  }


  if (isMongoId(normalized)) {
    return normalized;
  }


  const historyCall =
    await findCallInHistory(
      normalized,
    );


  if (!historyCall) {
    return null;
  }


  return (
    historyCall?._id ||
    historyCall?.id ||
    null
  );
}


/*
 * Load complete call data.
 *
 * Flow:
 *
 * Route ID
 *   â†“
 * Resolve to Mongo _id
 *   â†“
 * GET /api/calls/:mongoId
 *
 * This eliminates the old public-callId â†’ ObjectId problem.
 */
async function loadCallData(routeId) {
  const normalized =
    String(routeId || '').trim();


  const mongoId =
    await resolveMongoCallId(
      normalized,
    );


  if (!mongoId) {
    const notFoundError =
      new Error(
        'Call not found.',
      );

    notFoundError.response = {
      status: 404,
    };

    throw notFoundError;
  }


  /*
   * The resolved Mongo ID is the ONLY identifier
   * sent to the existing detail endpoint.
   */
  return callsApi
    .get(mongoId)
    .then(readPayload);
}


export default function CallDetail() {
  const { id } =
    useParams();


  const navigate =
    useNavigate();


  const toast =
    useToast();


  const valid =
    Boolean(id && String(id).trim());


  const [tab, setTab] =
    useState('overview');


  const [
    confirmDelete,
    setConfirmDelete,
  ] = useState(false);


  const [
    deleting,
    setDeleting,
  ] = useState(false);


  const {
    data,
    error,
    loading,
    reload,
  } = useAsync(
    () =>
      loadCallData(id),
    [id],
    {
      enabled: valid,
    },
  );


  const status =
    data?.call
      ?.processingStatus;


  /*
   * Continue polling only while the backend says the
   * call is actively processing.
   */
  useEffect(() => {
    if (
      !isActiveStatus(status)
    ) {
      return undefined;
    }


    const timer =
      setInterval(
        reload,
        2500,
      );


    return () =>
      clearInterval(timer);
  }, [
    status,
    reload,
  ]);


  const view =
    useMemo(() => {
      if (!data) {
        return null;
      }


      const {
        call,
        analysis,
        report,
      } = data;


      const outcome =
        analysis.salesOutcome ||
        call.salesOutcome ||
        null;


      const merged = {
        successConfidence:
          analysis.successConfidence ??
          call.successConfidence,

        failureConfidence:
          analysis.failureConfidence ??
          call.failureConfidence,
      };


      return {
        outcome,

        successConfidence:
          num(
            merged.successConfidence,
          ),

        failureConfidence:
          num(
            merged.failureConfidence,
          ),

        confidence:
          outcomeConfidence(
            outcome,
            merged,
          ),

        intent:
          analysis.customerIntent ||
          call.customerIntent ||
          null,

        signals:
          Array.isArray(
            analysis.buyingSignals,
          )
            ? analysis.buyingSignals
            : Array.isArray(
                call.buyingSignals,
              )
              ? call.buyingSignals
              : [],

        objections:
          Array.isArray(
            analysis.objections,
          )
            ? analysis.objections
            : Array.isArray(
                call.objections,
              )
              ? call.objections
              : [],

        situation:
          analysis.customerSituation ||
          call.customerSituation ||
          null,

        decision:
          analysis.decisionPoint ||
          call.decisionPoint ||
          null,

        transcript:
          transcriptText(
            call.transcript,
          ),

        evidence:
          evidenceRows(
            analysis.evidence,
          ),

        wentWell:
          normalizeList(
            report.whatWentWell,
          ),

        needsImprovement:
          normalizeList(
            report.whatNeedsImprovement,
          ),

        followUp:
          normalizeList(
            report.recommendedFollowUp,
          ),
      };
    }, [data]);


  if (!valid) {
    return (
      <ErrorState
        title="Call not found"
        message="This link does not point to a valid call."
        action={
          <Link
            to="/history"
            className="btn btn-secondary"
          >
            Back to Call History
          </Link>
        }
      />
    );
  }


  if (
    loading &&
    !data
  ) {
    return (
      <>
        <Link
          to="/history"
          className="back-link"
        >
          <Icon
            name="chevronLeft"
            size={14}
          />
          Call History
        </Link>

        <LoadingSkeleton
          variant="detail"
        />
      </>
    );
  }


  if (
    error &&
    !data
  ) {
    const notFound =
      error?.response?.status ===
      404;


    return (
      <ErrorState
        title={
          notFound
            ? 'Call not found'
            : 'Unable to load this call'
        }
        message={friendlyError(
          error,
          'Unable to load call',
        )}
        onRetry={
          reload
        }
        action={
          <Link
            to="/history"
            className="btn btn-secondary"
          >
            Back to Call History
          </Link>
        }
      />
    );
  }


  const {
    call,
    analysis,
    report,
  } = data;


  /*
   * Always use the actual Mongo ID for destructive
   * operations if it is available.
   */
  const mongoCallId =
    call?._id ||
    call?.id ||
    null;


  const callId =
    call?.callId ||
    mongoCallId ||
    id;


  const duration =
    call?.durationSeconds ??
    call?.duration ??
    null;


  const active =
    isActiveStatus(status);


  const tone =
    view.outcome === 'SUCCESS'
      ? 'success'
      : view.outcome === 'FAILURE'
        ? 'failure'
        : 'neutral';


  const copyText =
    () =>
      JSON.stringify(
        {
          sales_outcome:
            view.outcome ||
            'â€”',

          customer_situation:
            view.situation ||
            NOT_IDENTIFIED,

          key_buying_signals:
            view.signals,

          main_objections:
            view.objections,

          what_went_well:
            view.wentWell,

          what_needs_improvement:
            view.needsImprovement,

          recommended_follow_up:
            view.followUp,
        },
        null,
        2,
      );


  const downloadJson =
    () => {
      const blob =
        new Blob(
          [
            JSON.stringify(
              {
                call,
                analysis,
                report,
              },
              null,
              2,
            ),
          ],
          {
            type:
              'application/json',
          },
        );


      const url =
        URL.createObjectURL(
          blob,
        );


      const anchor =
        document.createElement(
          'a',
        );


      anchor.href = url;


      anchor.download =
        `${callId}.json`;


      document.body.appendChild(
        anchor,
      );


      anchor.click();


      anchor.remove();


      setTimeout(
        () =>
          URL.revokeObjectURL(
            url,
          ),
        1000,
      );


      toast.success(
        'JSON downloaded',
      );
    };


  const remove =
    async () => {
      setDeleting(true);


      try {
        /*
         * IMPORTANT:
         * Delete using the resolved Mongo _id,
         * never the public callId.
         */
        const deleteId =
          mongoCallId ||
          (isMongoId(id)
            ? id
            : null);


        if (!deleteId) {
          throw new Error(
            'Unable to determine the call ID for deletion.',
          );
        }


        await callsApi.delete(
          deleteId,
        );


        toast.success(
          'Call deleted',
        );


        navigate(
          '/history',
        );
      } catch (deleteError) {
        console.error(
          '[ISDABI] Delete failed:',
          deleteError,
        );


        toast.error(
          friendlyError(
            deleteError,
            'Unable to delete this call.',
          ),
        );


        setDeleting(false);
        setConfirmDelete(false);
      }
    };


  const pipeline = [
    [
      'Speech-to-text',
      analysis.speechToTextModel,
    ],

    [
      'Outcome model',
      analysis.outcomeModel,
    ],

    [
      'Report model',
      analysis.llmModel,
    ],

    [
      'Model version',
      analysis.modelVersion,
    ],

    [
      'Report status',
      analysis.qwenStatus,
    ],
  ].filter(
    ([, value]) =>
      value !== undefined &&
      value !== null &&
      String(value).trim() !== '',
  );


  const facts = [
    [
      'Language',
      call.detectedLanguage,
    ],

    [
      'Audio format',
      call.audioFormat,
    ],

    [
      'File size',
      Number.isFinite(
        call.audioSizeBytes,
      )
        ? formatBytes(
            call.audioSizeBytes,
          )
        : null,
    ],

    [
      'Processing started',
      call.processingStartedAt
        ? formatDateTime(
            call.processingStartedAt,
          )
        : null,
    ],

    [
      'Processing completed',
      call.processingCompletedAt
        ? formatDateTime(
            call.processingCompletedAt,
          )
        : null,
    ],
  ].filter(
    ([, value]) =>
      value !== undefined &&
      value !== null &&
      String(value).trim() !== '',
  );


  return (
    <>
      <Link
        to="/history"
        className="back-link"
      >
        <Icon
          name="chevronLeft"
          size={14}
        />
        Call History
      </Link>


      <header className="page-header">
        <div className="detail-title">
          <h1 className="page-title truncate">
            {call.originalFilename ||
              'Call Analysis'}
          </h1>


          <div className="meta-row">
            <span className="pill">
              {callId}
            </span>

            <span className="pill">
              {call.createdAt
                ? formatDateTime(
                    call.createdAt,
                  )
                : 'Date not available'}
            </span>

            <span className="pill num">
              Duration{' '}
              {formatDuration(
                duration,
              )}
            </span>

            <StatusBadge
              status={status}
            />
          </div>
        </div>


        <div className="page-actions">
          <Button
            variant="danger"
            icon="trash"
            onClick={() =>
              setConfirmDelete(
                true,
              )
            }
            disabled={active}
          >
            Delete
          </Button>
        </div>
      </header>


      {active && (
        <ProcessingTimeline
          phase="processing"
          backendStatus={status}
          stage={
            call.processingStage
          }
          filename={
            call.originalFilename
          }
        />
      )}


      {status ===
        'failed' && (
        <ErrorState
          title="Analysis did not finish"
          message={safeMessage(
            call.processingError,
            'The analysis failed. Please upload the recording again.',
          )}
          action={
            <Link
              to="/analyze"
              className="btn btn-accent"
            >
              Analyze another call
            </Link>
          }
        />
      )}


      {!active &&
        status !==
          'failed' && (
          <motion.div
            variants={stagger}
            initial="hidden"
            animate="show"
          >
            <motion.section
              variants={rise}
              className={`card hero tone-${tone}`}
            >
              <div className="hero-outcome-block">
                <span className="metric-label">
                  Sales Outcome
                </span>

                <div className="hero-outcome">
                  {view.outcome ||
                    'UNKNOWN'}
                </div>

                {view.intent && (
                  <span className="pill pill-accent">
                    {formatLabel(
                      view.intent,
                    )}
                  </span>
                )}
              </div>


              <div className="hero-confidence">
                <div className="hero-confidence-head">
                  <span className="metric-label">
                    Model confidence
                  </span>

                  <strong className="hero-conf-value num">
                    {fractionToPct(
                      view.confidence,
                    )}
                  </strong>
                </div>


                <div
                  className="bar-track"
                  role="img"
                  aria-label={`Model confidence ${fractionToPct(
                    view.confidence,
                  )}`}
                >
                  <motion.div
                    className={`bar-fill fill-${tone}`}
                    initial={{
                      scaleX: 0,
                    }}
                    animate={{
                      scaleX:
                        view.confidence ??
                        0,
                    }}
                    transition={{
                      duration: 0.9,
                      ease: [
                        0.22,
                        1,
                        0.36,
                        1,
                      ],
                      delay: 0.2,
                    }}
                  />
                </div>


                <p className="faint hero-note">
                  Not a guaranteed probability

                  {view.successConfidence !==
                    null &&
                    view.failureConfidence !==
                      null && (
                      <>
                        {' '}
                        <span aria-hidden="true">
                          Â·
                        </span>{' '}
                        Success{' '}
                        {fractionToPct(
                          view.successConfidence,
                        )}{' '}
                        <span aria-hidden="true">
                          Â·
                        </span>{' '}
                        Failure{' '}
                        {fractionToPct(
                          view.failureConfidence,
                        )}
                      </>
                    )}
                </p>
              </div>
            </motion.section>


            <motion.div
              variants={rise}
              className="tabs-row"
            >
              <Segmented
                label="Call analysis sections"
                options={TABS}
                value={tab}
                onChange={setTab}
              />
            </motion.div>


            <AnimatePresence
              mode="wait"
              initial={false}
            >
              <motion.div
                key={tab}
                initial={{
                  opacity: 0,
                  y: 6,
                }}
                animate={{
                  opacity: 1,
                  y: 0,
                }}
                exit={{
                  opacity: 0,
                }}
                transition={{
                  duration: 0.2,
                }}
              >
                {tab ===
                  'overview' && (
                  <motion.div
                    className="info-grid"
                    variants={stagger}
                    initial="hidden"
                    animate="show"
                  >
                    <InfoCard
                      title="Customer Intent"
                      icon="target"
                      tone="accent"
                    >
                      {view.intent ? (
                        <span className="pill pill-accent">
                          {formatLabel(
                            view.intent,
                          )}
                        </span>
                      ) : (
                        <p className="faint">
                          {NOT_IDENTIFIED}
                        </p>
                      )}
                    </InfoCard>


                    <InfoCard
                      title="Decision Point"
                      icon="check"
                    >
                      {view.decision ? (
                        <p>
                          {view.decision}
                        </p>
                      ) : (
                        <p className="faint">
                          {NOT_IDENTIFIED}
                        </p>
                      )}
                    </InfoCard>


                    <InfoCard
                      title="Buying Signals"
                      icon="wave"
                      tone="success"
                    >
                      <Tags
                        items={labelList(
                          view.signals,
                        )}
                        tone="pill-success"
                      />
                    </InfoCard>


                    <InfoCard
                      title="Objections"
                      icon="alert"
                      tone="warning"
                    >
                      <Tags
                        items={labelList(
                          view.objections,
                        )}
                        tone="pill-warning"
                      />
                    </InfoCard>


                    <InfoCard
                      title="Customer Situation"
                      icon="user"
                      wide
                    >
                      {view.situation ? (
                        <p className="situation">
                          {view.situation}
                        </p>
                      ) : (
                        <p className="faint">
                          {NOT_IDENTIFIED}
                        </p>
                      )}
                    </InfoCard>


                    {view.evidence
                      .length >
                      0 && (
                      <InfoCard
                        title="Supporting Evidence"
                        icon="search"
                        wide
                      >
                        <Evidence
                          rows={
                            view.evidence
                          }
                        />
                      </InfoCard>
                    )}


                    {(pipeline.length >
                      0 ||
                      facts.length >
                        0) && (
                      <InfoCard
                        title="Analysis Details"
                        icon="info"
                        wide
                      >
                        <dl className="kv">
                          {[
                            ...pipeline,
                            ...facts,
                          ].map(
                            ([
                              key,
                              value,
                            ]) => (
                              <div
                                key={key}
                              >
                                <dt>
                                  {key}
                                </dt>

                                <dd className="truncate">
                                  {String(
                                    value,
                                  )}
                                </dd>
                              </div>
                            ),
                          )}
                        </dl>
                      </InfoCard>
                    )}
                  </motion.div>
                )}


                {tab ===
                  'report' && (
                  <ManagerReport
                    situation={
                      report.customerSituation ||
                      view.situation
                    }

                    signals={labelList(
                      Array.isArray(
                        report.keyBuyingSignals,
                      )
                        ? report.keyBuyingSignals
                        : view.signals,
                    )}

                    objections={labelList(
                      Array.isArray(
                        report.mainObjections,
                      )
                        ? report.mainObjections
                        : view.objections,
                    )}

                    wentWell={
                      view.wentWell
                    }

                    needsImprovement={
                      view.needsImprovement
                    }

                    followUp={
                      view.followUp
                    }

                    getCopyText={
                      copyText
                    }

                    onDownload={
                      downloadJson
                    }
                  />
                )}


                {tab ===
                  'transcript' && (
                  <section className="card">
                    <div className="card-title">
                      <h3>
                        Transcript
                      </h3>
                    </div>

                    <TranscriptViewer
                      text={
                        view.transcript
                      }
                    />
                  </section>
                )}
              </motion.div>
            </AnimatePresence>
          </motion.div>
        )}


      <Modal
        open={confirmDelete}
        onClose={() =>
          !deleting &&
          setConfirmDelete(
            false,
          )
        }
        title="Delete this call?"
        actions={
          <>
            <Button
              onClick={() =>
                setConfirmDelete(
                  false,
                )
              }
              disabled={deleting}
            >
              Cancel
            </Button>

            <Button
              variant="danger-solid"
              loading={deleting}
              loadingLabel="Deletingâ€¦"
              onClick={remove}
            >
              Delete call
            </Button>
          </>
        }
      >
        <p className="muted">
          The transcript, analysis
          and manager report for{' '}
          {call.originalFilename ||
            callId}{' '}
          will be permanently
          removed.
        </p>
      </Modal>
    </>
  );
}



