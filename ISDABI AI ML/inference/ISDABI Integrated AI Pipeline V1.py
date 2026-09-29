import os
import json
import subprocess
import torch
from transformers import AutoTokenizer, AutoModel


ROOT = r"A:\5.Projects & Information\16.Intelligent Sales Data Analysis & Business Intelligence"

TEST_FILE = ROOT + r"\ISDABI Dataset\testing\ISDABI Sales Testing.jsonl"

MINILM_DIR = ROOT + r"\ISDABI Model\MiniLM"

CHECKPOINT = ROOT + r"\ISDABI Model\checkpoints\MiniLM Sales Outcome V1\best_model.pt"

LLAMA = ROOT + r"\ISDABI Model\llama.cpp\llama-cli.exe"

QWEN = ROOT + r"\ISDABI Model\Qwen\qwen2.5-0.5b-instruct-q4_k_m.gguf"

REPORT_DIR = ROOT + r"\ISDABI Reports"

OUTPUT = REPORT_DIR + r"\ISDABI Integrated AI Report V1.json"


# ---------------------------------------------------------
# Prepare output directory
# ---------------------------------------------------------

os.makedirs(REPORT_DIR, exist_ok=True)


# ---------------------------------------------------------
# Verify required files
# ---------------------------------------------------------

required_files = {
    "Testing dataset": TEST_FILE,
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


# ---------------------------------------------------------
# Load one real test conversation
# ---------------------------------------------------------

with open(TEST_FILE, "r", encoding="utf-8") as f:
    record = json.loads(
        next(line for line in f if line.strip())
    )


conversation = record["conversation"]

conversation_text = ""

if isinstance(conversation, list):

    for turn in conversation:

        role = turn.get("role", "").upper()
        text = turn.get("text", "")

        conversation_text += f"{role}: {text}\n"

else:

    conversation_text = str(conversation)


# ---------------------------------------------------------
# Load fine-tuned MiniLM
# ---------------------------------------------------------

print("=" * 60)
print("ISDABI INTEGRATED AI PIPELINE V1")
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


# ---------------------------------------------------------
# MiniLM classifier architecture
# ---------------------------------------------------------

class SalesClassifier(torch.nn.Module):

    def __init__(self, encoder):

        super().__init__()

        self.encoder = encoder

        self.dropout = torch.nn.Dropout(0.2)

        self.classifier = torch.nn.Linear(384, 2)


    def forward(self, input_ids, attention_mask):

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


# ---------------------------------------------------------
# Load trained checkpoint
# ---------------------------------------------------------

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


# ---------------------------------------------------------
# MiniLM inference
# ---------------------------------------------------------

print("Running MiniLM inference...")


encoded = tokenizer(
    conversation_text,
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


# ---------------------------------------------------------
# Structured sales analysis
# ---------------------------------------------------------

print("Running structured analysis...")


lower_text = conversation_text.lower()


# ---------------------------------------------------------
# Buying signals
# ---------------------------------------------------------

buying_signals = []


signal_patterns = {

    "purchase_interest": [
        "join",
        "sign up",
        "buy",
        "purchase",
        "start"
    ],

    "membership_interest": [
        "membership",
        "plan",
        "membership plan"
    ],

    "price_evaluation": [
        "price",
        "cost",
        "expensive",
        "afford"
    ],

    "trial_interest": [
        "trial",
        "try",
        "free trial"
    ],

    "commitment": [
        "go ahead",
        "ready",
        "sign",
        "start today"
    ]
}


for name, patterns in signal_patterns.items():

    if any(
        pattern in lower_text
        for pattern in patterns
    ):

        buying_signals.append(name)


# ---------------------------------------------------------
# Objections
# ---------------------------------------------------------

objections = []


objection_patterns = {

    "price_objection": [
        "expensive",
        "too high",
        "cost",
        "price"
    ],

    "time_objection": [
        "no time",
        "busy",
        "time"
    ],

    "commitment_objection": [
        "commit",
        "commitment",
        "long term"
    ],

    "cancellation_concern": [
        "cancel",
        "cancellation"
    ],

    "uncertainty": [
        "not sure",
        "maybe",
        "unsure",
        "concern"
    ]
}


for name, patterns in objection_patterns.items():

    if any(
        pattern in lower_text
        for pattern in patterns
    ):

        objections.append(name)


# ---------------------------------------------------------
# Structured AI analysis
#
# IMPORTANT:
# Ground truth is intentionally NOT sent to Qwen.
# This prevents test-label leakage.
# ---------------------------------------------------------

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

    "buying_signals": buying_signals,

    "objections": objections
}


# ---------------------------------------------------------
# Qwen manager report
# ---------------------------------------------------------

print("Starting Qwen manager report...")
print()


prompt = f"""
You are an experienced sales manager.

Create a concise professional sales-call report from the
AI analysis and conversation below.

AI ANALYSIS:

{json.dumps(structured_analysis, indent=2)}

CONVERSATION:

{conversation_text}

Return exactly these sections:

Sales Outcome

Customer Situation

Key Buying Signals

Main Objections

What Went Well

What Needs Improvement

Recommended Follow-up

Use simple professional business language.

Do not invent facts that are not present in the conversation.

Base the report only on the provided AI analysis and
conversation.
"""


# ---------------------------------------------------------
# Run Qwen through llama.cpp
#
# -st                = single turn, then exit
# --simple-io        = subprocess-friendly I/O
# --no-display-prompt = don't include the prompt in output
# ---------------------------------------------------------

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

        "--no-show-timings"
    ],

    capture_output=True,

    text=True,

    encoding="utf-8",

    errors="replace"
)


# ---------------------------------------------------------
# Check Qwen execution
# ---------------------------------------------------------

if result.returncode != 0:

    print("QWEN ERROR")
    print("=" * 60)

    print(result.stderr)

    raise RuntimeError(
        f"llama.cpp exited with code {result.returncode}"
    )


manager_report = result.stdout.strip()


if not manager_report:

    raise RuntimeError(
        "Qwen returned an empty manager report."
    )


# ---------------------------------------------------------
# Save integrated result
# ---------------------------------------------------------

final_report = {

    "project": "ISDABI",

    "pipeline":
        "MiniLM Fine-Tuned + Structured Analysis + Qwen",

    "conversation_id":
        record.get("conversation_id"),

    "miniLM":
        structured_analysis,

    "manager_report":
        manager_report,

    "conversation":
        conversation
}


with open(
    OUTPUT,
    "w",
    encoding="utf-8"
) as f:

    json.dump(
        final_report,
        f,
        indent=2,
        ensure_ascii=False
    )


# ---------------------------------------------------------
# Final console output
# ---------------------------------------------------------

print("=" * 60)
print("ISDABI INTEGRATED AI PIPELINE V1")
print("=" * 60)

print(
    "Conversation ID:",
    record.get("conversation_id")
)

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

print("Saved:")
print(OUTPUT)

print()

print("STATUS: PASS")