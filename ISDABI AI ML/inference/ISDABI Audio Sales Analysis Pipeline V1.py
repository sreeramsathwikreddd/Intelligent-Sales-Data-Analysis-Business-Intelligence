import os
import sys
import json
import subprocess
import re
import torch

from faster_whisper import WhisperModel
from transformers import AutoTokenizer, AutoModel


# =========================================================
# ISDABI AUDIO SALES ANALYSIS PIPELINE V1.1
# Audio -> STT -> MiniLM -> Sales Analysis -> Qwen
# =========================================================


ROOT = r"A:\5.Projects & Information\16.Intelligent Sales Data Analysis & Business Intelligence"

MINILM_DIR = ROOT + r"\ISDABI Model\MiniLM"

CHECKPOINT = (
    ROOT
    + r"\ISDABI Model\checkpoints\MiniLM Sales Outcome V1\best_model.pt"
)

LLAMA = ROOT + r"\ISDABI Model\llama.cpp\llama-cli.exe"

QWEN = (
    ROOT
    + r"\ISDABI Model\Qwen\qwen2.5-0.5b-instruct-q4_k_m.gguf"
)

REPORT_DIR = ROOT + r"\ISDABI Reports"

WHISPER_CACHE = (
    ROOT
    + r"\ISDABI Model\Whisper"
)


# =========================================================
# AUDIO INPUT
# =========================================================

if len(sys.argv) < 2:

    print()
    print("=" * 60)
    print("ISDABI AUDIO SALES ANALYSIS PIPELINE V1.1")
    print("=" * 60)
    print()
    print("ERROR: No audio file provided.")
    print()
    print(
        'Usage: python "ISDABI Audio Sales Analysis Pipeline V1.1.py" "audio.wav"'
    )
    print()

    sys.exit(1)


AUDIO_FILE = os.path.abspath(sys.argv[1])


# =========================================================
# PREPARE DIRECTORIES
# =========================================================

os.makedirs(REPORT_DIR, exist_ok=True)

os.makedirs(WHISPER_CACHE, exist_ok=True)


# =========================================================
# VERIFY REQUIRED FILES
# =========================================================

required_files = {

    "Audio file": AUDIO_FILE,

    "MiniLM model": MINILM_DIR,

    "MiniLM checkpoint": CHECKPOINT,

    "llama.cpp": LLAMA,

    "Qwen model": QWEN,
}


for name, path in required_files.items():

    if not os.path.exists(path):

        raise FileNotFoundError(
            f"{name} not found:\n{path}"
        )


# =========================================================
# AUDIO FORMAT
# =========================================================

supported_extensions = {

    ".wav",
    ".mp3",
    ".m4a",
    ".flac",
    ".ogg",
    ".aac",
    ".wma",
}


extension = os.path.splitext(
    AUDIO_FILE
)[1].lower()


if extension not in supported_extensions:

    raise ValueError(
        "Unsupported audio format: "
        + extension
        + "\nSupported formats: WAV, MP3, M4A, FLAC, OGG, AAC, WMA"
    )


# =========================================================
# START
# =========================================================

print()
print("=" * 60)
print("ISDABI AUDIO SALES ANALYSIS PIPELINE V1.1")
print("=" * 60)
print()

print("Audio:")
print(AUDIO_FILE)
print()


# =========================================================
# STEP 1 — SPEECH TO TEXT
# =========================================================

print("=" * 60)
print("STEP 1 — SPEECH TO TEXT")
print("=" * 60)
print()

print("Loading Faster-Whisper Small model...")


whisper_model = WhisperModel(

    "small",

    device="cpu",

    compute_type="int8",

    download_root=WHISPER_CACHE
)


print("Transcribing audio...")
print()


segments, info = whisper_model.transcribe(

    AUDIO_FILE,

    beam_size=5,

    vad_filter=True
)


transcript_parts = []


for segment in segments:

    text = segment.text.strip()

    if text:

        transcript_parts.append(text)


transcript = "\n".join(
    transcript_parts
).strip()


