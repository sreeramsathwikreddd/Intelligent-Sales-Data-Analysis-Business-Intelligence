$ErrorActionPreference = "Stop"

$VersionName = "ISDABI VERSION - 01"
$Root = "A:\5.Projects & Information\16.Intelligent Sales Data Analysis & Business Intelligence"
$VersionsRoot = Join-Path $Root "ISDABI Issues Versions"
$Frontend = Join-Path $Root "ISDABI Frontend"
$Backend = Join-Path $Root "ISDABI Backend"
$AI = Join-Path $Root "ISDABI AI ML"

$TimelinePath = Join-Path $Frontend "src\components\ProcessingTimeline.jsx"
$CssPath = Join-Path $Frontend "src\pages\Step2Pages.css"
$ModelPath = Join-Path $Backend "models\ISDABI Call.js"
$ControllerPath = Join-Path $Backend "controllers\ISDABI Call Controller.js"
$ServicePath = Join-Path $Backend "services\ISDABI AI Service.js"
$ApiPath = Join-Path $AI "api\ISDABI AI API.py"
$PipelinePath = Join-Path $AI "inference\ISDABI Audio Sales Analysis Pipeline V1.3.0.py"

$Targets = @(
    $TimelinePath,
    $CssPath,
    $ModelPath,
    $ControllerPath,
    $ServicePath,
    $ApiPath,
    $PipelinePath
)

function Write-Utf8NoBom([string]$Path, [string]$Text) {
    [System.IO.File]::WriteAllText(
        $Path,
        $Text,
        [System.Text.UTF8Encoding]::new($false)
    )
}

function Read-Text([string]$Path) {
    return [System.IO.File]::ReadAllText($Path)
}

function Require-Text([string]$Text, [string]$Needle, [string]$Name) {
    if (-not $Text.Contains($Needle)) {
        throw "Required anchor not found: $Name"
    }
}

Write-Host ""
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host " $VersionName | REAL-STAGE CALL ANALYSIS TIMELINE" -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host ""

# ------------------------------------------------------------
# VERIFY
# ------------------------------------------------------------
Write-Host "[1/8] Verifying only the 7 required files..." -ForegroundColor Yellow

foreach ($Path in $Targets) {
    if (-not (Test-Path -LiteralPath $Path)) {
        throw "Required file missing: $Path"
    }
    Write-Host "[OK] $(Split-Path -Leaf $Path)" -ForegroundColor Green
}

# ------------------------------------------------------------
# TEMPORARY SAFETY BACKUP
# ------------------------------------------------------------
Write-Host ""
Write-Host "[2/8] Creating temporary safety backup..." -ForegroundColor Yellow

$Backup = Join-Path $Root ".ISDABI_VERSION_01_TEMP_BACKUP"
if (Test-Path -LiteralPath $Backup) {
    Remove-Item -LiteralPath $Backup -Recurse -Force
}
New-Item -ItemType Directory -Path $Backup -Force | Out-Null

$BackupMap = @{}

