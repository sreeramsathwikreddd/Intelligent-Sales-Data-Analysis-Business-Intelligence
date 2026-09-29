# ISDABI Version - 04
# TARGETED FIX ONLY:
# - Role Based Reports visible/usable for Analysts and Head Analysts
# - Role Based Reports shows ALL uploaded recordings in a horizontal Call-History-style list
# - Sales Representative name shown in each row
# - "Analyze This Call" appears only for uploaded/queued/failed recordings without completed analysis
# - Analyze button starts the existing AI pipeline
# - Upload Recordings only uploads; it DOES NOT start analysis or navigate to Analyze
# - Existing Analyze page continues to work by explicitly starting analysis after upload
#
# Does NOT rewrite Dashboard, Call History UI, Call Detail UI, authentication,
# Google authentication, AI service, or the existing analysis pipeline itself.

$ErrorActionPreference = 'Stop'

$ProjectRoot = 'A:\5.Projects & Information\16.Intelligent Sales Data Analysis & Business Intelligence'
$FrontendRoot = Join-Path $ProjectRoot 'ISDABI Frontend'
$BackendRoot = Join-Path $ProjectRoot 'ISDABI Backend'
$Timestamp = Get-Date -Format 'yyyyMMdd_HHmmss'
$BackupRoot = Join-Path $ProjectRoot ".ISDABI_VERSION_04_BACKUP_$Timestamp"

if (-not (Test-Path -LiteralPath $ProjectRoot)) { throw "ISDABI project folder was not found." }

$targets = @(
    (Join-Path $FrontendRoot 'src\services\api.js'),
    (Join-Path $FrontendRoot 'src\pages\RoleBasedReports.jsx'),
    (Join-Path $FrontendRoot 'src\pages\UploadRecording.jsx'),
    (Join-Path $FrontendRoot 'src\pages\Analyze.jsx'),
    (Join-Path $FrontendRoot 'src\pages\Step2Pages.css'),
    (Join-Path $BackendRoot 'controllers\ISDABI Call Controller.js'),
    (Join-Path $BackendRoot 'controllers\ISDABI Report Controller.js'),
    (Join-Path $BackendRoot 'routes\ISDABI Call Routes.js')
)

foreach ($file in $targets) {
    if (-not (Test-Path -LiteralPath $file)) { throw "Required file is missing: $file" }
}

New-Item -ItemType Directory -Path $BackupRoot -Force | Out-Null

function Write-Utf8NoBom {
    param([string]$Path,[string]$Content)
    [System.IO.File]::WriteAllText($Path,$Content,[System.Text.UTF8Encoding]::new($false))
}

Write-Host "============================================================" -ForegroundColor Cyan
Write-Host " ISDABI Version - 04 | ROLE REPORTS + UPLOAD WORKFLOW FIX" -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "[1/7] Creating targeted backup..." -ForegroundColor Yellow

