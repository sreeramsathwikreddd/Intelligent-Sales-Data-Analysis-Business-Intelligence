import ast
import asyncio
import json
import re
import subprocess
import tempfile
from pathlib import Path

import av
import uvicorn
from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware


# ============================================================
# ISDABI AI API V1.3.0
# ============================================================

PROJECT_ROOT = Path(
    r"A:\5.Projects & Information\16.Intelligent Sales Data Analysis & Business Intelligence"
)

AI_ML_ROOT = PROJECT_ROOT / "ISDABI AI ML"

PIPELINE_PATH = (
    AI_ML_ROOT
    / "inference"
    / "ISDABI Audio Sales Analysis Pipeline V1.3.0.py"
)

PYTHON_EXECUTABLE = (
    AI_ML_ROOT
    / ".venv"
    / "Scripts"
    / "python.exe"
)

TEMP_DIR = AI_ML_ROOT / "temp_uploads"

TEMP_DIR.mkdir(
    parents=True,
    exist_ok=True
)


# ============================================================
# APP
# ============================================================

app = FastAPI(
    title="ISDABI AI API",
    version="1.3.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ],
    allow_credentials=True,
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)


# ============================================================
# REAL-TIME PIPELINE PROGRESS
# ============================================================

PIPELINE_PROGRESS = {}


def set_pipeline_stage(
    call_id,
    stage
):
    if call_id:
        PIPELINE_PROGRESS[str(call_id)] = stage


def clear_pipeline_stage(
    call_id
):
    if call_id:
        PIPELINE_PROGRESS.pop(
            str(call_id),
            None
        )


def read_pipeline_stage(
    line,
    call_id
):
    if not call_id:
        return

    match = re.search(
        r"ISDABI_STAGE:\s*([A-Za-z_]+)",
        line,
        re.IGNORECASE,
    )

    if not match:
        return

    stage = (
        match.group(1)
        .strip()
        .lower()
    )

    allowed_stages = {
        "transcribing",
        "analyzing",
        "signals",
        "objections",
        "report",
        "finalizing",
    }

    if stage in allowed_stages:
        set_pipeline_stage(
            call_id,
            stage
        )


# ============================================================
# AUDIO VALIDATION
# ============================================================

ALLOWED_EXTENSIONS = {
    ".wav",
    ".mp3",
    ".m4a",
    ".flac",
    ".ogg",
    ".webm",
    ".aac",
}


def get_audio_duration(
    audio_path: Path
):

    try:

        container = av.open(
            str(audio_path)
        )

        try:

            if container.duration is not None:

                return round(
                    float(
                        container.duration
                    ) / 1_000_000,
                    3,
                )

        finally:

            container.close()

    except Exception:

        return None

    return None


# ============================================================
# JSON EXTRACTION
# ============================================================

def extract_manager_report(
    stdout: str
):

    marker = "QWEN MANAGER REPORT"

    position = stdout.find(
        marker
    )

    if position == -1:

        raise ValueError(
            "QWEN MANAGER REPORT was not found in pipeline output."
        )

    start = stdout.find(
        "{",
        position
    )

    if start == -1:

        raise ValueError(
            "Manager report JSON was not found."
        )

    decoder = json.JSONDecoder()

    try:

        report, _ = decoder.raw_decode(
            stdout[start:]
        )

        if not isinstance(
            report,
            dict
        ):

            raise ValueError(
                "Qwen manager report is not a JSON object."
            )

        return report

    except json.JSONDecodeError as error:

        raise ValueError(
            f"Could not parse Qwen manager report: {error}"
        )


# ============================================================
# LIST PARSER
# ============================================================

def parse_list(
    text: str
):

    try:

        value = ast.literal_eval(
            text.strip()
        )

        if isinstance(
            value,
            list
        ):

            return [
                str(item)
                for item in value
            ]

    except Exception:

        pass

    return []


# ============================================================
# PIPELINE OUTPUT PARSER
# ============================================================

