from pathlib import Path
import ast
import json
from collections import Counter, defaultdict

PROJECT_ROOT = Path(
    r"A:\5.Projects & Information\16.Intelligent Sales Data Analysis & Business Intelligence"
)

INPUT_FILE = (
    PROJECT_ROOT
    / "ISDABI Reports"
    / "ISDABI Sales Testing Evaluation V1.2.1.jsonl"
)

OUTPUT_JSONL = (
    PROJECT_ROOT
    / "ISDABI Reports"
    / "ISDABI Sales Testing Evaluation V1.2.1 Corrected.jsonl"
)

OUTPUT_SUMMARY = (
    PROJECT_ROOT
    / "ISDABI Reports"
    / "ISDABI Sales Testing Evaluation V1.2.1 Corrected Summary.json"
)


def parse_python_dict_string(value):
    if isinstance(value, dict):
        return value
    if isinstance(value, str):
        try:
            parsed = ast.literal_eval(value)
            return parsed if isinstance(parsed, dict) else {}
        except (ValueError, SyntaxError):
            return {}
    return {}


def clean_label(value, default="Unknown"):
    if value is None:
        return default
    if isinstance(value, str):
        value = value.strip()
        return value if value else default
    return str(value)


def normalize_record(record):
    ground_truth = record.get("ground_truth") or {}
    analysis = record.get("analysis") or {}

    outcome = clean_label(
        ground_truth.get("outcome", record.get("outcome")),
        "Unknown",
    )

    intent = clean_label(analysis.get("intent"), "Unknown")
    sentiment = clean_label(analysis.get("sentiment"), "Unknown")
    engagement = clean_label(analysis.get("engagement"), "Unknown")

    decision_raw = analysis.get("decision_point")
    decision_dict = parse_python_dict_string(decision_raw)
    decision_point = clean_label(
        decision_dict.get("type")
        or decision_dict.get("label")
        or decision_dict.get("decision")
        or decision_dict.get("decision_type"),
        "Unknown",
    )

    objection_raw = analysis.get("objection_handling")
    objection_dict = parse_python_dict_string(objection_raw)

    if objection_dict:
        objection_handling = clean_label(
            objection_dict.get("status")
            or objection_dict.get("handling_status")
            or objection_dict.get("handling")
            or objection_dict.get("result")
            or objection_dict.get("label"),
            "Unknown",
        )
    else:
        objection_handling = "No clear objection detected"

    buying_signals = analysis.get("buying_signals")
    if not isinstance(buying_signals, list):
        buying_signals = []

    objections = analysis.get("objections")
    if not isinstance(objections, list):
        objections = []

    buying_signal_count = analysis.get("buying_signal_count")
    if not isinstance(buying_signal_count, (int, float)):
        buying_signal_count = len(buying_signals)

    objection_count = analysis.get("objection_count")
    if not isinstance(objection_count, (int, float)):
        objection_count = len(objections)

    return {
        "conversation_id": record.get("conversation_id"),
        "actual_dataset_outcome": outcome,
        "intent": intent,
        "sentiment": sentiment,
        "engagement": engagement,
        "decision_point": decision_point,
        "objection_handling": objection_handling,
        "buying_signal_count": buying_signal_count,
        "objection_count": objection_count,
        "buying_signals": buying_signals,
        "objections": objections,
    }


def counter_to_dict(counter):
    return dict(sorted(counter.items(), key=lambda item: (-item[1], item[0])))


records = []

with INPUT_FILE.open("r", encoding="utf-8") as handle:
    for line_number, line in enumerate(handle, start=1):
        line = line.strip()
        if not line:
            continue

        try:
            record = json.loads(line)
            records.append(normalize_record(record))
        except Exception as exc:
            raise RuntimeError(
                f"Failed to process input line {line_number}: {exc}"
            ) from exc


overall = {
    "intent": Counter(),
    "sentiment": Counter(),
    "engagement": Counter(),
    "decision_point": Counter(),
    "objection_handling": Counter(),
}

by_outcome = defaultdict(
    lambda: {
        "count": 0,
        "intent": Counter(),
        "sentiment": Counter(),
        "engagement": Counter(),
        "decision_point": Counter(),
        "objection_handling": Counter(),
        "buying_signal_count_total": 0,
        "objection_count_total": 0,
    }
)

total_buying_signals = 0
total_objections = 0

for record in records:
    outcome = record["actual_dataset_outcome"]

    overall["intent"][record["intent"]] += 1
    overall["sentiment"][record["sentiment"]] += 1
    overall["engagement"][record["engagement"]] += 1
    overall["decision_point"][record["decision_point"]] += 1
    overall["objection_handling"][record["objection_handling"]] += 1

    total_buying_signals += record["buying_signal_count"]
    total_objections += record["objection_count"]

    group = by_outcome[outcome]
    group["count"] += 1
    group["intent"][record["intent"]] += 1
    group["sentiment"][record["sentiment"]] += 1
    group["engagement"][record["engagement"]] += 1
    group["decision_point"][record["decision_point"]] += 1
    group["objection_handling"][record["objection_handling"]] += 1
    group["buying_signal_count_total"] += record["buying_signal_count"]
    group["objection_count_total"] += record["objection_count"]


