import json
import importlib.util
import time
from pathlib import Path
from collections import Counter

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
OUTPUT_FILE = REPORTS_DIR / "ISDABI Sales Training Analysis V1.2.1.jsonl"
SUMMARY_FILE = REPORTS_DIR / "ISDABI Sales Training Analysis V1.2.1 Summary.json"

REPORTS_DIR.mkdir(parents=True, exist_ok=True)


# ============================================================
# LOAD V1.2.1 ENGINE
# ============================================================

print("=" * 72)
print("ISDABI FULL TRAINING ANALYSIS V1.2.1")
print("=" * 72)
print()
print("Loading V1.2.1 engine...")

spec = importlib.util.spec_from_file_location(
    "isdabi_sales_engine_v1_2_1",
    ENGINE_PATH,
)

engine = importlib.util.module_from_spec(spec)
spec.loader.exec_module(engine)

print()
print("V1.2.1 engine loaded successfully.")
print(f"Training file: {TRAINING_FILE}")
print(f"Output file:   {OUTPUT_FILE}")
print()


# ============================================================
# RESUME SUPPORT
# ============================================================

completed_ids = set()

if OUTPUT_FILE.exists():
    print("Existing output detected.")
    print("Checking completed conversations for resume support...")

    with open(OUTPUT_FILE, "r", encoding="utf-8") as existing:
        for line in existing:
            line = line.strip()

            if not line:
                continue

            try:
                item = json.loads(line)
                conversation_id = item.get("conversation_id")

                if conversation_id is not None:
                    completed_ids.add(conversation_id)

            except json.JSONDecodeError:
                # Ignore an incomplete/corrupt final line.
                # Valid completed lines remain usable.
                continue

    print(f"Already completed: {len(completed_ids)}")
else:
    print("No previous output found.")
    print("Starting from conversation 1.")

print()


# ============================================================
# ANALYSIS
# ============================================================

start_time = time.time()

processed_this_run = 0
skipped = 0
errors = 0

intent_counts = Counter()
sentiment_counts = Counter()
engagement_counts = Counter()
decision_counts = Counter()
outcome_counts = Counter()

total_records = 0

# Count source records first.
with open(TRAINING_FILE, "r", encoding="utf-8") as source:
    for line in source:
        if line.strip():
            total_records += 1

print(f"Total training conversations: {total_records}")
print(f"Remaining to analyze: {total_records - len(completed_ids)}")
print()

# Append mode allows safe resume.
with open(OUTPUT_FILE, "a", encoding="utf-8") as output:

    with open(TRAINING_FILE, "r", encoding="utf-8") as source:

        for record_number, line in enumerate(source, start=1):

            if not line.strip():
                continue

            record = json.loads(line)
            conversation_id = record.get("conversation_id")

            if conversation_id in completed_ids:
                skipped += 1
                continue

            try:
                result = engine.analyze_record(record)

                # Write one complete JSON object per line.
                output.write(
                    json.dumps(
                        result,
                        ensure_ascii=False,
                    )
                    + "\n"
                )

                # Make every completed result durable.
                output.flush()

                completed_ids.add(conversation_id)
                processed_this_run += 1

                intent_counts[
                    result["customer_analysis"]["intent"]
                ] += 1

                sentiment_counts[
                    result["customer_analysis"]["sentiment"]
                ] += 1

                engagement_counts[
                    result["conversation_metrics"]["engagement_level"]
                ] += 1

                decision_counts[
                    result["decision_point"]["type"]
                ] += 1

                outcome_counts[
                    str(
                        result["ground_truth"][
                            "actual_sales_outcome"
                        ]
                    ).upper()
                ] += 1

                completed_total = len(completed_ids)

                if (
                    processed_this_run == 1
                    or processed_this_run % 25 == 0
                    or completed_total == total_records
                ):
                    elapsed = time.time() - start_time
                    rate = (
                        processed_this_run / elapsed
                        if elapsed > 0
                        else 0
                    )

                    remaining = total_records - completed_total

                    print(
                        f"Progress: {completed_total}/{total_records} "
                        f"| Remaining: {remaining} "
                        f"| This run: {processed_this_run} "
                        f"| Rate: {rate:.2f} conv/s"
                    )

            except Exception as error:
                errors += 1

                print()
                print(
                    f"ERROR at source record "
                    f"{record_number}, conversation "
                    f"{conversation_id}: {error}"
                )
                print(
                    "Continuing with the next conversation..."
                )
                print()


# ============================================================
# FINAL SUMMARY
# ============================================================

elapsed_total = time.time() - start_time

summary = {
    "analysis_version": "V1.2.1",
    "total_training_records": total_records,
    "completed_conversations": len(completed_ids),
    "processed_this_run": processed_this_run,
    "skipped_existing": skipped,
    "errors_this_run": errors,
    "remaining_conversations": total_records - len(completed_ids),
    "elapsed_seconds_this_run": round(elapsed_total, 2),
    "output_file": str(OUTPUT_FILE),
    "analysis_policy": {
        "speaker_roles": "Uses explicit sales/customer roles.",
        "outcome_leakage": "SUCCESS/FAILURE is retained only as ground truth.",
        "decision_turn_index": "Not used as an inference input.",
        "persona_mood_demographic": "Not used as transcript inference inputs.",
        "model": "Local MiniLM-L12-H384-uncased",
        "embedding_dimension": 384,
    },
    "outcome_counts_this_run": dict(outcome_counts),
    "intent_counts_this_run": dict(intent_counts),
    "sentiment_counts_this_run": dict(sentiment_counts),
    "engagement_counts_this_run": dict(engagement_counts),
    "decision_point_counts_this_run": dict(decision_counts),
}

with open(
    SUMMARY_FILE,
    "w",
    encoding="utf-8",
) as file:
    json.dump(
        summary,
        file,
        indent=2,
        ensure_ascii=False,
    )


print()
print("=" * 72)
print("FULL TRAINING ANALYSIS SUMMARY")
print("=" * 72)
print()
print(f"Total training records: {total_records}")
print(f"Completed:              {len(completed_ids)}")
print(f"Processed this run:     {processed_this_run}")
print(f"Skipped existing:       {skipped}")
print(f"Errors this run:        {errors}")
print(f"Remaining:              {total_records - len(completed_ids)}")
print()
print(f"Analysis output:")
print(OUTPUT_FILE)
print()
print(f"Summary output:")
print(SUMMARY_FILE)
print()

if len(completed_ids) == total_records and errors == 0:
    print("STATUS: COMPLETE")
elif len(completed_ids) < total_records:
    print("STATUS: PARTIAL / RESUMABLE")
else:
    print("STATUS: COMPLETE WITH ERRORS")
