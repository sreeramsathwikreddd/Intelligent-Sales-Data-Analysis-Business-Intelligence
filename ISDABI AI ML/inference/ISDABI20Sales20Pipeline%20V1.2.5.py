import os
import sys
import json
import subprocess
import torch

from faster_whisper import WhisperModel
from transformers import AutoTokenizer, AutoModel


# =========================================================
# ISDABI AUDIO SALES ANALYSIS PIPELINE V1.2.5
# Audio -> STT -> MiniLM -> Structured Analysis -> Qwen JSON
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

WHISPER_CACHE = ROOT + r"\ISDABI Model\Whisper"


# =========================================================
# AUDIO INPUT
# =========================================================

if len(sys.argv) < 2:

    print("ERROR: No audio file provided.")
    print()
    print(
        'Usage: python "ISDABI Audio Sales Analysis Pipeline V1.2.py" "audio.wav"'
    )
    sys.exit(1)


AUDIO_FILE = os.path.abspath(sys.argv[1])


# =========================================================
# DIRECTORIES
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
# START
# =========================================================

print()
print("=" * 60)
print("ISDABI AUDIO SALES ANALYSIS PIPELINE V1.2.5")
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
# STEP 2 — MINILM SALES OUTCOME
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


class SalesClassifier(torch.nn.Module):

    def __init__(self, encoder):

        super().__init__()

        self.encoder = encoder
        self.dropout = torch.nn.Dropout(0.2)
        self.classifier = torch.nn.Linear(384, 2)


    def forward(
        self,
        input_ids,
        attention_mask
    ):

        output = self.encoder(
            input_ids=input_ids,
            attention_mask=attention_mask
        )

        mask = attention_mask.unsqueeze(-1).float()

        pooled = (
            output.last_hidden_state * mask
        ).sum(dim=1)

        pooled = pooled / mask.sum(
            dim=1
        ).clamp(min=1e-9)

        pooled = self.dropout(pooled)

        return self.classifier(pooled)


# =========================================================
# LOAD CHECKPOINT
# =========================================================

device = torch.device("cpu")

model = SalesClassifier(encoder)


state = torch.load(
    CHECKPOINT,
    map_location=device,
    weights_only=True
)


model.load_state_dict(state)

model.to(device)

model.eval()


# =========================================================
# INFERENCE
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
    round(success_probability * 100, 2),
    "%"
)

print(
    "FAILURE Probability:",
    round(failure_probability * 100, 2),
    "%"
)

print()


# =========================================================
# STEP 3 — STRUCTURED SALES ANALYSIS
# =========================================================

print("=" * 60)
print("STEP 3 — STRUCTURED SALES ANALYSIS")
print("=" * 60)
print()


lower_text = transcript.lower()


# =========================================================
# BUYING SIGNALS
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


buying_signals = list(
    dict.fromkeys(buying_signals)
)


# =========================================================
# OBJECTIONS
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
# STRUCTURED ANALYSIS
# =========================================================

structured_analysis = {

    "predicted_outcome": predicted_outcome,

    "success_probability": round(
        success_probability,
        4
    ),

    "failure_probability": round(
        failure_probability,
        4
    ),

    "customer_intent": customer_intent,

    "buying_signals": buying_signals,

    "objections": objections
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
# STEP 4 — QWEN STRUCTURED JSON
# =========================================================

print("=" * 60)
print("STEP 4 — QWEN STRUCTURED MANAGER REPORT")
print("=" * 60)
print()

print("Starting Qwen...")


prompt = f"""
You are a professional sales manager.

Analyze this sales call.

AI ANALYSIS:
{json.dumps(structured_analysis, indent=2)}

CALL TRANSCRIPT:
{transcript}

Return ONLY valid JSON.

Do not write anything before or after the JSON.

Use exactly this structure:

{{
  "sales_outcome": "",
  "customer_situation": "",
  "key_buying_signals": [],
  "main_objections": [],
  "what_went_well": [],
  "what_needs_improvement": [],
  "recommended_follow_up": []
}}

Rules:

1. sales_outcome must use the AI predicted outcome.
2. customer_situation must summarize the customer's actual situation.
3. key_buying_signals must use only signals supported by the transcript.
4. main_objections must contain only real customer concerns, hesitation,
   rejection, or problems.
5. A normal product question is NOT an objection.
6. Do not invent facts.
7. Do not recommend information that is not supported by the call.
8. Keep every item concise.
9. If there are no objections, return an empty array.
10. Every required field must be present.
"""


# =========================================================
# RUN QWEN
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
        f"llama.cpp exited with code {result.returncode}"
    )


raw_output = result.stdout.strip()


if not raw_output:

    raise RuntimeError(
        "Qwen returned an empty response."
    )


# =========================================================
# EXTRACT ALL JSON OBJECTS
# =========================================================

decoder = json.JSONDecoder()

json_objects = []

search_position = 0


while search_position < len(raw_output):

    json_start = raw_output.find("{", search_position)

    if json_start == -1:

        break

    try:

        candidate, consumed = decoder.raw_decode(
            raw_output[json_start:]
        )

        if isinstance(candidate, dict):

            json_objects.append(candidate)

        search_position = (
            json_start
            + consumed
        )

    except json.JSONDecodeError:

        search_position = json_start + 1


if not json_objects:

    raise RuntimeError(
        "Qwen did not return a valid JSON object.\n\n"
        + raw_output
    )


# =========================================================
# SELECT ONLY THE QWEN MANAGER REPORT
# =========================================================

manager_fields = {
    "customer_situation",
    "key_buying_signals",
    "main_objections",
    "what_went_well",
    "what_needs_improvement",
    "recommended_follow_up"
}


qwen_report = None


for candidate in reversed(json_objects):

    if (
        "customer_situation" in candidate
        and
        len(
            manager_fields.intersection(
                candidate.keys()
            )
        ) >= 4
    ):

        qwen_report = candidate

        break


if qwen_report is None:

    raise RuntimeError(
        "Qwen manager report JSON was not found.\n\n"
        + raw_output
    )


# =========================================================
# KEEP ONLY MANAGER REPORT FIELDS
# =========================================================

required_fields = [

    "sales_outcome",

    "customer_situation",

    "key_buying_signals",

    "main_objections",

    "what_went_well",

    "what_needs_improvement",

    "recommended_follow_up"
]


clean_report = {}


for field in required_fields:

    if field in qwen_report:

        clean_report[field] = qwen_report[field]

    elif field == "sales_outcome":

        clean_report[field] = predicted_outcome

    elif field == "customer_situation":

        clean_report[field] = ""

    else:

        clean_report[field] = []


qwen_report = clean_report


# =========================================================
# NORMALIZE LIST FIELDS
# =========================================================

list_fields = [

    "key_buying_signals",

    "main_objections",

    "what_went_well",

    "what_needs_improvement",

    "recommended_follow_up"
]


for field in list_fields:

    if not isinstance(
        qwen_report[field],
        list
    ):

        qwen_report[field] = [
            str(qwen_report[field])
        ]


# =========================================================
# FORCE MODEL OUTCOME TO MATCH MINILM
# =========================================================

qwen_report["sales_outcome"] = predicted_outcome


# =========================================================
# STEP 5 — SAVE FINAL REPORT
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
    + " - ISDABI Audio Analysis V1.2.5.json"
)


final_report = {

    "project": "ISDABI",

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

    "qwen_manager_report":
        qwen_report
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
# FINAL DISPLAY
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

print(
    json.dumps(
        qwen_report,
        indent=2,
        ensure_ascii=False
    )
)

print()

print("REPORT SAVED:")
print(output_file)

print()

print("STATUS: PASS")