foreach ($Path in $Targets) {
    $Relative = $Path.Substring($Root.Length).TrimStart('\')
    $Destination = Join-Path $Backup $Relative
    New-Item -ItemType Directory -Path (Split-Path $Destination -Parent) -Force | Out-Null
    Copy-Item -LiteralPath $Path -Destination $Destination -Force
    $BackupMap[$Path] = $Destination
}

Write-Host "[OK] Temporary backup created." -ForegroundColor Green

try {

    # ========================================================
    # 3. PROCESSING TIMELINE UI
    # ========================================================
    Write-Host ""
    Write-Host "[3/8] Applying the real-stage timeline UI..." -ForegroundColor Yellow

    $Timeline = Read-Text $TimelinePath

    $TimelineNew = @'
import { AnimatePresence, motion } from 'framer-motion';
import Icon from './Icon';

const PIPELINE = [
  { key: 'transcribing', label: 'Transcribing Conversation' },
  { key: 'analyzing', label: 'Analyzing Customer Intent' },
  { key: 'signals', label: 'Detecting Buying Signals' },
  { key: 'objections', label: 'Detecting Objections' },
  { key: 'report', label: 'Generating Manager Report' },
];

const BARS = Array.from(
  { length: 26 },
  (_, i) =>
    0.3 +
    0.7 *
      Math.abs(Math.sin(i * 0.85)) *
      (0.65 + 0.35 * Math.cos(i * 0.4))
);

function derive({ phase, backendStatus, stage, uploadFailed }) {
  if (phase === 'error') {
    return {
      upload: uploadFailed ? 'failed' : 'done',
      steps: PIPELINE.map((step) =>
        step.key === stage ? 'failed' : 'pending'
      ),
      final: 'pending',
    };
  }

  if (phase === 'done' || backendStatus === 'completed') {
    return {
      upload: 'done',
      steps: PIPELINE.map(() => 'done'),
      final: 'done',
    };
  }

  if (phase === 'uploading') {
    return {
      upload: 'active',
      steps: PIPELINE.map(() => 'pending'),
      final: 'pending',
    };
  }

  const currentIndex = PIPELINE.findIndex(
    (step) => step.key === stage
  );

  if (currentIndex >= 0) {
    return {
      upload: 'done',
      steps: PIPELINE.map((step, index) => {
        if (index < currentIndex) return 'done';
        if (index === currentIndex) return 'active';
        return 'pending';
      }),
      final: 'pending',
    };
  }

  return {
    upload: 'done',
    steps: PIPELINE.map(() => 'pending'),
    final: 'pending',
  };
}

function Dot({ state }) {
  return (
    <span
      className={`tl-dot is-${state}`}
      aria-hidden="true"
    >
      <AnimatePresence mode="wait" initial={false}>
        <motion.span
          key={state}
          className="tl-dot-inner"
          initial={{ scale: 0.4, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.4, opacity: 0 }}
          transition={{ duration: 0.2 }}
        >
          {state === 'done' && (
            <Icon name="check" strokeWidth={3} />
          )}

          {state === 'failed' && (
            <Icon name="x" strokeWidth={3} />
          )}

          {state === 'active' && (
            <span className="tl-spin" />
          )}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}

function Row({ state, label, hint, i = 0 }) {
  const text = {
    done: 'Completed',
    active: 'In progress',
    failed: 'Stopped',
    pending: 'Pending',
  }[state];

  return (
    <motion.li
      className={`tl-row is-${state}`}
      initial={{ opacity: 0, x: -6 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{
        duration: 0.3,
        delay: 0.05 + i * 0.05,
      }}
    >
      <Dot state={state} />
      <span className="tl-label">{label}</span>

      {hint ? (
        <span className="tl-hint num">{hint}</span>
      ) : (
        <span className="sr-only">{text}</span>
      )}
    </motion.li>
  );
}

export default function ProcessingTimeline({
  phase,
  progress = 0,
  backendStatus,
  stage,
  error,
  filename,
  uploadFailed = false,
}) {
  const state = derive({
    phase,
    backendStatus,
    stage,
    uploadFailed,
  });

  const finished = state.final === 'done';
  const failed = phase === 'error';

  return (
    <motion.section
      className="card timeline-card"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        duration: 0.4,
        ease: [0.22, 1, 0.36, 1],
      }}
      aria-live="polite"
    >
      <div
        className={`wave ${
          backendStatus === 'processing' ? 'is-running' : ''
        } ${failed ? 'is-failed' : ''} ${
          finished ? 'is-done' : ''
        }`}
        aria-hidden="true"
      >
        {BARS.map((height, index) => (
          <span
            key={index}
            style={{
              '--i': index,
              '--h': height,
            }}
          />
        ))}
      </div>

      <h2 className="timeline-title">
        {finished
          ? 'Analysis complete'
          : failed
            ? 'Analysis stopped'
            : 'Analyzing your sales call'}
      </h2>

      {filename && (
        <p className="muted truncate timeline-file">
          {filename}
        </p>
      )}

      <ol className="timeline">
        <Row
          state={state.upload}
          i={0}
          label="Audio Received"
          hint={
            state.upload === 'active'
              ? `${Math.round(progress * 100)}%`
              : null
          }
        />

        {state.upload === 'active' && (
          <li
            className="tl-progress"
            aria-hidden="true"
          >
            <motion.span
              animate={{ scaleX: progress }}
              transition={{
                duration: 0.2,
                ease: 'linear',
              }}
            />
          </li>
        )}

        {PIPELINE.map((step, index) => (
          <Row
            key={step.key}
            i={index + 1}
            state={state.steps[index]}
            label={step.label}
          />
        ))}

        <Row
          i={PIPELINE.length + 1}
          state={state.final}
          label="Finalizing"
        />
      </ol>

      <AnimatePresence>
        {failed && error && (
          <motion.div
            className="notice notice-error"
            role="alert"
            style={{ marginTop: 18 }}
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
          >
            <Icon name="alert" />
            {error}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.section>
  );
}
'@

    Write-Utf8NoBom $TimelinePath $TimelineNew
    Write-Host "[OK] Timeline component replaced with stage-driven UI." -ForegroundColor Green

    # ========================================================
    # 4. CSS ONLY FOR THIS TIMELINE
    # ========================================================
    Write-Host ""
    Write-Host "[4/8] Ensuring clean vertical timeline styling..." -ForegroundColor Yellow

    $Css = Read-Text $CssPath

    if (-not $Css.Contains("ISDABI VERSION 01 REAL STAGE TIMELINE")) {
        $CssAdd = @'

/* ISDABI VERSION 01 REAL STAGE TIMELINE */
.timeline-card .timeline {
  position: relative;
}

.timeline-card .timeline::before {
  content: '';
  position: absolute;
  left: 8px;
  top: 11px;
  bottom: 11px;
  width: 1px;
  background: var(--border, rgba(255,255,255,.12));
  pointer-events: none;
}

.timeline-card .tl-row {
  position: relative;
  z-index: 1;
}

.timeline-card .tl-dot {
  width: 17px;
  height: 17px;
  min-width: 17px;
  border-radius: 50%;
}

.timeline-card .tl-dot.is-pending {
  opacity: .55;
}

.timeline-card .tl-dot.is-active {
  opacity: 1;
}

.timeline-card .tl-dot.is-done {
  opacity: 1;
}

.timeline-card .tl-dot.is-failed {
  opacity: 1;
}

.timeline-card .tl-spin {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  border: 1.5px solid currentColor;
  border-right-color: transparent;
  animation: isdabi-stage-spin .8s linear infinite;
}

@keyframes isdabi-stage-spin {
  to {
    transform: rotate(360deg);
  }
}
'@
        $Css = $Css.TrimEnd() + "`r`n" + $CssAdd
        Write-Utf8NoBom $CssPath $Css
        Write-Host "[OK] Timeline CSS added." -ForegroundColor Green
    }
    else {
        Write-Host "[OK] Timeline CSS already present." -ForegroundColor Green
    }

    # ========================================================
    # 5. DATABASE + CONTROLLER + NODE SERVICE
    # ========================================================
    Write-Host ""
    Write-Host "[5/8] Connecting real backend stage telemetry..." -ForegroundColor Yellow

    # MODEL
    $Model = Read-Text $ModelPath

    if (-not $Model.Contains("processingStage")) {
        $ModelAnchor = @'
    processingStatus: {
      type: String,
      enum: [
        "uploaded",
        "queued",
        "processing",
        "completed",
        "failed"
      ],
      default: "uploaded",
      index: true
    },
'@

        Require-Text $Model $ModelAnchor "processingStatus schema block"

        $ModelReplacement = @'
    processingStatus: {
      type: String,
      enum: [
        "uploaded",
        "queued",
        "processing",
        "completed",
        "failed"
      ],
      default: "uploaded",
      index: true
    },

    processingStage: {
      type: String,
      enum: [
        "transcribing",
        "analyzing",
        "signals",
        "objections",
        "report",
        "finalizing"
      ],
      default: null
    },
'@

        $Model = $Model.Replace($ModelAnchor, $ModelReplacement)
        Write-Utf8NoBom $ModelPath $Model
        Write-Host "[OK] processingStage added to Call model." -ForegroundColor Green
    }
    else {
        Write-Host "[OK] Call model already has processingStage." -ForegroundColor Green
    }

    # CONTROLLER
    $Controller = Read-Text $ControllerPath

    if (-not $Controller.Contains("async stage =>")) {
        $ControllerAnchor = @'
    await Call.findByIdAndUpdate(
      callId,
      {
        processingStatus: "processing",
        processingStartedAt: new Date(),
        processingError: null
      }
    );

    const result = await analyzeAudio(
      call.audioPath,
      call.originalFilename
    );
'@

        Require-Text $Controller $ControllerAnchor "controller processing start"

        $ControllerReplacement = @'
    await Call.findByIdAndUpdate(
      callId,
      {
        processingStatus: "processing",
        processingStage: "transcribing",
        processingStartedAt: new Date(),
        processingError: null
      }
    );

    const result = await analyzeAudio(
      call.audioPath,
      call.originalFilename,
      String(callId),
      async stage => {
        await Call.findByIdAndUpdate(
          callId,
          {
            processingStatus: "processing",
            processingStage: stage
          }
        );
      }
    );
'@

        $Controller = $Controller.Replace($ControllerAnchor, $ControllerReplacement)

        $ControllerCompletionAnchor = @'
        processingStatus: "completed",
        processingCompletedAt: new Date(),
        processingError: null
'@

        Require-Text $Controller $ControllerCompletionAnchor "controller completion block"

        $ControllerCompletionReplacement = @'
        processingStatus: "completed",
        processingStage: null,
        processingCompletedAt: new Date(),
        processingError: null
'@

        $Controller = $Controller.Replace(
            $ControllerCompletionAnchor,
            $ControllerCompletionReplacement
        )

        $ControllerFailureAnchor = @'
        processingStatus: "failed",
        processingCompletedAt: new Date(),
        processingError:
'@

        Require-Text $Controller $ControllerFailureAnchor "controller failure block"

        $ControllerFailureReplacement = @'
        processingStatus: "failed",
        processingStage: null,
        processingCompletedAt: new Date(),
        processingError:
'@

        $Controller = $Controller.Replace(
            $ControllerFailureAnchor,
            $ControllerFailureReplacement
        )

        $ControllerQueuedAnchor = @'
        processingStatus:
          "queued",
        processingStartedAt: null,
        processingCompletedAt: null,
        processingError: null
'@

        Require-Text $Controller $ControllerQueuedAnchor "controller queued block"

        $ControllerQueuedReplacement = @'
        processingStatus:
          "queued",
        processingStage: null,
        processingStartedAt: null,
        processingCompletedAt: null,
        processingError: null
'@

        $Controller = $Controller.Replace(
            $ControllerQueuedAnchor,
            $ControllerQueuedReplacement
        )

        Write-Utf8NoBom $ControllerPath $Controller
        Write-Host "[OK] Controller now forwards real stages to MongoDB." -ForegroundColor Green
    }
    else {
        Write-Host "[OK] Controller stage callback already present." -ForegroundColor Green
    }

    # NODE AI SERVICE
    $ServiceNew = @'
const fs = require("fs");
const axios = require("axios");
const FormData = require("form-data");

const AI_API_URL =
  process.env.AI_API_URL ||
  "http://127.0.0.1:8000";

const AI_TIMEOUT =
  30 * 60 * 1000;

const STAGE_POLL_MS = 700;

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function checkAIHealth() {
  try {
    const response = await axios.get(
      `${AI_API_URL}/health`,
      {
        timeout: 10000
      }
    );

    return {
      ok: true,
      data: response.data
    };
  } catch (error) {
    return {
      ok: false,
      error:
        error.response?.data ||
        error.message ||
        "AI API unreachable."
    };
  }
}

async function analyzeAudio(
  filePath,
  originalFilename,
  callId,
  onStage
) {
  if (!filePath) {
    throw new Error("Audio file path is required.");
  }

  if (!fs.existsSync(filePath)) {
    throw new Error(
      `Audio file does not exist: ${filePath}`
    );
  }

  console.log(
    `[ISDABI AI] Sending audio to AI API: ${originalFilename}`
  );

  const form = new FormData();

  form.append(
    "file",
    fs.createReadStream(filePath),
    {
      filename: originalFilename
    }
  );

  if (callId) {
    form.append("call_id", String(callId));
  }

  const request = axios.post(
    `${AI_API_URL}/analyze`,
    form,
    {
      headers: {
        ...form.getHeaders()
      },
      maxContentLength: Infinity,
      maxBodyLength: Infinity,
      timeout: AI_TIMEOUT
    }
  );

  let polling = true;

  const poll = callId
    ? (async () => {
        while (polling) {
          try {
            const response = await axios.get(
              `${AI_API_URL}/progress/${encodeURIComponent(String(callId))}`,
              {
                timeout: 10000
              }
            );

            const stage =
              response.data?.stage;

            if (
              stage &&
              typeof onStage === "function"
            ) {
              await onStage(stage);
            }
          } catch (_) {
            // Progress polling is supplemental.
            // The main analysis request remains authoritative.
          }

          if (polling) {
            await sleep(STAGE_POLL_MS);
          }
        }
      })()
    : null;

  try {
    const response = await request;
    return response.data;
  } catch (error) {
    if (error.code === "ECONNABORTED") {
      throw new Error(
        "AI API timed out after 30 minutes."
      );
    }

    if (error.response) {
      throw new Error(
        `AI API error ${error.response.status}: ${
          typeof error.response.data === "string"
            ? error.response.data
            : JSON.stringify(error.response.data)
        }`
      );
    }

    throw new Error(
      `Unable to reach ISDABI AI API: ${
        error.message || "Unknown error"
      }`
    );
  } finally {
    polling = false;

    if (poll) {
      await poll;
    }
  }
}

module.exports = {
  analyzeAudio,
  checkAIHealth
};
'@

    Write-Utf8NoBom $ServicePath $ServiceNew
    Write-Host "[OK] AI service now polls real AI stage telemetry." -ForegroundColor Green

    # ========================================================
    # 6. PYTHON AI API
    # ========================================================
    Write-Host ""
    Write-Host "[6/8] Adding real AI API progress telemetry..." -ForegroundColor Yellow

    $Api = Read-Text $ApiPath

    if (-not $Api.Contains("PIPELINE_PROGRESS")) {

        $Api = $Api.Replace(
            "from fastapi import FastAPI, File, HTTPException, UploadFile",
            "from fastapi import FastAPI, File, Form, HTTPException, UploadFile"
        )

        $ProgressBlock = @'

# ============================================================
# REAL PIPELINE STAGE TELEMETRY
# ============================================================

PIPELINE_PROGRESS = {}

VALID_PIPELINE_STAGES = {
    "transcribing",
    "analyzing",
    "signals",
    "objections",
    "report",
    "finalizing",
}


def set_pipeline_stage(call_id, stage):
    if not call_id:
        return

    if stage not in VALID_PIPELINE_STAGES:
        return

    PIPELINE_PROGRESS[str(call_id)] = stage
'@

        $ApiAnchor = "# ============================================================`r`n# AUDIO VALIDATION"
        if (-not $Api.Contains($ApiAnchor)) {
            $ApiAnchor = "# ============================================================`n# AUDIO VALIDATION"
        }

        Require-Text $Api $ApiAnchor "AI API audio validation anchor"

        $Api = $Api.Replace(
            $ApiAnchor,
            $ProgressBlock + "`r`n`r`n" + $ApiAnchor
        )

        $RunPattern = '(?s)def run_pipeline\(audio_path: Path\):.*?# ============================================================\r?\n# ROOT'
        $RunReplacement = @'
def run_pipeline(audio_path: Path, call_id=None):

    command = [
        str(PYTHON_EXECUTABLE),
        "-u",
        str(PIPELINE_PATH),
        str(audio_path),
    ]

    print("=" * 70)
    print(
        "[ISDABI AI] Starting verified audio analysis pipeline"
    )
    print("=" * 70)

    creation_flags = 0

    if hasattr(
        subprocess,
        "CREATE_NO_WINDOW",
    ):
        creation_flags = subprocess.CREATE_NO_WINDOW

    process = subprocess.Popen(
        command,
        cwd=str(AI_ML_ROOT),
        stdin=subprocess.DEVNULL,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
        encoding="utf-8",
        errors="replace",
        bufsize=1,
        close_fds=True,
        creationflags=creation_flags,
    )

    output_lines = []

    try:
        for raw_line in process.stdout:
            line = raw_line.rstrip("\r\n")
            output_lines.append(line)

            clean = line.strip()

            if clean.startswith("ISDABI_STAGE:"):
                stage = clean.split(":", 1)[1].strip()
                set_pipeline_stage(
                    call_id,
                    stage
                )

        process.wait(timeout=900)

    except subprocess.TimeoutExpired:
        process.kill()
        process.wait()
        raise RuntimeError(
            "ISDABI pipeline timed out after 900 seconds."
        )

    stdout = "\n".join(output_lines)

    if process.returncode != 0:
        raise RuntimeError(
            "ISDABI pipeline failed:\n"
            + stdout[-5000:]
        )

    return stdout, ""


# ============================================================
# ROOT
'@

        $ApiUpdated = [regex]::Replace(
            $Api,
            $RunPattern,
            $RunReplacement,
            1
        )

        if ($ApiUpdated -eq $Api) {
            throw "AI API run_pipeline block was not found."
        }

        $Api = $ApiUpdated

        $Api = $Api.Replace(
            'async def analyze_audio(',
            'async def analyze_audio('
        )

        $ApiSignature = @'
async def analyze_audio(
    file: UploadFile = File(None),
    audio: UploadFile = File(None),
):
'@

        $ApiSignatureNew = @'
async def analyze_audio(
    file: UploadFile = File(None),
    audio: UploadFile = File(None),
    call_id: str = Form(None),
):
'@

        Require-Text $Api $ApiSignature "AI API analyze signature"

        $Api = $Api.Replace(
            $ApiSignature,
            $ApiSignatureNew
        )

        $ApiCallAnchor = @'
                run_pipeline,
                temp_path,
            )
'@

        $ApiCallNew = @'
                run_pipeline,
                temp_path,
                call_id,
            )
'@

        Require-Text $Api $ApiCallAnchor "AI API run_pipeline call"

        $Api = $Api.Replace(
            $ApiCallAnchor,
            $ApiCallNew
        )

        $ProgressRoute = @'

# ============================================================
# PIPELINE PROGRESS
# ============================================================

@app.get("/progress/{call_id}")
async def pipeline_progress(call_id: str):
    return {
        "success": True,
        "call_id": call_id,
        "stage": PIPELINE_PROGRESS.get(
            str(call_id)
        )
    }

'@

        $RootRouteAnchor = "# ============================================================`r`n# ROOT"
        if (-not $Api.Contains($RootRouteAnchor)) {
            $RootRouteAnchor = "# ============================================================`n# ROOT"
        }

        Require-Text $Api $RootRouteAnchor "AI API root route anchor"

        $Api = $Api.Replace(
            $RootRouteAnchor,
            $ProgressRoute + $RootRouteAnchor
        )

        Write-Utf8NoBom $ApiPath $Api
        Write-Host "[OK] AI API now exposes /progress/{call_id}." -ForegroundColor Green
    }
    else {
        Write-Host "[OK] AI API telemetry already present." -ForegroundColor Green
    }

    # ========================================================
    # 7. PIPELINE MARKERS
    # ========================================================
    Write-Host ""
    Write-Host "[7/8] Adding exact pipeline stage markers..." -ForegroundColor Yellow

    $Pipeline = Read-Text $PipelinePath

    $Markers = @(
        "ISDABI_STAGE: transcribing",
        "ISDABI_STAGE: analyzing",
        "ISDABI_STAGE: signals",
        "ISDABI_STAGE: objections",
        "ISDABI_STAGE: report",
        "ISDABI_STAGE: finalizing"
    )

    if (-not ($Markers | ForEach-Object { $Pipeline.Contains($_) } | Where-Object { -not $_ })) {

        # Already complete.
        Write-Host "[OK] All six pipeline markers already present." -ForegroundColor Green

    } else {

        $PipelineAnchors = @(
            @{
                Old = 'print("Transcribing audio...")'
                New = @'
print("ISDABI_STAGE: transcribing", flush=True)
print("Transcribing audio...", flush=True)
'@
                Name = "transcribing"
            },
            @{
                Old = 'print("Loading fine-tuned MiniLM...")'
                New = @'
print("ISDABI_STAGE: analyzing", flush=True)
print("Loading fine-tuned MiniLM...", flush=True)
'@
                Name = "analyzing"
            },
            @{
                Old = "# BUYING SIGNALS"
                New = @'
print("ISDABI_STAGE: signals", flush=True)

# BUYING SIGNALS
'@
                Name = "signals"
            },
            @{
                Old = "# OBJECTIONS"
                New = @'
print("ISDABI_STAGE: objections", flush=True)

# OBJECTIONS
'@
                Name = "objections"
            },
            @{
                Old = 'print("STEP 4 — QWEN MANAGER REPORT FORMATTING")'
                New = @'
print("ISDABI_STAGE: report", flush=True)
print("STEP 4 — QWEN MANAGER REPORT FORMATTING", flush=True)
'@
                Name = "report"
            },
            @{
                Old = "# FINAL REPORT"
                New = @'
print("ISDABI_STAGE: finalizing", flush=True)

# FINAL REPORT
'@
                Name = "finalizing"
            }
        )

        foreach ($Marker in $PipelineAnchors) {
            $MarkerText = "ISDABI_STAGE: $($Marker.Name)"

            if (-not $Pipeline.Contains($MarkerText)) {
                Require-Text $Pipeline $Marker.Old "pipeline $($Marker.Name) anchor"

                $Pipeline = $Pipeline.Replace(
                    $Marker.Old,
                    $Marker.New
                )
            }
        }

        Write-Utf8NoBom $PipelinePath $Pipeline
        Write-Host "[OK] All real pipeline stage markers added." -ForegroundColor Green
    }

    # ========================================================
    # 8. STATIC VALIDATION + BUILD
    # ========================================================
    Write-Host ""
    Write-Host "[8/8] Validating everything before completion..." -ForegroundColor Yellow

    $TimelineCheck = Read-Text $TimelinePath
    $CssCheck = Read-Text $CssPath
    $ModelCheck = Read-Text $ModelPath
    $ControllerCheck = Read-Text $ControllerPath
    $ServiceCheck = Read-Text $ServicePath
    $ApiCheck = Read-Text $ApiPath
    $PipelineCheck = Read-Text $PipelinePath

    foreach ($Label in @(
        "Audio Received",
        "Transcribing Conversation",
        "Analyzing Customer Intent",
        "Detecting Buying Signals",
        "Detecting Objections",
        "Generating Manager Report",
        "Finalizing"
    )) {
        Require-Text $TimelineCheck $Label "timeline label: $Label"
    }

    if ($TimelineCheck.Contains("tl-group-head")) {
        throw "Timeline still contains the old AI pipeline group header."
    }

    Require-Text $CssCheck "ISDABI VERSION 01 REAL STAGE TIMELINE" "timeline CSS"
    Require-Text $ModelCheck "processingStage" "processingStage model field"
    Require-Text $ControllerCheck "async stage =>" "controller stage callback"
    Require-Text $ServiceCheck "/progress/" "AI service progress polling"
    Require-Text $ApiCheck "PIPELINE_PROGRESS" "AI API progress store"
    Require-Text $ApiCheck '@app.get("/progress/{call_id}")' "AI API progress route"

    foreach ($Marker in $Markers) {
        Require-Text $PipelineCheck $Marker "pipeline marker: $Marker"
    }

    $Node = Get-Command node -ErrorAction SilentlyContinue
    if (-not $Node) {
        throw "node.exe was not found. Backend syntax validation cannot continue."
    }

    foreach ($JsFile in @($ControllerPath, $ServicePath)) {
        & $Node.Source --check $JsFile
        if ($LASTEXITCODE -ne 0) {
            throw "Node syntax validation failed: $JsFile"
        }
        Write-Host "[OK] Node syntax: $(Split-Path -Leaf $JsFile)" -ForegroundColor Green
    }

    $Python = Get-Command python -ErrorAction SilentlyContinue
    if (-not $Python) {
        throw "python.exe was not found. Python syntax validation cannot continue."
    }

    & $Python.Source -m py_compile $ApiPath
    if ($LASTEXITCODE -ne 0) {
        throw "Python syntax validation failed: $ApiPath"
    }

    & $Python.Source -m py_compile $PipelinePath
    if ($LASTEXITCODE -ne 0) {
        throw "Python syntax validation failed: $PipelinePath"
    }

    Write-Host "[OK] Python syntax validation passed." -ForegroundColor Green

    Push-Location $Frontend
    try {
        & node ".\node_modules\vite\bin\vite.js" build
        $BuildCode = $LASTEXITCODE
    }
    finally {
        Pop-Location
    }

    if ($BuildCode -ne 0) {
        throw "Frontend build failed."
    }

    Write-Host "[OK] Frontend build passed." -ForegroundColor Green

    # Remove temporary backup only after every validation succeeds.
    Remove-Item -LiteralPath $Backup -Recurse -Force

    Write-Host ""
    Write-Host "============================================================" -ForegroundColor Green
    Write-Host " $VersionName COMPLETE - REAL-STAGE TIMELINE READY" -ForegroundColor Green
    Write-Host "============================================================" -ForegroundColor Green
    Write-Host ""
    Write-Host "Only the Call Analysis processing timeline and its required telemetry path were changed." -ForegroundColor White
    Write-Host "No servers were started by this script." -ForegroundColor White
    Write-Host ""

}
catch {

    Write-Host ""
    Write-Host "[FAILED] $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "Restoring the 7 targeted files..." -ForegroundColor Yellow

    foreach ($Path in $Targets) {
        $BackupPath = $BackupMap[$Path]
        if (Test-Path -LiteralPath $BackupPath) {
            Copy-Item -LiteralPath $BackupPath -Destination $Path -Force
        }
    }

    Write-Host "[RESTORED] Original files restored." -ForegroundColor Green
    Write-Host "Temporary backup retained at:" -ForegroundColor Yellow
    Write-Host $Backup -ForegroundColor White
    throw
}