if not transcript:

    raise RuntimeError(
        "Speech-to-text produced an empty transcript."
    )


print("Detected language:")
print(info.language)

print()

print("TRANSCRIPT")
print("-" * 60)
print(transcript)
print()


# =========================================================
# STEP 2 — MINILM
# =========================================================

print("=" * 60)
print("STEP 2 — MINILM SALES OUTCOME ANALYSIS")
print("=" * 60)
print()

print("Loading fine-tuned MiniLM...")


tokenizer = AutoTokenizer.from_pretrained(

    MINILM_DIR,

    local_files_only=True
)


encoder = AutoModel.from_pretrained(

    MINILM_DIR,

    local_files_only=True
)


# =========================================================
# MINI LM CLASSIFIER
# =========================================================

class SalesClassifier(torch.nn.Module):

    def __init__(self, encoder):

        super().__init__()

        self.encoder = encoder

        self.dropout = torch.nn.Dropout(0.2)

        self.classifier = torch.nn.Linear(
            384,
            2
        )


    def forward(
        self,
        input_ids,
        attention_mask
    ):

        output = self.encoder(

            input_ids=input_ids,

            attention_mask=attention_mask
        )


        mask = attention_mask.unsqueeze(
            -1
        ).float()


        pooled = (
            output.last_hidden_state * mask
        ).sum(
            dim=1
        )


        pooled = pooled / mask.sum(
            dim=1
        ).clamp(
            min=1e-9
        )


        pooled = self.dropout(
            pooled
        )


        return self.classifier(
            pooled
        )


# =========================================================
# LOAD CHECKPOINT
# =========================================================

device = torch.device("cpu")

model = SalesClassifier(
    encoder
)


state = torch.load(

    CHECKPOINT,

    map_location=device,

    weights_only=True
)


model.load_state_dict(
    state
)

model.to(device)

model.eval()


# =========================================================
# MINILM INFERENCE
# =========================================================

encoded = tokenizer(

    transcript,

    truncation=True,

    padding=True,

    max_length=256,

    return_tensors="pt"
)


with torch.no_grad():

    logits = model(

        encoded["input_ids"],

        encoded["attention_mask"]
    )


probabilities = torch.softmax(
    logits,
    dim=1
)[0]


predicted_class = torch.argmax(
    probabilities
).item()


predicted_outcome = (
    "SUCCESS"
    if predicted_class == 1
    else "FAILURE"
)


success_probability = float(
    probabilities[1]
)

failure_probability = float(
    probabilities[0]
)


print("MiniLM Prediction:")
print(predicted_outcome)

print()

print(
    "SUCCESS Probability:",
    round(
        success_probability * 100,
        2
    ),
    "%"
)

print(
    "FAILURE Probability:",
    round(
        failure_probability * 100,
        2
    ),
    "%"
)

print()


# =========================================================
# STEP 3 — IMPROVED SALES SIGNAL ANALYSIS
# =========================================================

print("=" * 60)
print("STEP 3 — STRUCTURED SALES ANALYSIS")
print("=" * 60)
print()


lower_text = transcript.lower()


# =========================================================
# BUYING / SALES SIGNALS
# =========================================================

buying_signals = []


signal_patterns = {

    "product_interest": [

        "interested in",
        "looking for",
        "interested",
        "looking at",
        "want to know about"
    ],

    "product_inquiry": [

        "what is",
        "what's",
        "how much",
        "does it come with",
        "do you have",
        "tell me about",
        "information about",
        "question about",
        "questions about"
    ],

    "purchase_interest": [

        "buy",
        "purchase",
        "order",
        "place an order",
        "purchase it",
        "buy it"
    ],

    "membership_interest": [

        "membership",
        "membership plan",
        "join",
        "sign up"
    ],

    "price_evaluation": [

        "price",
        "cost",
        "how much does",
        "how much is",
        "afford",
        "monthly rate",
        "monthly price"
    ],

    "trial_interest": [

        "trial",
        "free trial",
        "try it",
        "try the"
    ],

    "commitment": [

        "go ahead",
        "ready to buy",
        "ready to purchase",
        "ready to sign",
        "start today",
        "sign today",
        "place the order"
    ],

    "product_specification_interest": [

        "btu",
        "specification",
        "specifications",
        "capacity",
        "model",
        "rating",
        "features",
        "remote control",
        "accessories"
    ]
}