def parse_pipeline_output(
    stdout: str,
    duration_seconds,
):

    manager_report = (
        extract_manager_report(
            stdout
        )
    )

    # --------------------------------------------------------
    # Language
    # --------------------------------------------------------

    language = None

    match = re.search(
        r"Detected language:\s*([A-Za-z\-]+)",
        stdout,
        re.IGNORECASE,
    )

    if match:

        language = (
            match.group(1)
            .strip()
        )

    # --------------------------------------------------------
    # Transcript
    # --------------------------------------------------------

    transcript = ""

    transcript_match = re.search(
        r"TRANSCRIPT\s*-+\s*(.*?)\s*={20,}\s*STEP 2",
        stdout,
        re.IGNORECASE | re.DOTALL,
    )

    if transcript_match:

        transcript = (
            transcript_match
            .group(1)
            .strip()
        )

    # --------------------------------------------------------
    # MiniLM outcome
    # --------------------------------------------------------

    sales_outcome = "UNKNOWN"

    match = re.search(
        r"MiniLM Prediction:\s*(SUCCESS|FAILURE)",
        stdout,
        re.IGNORECASE,
    )

    if match:

        sales_outcome = (
            match.group(1)
            .upper()
        )

    # --------------------------------------------------------
    # Confidence
    # --------------------------------------------------------

    success_confidence = None
    failure_confidence = None

    match = re.search(
        r"SUCCESS Probability:\s*([0-9.]+)\s*%",
        stdout,
        re.IGNORECASE,
    )

    if match:

        success_confidence = round(
            float(
                match.group(1)
            ) / 100,
            6,
        )

    match = re.search(
        r"FAILURE Probability:\s*([0-9.]+)\s*%",
        stdout,
        re.IGNORECASE,
    )

    if match:

        failure_confidence = round(
            float(
                match.group(1)
            ) / 100,
            6,
        )

    # --------------------------------------------------------
    # Customer intent
    # --------------------------------------------------------

    customer_intent = (
        "Not identified"
    )

    match = re.search(
        r"Customer Intent:\s*(.+)",
        stdout,
        re.IGNORECASE,
    )

    if match:

        customer_intent = (
            match.group(1)
            .strip()
        )

    # --------------------------------------------------------
    # Buying signals
    # --------------------------------------------------------

    buying_signals = []

    match = re.search(
        r"Buying Signals:\s*(\[.*?\])",
        stdout,
        re.IGNORECASE,
    )

    if match:

        buying_signals = parse_list(
            match.group(1)
        )

    # --------------------------------------------------------
    # Objections
    # --------------------------------------------------------

    objections = []

    match = re.search(
        r"Objections:\s*(\[.*?\])",
        stdout,
        re.IGNORECASE,
    )

    if match:

        objections = parse_list(
            match.group(1)
        )

    # --------------------------------------------------------
    # Customer situation
    # --------------------------------------------------------

    customer_situation = (
        "Not identified from the conversation."
    )

    match = re.search(
        r"Customer Situation:\s*(.+)",
        stdout,
        re.IGNORECASE,
    )

    if match:

        customer_situation = (
            match.group(1)
            .strip()
        )

    # --------------------------------------------------------
    # Qwen status
    # --------------------------------------------------------

    qwen_status = (
        "QWEN_FORMATTED_GROUNDED"
    )

    match = re.search(
        r"QWEN STATUS:\s*(.+)",
        stdout,
        re.IGNORECASE,
    )

    if match:

        qwen_status = (
            match.group(1)
            .strip()
        )

    # --------------------------------------------------------
    # Grounded result
    # --------------------------------------------------------

    manager_report[
        "sales_outcome"
    ] = sales_outcome

    manager_report[
        "key_buying_signals"
    ] = list(
        buying_signals
    )

    manager_report[
        "main_objections"
    ] = list(
        objections
    )

    return {

        "transcript": transcript,

        "detected_language": language,

        "duration_seconds": duration_seconds,

        "sales_outcome": sales_outcome,

        "success_confidence": success_confidence,

        "failure_confidence": failure_confidence,

        "customer_intent": customer_intent,

        "buying_signals": buying_signals,

        "objections": objections,

        "customer_situation": customer_situation,

        "manager_report": manager_report,

        "qwen_status": qwen_status,

        "pipeline_version": "V1.4.0",

        "speech_to_text_model": (
            "Faster-Whisper Small"
        ),

        "outcome_model": (
            "MiniLM Sales Outcome V1"
        ),

        "llm_model": (
            "Qwen2.5-0.5B-Instruct Q4_K_M"
        ),
    }


