import json
from pathlib import Path
from collections import Counter

PROJECT_ROOT = Path(
    r"A:\5.Projects & Information\16.Intelligent Sales Data Analysis & Business Intelligence"
)

ENGINE_PATH = (
    PROJECT_ROOT
    / "ISDABI AI ML"
    / "analysis"
    / "ISDABI Sales Analysis Engine.py"
)

TRAINING_FILE = (
    PROJECT_ROOT
    / "ISDABI Dataset"
    / "training"
    / "ISDABI Sales Training.jsonl"
)

REPORTS_PATH = PROJECT_ROOT / "ISDABI Reports"

VALIDATION_OUTPUT = (
    REPORTS_PATH / "sales_engine_v1_1_validation_100.json"
)


# ============================================================
# LOAD ENGINE FUNCTIONS
# ============================================================

engine_source = ENGINE_PATH.read_text(
    encoding="utf-8-sig"
)

marker = (
    "# ============================================================\n"
    "# LOAD FIRST RECORD"
)

if marker not in engine_source:
    raise RuntimeError(
        "Could not locate the execution section in the Sales Analysis Engine."
    )

engine_definition = engine_source.split(marker)[0]

namespace = {
    "__name__": "isdabi_sales_engine_v1_1"
}

exec(
    compile(
        engine_definition,
        str(ENGINE_PATH),
        "exec"
    ),
    namespace
)

analyze_record = namespace["analyze_record"]


# ============================================================
# LOAD FIRST 100 RECORDS
# ============================================================

records = []

with open(
    TRAINING_FILE,
    "r",
    encoding="utf-8"
) as file:

    for line in file:

        if len(records) >= 100:
            break

        if not line.strip():
            continue

        records.append(json.loads(line))


if len(records) != 100:
    raise RuntimeError(
        f"Expected 100 records but loaded {len(records)}."
    )


# ============================================================
# VALIDATION
# ============================================================

results = []

intent_counter = Counter()
sentiment_counter = Counter()
engagement_counter = Counter()
outcome_counter = Counter()

buying_signal_counter = Counter()
objection_counter = Counter()

objection_handled_count = 0

success_intents = Counter()
failure_intents = Counter()

success_sentiments = Counter()
failure_sentiments = Counter()

success_engagement = Counter()
failure_engagement = Counter()


print()
print("=" * 70)
print("ISDABI SALES ANALYSIS ENGINE V1.1")
print("100-CONVERSATION VALIDATION")
print("=" * 70)

print()
print("Loading and analyzing 100 conversations...")
print()


for index, record in enumerate(records, start=1):

    analysis = analyze_record(record)

    results.append(analysis)

    intent = analysis["customer_analysis"]["intent"]
    sentiment = analysis["customer_analysis"]["sentiment"]
    engagement = analysis["conversation_metrics"]["engagement_level"]

    outcome = analysis["ground_truth"]["actual_sales_outcome"]

    intent_counter[intent] += 1
    sentiment_counter[sentiment] += 1
    engagement_counter[engagement] += 1
    outcome_counter[outcome] += 1

    for signal in analysis["buying_signals"]:
        buying_signal_counter[signal["type"]] += 1

    for objection in analysis["objections"]:
        objection_counter[objection["type"]] += 1

    if analysis["objection_handling"]["detected"]:
        objection_handled_count += 1

    if outcome == "SUCCESS":

        success_intents[intent] += 1
        success_sentiments[sentiment] += 1
        success_engagement[engagement] += 1

    elif outcome == "FAILURE":

        failure_intents[intent] += 1
        failure_sentiments[sentiment] += 1
        failure_engagement[engagement] += 1

    if index % 10 == 0:
        print(f"Processed: {index}/100")


# ============================================================
# BUILD VALIDATION REPORT
# ============================================================

validation_report = {

    "validation_type":
        "V1.1 transcript-only validation",

    "number_of_conversations":
        100,

    "dataset_outcomes":
        dict(outcome_counter),

    "customer_intent_distribution":
        dict(intent_counter),

    "customer_sentiment_distribution":
        dict(sentiment_counter),

    "engagement_distribution":
        dict(engagement_counter),

    "buying_signal_distribution":
        dict(buying_signal_counter),

    "objection_distribution":
        dict(objection_counter),

    "objection_handling": {
        "handled": objection_handled_count,
        "not_handled": 100 - objection_handled_count
    },

    "analysis_by_actual_outcome": {

        "SUCCESS": {
            "intent": dict(success_intents),
            "sentiment": dict(success_sentiments),
            "engagement": dict(success_engagement)
        },

        "FAILURE": {
            "intent": dict(failure_intents),
            "sentiment": dict(failure_sentiments),
            "engagement": dict(failure_engagement)
        }
    },

    "conversations": results
}


# ============================================================
# SAVE REPORT
# ============================================================

REPORTS_PATH.mkdir(
    parents=True,
    exist_ok=True
)

with open(
    VALIDATION_OUTPUT,
    "w",
    encoding="utf-8"
) as file:

    json.dump(
        validation_report,
        file,
        indent=2,
        ensure_ascii=False
    )


# ============================================================
# DISPLAY SUMMARY
# ============================================================

print()
print("=" * 70)
print("VALIDATION SUMMARY")
print("=" * 70)

print()
print(f"Conversations analyzed: {len(results)}")


print()
print("Actual Dataset Outcomes:")

for key, value in outcome_counter.items():
    print(f"- {key}: {value}")


print()
print("Customer Intent:")

for key, value in intent_counter.items():
    print(f"- {key}: {value}")


print()
print("Customer Sentiment:")

for key, value in sentiment_counter.items():
    print(f"- {key}: {value}")


print()
print("Engagement:")

for key, value in engagement_counter.items():
    print(f"- {key}: {value}")


print()
print("Buying Signals:")

if buying_signal_counter:

    for key, value in buying_signal_counter.items():
        print(f"- {key}: {value}")

else:
    print("- None detected")


print()
print("Objections:")

if objection_counter:

    for key, value in objection_counter.items():
        print(f"- {key}: {value}")

else:
    print("- None detected")


print()
print("Objection Handling:")

print(
    f"- Handled: {objection_handled_count}"
)

print(
    f"- Not handled: {100 - objection_handled_count}"
)


print()
print("Analysis by Actual Outcome")


print()
print("SUCCESS:")

for key, value in success_intents.items():
    print(f"- Intent / {key}: {value}")

for key, value in success_sentiments.items():
    print(f"- Sentiment / {key}: {value}")

for key, value in success_engagement.items():
    print(f"- Engagement / {key}: {value}")


print()
print("FAILURE:")

for key, value in failure_intents.items():
    print(f"- Intent / {key}: {value}")

for key, value in failure_sentiments.items():
    print(f"- Sentiment / {key}: {value}")

for key, value in failure_engagement.items():
    print(f"- Engagement / {key}: {value}")


print()
print(
    f"Validation report: {VALIDATION_OUTPUT}"
)

print()
print("=" * 70)
print("STATUS: PASS")
print("=" * 70)
