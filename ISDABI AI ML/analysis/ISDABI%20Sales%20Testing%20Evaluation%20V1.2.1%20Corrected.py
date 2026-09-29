import json
from collections import Counter, defaultdict

PROJECT_ROOT = Path(
    r"A:\5.Projects & Information\16.Intelligent Sales Data Analysis & Business Intelligence"
)

REPORTS_DIR = PROJECT_ROOT / "ISDABI Reports"

INPUT_FILE = REPORTS_DIR / "ISDABI Sales Testing Evaluation V1.2.1.jsonl"
OUTPUT_FILE = REPORTS_DIR / "ISDABI Sales Testing Evaluation V1.2.1 Corrected.jsonl"
SUMMARY_FILE = REPORTS_DIR / "ISDABI Sales Testing Evaluation V1.2.1 Corrected Summary.json"


def first_existing_value(value, keys):
    if isinstance(value, dict):
        for key in keys:
            if key in value and value[key] not in (None, ""):
                return value[key]
    return None


def normalize_decision_point(value):
    """
    Converts the engine's decision_point structure into one clean label.
    Handles both:
      {"type": "Hesitation", ...}
    and plain strings.
    """
    if isinstance(value, str):
        return value

    if isinstance(value, dict):
        label = first_existing_value(
            value,
            ["type", "label", "decision", "decision_type", "status"]
        )
        if label:
            return str(label)

    return "Unknown"


def normalize_objection_handling(value):
    """
    Converts the engine's objection_handling structure into one clean status.
    Handles V1.2.1 structures such as:
      {"status": "Handled", ...}
    or:
      {"handling_status": "Handled", ...}
    """
    if isinstance(value, str):
        return value

    if isinstance(value, dict):
        label = first_existing_value(
            value,
            [
                "status",
                "handling_status",
                "handling",
                "result",
                "label"
            ]
        )
        if label:
            return str(label)

        # Fallback based on the actual objection lists.
        handled = value.get("handled_objections", [])
        unhandled = value.get("unhandled_objections", [])

        if handled and not unhandled:
            return "Handled"

        if handled and unhandled:
            return "Partially handled"

        if unhandled and not handled:
            return "Not handled"

        return "No clear objection detected"

    return "Unknown"


def normalize_outcome(value):
    if value is None:
        return "UNKNOWN"

    text = str(value).strip().upper()

    if text == "SUCCESS":
        return "SUCCESS"

    if text == "FAILURE":
        return "FAILURE"

    return text


def safe_len(value):
    return len(value) if isinstance(value, list) else 0


def load_records():
    if not INPUT_FILE.exists():
        raise FileNotFoundError(
            f"Input evaluation file was not found:\n{INPUT_FILE}"
        )

    records = []

    with INPUT_FILE.open("r", encoding="utf-8") as file:
        for line_number, line in enumerate(file, start=1):
            line = line.strip()

            if not line:
                continue

            try:
                records.append(json.loads(line))
            except json.JSONDecodeError as exc:
                raise ValueError(
                    f"Invalid JSON on line {line_number}: {exc}"
                ) from exc

    return records


def extract_engine_fields(record):
    customer_analysis = record.get("customer_analysis", {})
    conversation_metrics = record.get("conversation_metrics", {})
    objection_handling = record.get("objection_handling", {})

    outcome = normalize_outcome(
        record.get("actual_dataset_outcome")
        or record.get("ground_truth", {}).get("outcome")
        or record.get("outcome")
    )

    intent = first_existing_value(
        customer_analysis,
        ["intent"]
    ) or "Unknown"

    sentiment = first_existing_value(
        customer_analysis,
        ["sentiment"]
    ) or "Unknown"

    engagement = first_existing_value(
        conversation_metrics,
        ["engagement_level", "engagement"]
    ) or "Unknown"

    decision_point = normalize_decision_point(
        record.get("decision_point", "Unknown")
    )

    objection_status = normalize_objection_handling(
        objection_handling
    )

    buying_signals = record.get("buying_signals", [])
    objections = record.get("objections", [])

    return {
        "conversation_id": record.get("conversation_id"),
        "outcome": outcome,
        "intent": str(intent),
        "sentiment": str(sentiment),
        "engagement": str(engagement),
        "decision_point": decision_point,
        "objection_handling": objection_status,
        "buying_signal_count": safe_len(buying_signals),
        "objection_count": safe_len(objections),
    }


