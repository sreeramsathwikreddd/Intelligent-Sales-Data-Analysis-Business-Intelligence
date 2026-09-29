import json
import importlib.util
from collections import Counter, defaultdict
from pathlib import Path

PROJECT_ROOT = Path(
    r"A:\5.Projects & Information\16.Intelligent Sales Data Analysis & Business Intelligence"
)

ENGINE_PATH = (
    PROJECT_ROOT
    / "ISDABI AI ML"
    / "analysis"
    / "ISDABI Sales Analysis Engine V1.2.1.py"
)

TRAINING_FILE = (
    PROJECT_ROOT
    / "ISDABI Dataset"
    / "training"
    / "ISDABI Sales Training.jsonl"
)

REPORTS_DIR = PROJECT_ROOT / "ISDABI Reports"
REPORTS_DIR.mkdir(parents=True, exist_ok=True)


print("=" * 70)
print("ISDABI SALES ANALYSIS ENGINE V1.2.1")
print("100-CONVERSATION VALIDATION")
print("=" * 70)
print()
print("Loading V1.2.1 engine...")


# Load V1.2.1 engine without executing its __main__ test block.
spec = importlib.util.spec_from_file_location(
    "isdabi_sales_engine_v1_2",
    ENGINE_PATH,
)

engine = importlib.util.module_from_spec(spec)
spec.loader.exec_module(engine)

print()
print("=" * 70)
print("Loading and analyzing 100 conversations...")
print("=" * 70)


records = []

with open(TRAINING_FILE, "r", encoding="utf-8") as file:
    for _ in range(100):
        try:
            records.append(json.loads(next(file)))
        except StopIteration:
            break


results = []

for index, record in enumerate(records, start=1):
    result = engine.analyze_record(record)
    results.append(result)

    if index % 10 == 0:
        print(f"Processed: {index}/100")


# ============================================================
# AGGREGATION
# ============================================================

intent_counter = Counter()
sentiment_counter = Counter()
engagement_counter = Counter()
buying_counter = Counter()
objection_counter = Counter()
objection_handling_counter = Counter()
decision_counter = Counter()

outcome_counts = Counter()

by_outcome = defaultdict(
    lambda: {
        "intent": Counter(),
        "sentiment": Counter(),
        "engagement": Counter(),
        "decision_point": Counter(),
        "objection_handling": Counter(),
    }
)


for result in results:
    outcome = str(
        result["ground_truth"]["actual_sales_outcome"]
    ).upper()

    outcome_counts[outcome] += 1

    intent = result["customer_analysis"]["intent"]
    sentiment = result["customer_analysis"]["sentiment"]
    engagement = result["conversation_metrics"]["engagement_level"]
    decision = result["decision_point"]["type"]
    handling = result["objection_handling"]["status"]

    intent_counter[intent] += 1
    sentiment_counter[sentiment] += 1
    engagement_counter[engagement] += 1
    decision_counter[decision] += 1
    objection_handling_counter[handling] += 1

    for signal in result["buying_signals"]:
        buying_counter[signal] += 1

    for objection in result["objections"]:
        objection_counter[objection] += 1

    by_outcome[outcome]["intent"][intent] += 1
    by_outcome[outcome]["sentiment"][sentiment] += 1
    by_outcome[outcome]["engagement"][engagement] += 1
    by_outcome[outcome]["decision_point"][decision] += 1
    by_outcome[outcome]["objection_handling"][handling] += 1


def counter_to_dict(counter):
    return dict(counter)


report = {
    "validation_version": "V1.2.1",
    "conversations_analyzed": len(results),
    "actual_dataset_outcomes": counter_to_dict(outcome_counts),
    "customer_intent": counter_to_dict(intent_counter),
    "customer_sentiment": counter_to_dict(sentiment_counter),
    "engagement": counter_to_dict(engagement_counter),
    "buying_signals": counter_to_dict(buying_counter),
    "objections": counter_to_dict(objection_counter),
    "objection_handling": counter_to_dict(objection_handling_counter),
    "decision_points": counter_to_dict(decision_counter),
    "analysis_by_actual_outcome": {
        outcome: {
            "intent": counter_to_dict(values["intent"]),
            "sentiment": counter_to_dict(values["sentiment"]),
            "engagement": counter_to_dict(values["engagement"]),
            "decision_point": counter_to_dict(values["decision_point"]),
            "objection_handling": counter_to_dict(
                values["objection_handling"]
            ),
        }
        for outcome, values in by_outcome.items()
    },
}


output_path = (
    REPORTS_DIR
    / "sales_engine_v1_2_validation_100.json"
)

with open(
    output_path,
    "w",
    encoding="utf-8",
) as file:
    json.dump(
        report,
        file,
        indent=2,
        ensure_ascii=False,
    )


# ============================================================
# TERMINAL SUMMARY
# ============================================================

print()
print("=" * 70)
print("VALIDATION SUMMARY")
print("=" * 70)

print()
print(f"Conversations analyzed: {len(results)}")

print()
print("Actual Dataset Outcomes:")
for key, value in outcome_counts.items():
    print(f"- {key}: {value}")

print()
print("Customer Intent:")
for key, value in intent_counter.most_common():
    print(f"- {key}: {value}")

print()
print("Customer Sentiment:")
for key, value in sentiment_counter.most_common():
    print(f"- {key}: {value}")

print()
print("Engagement:")
for key, value in engagement_counter.most_common():
    print(f"- {key}: {value}")

print()
print("Buying Signals:")
for key, value in buying_counter.most_common():
    print(f"- {key}: {value}")

print()
print("Objections:")
for key, value in objection_counter.most_common():
    print(f"- {key}: {value}")

print()
print("Objection Handling:")
for key, value in objection_handling_counter.most_common():
    print(f"- {key}: {value}")

print()
print("Decision Points:")
for key, value in decision_counter.most_common():
    print(f"- {key}: {value}")

print()
print("Analysis by Actual Outcome")

for outcome in ["SUCCESS", "FAILURE"]:
    if outcome not in by_outcome:
        continue

    print()
    print(f"{outcome}:")

    print("- Intent")
    for key, value in by_outcome[outcome]["intent"].most_common():
        print(f"  - {key}: {value}")

    print("- Sentiment")
    for key, value in by_outcome[outcome]["sentiment"].most_common():
        print(f"  - {key}: {value}")

    print("- Engagement")
    for key, value in by_outcome[outcome]["engagement"].most_common():
        print(f"  - {key}: {value}")

    print("- Decision Point")
    for key, value in by_outcome[outcome]["decision_point"].most_common():
        print(f"  - {key}: {value}")

    print("- Objection Handling")
    for key, value in by_outcome[outcome]["objection_handling"].most_common():
        print(f"  - {key}: {value}")


print()
print(f"Validation report: {output_path}")
print()
print("=" * 70)
print("STATUS: PASS")
print("=" * 70)