for name, patterns in signal_patterns.items():

    if any(
        pattern in lower_text
        for pattern in patterns
    ):

        buying_signals.append(name)


# Remove duplicates while preserving order

buying_signals = list(
    dict.fromkeys(buying_signals)
)


# =========================================================
# OBJECTION DETECTION
#
# Normal questions such as:
# "Does it come with a remote?"
# are NOT objections.
# =========================================================

objections = []


objection_patterns = {

    "price_objection": [

        "too expensive",
        "very expensive",
        "too costly",
        "costs too much",
        "price is too high",
        "too high",
        "can't afford",
        "cannot afford",
        "outside my budget"
    ],

    "time_objection": [

        "no time",
        "don't have time",
        "do not have time",
        "too busy",
        "not enough time"
    ],

    "commitment_objection": [

        "don't want to commit",
        "do not want to commit",
        "can't commit",
        "cannot commit",
        "too long term",
        "long commitment",
        "long-term commitment"
    ],

    "cancellation_concern": [

        "can't cancel",
        "cannot cancel",
        "cancellation fee",
        "cancel fee",
        "difficult to cancel"
    ],

    "uncertainty": [

        "not sure",
        "unsure",
        "i'm uncertain",
        "i am uncertain",
        "i don't know if",
        "i do not know if",
        "i'm concerned",
        "i am concerned",
        "concerned about",
        "worried about"
    ]
}


for name, patterns in objection_patterns.items():

    if any(
        pattern in lower_text
        for pattern in patterns
    ):

        objections.append(name)


objections = list(
    dict.fromkeys(objections)
)


# =========================================================
# CUSTOMER INTENT
# =========================================================

if any(
    phrase in lower_text
    for phrase in [
        "buy",
        "purchase",
        "place an order",
        "ready to buy",
        "ready to purchase"
    ]
):

    customer_intent = "Purchase intent"

elif buying_signals:

    customer_intent = "Product information / evaluation"

else:

    customer_intent = "General inquiry"


# =========================================================
# STRUCTURED RESULT
# =========================================================

structured_analysis = {

    "predicted_outcome":
        predicted_outcome,

    "success_probability":
        round(
            success_probability,
            4
        ),

    "failure_probability":
        round(
            failure_probability,
            4
        ),

    "customer_intent":
        customer_intent,

    "buying_signals":
        buying_signals,

    "objections":
        objections
}


print("Customer Intent:")
print(customer_intent)

print()

print("Buying Signals:")
print(buying_signals)

print()

print("Objections:")
print(objections)

print()


# =========================================================
# STEP 4 — QWEN
# =========================================================

print("=" * 60)
print("STEP 4 — QWEN MANAGER REPORT")
print("=" * 60)
print()

print("Starting Qwen...")


prompt = f"""
You are an experienced sales manager.

Analyze the sales call using the provided transcript and AI analysis.

AI ANALYSIS:

{json.dumps(
    structured_analysis,
    indent=2
)}

CALL TRANSCRIPT:

{transcript}

Create a concise professional sales-call report.

You MUST return all seven sections below.
Do not skip any section.

Sales Outcome

Customer Situation

Key Buying Signals

Main Objections

What Went Well

What Needs Improvement

Recommended Follow-up

Rules:

1. Base every statement on the transcript or AI analysis.
2. Do not invent customer facts.
3. A product question is NOT automatically an objection.
4. Only list an objection when the customer expresses a concern,
   hesitation, rejection, or problem.
5. Product specifications and product questions should be treated
   as information-seeking or buying signals when appropriate.
6. Keep the report concise.
7. Use simple professional business English.
8. Do not include a preamble.
9. Do not include markdown code fences.
10. Do not repeat the full transcript.
"""


# =========================================================
# RUN LLAMA.CPP
# =========================================================