def build_summary(records):
    total = len(records)

    outcomes = Counter()
    intents = Counter()
    sentiments = Counter()
    engagements = Counter()
    decision_points = Counter()
    objection_handling = Counter()

    by_outcome = defaultdict(
        lambda: {
            "intent": Counter(),
            "sentiment": Counter(),
            "engagement": Counter(),
            "decision_point": Counter(),
            "objection_handling": Counter(),
        }
    )

    total_buying_signals = 0
    total_objections = 0

    normalized_records = []

    for record in records:
        item = extract_engine_fields(record)
        normalized_records.append(item)

        outcome = item["outcome"]

        outcomes[outcome] += 1
        intents[item["intent"]] += 1
        sentiments[item["sentiment"]] += 1
        engagements[item["engagement"]] += 1
        decision_points[item["decision_point"]] += 1
        objection_handling[item["objection_handling"]] += 1

        by_outcome[outcome]["intent"][item["intent"]] += 1
        by_outcome[outcome]["sentiment"][item["sentiment"]] += 1
        by_outcome[outcome]["engagement"][item["engagement"]] += 1
        by_outcome[outcome]["decision_point"][item["decision_point"]] += 1
        by_outcome[outcome]["objection_handling"][
            item["objection_handling"]
        ] += 1

        total_buying_signals += item["buying_signal_count"]
        total_objections += item["objection_count"]

    summary = {
        "evaluation_version": "V1.2.1 corrected",
        "total_conversations": total,
        "actual_dataset_outcomes": dict(outcomes),
        "customer_intent": dict(intents),
        "customer_sentiment": dict(sentiments),
        "engagement": dict(engagements),
        "decision_points": dict(decision_points),
        "objection_handling": dict(objection_handling),
        "average_buying_signals": (
            total_buying_signals / total if total else 0
        ),
        "average_objections": (
            total_objections / total if total else 0
        ),
        "analysis_by_actual_outcome": {},
    }

    for outcome, groups in by_outcome.items():
        summary["analysis_by_actual_outcome"][outcome] = {
            "intent": dict(groups["intent"]),
            "sentiment": dict(groups["sentiment"]),
            "engagement": dict(groups["engagement"]),
            "decision_point": dict(groups["decision_point"]),
            "objection_handling": dict(groups["objection_handling"]),
        }

    return normalized_records, summary


def save_corrected_records(records):
    with OUTPUT_FILE.open("w", encoding="utf-8") as file:
        for record in records:
            file.write(
                json.dumps(
                    record,
                    ensure_ascii=False
                ) + "\n"
            )


def save_summary(summary):
    with SUMMARY_FILE.open("w", encoding="utf-8") as file:
        json.dump(
            summary,
            file,
            ensure_ascii=False,
            indent=2
        )


def print_counter(title, counter):
    print()
    print(title)

    if not counter:
        print("- None")
        return

    for key, value in counter.items():
        print(f"- {key}: {value}")


def print_group(title, group):
    print()
    print(title)

    print_counter("Intent:", group["intent"])
    print_counter("Sentiment:", group["sentiment"])
    print_counter("Engagement:", group["engagement"])
    print_counter("Decision Point:", group["decision_point"])
    print_counter("Objection Handling:", group["objection_handling"])


def main():
    print("=" * 72)
    print("ISDABI SALES TESTING EVALUATION V1.2.1")
    print("CORRECTED EVALUATION AGGREGATOR")
    print("=" * 72)

    print()
    print(f"Input: {INPUT_FILE}")

    records = load_records()

    print(f"Records loaded: {len(records)}")

    normalized_records, summary = build_summary(records)

    # Preserve the original per-conversation evaluation results while
    # adding a clean normalized representation for reliable aggregation.
    save_corrected_records(normalized_records)
    save_summary(summary)

    print()
    print("=" * 72)
    print("CORRECTED VALIDATION SUMMARY")
    print("=" * 72)

    print()
    print(f"Conversations analyzed: {summary['total_conversations']}")

    print_counter(
        "Actual Dataset Outcomes:",
        summary["actual_dataset_outcomes"]
    )

    print_counter(
        "Customer Intent:",
        summary["customer_intent"]
    )

    print_counter(
        "Customer Sentiment:",
        summary["customer_sentiment"]
    )

    print_counter(
        "Engagement:",
        summary["engagement"]
    )

    print_counter(
        "Decision Points:",
        summary["decision_points"]
    )

    print_counter(
        "Objection Handling:",
        summary["objection_handling"]
    )

    print()
    print(
        "Average buying signals: "
        f"{summary['average_buying_signals']:.3f}"
    )

    print(
        "Average objections: "
        f"{summary['average_objections']:.3f}"
    )

    if "SUCCESS" in summary["analysis_by_actual_outcome"]:
        print_group(
            "SUCCESS",
            summary["analysis_by_actual_outcome"]["SUCCESS"]
        )

    if "FAILURE" in summary["analysis_by_actual_outcome"]:
        print_group(
            "FAILURE",
            summary["analysis_by_actual_outcome"]["FAILURE"]
        )

    print()
    print("=" * 72)
    print("OUTPUT FILES")
    print("=" * 72)

    print()
    print(f"Corrected JSONL:")
    print(OUTPUT_FILE)

    print()
    print(f"Corrected Summary:")
    print(SUMMARY_FILE)

    print()
    print("=" * 72)
    print("STATUS: COMPLETE")
    print("=" * 72)


if __name__ == "__main__":
    main()