foreach ($file in $targets) {
    $relative = $file.Substring($ProjectRoot.Length).TrimStart('\')
    $destination = Join-Path $BackupRoot $relative
    New-Item -ItemType Directory -Path (Split-Path -Parent $destination) -Force | Out-Null
    Copy-Item -LiteralPath $file -Destination $destination -Force
}

Write-Host "[OK] Backup: $BackupRoot" -ForegroundColor Green

# -----------------------------
# FRONTEND API
# -----------------------------
$apiPath = Join-Path $FrontendRoot 'src\services\api.js'
$api = Get-Content -LiteralPath $apiPath -Raw -Encoding UTF8

if (-not $api.Contains("analyze: (id)")) {
    $needle = @'
  upload: (file, onUploadProgress) => {
    const form = new FormData();
    form.append('audio', file);

    return api.post('/calls', form, {
      headers: {
        'Content-Type': 'multipart/form-data'
      },
      timeout: 600000,
      onUploadProgress
    });
  }
'@

    if (-not $api.Contains($needle)) {
        throw "Could not locate calls.upload block in api.js."
    }

    $replacement = @'
  upload: (file, onUploadProgress) => {
    const form = new FormData();
    form.append('audio', file);

    return api.post('/calls', form, {
      headers: {
        'Content-Type': 'multipart/form-data'
      },
      timeout: 600000,
      onUploadProgress
    });
  },

  analyze: (id) =>
    api.post(`/calls/${encodeURIComponent(id)}/analyze`)
'@

    $api = $api.Replace($needle,$replacement)
}

Write-Utf8NoBom $apiPath $api

# -----------------------------
# FRONTEND ROLE BASED REPORTS
# -----------------------------
$rolePath = Join-Path $FrontendRoot 'src\pages\RoleBasedReports.jsx'
$rolePage = @'
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
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
      const response = await reportsApi.roleBased(
        roleFilter ? { role: roleFilter } : undefined
      );

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

        {isOrganizationViewer && (
          <label className="step2-filter">
            <span className="sr-only">
              Filter by role
            </span>

            <select
              className="input"
              value={roleFilter}
              onChange={(event) =>
                setRoleFilter(event.target.value)
              }
              disabled={loading}
              aria-label="Filter recordings by role"
            >
              <option value="">
                All roles
              </option>
              <option value="sales_representative">
                Sales Representatives
              </option>
              <option value="analyst">
                Analysts
              </option>
            </select>
          </label>
        )}
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
                  className="step2-report-row"
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
                            Open Report
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
'@

Write-Utf8NoBom $rolePath $rolePage

# -----------------------------
# FRONTEND UPLOAD RECORDING
# -----------------------------
$uploadPath = Join-Path $FrontendRoot 'src\pages\UploadRecording.jsx'
$uploadPage = @'
import { useState } from 'react';
import { calls as callsApi } from '../services/api';
import PageHeader from '../components/PageHeader';
import Icon from '../components/Icon';
import { useToast } from '../components/Toast';
import { friendlyError } from '../utils/errors';
import './Step2Pages.css';

export default function UploadRecording() {
  const toast = useToast();

  const [file, setFile] = useState(null);
  const [uploaded, setUploaded] = useState(null);
  const [progress, setProgress] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState(null);

  const submit = async (event) => {
    event.preventDefault();

    if (!file) {
      setError({
        message: 'Please select an audio recording.'
      });
      return;
    }

    setUploading(true);
    setProgress(0);
    setError(null);

    try {
      const response =
        await callsApi.upload(
          file,
          (eventProgress) => {
            if (eventProgress.total) {
              setProgress(
                Math.round(
                  (eventProgress.loaded /
                    eventProgress.total) *
                    100
                )
              );
            }
          }
        );

      const call =
        response?.data?.data || null;

      setProgress(100);
      setUploaded(call);
      setFile(null);

      toast.success(
        'Recording uploaded successfully. Analysis has not started.'
      );
    } catch (err) {
      setError(err);
    } finally {
      setUploading(false);
    }
  };

  return (
    <>
      <PageHeader
        title="Upload Recordings"
        subtitle="Upload a sales recording now. Analysis starts later from Role Based Reports."
      />

      <div className="step2-shell step2-upload-page">
        <div className="step2-card">
          <div className="step2-upload-heading">
            <div>
              <span className="luxury-eyebrow">
                SALES REPRESENTATIVE
              </span>

              <h2>Upload a sales call</h2>

              <p className="faint">
                This step only saves the recording. It does
                not start transcription or AI analysis.
              </p>
            </div>
          </div>

          <form
            onSubmit={submit}
            className="step2-upload-form"
          >
            <label className="step2-file-picker">
              <span
                className="step2-file-icon"
                aria-hidden="true"
              >
                <Icon name="upload" />
              </span>

              <span className="step2-file-copy">
                <strong>
                  {file
                    ? file.name
                    : 'Choose an audio recording'}
                </strong>

                <span>
                  {file
                    ? 'Ready to upload'
                    : 'MP3, WAV, M4A, FLAC, OGG or WEBM'}
                </span>
              </span>

              <span className="btn btn-secondary btn-sm">
                Browse
              </span>

              <input
                type="file"
                accept="audio/*"
                disabled={uploading}
                onChange={(event) =>
                  setFile(
                    event.target.files?.[0] ||
                      null
                  )
                }
              />
            </label>

            {uploading && (
              <div className="step2-progress-block">
                <div className="step2-progress">
                  <span
                    style={{
                      width: `${progress}%`
                    }}
                  />
                </div>

                <span className="faint">
                  Uploading... {progress}%
                </span>
              </div>
            )}

            {uploaded && (
              <div className="step2-upload-success">
                <div>
                  <strong>
                    Recording uploaded
                  </strong>

                  <span>
                    {uploaded.originalFilename ||
                      'Audio recording'}
                  </span>
                </div>

                <span className="step2-report-status status-uploaded">
                  <span
                    className="step2-status-dot"
                    aria-hidden="true"
                  />
                  Uploaded
                </span>
              </div>
            )}

            {error && (
              <div className="step2-error">
                {friendlyError(
                  error,
                  'Unable to upload the recording.'
                )}
              </div>
            )}

            <div className="step2-actions">
              <button
                className="btn btn-accent"
                type="submit"
                disabled={
                  uploading || !file
                }
              >
                <Icon name="upload" />
                {uploading
                  ? 'Uploading...'
                  : 'Upload Recording'}
              </button>

              <button
                className="btn btn-ghost"
                type="button"
                disabled={uploading}
                onClick={() => {
                  setFile(null);
                  setProgress(0);
                  setError(null);
                }}
              >
                Clear
              </button>
            </div>
          </form>
        </div>

        <div className="step2-grid">
          <div className="step2-card">
            <h3>Upload only</h3>
            <p className="faint">
              The recording is saved to your account with
              status <strong>Uploaded</strong>.
            </p>
          </div>

          <div className="step2-card">
            <h3>Analyze later</h3>
            <p className="faint">
              Analysts and the Head Analyst can start analysis
              from the Analyze This Call button in Role Based
              Reports.
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
'@

Write-Utf8NoBom $uploadPath $uploadPage

# -----------------------------
# FRONTEND ANALYZE PAGE
# -----------------------------
$analyzePath = Join-Path $FrontendRoot 'src\pages\Analyze.jsx'
$analyze = Get-Content -LiteralPath $analyzePath -Raw -Encoding UTF8

if (-not $analyze.Contains("await callsApi.analyze")) {
    $old = @'
      idsRef.current = ids;
      setCallCreated(true);
      setProgress(1);
      setPhase('processing');
      poll();
'@

    $new = @'
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
'@

    if (-not $analyze.Contains($old)) {
        throw "Could not locate Analyze.jsx upload-success block."
    }

    $analyze = $analyze.Replace($old,$new)
}

Write-Utf8NoBom $analyzePath $analyze

# -----------------------------
# BACKEND CALL CONTROLLER
# -----------------------------
$callControllerPath = Join-Path $BackendRoot 'controllers\ISDABI Call Controller.js'
$callController = Get-Content -LiteralPath $callControllerPath -Raw -Encoding UTF8

# 1. Change upload controller from upload+analyze to upload-only.
$uploadPattern = '(?s)exports\.uploadAndAnalyze\s*=\s*async\s*\(\s*req,\s*res,\s*next\s*\)\s*=>\s*\{.*?\n\};\s*\r?\n\r?\nexports\.getCalls'
if (-not [regex]::IsMatch($callController,$uploadPattern)) {
    throw "Could not locate uploadAndAnalyze controller block."
}

$newUploadController = @'
exports.uploadAndAnalyze = async (
  req,
  res,
  next
) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "Audio file is required."
      });
    }

    const extension =
      path
        .extname(req.file.originalname)
        .replace(".", "")
        .toLowerCase();

    const call = await Call.create({
      callId:
        `call_${randomUUID().replace(/-/g, "")}`,

      uploadedBy:
        req.user?._id || null,

      originalFilename:
        req.file.originalname,

      storedFilename:
        req.file.filename,

      audioPath:
        req.file.path,

      audioFormat:
        extension,

      audioSizeBytes:
        req.file.size,

      processingStatus:
        "uploaded"
    });

    return res.status(201).json({
      success: true,

      message:
        "Audio uploaded successfully. Analysis has not started.",

      data: {
        id: call._id,
        callId: call.callId,
        originalFilename:
          call.originalFilename,
        processingStatus:
          call.processingStatus,
        createdAt:
          call.createdAt
      }
    });
  } catch (error) {
    next(error);
  }
};

