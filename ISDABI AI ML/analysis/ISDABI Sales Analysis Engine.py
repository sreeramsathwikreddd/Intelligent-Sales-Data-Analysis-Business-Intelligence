import json
import re
from pathlib import Path

import torch
from transformers import AutoTokenizer, AutoModel


# ============================================================
# PROJECT PATHS
# ============================================================

PROJECT_ROOT = Path(
    r"A:\5.Projects & Information\16.Intelligent Sales Data Analysis & Business Intelligence"
)

MODEL_PATH = PROJECT_ROOT / "ISDABI Model" / "MiniLM"
TRAINING_FILE = PROJECT_ROOT / "ISDABI Dataset" / "training" / "ISDABI Sales Training.jsonl"
REPORTS_PATH = PROJECT_ROOT / "ISDABI Reports"

REPORTS_PATH.mkdir(parents=True, exist_ok=True)


# ============================================================
# MODEL LOADING
# ============================================================

print("=" * 70)
print("ISDABI SALES ANALYSIS ENGINE V1.1")
print("=" * 70)
print()
print("Loading MiniLM...")

device = torch.device("cuda" if torch.cuda.is_available() else "cpu")

tokenizer = AutoTokenizer.from_pretrained(
    str(MODEL_PATH),
    local_files_only=True
)

model = AutoModel.from_pretrained(
    str(MODEL_PATH),
    local_files_only=True
)

model.to(device)
model.eval()

print("MiniLM loaded successfully.")
print(f"Device: {device}")
print(f"Embedding size: {model.config.hidden_size}")


# ============================================================
# TEXT UTILITIES
# ============================================================

def extract_text(conversation):
    """
    Converts the conversation into plain text.
    Supports both string and list-style conversations.
    """

    if isinstance(conversation, str):
        return conversation.strip()

    if isinstance(conversation, list):
        parts = []

        for item in conversation:
            if isinstance(item, dict):
                speaker = (
                    item.get("speaker")
                    or item.get("role")
                    or item.get("from")
                    or ""
                )

                text = (
                    item.get("text")
                    or item.get("content")
                    or item.get("message")
                    or ""
                )

                if text:
                    if speaker:
                        parts.append(f"{speaker}: {text}")
                    else:
                        parts.append(text)

            elif isinstance(item, str):
                parts.append(item)

        return "\n".join(parts).strip()

    return str(conversation).strip()


def get_turns(conversation):
    """
    Splits conversation into non-empty turns.
    """

    if isinstance(conversation, list):
        turns = []

        for item in conversation:
            if isinstance(item, dict):
                text = (
                    item.get("text")
                    or item.get("content")
                    or item.get("message")
                    or ""
                )

                if text:
                    turns.append(str(text).strip())

            elif isinstance(item, str) and item.strip():
                turns.append(item.strip())

        return turns

    text = extract_text(conversation)

    if not text:
        return []

    lines = [
        line.strip()
        for line in text.splitlines()
        if line.strip()
    ]

    return lines


def normalize_text(text):
    return re.sub(r"\s+", " ", text.lower()).strip()


# ============================================================
# MINILM EMBEDDING
# ============================================================

def generate_embedding(text):
    """
    Generates a normalized MiniLM sentence embedding.
    """

    encoded = tokenizer(
        text,
        return_tensors="pt",
        truncation=True,
        max_length=512,
        padding=True
    )

    encoded = {
        key: value.to(device)
        for key, value in encoded.items()
    }

    with torch.no_grad():
        output = model(**encoded)

    token_embeddings = output.last_hidden_state
    attention_mask = encoded["attention_mask"]

    mask = attention_mask.unsqueeze(-1).expand(token_embeddings.size()).float()

    summed = torch.sum(token_embeddings * mask, dim=1)
    counts = torch.clamp(mask.sum(dim=1), min=1e-9)

    embedding = summed / counts

    embedding = torch.nn.functional.normalize(
        embedding,
        p=2,
        dim=1
    )

    return embedding[0].cpu().tolist()


# ============================================================
# SIGNAL PATTERNS
# ============================================================

BUYING_PATTERNS = {
    "purchase_interest": [
        r"\bi want\b",
        r"\bi would like\b",
        r"\bi'd like\b",
        r"\bi am interested\b",
        r"\bi'm interested\b",
        r"\bsign me up\b",
        r"\bsign up\b",
        r"\bjoin\b",
        r"\bstart\b"
    ],

    "membership_interest": [
        r"\bmembership\b",
        r"\bplan\b",
        r"\bsubscription\b",
        r"\bmonthly membership\b",
        r"\bannual membership\b"
    ],

    "price_evaluation": [
        r"\bhow much\b",
        r"\bprice\b",
        r"\bcost\b",
        r"\bmonthly fee\b",
        r"\bannual fee\b"
    ],

    "trial_interest": [
        r"\btrial\b",
        r"\btry it\b",
        r"\bfree trial\b",
        r"\bvisit\b",
        r"\btour\b"
    ],

    "commitment": [
        r"\bwhen can i start\b",
        r"\bhow do i sign\b",
        r"\bwhere do i sign\b",
        r"\bcan i pay\b",
        r"\bpayment\b"
    ]
}


