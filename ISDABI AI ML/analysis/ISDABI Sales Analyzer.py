import json
from pathlib import Path

import torch
from transformers import AutoTokenizer, AutoModel


PROJECT_ROOT = Path(
    r"A:\5.Projects & Information\16.Intelligent Sales Data Analysis & Business Intelligence"
)

MODEL_PATH = PROJECT_ROOT / "ISDABI Model" / "MiniLM"

TRAINING_FILE = (
    PROJECT_ROOT
    / "ISDABI Dataset"
    / "training"
    / "ISDABI Sales Training.jsonl"
)

REPORTS_PATH = PROJECT_ROOT / "ISDABI Reports"

REPORTS_PATH.mkdir(parents=True, exist_ok=True)


print("=" * 70)
print("ISDABI SALES ANALYZER")
print("=" * 70)

print(f"Project Root : {PROJECT_ROOT}")
print(f"MiniLM Path  : {MODEL_PATH}")
print(f"Training File: {TRAINING_FILE}")
print(f"Reports Path : {REPORTS_PATH}")


if not MODEL_PATH.exists():
    raise FileNotFoundError(
        f"MiniLM model not found: {MODEL_PATH}"
    )

if not TRAINING_FILE.exists():
    raise FileNotFoundError(
        f"Training dataset not found: {TRAINING_FILE}"
    )


print("\nLoading MiniLM...")

tokenizer = AutoTokenizer.from_pretrained(
    str(MODEL_PATH),
    local_files_only=True
)

model = AutoModel.from_pretrained(
    str(MODEL_PATH),
    local_files_only=True
)

model.eval()

device = torch.device(
    "cuda" if torch.cuda.is_available() else "cpu"
)

model.to(device)

print("MiniLM loaded successfully.")
print("Device:", device)
print("Hidden size:", model.config.hidden_size)
print(
    "Parameters:",
    sum(parameter.numel() for parameter in model.parameters())
)


def mean_pooling(model_output, attention_mask):
    token_embeddings = model_output.last_hidden_state

    input_mask_expanded = (
        attention_mask
        .unsqueeze(-1)
        .expand(token_embeddings.size())
        .float()
    )

    return torch.sum(
        token_embeddings * input_mask_expanded,
        dim=1
    ) / torch.clamp(
        input_mask_expanded.sum(dim=1),
        min=1e-9
    )


def generate_embedding(text):
    encoded_input = tokenizer(
        text,
        padding=True,
        truncation=True,
        max_length=512,
        return_tensors="pt"
    )

    encoded_input = {
        key: value.to(device)
        for key, value in encoded_input.items()
    }

    with torch.no_grad():
        model_output = model(**encoded_input)

    embedding = mean_pooling(
        model_output,
        encoded_input["attention_mask"]
    )

    embedding = torch.nn.functional.normalize(
        embedding,
        p=2,
        dim=1
    )

    return embedding[0].cpu().tolist()


def extract_text(conversation):
    if isinstance(conversation, str):
        return conversation

    if not isinstance(conversation, list):
        return ""

    parts = []

    for turn in conversation:

        if isinstance(turn, dict):

            speaker = turn.get("speaker", "")
            text = turn.get("text", "")

            if text:
                parts.append(
                    f"{speaker}: {text}"
                )

        elif isinstance(turn, str):

            parts.append(turn)

    return "\n".join(parts)


def detect_keywords(text, keywords):
    text_lower = text.lower()

    return [
        keyword
        for keyword in keywords
        if keyword.lower() in text_lower
    ]


def analyze_sales_conversation(record):

    conversation_text = extract_text(
        record.get("conversation", "")
    )

    if not conversation_text.strip():
        raise ValueError(
            "Conversation text is empty."
        )


    buying_signals = detect_keywords(
        conversation_text,
        [
            "sign up",
            "signup",
            "join",
            "membership",
            "register",
            "start",
            "interested",
            "sounds good",
            "let's do it",
            "i'll take",
            "how much",
            "price",
            "trial"
        ]
    )


    objection_signals = detect_keywords(
        conversation_text,
        [
            "expensive",
            "too expensive",
            "cost",
            "price",
            "busy",
            "time",
            "commitment",
            "not sure",
            "think about it",
            "maybe",
            "cancel",
            "refund",
            "money",
            "afford"
        ]
    )


    positive_signals = detect_keywords(
        conversation_text,
        [
            "great",
            "good",
            "perfect",
            "interested",
            "sounds good",
            "thank you",
            "love",
            "happy",
            "yes"
        ]
    )


    negative_signals = detect_keywords(
        conversation_text,
        [
            "angry",
            "bad",
            "terrible",
            "expensive",
            "frustrated",
            "disappointed",
            "hate",
            "no",
            "problem",
            "issue"
        ]
    )


    outcome = record.get("outcome")

    if outcome == "SUCCESS":
        outcome_label = "Successful"

    elif outcome == "FAILURE":
        outcome_label = "Unsuccessful"

    else:
        outcome_label = "Unknown"


    embedding = generate_embedding(
        conversation_text
    )


    analysis = {
        "conversation_id": record.get(
            "conversation_id"
        ),
        "outcome": outcome_label,
        "persona": record.get("persona"),
        "mood": record.get("mood"),
        "gym": record.get("gym"),
        "price": record.get("price"),
        "number_of_turns": record.get(
            "number_of_turns"
        ),
        "buying_signals": buying_signals,
        "objection_signals": objection_signals,
        "positive_signals": positive_signals,
        "negative_signals": negative_signals,
        "minilm_embedding_dimension": len(
            embedding
        ),
        "minilm_embedding": embedding,
        "conversation_text": conversation_text
    }


    output_file = (
        REPORTS_PATH
        / f"sales_analysis_{record.get('conversation_id')}.json"
    )


    with open(
        output_file,
        "w",
        encoding="utf-8"
    ) as file:

        json.dump(
            analysis,
            file,
            indent=4,
            ensure_ascii=False
        )


    return analysis, output_file


def load_first_training_record():

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


if __name__ == "__main__":

    record = load_first_training_record()

    analysis, output_file = (
        analyze_sales_conversation(record)
    )


    print("\nAnalysis completed successfully.")

    print(
        "Conversation ID:",
        analysis["conversation_id"]
    )

    print(
        "Outcome:",
        analysis["outcome"]
    )

    print(
        "Persona:",
        analysis["persona"]
    )

    print(
        "Mood:",
        analysis["mood"]
    )

    print(
        "MiniLM embedding dimension:",
        analysis["minilm_embedding_dimension"]
    )

    print(
        "Report saved to:",
        output_file
    )


    print("\nBuying Signals:")
    print(
        analysis["buying_signals"]
    )


    print("\nObjection Signals:")
    print(
        analysis["objection_signals"]
    )


    print("\nPositive Signals:")
    print(
        analysis["positive_signals"]
    )


    print("\nNegative Signals:")
    print(
        analysis["negative_signals"]
    )


    print("\n" + "=" * 70)
    print("STATUS: PASS")
    print("=" * 70)