# ============================================================
# RUN PIPELINE
# ============================================================

def run_pipeline(
    audio_path: Path,
    call_id=None
):

    command = [
        str(PYTHON_EXECUTABLE),
        str(PIPELINE_PATH),
        str(audio_path),
    ]

    print(
        "=" * 70
    )

    print(
        "[ISDABI AI] Starting verified audio analysis pipeline"
    )

    print(
        "=" * 70
    )

    print(
        f"[ISDABI AI] Python:   {PYTHON_EXECUTABLE}"
    )

    print(
        f"[ISDABI AI] Pipeline: {PIPELINE_PATH}"
    )

    print(
        f"[ISDABI AI] Audio:    {audio_path}"
    )

    if call_id:

        print(
            f"[ISDABI AI] Call ID:   {call_id}"
        )

    creation_flags = 0

    if hasattr(
        subprocess,
        "CREATE_NO_WINDOW"
    ):

        creation_flags = (
            subprocess.CREATE_NO_WINDOW
        )

    process = subprocess.Popen(

        command,

        cwd=str(
            AI_ML_ROOT
        ),

        stdin=subprocess.DEVNULL,

        stdout=subprocess.PIPE,

        stderr=subprocess.STDOUT,

        text=True,

        encoding="utf-8",

        errors="replace",

        bufsize=1,

        universal_newlines=True,

        close_fds=True,

        creationflags=creation_flags,
    )

    print(
        f"[ISDABI AI] Pipeline PID: {process.pid}"
    )

    output_lines = []

    try:

        while True:

            line = process.stdout.readline()

            if line:

                output_lines.append(
                    line
                )

                # Windows console-safe pipeline output.
                # Stage detection still receives the original line unchanged.
                safe_line = line.encode(
                    "ascii",
                    errors="backslashreplace"
                ).decode("ascii")

                print(
                    safe_line,
                    end=""
                )

                read_pipeline_stage(
                    line,
                    call_id
                )

            elif (
                process.poll()
                is not None
            ):

                break

        process.wait(
            timeout=900
        )

    except subprocess.TimeoutExpired:

        process.kill()

        remaining_output = (
            process.stdout.read()
            if process.stdout
            else ""
        )

        if remaining_output:

            output_lines.append(
                remaining_output
            )

        raise RuntimeError(
            "ISDABI pipeline timed out after 900 seconds."
        )

    finally:

        if process.stdout:

            process.stdout.close()

    stdout = "".join(
        output_lines
    )

    print(
        "[ISDABI AI] Pipeline process completed."
    )

    print(
        f"[ISDABI AI] Exit code: {process.returncode}"
    )

    if process.returncode != 0:

        raise RuntimeError(
            "ISDABI pipeline failed:\n"
            + (
                stdout[-5000:]
                if stdout
                else "No pipeline output was produced."
            )
        )

    return (
        stdout,
        ""
    )


# ============================================================
# ROOT
# ============================================================

@app.get("/")
async def root():

    return {

        "success": True,

        "service": "ISDABI AI API",

        "status": "online",

        "version": "1.3.0",

        "pipeline": "V1.4.0",
    }


# ============================================================
# HEALTH
# ============================================================

@app.get("/health")
async def health():

    return {

        "success": True,

        "service": "ISDABI AI API",

        "status": "online",

        "api_version": "1.3.0",

        "pipeline_available": (
            PIPELINE_PATH.exists()
        ),

        "pipeline_version": "V1.4.0",

        "python_executable": (
            str(PYTHON_EXECUTABLE)
        ),

        "temporary_directory": (
            str(TEMP_DIR)
        ),
    }


# ============================================================
# PIPELINE PROGRESS
# ============================================================

@app.get(
    "/progress/{call_id}"
)
async def pipeline_progress(
    call_id: str
):

    return {

        "success": True,

        "call_id": call_id,

        "stage": PIPELINE_PROGRESS.get(
            str(call_id),
            None
        ),
    }


# ============================================================
# ANALYZE AUDIO
# ============================================================

