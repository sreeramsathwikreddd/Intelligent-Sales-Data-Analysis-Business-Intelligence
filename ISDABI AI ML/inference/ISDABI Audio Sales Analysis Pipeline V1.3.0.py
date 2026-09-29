import os
import sys
import json
import subprocess
import re
import torch

from faster_whisper import WhisperModel
from transformers import AutoTokenizer, AutoModel


# =========================================================
# ISDABI AUDIO SALES ANALYSIS PIPELINE V1.4.0
#
# Audio
#   -> Faster-Whisper
#   -> Fine-tuned MiniLM
#   -> Deterministic Evidence Extraction
#   -> Qwen Formatting
#   -> Final Grounding Enforcement
#   -> JSON Report
#
# IMPORTANT:
# Qwen is NEVER allowed to introduce facts into the final report.
# Final report content is grounded in the transcript and deterministic
# evidence extraction.
# =========================================================


ROOT = (
    r"A:\5.Projects & Information\16.Intelligent Sales Data Analysis & Business Intelligence"
)

MINILM_DIR = (
    ROOT
    + r"\ISDABI Model\MiniLM"
)

CHECKPOINT = (
    ROOT
    + r"\ISDABI Model\checkpoints\MiniLM Sales Outcome V1\best_model.pt"
)

LLAMA = (
    ROOT
    + r"\ISDABI Model\llama.cpp\llama-cli.exe"
)

QWEN = (
    ROOT
    + r"\ISDABI Model\Qwen\qwen2.5-0.5b-instruct-q4_k_m.gguf"
)

REPORT_DIR = (
    ROOT
    + r"\ISDABI Reports"
)

WHISPER_CACHE = (
    ROOT
    + r"\ISDABI Model\Whisper"
)


# =========================================================
# AUDIO INPUT
# =========================================================

if len(sys.argv) < 2:

    print("ERROR: No audio file provided.")
    print()

    print(
        'Usage: python "ISDABI Audio Sales Analysis Pipeline V1.4.0.py" "audio.wav"'
    )

    sys.exit(1)


AUDIO_FILE = os.path.abspath(
    sys.argv[1]
)


# =========================================================
# DIRECTORIES
# =========================================================

os.makedirs(
    REPORT_DIR,
    exist_ok=True
)

os.makedirs(
    WHISPER_CACHE,
    exist_ok=True
)


# =========================================================
# VERIFY REQUIRED FILES
# =========================================================