OBJECTION_PATTERNS = {
    "price_objection": [
        r"\btoo expensive\b",
        r"\bexpensive\b",
        r"\btoo much\b",
        r"\bcost too much\b",
        r"\bcan't afford\b",
        r"\bcannot afford\b",
        r"\bprice is high\b",
        r"\bprice\b"
    ],

    "time_objection": [
        r"\bno time\b",
        r"\bdon't have time\b",
        r"\bdo not have time\b",
        r"\btoo busy\b",
        r"\bbusy\b",
        r"\bmy schedule\b",
        r"\bschedule\b"
    ],

    "commitment_objection": [
        r"\bnot sure\b",
        r"\bmaybe\b",
        r"\bthink about it\b",
        r"\bneed to think\b",
        r"\bnot ready\b"
    ],

    "uncertainty": [
        r"\bunsure\b",
        r"\bconfused\b",
        r"\bdoesn't make sense\b",
        r"\bnot certain\b",
        r"\bi don't know\b",
        r"\bi'm not sure\b"
    ],

    "cancellation_concern": [
        r"\bcancel\b",
        r"\bcancellation\b",
        r"\brefund\b",
        r"\bcontract\b",
        r"\blocked in\b"
    ]
}


POSITIVE_PATTERNS = {
    "positive_response": [
        r"\byes\b",
        r"\byep\b",
        r"\bsounds good\b",
        r"\bgreat\b",
        r"\bperfect\b",
        r"\bthank you\b",
        r"\bthanks\b",
        r"\bi like\b",
        r"\bi'd love\b",
        r"\bthat works\b"
    ]
}


NEGATIVE_PATTERNS = {
    "negative_response": [
        r"\bno\b",
        r"\bnope\b",
        r"\bnot interested\b",
        r"\bnever\b",
        r"\bcan't\b",
        r"\bcannot\b",
        r"\bwon't\b",
        r"\bdo not want\b",
        r"\bdon't want\b"
    ]
}


# ============================================================
# SIGNAL DETECTION
# ============================================================

def find_signals(text, patterns):
    normalized = normalize_text(text)

    detected = []

    for category, expressions in patterns.items():

        matches = []

        for expression in expressions:
            if re.search(expression, normalized):
                matches.append(expression)

        if matches:
            detected.append({
                "type": category,
                "matches": len(matches)
            })

    return detected


# ============================================================
# CUSTOMER INTENT
# ============================================================

def determine_customer_intent(
    text,
    buying_signals,
    objection_signals
):

    normalized = normalize_text(text)

    strong_purchase_phrases = [
        "sign me up",
        "i want to join",
        "i want to start",
        "when can i start",
        "how do i sign up",
        "i'd like to join"
    ]

    moderate_purchase_phrases = [
        "interested",
        "membership",
        "trial",
        "join",
        "start"
    ]

    strong_score = sum(
        1
        for phrase in strong_purchase_phrases
        if phrase in normalized
    )

    moderate_score = sum(
        1
        for phrase in moderate_purchase_phrases
        if phrase in normalized
    )

    objection_count = len(objection_signals)

    if strong_score >= 1:
        return "Very high purchase intent"

    if moderate_score >= 2 and objection_count <= 2:
        return "High purchase intent"

    if moderate_score >= 1:
        return "Moderate purchase intent"

    if objection_count >= 2:
        return "Low purchase intent"

    if buying_signals:
        return "Potential purchase interest"

    return "Information seeking"


# ============================================================
# SENTIMENT
# ============================================================

def determine_sentiment(
    text,
    positive_signals,
    negative_signals,
    objection_signals
):

    normalized = normalize_text(text)

    positive_score = len(positive_signals)
    negative_score = len(negative_signals)

    positive_words = [
        "happy",
        "great",
        "excellent",
        "perfect",
        "love",
        "good",
        "excited",
        "thanks",
        "thank you"
    ]

    negative_words = [
        "angry",
        "frustrated",
        "bad",
        "terrible",
        "hate",
        "upset",
        "annoyed",
        "disappointed"
    ]

    positive_score += sum(
        1
        for word in positive_words
        if re.search(rf"\b{re.escape(word)}\b", normalized)
    )

    negative_score += sum(
        1
        for word in negative_words
        if re.search(rf"\b{re.escape(word)}\b", normalized)
    )

    if negative_score >= positive_score + 2:
        return "Negative"

    if positive_score >= negative_score + 2:
        return "Positive"

    if objection_signals and negative_score > 0:
        return "Negative"

    if positive_score > 0:
        return "Positive"

    if negative_score > 0:
        return "Negative"

    return "Neutral"