summary = {
    "version": "V1.2.1",
    "evaluation_type": "Corrected aggregation of existing testing evaluation JSONL",
    "input_file": str(INPUT_FILE),
    "output_jsonl": str(OUTPUT_JSONL),
    "output_summary": str(OUTPUT_SUMMARY),
    "conversations_analyzed": len(records),
    "actual_dataset_outcomes": counter_to_dict(
        Counter(record["actual_dataset_outcome"] for record in records)
    ),
    "overall": {
        "intent": counter_to_dict(overall["intent"]),
        "sentiment": counter_to_dict(overall["sentiment"]),
        "engagement": counter_to_dict(overall["engagement"]),
        "decision_point": counter_to_dict(overall["decision_point"]),
        "objection_handling": counter_to_dict(overall["objection_handling"]),
        "average_buying_signals": (
            total_buying_signals / len(records) if records else 0.0
        ),
        "average_objections": (
            total_objections / len(records) if records else 0.0
        ),
    },
    "by_actual_outcome": {},
}

for outcome, group in sorted(by_outcome.items()):
    count = group["count"]
    summary["by_actual_outcome"][outcome] = {
        "count": count,
        "intent": counter_to_dict(group["intent"]),
        "sentiment": counter_to_dict(group["sentiment"]),
        "engagement": counter_to_dict(group["engagement"]),
        "decision_point": counter_to_dict(group["decision_point"]),
        "objection_handling": counter_to_dict(group["objection_handling"]),
        "average_buying_signals": (
            group["buying_signal_count_total"] / count if count else 0.0
        ),
        "average_objections": (
            group["objection_count_total"] / count if count else 0.0
        ),
    }


with OUTPUT_JSONL.open("w", encoding="utf-8") as handle:
    for record in records:
        handle.write(json.dumps(record, ensure_ascii=False) + "\n")

with OUTPUT_SUMMARY.open("w", encoding="utf-8") as handle:
    json.dump(summary, handle, indent=2, ensure_ascii=False)


print("=" * 72)
print("ISDABI SALES TESTING EVALUATION V1.2.1")
print("FINAL CORRECTED AGGREGATOR")
print("=" * 72)
print()
print(f"Input: {INPUT_FILE}")
print(f"Records loaded: {len(records)}")
print()
print("=" * 72)
print("CORRECTED VALIDATION SUMMARY")
print("=" * 72)
print()
print(f"Conversations analyzed: {len(records)}")
print()
print("Actual Dataset Outcomes:")
for label, count in summary["actual_dataset_outcomes"].items():
    print(f"- {label}: {count}")

print()
print("Customer Intent:")
for label, count in summary["overall"]["intent"].items():
    print(f"- {label}: {count}")

print()
print("Customer Sentiment:")
for label, count in summary["overall"]["sentiment"].items():
    print(f"- {label}: {count}")

print()
print("Engagement:")
for label, count in summary["overall"]["engagement"].items():
    print(f"- {label}: {count}")

print()
print("Decision Points:")
for label, count in summary["overall"]["decision_point"].items():
    print(f"- {label}: {count}")

print()
print("Objection Handling:")
for label, count in summary["overall"]["objection_handling"].items():
    print(f"- {label}: {count}")

print()
print(f"Average buying signals: {summary['overall']['average_buying_signals']:.3f}")
print(f"Average objections: {summary['overall']['average_objections']:.3f}")

for outcome, group in summary["by_actual_outcome"].items():
    print()
    print("=" * 72)
    print(outcome)
    print("=" * 72)
    print(f"Conversations: {group['count']}")

    print()
    print("Intent:")
    for label, count in group["intent"].items():
        print(f"- {label}: {count}")

    print()
    print("Sentiment:")
    for label, count in group["sentiment"].items():
        print(f"- {label}: {count}")

    print()
    print("Engagement:")
    for label, count in group["engagement"].items():
        print(f"- {label}: {count}")

    print()
    print("Decision Point:")
    for label, count in group["decision_point"].items():
        print(f"- {label}: {count}")

    print()
    print("Objection Handling:")
    for label, count in group["objection_handling"].items():
        print(f"- {label}: {count}")

    print()
    print(f"Average buying signals: {group['average_buying_signals']:.3f}")
    print(f"Average objections: {group['average_objections']:.3f}")

print()
print("=" * 72)
print("OUTPUT FILES")
print("=" * 72)
print()
print(f"Corrected JSONL:")
print(OUTPUT_JSONL)
print()
print(f"Corrected Summary:")
print(OUTPUT_SUMMARY)
print()
print("=" * 72)
print("STATUS: COMPLETE")
print("=" * 72)