required_files = {

    "Audio file":
        AUDIO_FILE,

    "MiniLM model":
        MINILM_DIR,

    "MiniLM checkpoint":
        CHECKPOINT,

    "llama.cpp":
        LLAMA,

    "Qwen model":
        QWEN
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
print("ISDABI AUDIO SALES ANALYSIS PIPELINE V1.4.0")
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

print(
    "ISDABI_STAGE: transcribing",
    flush=True
)


segments, info = whisper_model.transcribe(
    AUDIO_FILE,
    beam_size=5,
    vad_filter=True
)


transcript_parts = []


for segment in segments:

    text = segment.text.strip()

    if text:

        transcript_parts.append(
            text
        )


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

print(
    "ISDABI_STAGE: analyzing",
    flush=True
)

tokenizer = AutoTokenizer.from_pretrained(
    MINILM_DIR,
    local_files_only=True
)


encoder = AutoModel.from_pretrained(
    MINILM_DIR,
    local_files_only=True
)


class SalesClassifier(torch.nn.Module):

    def __init__(
        self,
        encoder
    ):

        super().__init__()

        self.encoder = encoder

        self.dropout = torch.nn.Dropout(
            0.2
        )

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

device = torch.device(
    "cpu"
)


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

model.to(
    device
)

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
# STEP 3 — DETERMINISTIC SALES EVIDENCE
# =========================================================

print("=" * 60)
print("STEP 3 — DETERMINISTIC SALES EVIDENCE")
print("=" * 60)
print()


lower_text = transcript.lower()


# =========================================================
# BUYING SIGNALS
# =========================================================

print(
    "ISDABI_STAGE: signals",
    flush=True
)

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

        buying_signals.append(
            name
        )


buying_signals = list(
    dict.fromkeys(
        buying_signals
    )
)


# =========================================================
# OBJECTIONS
# =========================================================

print(
    "ISDABI_STAGE: objections",
    flush=True
)

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

        objections.append(
            name
        )


objections = list(
    dict.fromkeys(
        objections
    )
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

    customer_intent = (
        "Purchase intent"
    )


elif buying_signals:

    customer_intent = (
        "Product information / evaluation"
    )


else:

    customer_intent = (
        "General inquiry"
    )


# =========================================================
# PRODUCT REFERENCE EXTRACTION
# =========================================================

def extract_product_reference(
    text
):

    patterns = [

        r"\b[A-Z]{2,}\d{2,}[A-Z0-9-]*\b",

        r"\b[A-Z][A-Za-z0-9-]{2,}\s+"
        r"(?:air conditioner|product|unit|model)\b"
    ]


    for pattern in patterns:

        matches = re.findall(
            pattern,
            text
        )

        if matches:

            return matches[0].strip()


    return ""


product_reference = (
    extract_product_reference(
        transcript
    )
)


# =========================================================
# PRODUCT DESCRIPTION EXTRACTION
# =========================================================

def detect_product_description(
    text
):

    lower = text.lower()

    known_descriptions = [

        "air conditioner",

        "air conditioning unit",

        "gym membership",

        "membership",

        "treadmill",

        "exercise bike",

        "elliptical",

        "fitness equipment",

        "software",

        "laptop",

        "phone",

        "camera",

        "television",

        "refrigerator",

        "washing machine"
    ]


    for description in known_descriptions:

        if description in lower:

            return description


    return ""


product_description = (
    detect_product_description(
        transcript
    )
)


# =========================================================
# CUSTOMER QUESTION / INFORMATION TOPICS
# =========================================================

information_topics = []


topic_patterns = {

    "price": [

        "price",

        "cost",

        "how much",

        "monthly rate",

        "monthly price"
    ],


    "btu_rating": [

        "btu",

        "btu rating"
    ],


    "remote_control": [

        "remote control"
    ],


    "specifications": [

        "specification",

        "specifications",

        "capacity",

        "rating",

        "features"
    ],


    "accessories": [

        "accessories",

        "comes with"
    ],


    "membership": [

        "membership",

        "membership plan"
    ],


    "trial": [

        "trial",

        "free trial"
    ],


    "cancellation": [

        "cancel",

        "cancellation",

        "cancellation fee"
    ]
}


for topic, patterns in topic_patterns.items():

    if any(
        pattern in lower_text
        for pattern in patterns
    ):

        information_topics.append(
            topic
        )


information_topics = list(
    dict.fromkeys(
        information_topics
    )
)


# =========================================================
# CUSTOMER SITUATION
# =========================================================

def build_customer_situation():

    if product_reference:

        if (
            "btu_rating"
            in information_topics
            and
            "remote_control"
            in information_topics
        ):

            return (
                f"Customer is asking about the "
                f"{product_reference} "
                f"{product_description if product_description else 'product'}, "
                f"specifically its BTU rating and whether it comes "
                f"with a remote control."
            )


        if information_topics:

            topic_labels = {

                "price":
                    "price",

                "btu_rating":
                    "BTU rating",

                "remote_control":
                    "remote control",

                "specifications":
                    "product specifications",

                "accessories":
                    "included accessories",

                "membership":
                    "membership",

                "trial":
                    "trial",

                "cancellation":
                    "cancellation"
            }


            readable_topics = [

                topic_labels[topic]

                for topic in information_topics

                if topic in topic_labels
            ]


            if len(readable_topics) == 1:

                topic_text = readable_topics[0]

            elif len(readable_topics) == 2:

                topic_text = (
                    f"{readable_topics[0]} and "
                    f"{readable_topics[1]}"
                )

            else:

                topic_text = (
                    ", ".join(
                        readable_topics[:-1]
                    )
                    + ", and "
                    + readable_topics[-1]
                )


            return (
                f"Customer is asking about the "
                f"{product_reference} "
                f"{product_description if product_description else 'product'}, "
                f"specifically regarding {topic_text}."
            )


        return (
            f"Customer is asking about the "
            f"{product_reference}"
            f"{' ' + product_description if product_description else ''}."
        )


    if product_description and information_topics:

        return (
            f"Customer is asking about the "
            f"{product_description}, "
            f"with questions about the product."
        )


    if buying_signals:

        return (
            "Customer is seeking product information "
            "or evaluating the offering."
        )


    return (
        "Customer is making a general inquiry."
    )


customer_situation = (
    build_customer_situation()
)


# =========================================================
# GROUNDED WHAT WENT WELL
# =========================================================

def build_what_went_well():

    points = []


    if "product_inquiry" in buying_signals:

        points.append(
            "Customer showed specific interest by asking product-related questions."
        )


    if "product_specification_interest" in buying_signals:

        points.append(
            "Customer asked for specific product specifications or features."
        )


    if "purchase_interest" in buying_signals:

        points.append(
            "Customer expressed purchase-related interest."
        )


    if "membership_interest" in buying_signals:

        points.append(
            "Customer expressed membership-related interest."
        )


    if "trial_interest" in buying_signals:

        points.append(
            "Customer expressed interest in a trial."
        )


    if "commitment" in buying_signals:

        points.append(
            "Customer showed a commitment signal."
        )


    if not points:

        points.append(
            "Customer clearly communicated their needs or questions."
        )


    return points


# =========================================================
# GROUNDED IMPROVEMENTS
# =========================================================

def build_what_needs_improvement():

    improvements = []


    if objections:

        improvements.append(
            "The customer's identified concerns should be addressed clearly."
        )


    return improvements


# =========================================================
# GROUNDED FOLLOW-UP
# =========================================================

def build_recommended_follow_up():

    follow_up = []


    if information_topics:

        follow_up.append(
            "Follow up by addressing the customer's stated product questions."
        )


    if objections:

        follow_up.append(
            "Address the identified customer concerns before requesting a decision."
        )


    if not follow_up:

        follow_up.append(
            "Follow up based on the customer's stated needs."
        )


    return follow_up


# =========================================================
# FINAL GROUNDED REPORT
# =========================================================

grounded_report = {

    "sales_outcome":
        predicted_outcome,

    "customer_situation":
        customer_situation,

    "key_buying_signals":
        buying_signals,

    "main_objections":
        objections,

    "what_went_well":
        build_what_went_well(),

    "what_needs_improvement":
        build_what_needs_improvement(),

    "recommended_follow_up":
        build_recommended_follow_up()
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

print("Customer Situation:")
print(customer_situation)

print()


# =========================================================
# STEP 4 — QWEN
# =========================================================

print(
    "ISDABI_STAGE: report",
    flush=True
)

print("=" * 60)
print("STEP 4 — QWEN MANAGER REPORT FORMATTING")
print("=" * 60)
print()

print("Starting Qwen...")


qwen_prompt = f"""
You are a professional sales report formatter.

Your ONLY job is to format the supplied GROUNDED REPORT.

DO NOT create new facts.

DO NOT infer missing facts.

DO NOT modify the meaning.

DO NOT add information.

GROUNDED REPORT:
{json.dumps(
    grounded_report,
    indent=2
)}

CALL TRANSCRIPT:
{transcript}

Return ONLY valid JSON.

Use exactly:

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

1. Copy every field from GROUNDED REPORT.
2. Do not change any fact.
3. Do not add product information.
4. Do not add warranty information.
5. Do not claim a question was answered.
6. Do not claim the salesperson performed an action unless explicitly present.
7. Do not claim customer satisfaction.
8. Do not claim a purchase occurred.
9. Do not invent objections.
10. Do not invent buying signals.
11. Do not invent follow-up actions.
12. Return JSON only.
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
        "400",

        "-p",
        qwen_prompt,

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
# EXTRACT JSON OBJECTS
# =========================================================

decoder = json.JSONDecoder()

json_objects = []

search_position = 0


while search_position < len(raw_output):

    json_start = raw_output.find(
        "{",
        search_position
    )


    if json_start == -1:

        break


    try:

        candidate, consumed = (
            decoder.raw_decode(
                raw_output[
                    json_start:
                ]
            )
        )


        if isinstance(
            candidate,
            dict
        ):

            json_objects.append(
                candidate
            )


        search_position = (
            json_start
            + consumed
        )


    except json.JSONDecodeError:

        search_position = (
            json_start + 1
        )


# =========================================================
# QWEN STATUS
# =========================================================

if json_objects:

    qwen_status = (
        "QWEN_FORMATTED_GROUNDED"
    )

else:

    qwen_status = (
        "QWEN_OUTPUT_INVALID_USING_GROUNDED_REPORT"
    )


# =========================================================
# IMPORTANT FINAL GROUNDING
#
# The final manager report ALWAYS comes from the
# deterministic grounded report.
#
# Qwen cannot modify final facts.
# =========================================================

final_manager_report = {

    "sales_outcome":
        grounded_report[
            "sales_outcome"
        ],

    "customer_situation":
        grounded_report[
            "customer_situation"
        ],

    "key_buying_signals":
        grounded_report[
            "key_buying_signals"
        ],

    "main_objections":
        grounded_report[
            "main_objections"
        ],

    "what_went_well":
        grounded_report[
            "what_went_well"
        ],

    "what_needs_improvement":
        grounded_report[
            "what_needs_improvement"
        ],

    "recommended_follow_up":
        grounded_report[
            "recommended_follow_up"
        ]
}


# =========================================================
# FINAL VALIDATION
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


for field in required_fields:

    if field not in final_manager_report:

        raise RuntimeError(
            f"Final manager report missing field: {field}"
        )


if not isinstance(
    final_manager_report[
        "key_buying_signals"
    ],
    list
):

    raise RuntimeError(
        "key_buying_signals must be a list."
    )


if not isinstance(
    final_manager_report[
        "main_objections"
    ],
    list
):

    raise RuntimeError(
        "main_objections must be a list."
    )


if not isinstance(
    final_manager_report[
        "what_went_well"
    ],
    list
):

    raise RuntimeError(
        "what_went_well must be a list."
    )


if not isinstance(
    final_manager_report[
        "what_needs_improvement"
    ],
    list
):

    raise RuntimeError(
        "what_needs_improvement must be a list."
    )


if not isinstance(
    final_manager_report[
        "recommended_follow_up"
    ],
    list
):

    raise RuntimeError(
        "recommended_follow_up must be a list."
    )


# =========================================================
# FINAL REPORT
# =========================================================

print(
    "ISDABI_STAGE: finalizing",
    flush=True
)

final_report = {

    "project":
        "ISDABI",

    "pipeline":
        "Audio -> Faster-Whisper -> MiniLM -> Evidence -> Qwen -> Grounding",

    "pipeline_version":
        "V1.4.0",

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

    "miniLM": {

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
    },

    "evidence": {

        "product_reference":
            product_reference,

        "product_description":
            product_description,

        "information_topics":
            information_topics
    },

    "qwen": {

        "status":
            qwen_status,

        "model":
            "Qwen2.5-0.5B-Instruct Q4_K_M"
    },

    "qwen_manager_report":
        final_manager_report
}


# =========================================================
# SAVE REPORT
# =========================================================

audio_name = os.path.splitext(
    os.path.basename(
        AUDIO_FILE
    )
)[0]


output_file = (

    REPORT_DIR
    + "\\"
    + audio_name
    + " - ISDABI Audio Analysis V1.4.0.json"
)


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

print()
print("=" * 60)
print("ISDABI AUDIO SALES ANALYSIS COMPLETE")
print("=" * 60)
print()

print(
    "Audio:",
    os.path.basename(
        AUDIO_FILE
    )
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

print(
    "Customer Situation:"
)

print(
    customer_situation
)

print()

print(
    "QWEN STATUS:"
)

print(
    qwen_status
)

print()

print(
    "QWEN MANAGER REPORT"
)

print(
    "=" * 60
)

print(
    json.dumps(
        final_manager_report,
        indent=2,
        ensure_ascii=False
    )
)

print()

print(
    "REPORT SAVED:"
)

print(
    output_file
)

print()

print(
    "STATUS: PASS"
)