# ============================================================
# ENGAGEMENT
# ============================================================

def determine_engagement(turns, text):

    turn_count = len(turns)
    word_count = len(normalize_text(text).split())

    question_count = len(
        re.findall(r"\?", text)
    )

    if turn_count >= 8 or word_count >= 180 or question_count >= 4:
        return "High"

    if turn_count >= 5 or word_count >= 100 or question_count >= 2:
        return "Medium"

    return "Low"


# ============================================================
# OBJECTION HANDLING
# ============================================================

def analyze_objection_handling(
    turns,
    objection_signals
):

    if not objection_signals:
        return {
            "detected": False,
            "quality": "Not applicable",
            "reason": "No clear customer objections detected."
        }

    objection_words = [
        "expensive",
        "cost",
        "price",
        "time",
        "busy",
        "not sure",
        "think about",
        "cancel",
        "refund",
        "afford"
    ]

    handling_words = [
        "because",
        "however",
        "instead",
        "we offer",
        "you can",
        "flexible",
        "option",
        "benefit",
        "value",
        "save",
        "discount",
        "trial",
        "schedule"
    ]

    handled = False

    for index, turn in enumerate(turns):

        normalized_turn = normalize_text(turn)

        contains_objection = any(
            word in normalized_turn
            for word in objection_words
        )

        if not contains_objection:
            continue

        following_turns = turns[index + 1:index + 3]

        response_text = " ".join(
            following_turns
        )

        normalized_response = normalize_text(
            response_text
        )

        if any(
            word in normalized_response
            for word in handling_words
        ):
            handled = True
            break

    if handled:
        return {
            "detected": True,
            "quality": "Detected",
            "reason": "The salesperson appears to respond to at least one customer objection with value, explanation, flexibility, or supporting information."
        }

    return {
        "detected": False,
        "quality": "Not detected",
        "reason": "Customer objections were detected, but a clear objection-handling response was not identified."
    }


# ============================================================
# STRENGTHS
# ============================================================

def determine_strengths(
    buying_signals,
    positive_signals,
    engagement,
    objection_handling
):

    strengths = []

    if buying_signals:
        strengths.append(
            "The conversation contains identifiable buying signals."
        )

    if positive_signals:
        strengths.append(
            "The customer shows positive response signals."
        )

    if engagement == "High":
        strengths.append(
            "The customer demonstrates high engagement."
        )
    elif engagement == "Medium":
        strengths.append(
            "The customer demonstrates moderate engagement."
        )

    if objection_handling["detected"]:
        strengths.append(
            "The salesperson appears to address customer objections."
        )

    if not strengths:
        strengths.append(
            "The conversation contains usable customer interaction information."
        )

    return strengths


# ============================================================
# WEAKNESSES
# ============================================================

def determine_weaknesses(
    objection_signals,
    objection_handling,
    negative_signals,
    engagement
):

    weaknesses = []

    if objection_signals:
        weaknesses.append(
            "The customer expressed one or more objections."
        )

    if objection_signals and not objection_handling["detected"]:
        weaknesses.append(
            "Clear objection handling was not detected."
        )

    if negative_signals:
        weaknesses.append(
            "Negative customer response signals were detected."
        )

    if engagement == "Low":
        weaknesses.append(
            "Customer engagement appears low."
        )

    if not weaknesses:
        weaknesses.append(
            "No major weakness was identified using the current V1 rule set."
        )

    return weaknesses


# ============================================================
# FOLLOW-UP
# ============================================================

def determine_follow_up(
    intent,
    objection_signals,
    objection_handling,
    sentiment
):

    if objection_signals and not objection_handling["detected"]:
        return (
            "Follow up by addressing the customer's main objections "
            "with clear value, pricing, timing, or commitment information."
        )

    if intent in [
        "Very high purchase intent",
        "High purchase intent"
    ]:
        return (
            "Follow up promptly with a clear next step such as "
            "registration, payment, trial scheduling, or membership confirmation."
        )

    if sentiment == "Negative":
        return (
            "Follow up with a clarification or resolution focused on "
            "the customer's concerns before presenting another sales offer."
        )

    if intent == "Moderate purchase intent":
        return (
            "Follow up with relevant benefits, pricing information, "
            "and a simple next step to move the customer toward a decision."
        )

    return (
        "Follow up with relevant information and a clear next step "
        "based on the customer's questions."
    )