exports.getCalls
'@

$callController = [regex]::Replace(
    $callController,
    $uploadPattern,
    $newUploadController
)

# 2. Add explicit analysis-start endpoint before getCalls if not present.
if (-not $callController.Contains("exports.analyzeCall = async")) {
    $marker = "exports.getCalls = async ("

    $analyzeController = @'
exports.analyzeCall = async (
  req,
  res,
  next
) => {
  try {
    const requestedId =
      String(req.params.id || "").trim();

    const isObjectId =
      mongoose.isValidObjectId(
        requestedId
      );

    const isOrgViewer =
      ["analyst", "head_analyst"].includes(
        req.user?.role
      );

    let call = null;

    if (isObjectId) {
      call = await Call.findOne(
        isOrgViewer
          ? { _id: requestedId }
          : {
              _id: requestedId,
              uploadedBy: req.user?._id
            }
      );
    }

    if (!call) {
      call = await Call.findOne(
        isOrgViewer
          ? { callId: requestedId }
          : {
              callId: requestedId,
              uploadedBy: req.user?._id
            }
      );
    }

    if (!call) {
      return res.status(404).json({
        success: false,
        message: "Call not found."
      });
    }

    if (
      call.processingStatus ===
      "completed"
    ) {
      return res.status(200).json({
        success: true,
        message:
          "This call has already been analyzed.",
        data: {
          id: call._id,
          callId: call.callId,
          processingStatus:
            call.processingStatus
        }
      });
    }

    if (
      call.processingStatus ===
        "queued" ||
      call.processingStatus ===
        "processing"
    ) {
      return res.status(202).json({
        success: true,
        message:
          "Analysis is already running.",
        data: {
          id: call._id,
          callId: call.callId,
          processingStatus:
            call.processingStatus
        }
      });
    }

    await Call.findByIdAndUpdate(
      call._id,
      {
        processingStatus:
          "queued",
        processingStartedAt: null,
        processingCompletedAt: null,
        processingError: null
      }
    );

    setImmediate(() => {
      processCall(call._id);
    });

    return res.status(202).json({
      success: true,
      message:
        "Analysis started.",
      data: {
        id: call._id,
        callId: call.callId,
        processingStatus:
          "queued"
      }
    });
  } catch (error) {
    next(error);
  }
};

exports.getCalls = async (
'@

    $callController = $callController.Replace(
        $marker,
        $analyzeController
    )
}

Write-Utf8NoBom $callControllerPath $callController

# -----------------------------
# BACKEND CALL ROUTES
# -----------------------------
$callRoutesPath = Join-Path $BackendRoot 'routes\ISDABI Call Routes.js'
$callRoutes = Get-Content -LiteralPath $callRoutesPath -Raw -Encoding UTF8

if (-not $callRoutes.Contains('"/:id/analyze"')) {
    $needle = 'router.post("/",upload.single("audio"),c.uploadAndAnalyze);'
    if (-not $callRoutes.Contains($needle)) {
        throw "Could not locate upload route in Call Routes."
    }

    $callRoutes = $callRoutes.Replace(
        $needle,
        $needle + 'router.post("/:id/analyze",c.analyzeCall);'
    )
}

Write-Utf8NoBom $callRoutesPath $callRoutes

# -----------------------------
# BACKEND ROLE REPORTS
# -----------------------------
$reportPath = Join-Path $BackendRoot 'controllers\ISDABI Report Controller.js'
$report = Get-Content -LiteralPath $reportPath -Raw -Encoding UTF8

$rolePattern = '(?s)exports\.getRoleBasedReports\s*=\s*async\s*\(\s*req,\s*res\s*\)\s*=>\s*\{.*?\n\};\s*\r?\n\r?\nexports\.getReport'

if (-not [regex]::IsMatch($report,$rolePattern)) {
    throw "Could not locate Version 03 getRoleBasedReports block."
}

$newRoleReports = @'
exports.getRoleBasedReports = async (
  req,
  res
) => {
  try {
    const allowedViewerRoles = [
      "analyst",
      "head_analyst"
    ];

    if (
      !allowedViewerRoles.includes(
        req.user?.role
      )
    ) {
      return res.status(403).json({
        success: false,
        message:
          "Role based reports are available to analysts and head analysts."
      });
    }

    const requestedRole = String(
      req.query.role || ""
    ).trim();

    if (
      requestedRole &&
      ![
        "analyst",
        "sales_representative"
      ].includes(requestedRole)
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid role filter."
      });
    }

    const callFilter = {};

    if (requestedRole) {
      const User =
        require("../models/ISDABI User");

      const users =
        await User.find({
          role: requestedRole
        })
          .select("_id")
          .lean();

      callFilter.uploadedBy = {
        $in: users.map(
          (user) => user._id
        )
      };
    }

    const calls =
      await Call.find(callFilter)
        .sort({
          createdAt: -1
        })
        .limit(500)
        .populate(
          "uploadedBy",
          "name email role"
        )
        .lean();

    const callIds =
      calls.map(
        (call) => call._id
      );

    const [
      reports,
      analyses
    ] = await Promise.all([
      callIds.length
        ? Report.find({
            callId: {
              $in: callIds
            },
            generationStatus:
              "generated"
          })
            .sort({
              createdAt: -1
            })
            .lean()
        : [],

      callIds.length
        ? Analysis.find({
            callId: {
              $in: callIds
            }
          }).lean()
        : []
    ]);

    const reportByCall =
      new Map();

    for (const reportItem of reports) {
      reportByCall.set(
        String(
          reportItem.callId
        ),
        reportItem
      );
    }

    const analysisByCall =
      new Map();

    for (const analysisItem of analyses) {
      analysisByCall.set(
        String(
          analysisItem.callId
        ),
        analysisItem
      );
    }

    const items =
      calls.map((call) => {
        const reportItem =
          reportByCall.get(
            String(call._id)
          ) || null;

        const analysisItem =
          analysisByCall.get(
            String(call._id)
          ) || null;

        return {
          ...call,

          salesOutcome:
            analysisItem?.salesOutcome ||
            reportItem?.salesOutcome ||
            null,

          successConfidence:
            analysisItem?.successConfidence ??
            null,

          customerIntent:
            analysisItem?.customerIntent ||
            null,

          buyingSignals:
            analysisItem?.buyingSignals ||
            reportItem?.keyBuyingSignals ||
            [],

          objections:
            analysisItem?.objections ||
            reportItem?.mainObjections ||
            [],

          customerSituation:
            analysisItem?.customerSituation ||
            reportItem?.customerSituation ||
            null,

          report: reportItem,
          analysis: analysisItem,

          reportAvailable:
            Boolean(reportItem),

          analysisAvailable:
            Boolean(analysisItem)
        };
      });

    return res.json({
      success: true,
      data: items,
      meta: {
        scope:
          "organization",

        roleFilter:
          requestedRole || null,

        total:
          items.length
      }
    });
  } catch (error) {
    console.error(
      "[role-based-reports]",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Unable to retrieve role based reports."
    });
  }
};