result = subprocess.run(

    [

        LLAMA,

        "-m",
        QWEN,

        "-ngl",
        "99",

        "-c",
        "4096",

        "-n",
        "500",

        "-p",
        prompt,

        "-st",

        "--simple-io",

        "--no-display-prompt",

        "--no-show-timings",

        "--log-disable"
    ],

    capture_output=True,

    text=True,

    encoding="utf-8",

    errors="replace"
)


if result.returncode != 0:

    print()
    print("QWEN ERROR")
    print("=" * 60)

    print(result.stderr)

    raise RuntimeError(
        f"llama.cpp exited with code "
        f"{result.returncode}"
    )


raw_qwen_output = result.stdout.strip()


if not raw_qwen_output:

    raise RuntimeError(
        "Qwen returned an empty report."
    )


# =========================================================
# CLEAN QWEN OUTPUT
# =========================================================

manager_report = raw_qwen_output


# Remove llama.cpp startup text

sales_outcome_position = manager_report.find(
    "Sales Outcome:"
)


if sales_outcome_position >= 0:

    manager_report = manager_report[
        sales_outcome_position:
    ]


# Remove interactive exit text

exit_position = manager_report.find(
    "\nExiting..."
)


if exit_position >= 0:

    manager_report = manager_report[
        :exit_position
    ]


# Remove trailing prompt marker if present

manager_report = re.sub(
    r"^\s*>\s*",
    "",
    manager_report
)


manager_report = manager_report.strip()


# =========================================================
# FALLBACK IF MODEL OMITTED SECTIONS
# =========================================================

required_sections = [

    "Sales Outcome:",
    "Customer Situation:",
    "Key Buying Signals:",
    "Main Objections:",
    "What Went Well:",
    "What Needs Improvement:",
    "Recommended Follow-up:"
]


missing_sections = [

    section
    for section in required_sections
    if section not in manager_report
]


if missing_sections:

    manager_report += (
        "\n\n"
        "Note: Qwen did not return all requested report sections.\n"
        "Missing sections: "
        + ", ".join(missing_sections)
    )


# =========================================================
# STEP 5 — SAVE REPORT
# =========================================================

print()
print("=" * 60)
print("STEP 5 — SAVE REPORT")
print("=" * 60)
print()


audio_name = os.path.splitext(
    os.path.basename(AUDIO_FILE)
)[0]


output_file = (

    REPORT_DIR
    + "\\"
    + audio_name
    + " - ISDABI Audio Analysis.json"
)


final_report = {

    "project":
        "ISDABI",

    "pipeline":
        "Audio -> Faster-Whisper -> MiniLM -> Structured Analysis -> Qwen",

    "audio_file":
        AUDIO_FILE,

    "speech_to_text": {

        "model":
            "Faster-Whisper Small",

        "language":
            info.language,

        "transcript":
            transcript
    },

    "miniLM":
        structured_analysis,

    "manager_report":
        manager_report
}


with open(

    output_file,

    "w",

    encoding="utf-8"
) as f:

    json.dump(

        final_report,

        f,

        indent=2,

        ensure_ascii=False
    )


# =========================================================
# FINAL RESULT
# =========================================================

print("=" * 60)
print("ISDABI AUDIO SALES ANALYSIS COMPLETE")
print("=" * 60)

print()

print(
    "Audio:",
    os.path.basename(AUDIO_FILE)
)

print(
    "Detected Language:",
    info.language
)

print()

print(
    "MiniLM Prediction:",
    predicted_outcome
)

print(
    "SUCCESS Probability:",
    round(
        success_probability * 100,
        2
    ),
    "%"
)

print(
    "FAILURE Probability:",
    round(
        failure_probability * 100,
        2
    ),
    "%"
)

print()

print(
    "Customer Intent:",
    customer_intent
)

print(
    "Buying Signals:",
    buying_signals
)

print(
    "Objections:",
    objections
)

print()

print("QWEN MANAGER REPORT")
print("=" * 60)

print(manager_report)

print()

print("REPORT SAVED:")
print(output_file)

print()

print("STATUS: PASS")