# ============================================================
# MAIN ANALYSIS
# ============================================================

def analyze_record(record):

    conversation = record.get("conversation", "")

    text = extract_text(conversation)
    turns = get_turns(conversation)

    buying_signals = find_signals(
        text,
        BUYING_PATTERNS
    )

    objection_signals = find_signals(
        text,
        OBJECTION_PATTERNS
    )

    positive_signals = find_signals(
        text,
        POSITIVE_PATTERNS
    )

    negative_signals = find_signals(
        text,
        NEGATIVE_PATTERNS
    )

    embedding = generate_embedding(text)

    intent = determine_customer_intent(
        text,
        buying_signals,
        objection_signals
    )

    sentiment = determine_sentiment(
        text,
        positive_signals,
        negative_signals,
        objection_signals
    )

    engagement = determine_engagement(
        turns,
        text
    )

    objection_handling = analyze_objection_handling(
        turns,
        objection_signals
    )

    strengths = determine_strengths(
        buying_signals,
        positive_signals,
        engagement,
        objection_handling
    )

    weaknesses = determine_weaknesses(
        objection_signals,
        objection_handling,
        negative_signals,
        engagement
    )

    follow_up = determine_follow_up(
        intent,
        objection_signals,
        objection_handling,
        sentiment
    )

    # IMPORTANT:
    # Dataset outcome is stored only as ground truth.
    # It is NOT used to produce the analysis above.

    return {
        "conversation_id": record.get("conversation_id"),

        "ground_truth": {
            "actual_sales_outcome": record.get("outcome")
        },

        "customer_analysis": {
            "intent": intent,
            "sentiment": sentiment
        },

        "buying_signals": buying_signals,

        "objections": objection_signals,

        "objection_handling": objection_handling,

        "positive_signals": positive_signals,

        "negative_signals": negative_signals,

        "conversation_metrics": {
            "number_of_turns": len(turns),
            "dataset_number_of_turns": record.get("number_of_turns"),
            "engagement_level": engagement
        },

        "conversation_assessment": {
            "strengths": strengths,
            "weaknesses": weaknesses
        },

        "follow_up_recommendation": follow_up,

        "minilm": {
            "embedding_dimension": len(embedding),
            "embedding": embedding
        },

        "conversation_text": text
    }


# ============================================================
# LOAD FIRST RECORD
# ============================================================

def load_first_record():

    with open(
        TRAINING_FILE,
        "r",
        encoding="utf-8"
    ) as file:

        first_line = file.readline()

        if not first_line.strip():
            raise ValueError(
                "Training dataset is empty."
            )

        return json.loads(first_line)


# ============================================================
# RUN
# ============================================================

record = load_first_record()

analysis = analyze_record(record)

conversation_id = analysis["conversation_id"]

output_file = (
    REPORTS_PATH
    / f"sales_engine_v1_1_{conversation_id}.json"
)

with open(
    output_file,
    "w",
    encoding="utf-8"
) as file:

    json.dump(
        analysis,
        file,
        indent=2,
        ensure_ascii=False
    )


# ============================================================
# DISPLAY RESULT
# ============================================================

print()
print("=" * 70)
print("SALES ANALYSIS ENGINE V1.1 RESULT")
print("=" * 70)

print()
print(f"Conversation ID: {conversation_id}")

print(
    "Actual Dataset Outcome: "
    f"{analysis['ground_truth']['actual_sales_outcome']}"
)

print(
    "Customer Intent: "
    f"{analysis['customer_analysis']['intent']}"
)

print(
    "Customer Sentiment: "
    f"{analysis['customer_analysis']['sentiment']}"
)

print(
    "Engagement: "
    f"{analysis['conversation_metrics']['engagement_level']}"
)

print()
print(
    "Buying Signals: "
    f"{len(analysis['buying_signals'])}"
)

print(
    "Objections: "
    f"{len(analysis['objections'])}"
)

print(
    "Positive Signals: "
    f"{len(analysis['positive_signals'])}"
)

print(
    "Negative Signals: "
    f"{len(analysis['negative_signals'])}"
)

print(
    "Objection Handling: "
    f"{analysis['objection_handling']['detected']}"
)

print()
print("Strengths:")

for item in analysis["conversation_assessment"]["strengths"]:
    print(f"- {item}")

print()
print("Weaknesses:")

for item in analysis["conversation_assessment"]["weaknesses"]:
    print(f"- {item}")

print()
print("Follow-up:")

print(
    analysis["follow_up_recommendation"]
)

print()
print(
    "MiniLM Embedding: "
    f"{analysis['minilm']['embedding_dimension']} dimensions"
)

print()
print(
    f"Report: {output_file}"
)

print()
print("=" * 70)
print("STATUS: PASS")
print("=" * 70)