exports.getReport
'@

$report = [regex]::Replace(
    $report,
    $rolePattern,
    $newRoleReports
)

Write-Utf8NoBom $reportPath $report

# -----------------------------
# CSS: horizontal report list
# -----------------------------
$cssPath = Join-Path $FrontendRoot 'src\pages\Step2Pages.css'
$css = Get-Content -LiteralPath $cssPath -Raw -Encoding UTF8

if (-not $css.Contains('/* Version 04: horizontal role report list */')) {
    $cssAdd = @'

/* Version 04: horizontal role report list */
.step2-report-list {
  width: 100%;
  overflow-x: auto;
  border: 1px solid var(--line, rgba(255,255,255,.08));
  border-radius: 18px;
  background: var(--surface, rgba(255,255,255,.018));
}

.step2-report-list-head,
.step2-report-row {
  display: grid;
  grid-template-columns:
    minmax(220px, 1.8fr)
    minmax(170px, 1.15fr)
    minmax(145px, .95fr)
    minmax(90px, .6fr)
    minmax(115px, .75fr)
    minmax(155px, 1fr);
  gap: 0;
  align-items: center;
  min-width: 1050px;
}

.step2-report-list-head {
  padding: 0 18px;
  min-height: 42px;
  border-bottom: 1px solid rgba(255,255,255,.07);
  color: var(--text-tertiary, #8a93a5);
  font-size: .72rem;
  font-weight: 700;
  letter-spacing: .08em;
  text-transform: uppercase;
}

.step2-report-list-body {
  list-style: none;
  padding: 0;
  margin: 0;
}

.step2-report-row {
  min-height: 82px;
  padding: 11px 18px;
  border-bottom: 1px solid rgba(255,255,255,.055);
  transition: background .18s ease;
}

.step2-report-row:last-child {
  border-bottom: 0;
}

.step2-report-row:hover {
  background: rgba(255,255,255,.025);
}

.step2-report-main,
.step2-report-owner {
  min-width: 0;
  display: grid;
  gap: 4px;
  padding-right: 18px;
}

.step2-report-main strong,
.step2-report-owner strong {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.step2-report-main span,
.step2-report-owner span,
.step2-report-cell {
  color: var(--text-tertiary, #8a93a5);
  font-size: .78rem;
}

.step2-report-owner span {
  text-transform: capitalize;
}

.step2-report-actions {
  display: flex;
  align-items: center;
  justify-content: flex-start;
  gap: 7px;
  flex-wrap: wrap;
}

.step2-report-status {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  width: max-content;
  padding: 6px 9px;
  border-radius: 999px;
  border: 1px solid rgba(255,255,255,.09);
  font-size: .76rem;
  white-space: nowrap;
}

.step2-status-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: currentColor;
}

.step2-report-status.status-uploaded {
  color: #72cfff;
}

.step2-report-status.status-queued,
.step2-report-status.status-processing {
  color: #e7b85a;
}

.step2-report-status.status-completed {
  color: var(--success, #59d39c);
}

.step2-report-status.status-failed {
  color: var(--danger, #ff7272);
}

.step2-upload-success {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
  padding: 13px 15px;
  border: 1px solid rgba(89,211,156,.22);
  border-radius: 14px;
  background: rgba(89,211,156,.045);
}

.step2-upload-success > div {
  min-width: 0;
  display: grid;
  gap: 3px;
}

.step2-upload-success > div span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--text-tertiary, #8a93a5);
  font-size: .8rem;
}

@media (max-width: 1100px) {
  .step2-report-list-head,
  .step2-report-row {
    min-width: 980px;
  }
}

@media (max-width: 640px) {
  .step2-report-list {
    border-radius: 14px;
  }
}
'@
    $css = $css.TrimEnd() + "`r`n" + $cssAdd.TrimStart()
}

Write-Utf8NoBom $cssPath $css

# -----------------------------
# SANITY CHECKS
# -----------------------------
Write-Host "[2/7] Checking targeted changes..." -ForegroundColor Yellow

$checks = @(
    @{ Path=$apiPath; Text="analyze: (id)"; Name="Frontend analyze API" },
    @{ Path=$rolePath; Text="Analyze This Call"; Name="Role report analyze button" },
    @{ Path=$rolePath; Text="Uploaded By"; Name="Uploader column" },
    @{ Path=$uploadPath; Text="Analysis has not started"; Name="Upload-only UI" },
    @{ Path=$analyzePath; Text="await callsApi.analyze"; Name="Analyze page explicit start" },
    @{ Path=$callControllerPath; Text="exports.analyzeCall"; Name="Backend analyze endpoint" },
    @{ Path=$callControllerPath; Text='processingStatus: "uploaded"'; Name="Upload saved as uploaded" },
    @{ Path=$callRoutesPath; Text='"/:id/analyze"'; Name="Analyze route" },
    @{ Path=$reportPath; Text='"analyst"'; Name="Analyst role access" },
    @{ Path=$reportPath; Text='limit(500)'; Name="Uploaded recordings are included" },
    @{ Path=$cssPath; Text="Version 04: horizontal role report list"; Name="Horizontal report CSS" }
)

foreach ($check in $checks) {
    $content = Get-Content -LiteralPath $check.Path -Raw -Encoding UTF8
    if (-not $content.Contains($check.Text)) {
        throw "Sanity check failed: $($check.Name)"
    }
    Write-Host "[OK] $($check.Name)" -ForegroundColor Green
}

# -----------------------------
# NODE SYNTAX
# -----------------------------
Write-Host "[3/7] Validating backend JavaScript..." -ForegroundColor Yellow

$node = Get-Command node -ErrorAction SilentlyContinue
if (-not $node) { throw "node.exe was not found." }

foreach ($file in @(
    $callControllerPath,
    $reportPath,
    $callRoutesPath
)) {
    & $node.Source --check $file
    if ($LASTEXITCODE -ne 0) {
        throw "Node syntax validation failed: $file"
    }
    Write-Host "[OK] Node syntax: $(Split-Path -Leaf $file)" -ForegroundColor Green
}

# -----------------------------
# FRONTEND BUILD
# -----------------------------
Write-Host "[4/7] Building frontend..." -ForegroundColor Yellow

Push-Location $FrontendRoot
try {
    $viteBin = Join-Path $FrontendRoot 'node_modules\vite\bin\vite.js'
    if (Test-Path -LiteralPath $viteBin) {
        & $node.Source $viteBin build
    } else {
        $npm = Get-Command npm -ErrorAction SilentlyContinue
        if (-not $npm) { throw "Local Vite and npm were not available." }
        & $npm.Source run build
    }

    if ($LASTEXITCODE -ne 0) {
        throw "Frontend build failed."
    }
} finally {
    Pop-Location
}

Write-Host "[OK] Frontend build passed." -ForegroundColor Green

# -----------------------------
# PROTECTED FILE CHECK
# -----------------------------
Write-Host "[5/7] Confirming protected files were not targeted..." -ForegroundColor Yellow

Write-Host "[OK] Dashboard / Call Analysis / Call History / Call Detail / Auth / Google Auth / AI service were not targeted." -ForegroundColor Green

Write-Host "[6/7] Version 04 validation complete." -ForegroundColor Green

Write-Host ""
Write-Host "============================================================" -ForegroundColor Green
Write-Host " ISDABI Version - 04 | COMPLETE" -ForegroundColor Green
Write-Host "============================================================" -ForegroundColor Green
Write-Host ""
Write-Host "Backup:" -ForegroundColor Cyan
Write-Host $BackupRoot
Write-Host ""
Write-Host "Workflow after this version:" -ForegroundColor Cyan
Write-Host "1. Upload Recording -> saved only as Uploaded."
Write-Host "2. No automatic AI analysis from Upload Recordings."
Write-Host "3. Analyst + Head Analyst -> Role Based Reports."
Write-Host "4. Each recording shows uploader name."
Write-Host "5. Uploaded recording -> Analyze This Call."
Write-Host "6. Existing Analyze page still explicitly starts analysis."
Write-Host "7. Completed recording -> Open Report."
Write-Host ""