@app.post("/analyze")
async def analyze_audio(

    file: UploadFile = File(None),

    audio: UploadFile = File(None),

    call_id: str = Form(None),
):

    # --------------------------------------------------------
    # IMPORTANT:
    # Backend currently sends "file".
    # Older frontend/API versions may send "audio".
    # Accept BOTH.
    # --------------------------------------------------------

    upload = file or audio

    if upload is None:

        raise HTTPException(

            status_code=400,

            detail=(
                "No audio file received. "
                "Expected multipart field 'file' or 'audio'."
            ),
        )

    filename = upload.filename

    if not filename:

        raise HTTPException(

            status_code=400,

            detail=(
                "Audio filename is missing."
            ),
        )

    extension = (
        Path(filename)
        .suffix
        .lower()
    )

    if extension not in ALLOWED_EXTENSIONS:

        raise HTTPException(

            status_code=400,

            detail={

                "message": (
                    "Unsupported audio format."
                ),

                "allowed_formats": sorted(
                    ALLOWED_EXTENSIONS
                ),
            },
        )

    temp_path = None

    if call_id:

        set_pipeline_stage(
            call_id,
            "transcribing"
        )

    try:

        print(
            "[ISDABI AI] Upload received:"
        )

        print(
            f"[ISDABI AI] Original filename: {filename}"
        )

        if call_id:

            print(
                f"[ISDABI AI] Call ID: {call_id}"
            )

        temp_file = (
            tempfile.NamedTemporaryFile(

                delete=False,

                suffix=extension,

                prefix="ISDABI_AUDIO_",

                dir=str(TEMP_DIR),
            )
        )

        temp_path = Path(
            temp_file.name
        )

        temp_file.close()

        with temp_path.open(
            "wb"
        ) as output:

            while True:

                chunk = await upload.read(
                    1024 * 1024
                )

                if not chunk:

                    break

                output.write(
                    chunk
                )

        print(
            f"[ISDABI AI] Temporary file:    {temp_path}"
        )

        print(
            "[ISDABI AI] Upload saved successfully."
        )

        duration_seconds = (
            await asyncio.to_thread(

                get_audio_duration,

                temp_path,
            )
        )

        stdout, stderr = (
            await asyncio.to_thread(

                run_pipeline,

                temp_path,

                call_id,
            )
        )

        result = parse_pipeline_output(

            stdout,

            duration_seconds,
        )

        print(
            "[ISDABI AI] Pipeline output parsed successfully."
        )

        print(
            f"[ISDABI AI] Outcome: "
            f"{result['sales_outcome']}"
        )

        print(
            f"[ISDABI AI] Language: "
            f"{result['detected_language']}"
        )

        print(
            f"[ISDABI AI] Transcript characters: "
            f"{len(result['transcript'])}"
        )

        print(
            "[ISDABI AI] Analysis completed successfully."
        )

        return {

            "success": True,

            "api": "ISDABI AI API",

            "api_version": "1.3.0",

            "pipeline_version": "V1.4.0",

            "result": result,

            **result,
        }

    except HTTPException:

        raise

    except Exception as error:

        print(
            "[ISDABI AI] Analysis failed."
        )

        print(
            f"[ISDABI AI] Error: {error}"
        )

        raise HTTPException(

            status_code=500,

            detail=str(error),
        )

    finally:

        clear_pipeline_stage(
            call_id
        )

        if (
            temp_path
            and temp_path.exists()
        ):

            try:

                temp_path.unlink()

                print(
                    "[ISDABI AI] Temporary file removed:"
                )

                print(
                    temp_path
                )

            except Exception as error:

                print(
                    "[ISDABI AI] Cleanup warning:"
                )

                print(
                    error
                )


# ============================================================
# START
# ============================================================

if __name__ == "__main__":

    print(
        "=" * 70
    )

    print(
        "ISDABI AI API"
    )

    print(
        "=" * 70
    )

    print(
        f"Project:  {PROJECT_ROOT}"
    )

    print(
        f"Pipeline: {PIPELINE_PATH}"
    )

    print(
        f"Python:   {PYTHON_EXECUTABLE}"
    )

    print(
        f"Temp:     {TEMP_DIR}"
    )

    print(
        "=" * 70
    )

    uvicorn.run(

        app,

        host="127.0.0.1",

        port=8000,

        reload=False,
    )