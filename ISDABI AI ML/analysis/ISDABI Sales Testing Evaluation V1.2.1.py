import json
import importlib.util
import sys
import time
from collections import Counter, defaultdict
from pathlib import Path

BASE_DIR = Path(r"A:\5.Projects & Information\16.Intelligent Sales Data Analysis & Business Intelligence")
ENGINE_PATH = BASE_DIR / "ISDABI AI ML" / "analysis" / "ISDABI Sales Analysis Engine V1.2.1.py"
TESTING_FILE = BASE_DIR / "ISDABI Dataset" / "testing" / "ISDABI Sales Testing.jsonl"
REPORTS_DIR = BASE_DIR / "ISDABI Reports"
OUTPUT_FILE = REPORTS_DIR / "ISDABI Sales Testing Evaluation V1.2.1.jsonl"
SUMMARY_FILE = REPORTS_DIR / "ISDABI Sales Testing Evaluation V1.2.1 Summary.json"

def load_engine():
    print("Loading V1.2.1 engine...")
    spec = importlib.util.spec_from_file_location("isdabi_sales_engine_v121_testing", ENGINE_PATH)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"Could not load engine from: {ENGINE_PATH}")
    module = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)
    print("V1.2.1 engine loaded successfully.")
    return module

def load_testing_records():
    records = []
    with TESTING_FILE.open("r", encoding="utf-8") as f:
        for line_number, line in enumerate(f, start=1):
            line = line.strip()
            if not line:
                continue
            try:
                records.append(json.loads(line))
            except json.JSONDecodeError as exc:
                raise ValueError(f"Invalid JSON on testing file line {line_number}: {exc}")
    return records

def normalize_outcome(value):
    if value is None:
        return "UNKNOWN"
    value = str(value).strip().upper()
    return value

def extract_prediction_fields(result):
    customer = result.get("customer_analysis", {})
    assessment = result.get("assessment", {})
    if not isinstance(customer, dict):
        customer = {}
    if not isinstance(assessment, dict):
        assessment = {}

    intent = customer.get("intent", result.get("customer_intent", "UNKNOWN"))
    sentiment = customer.get("sentiment", result.get("customer_sentiment", "UNKNOWN"))
    engagement = customer.get("engagement", result.get("engagement", "UNKNOWN"))
    objection_handling = assessment.get("objection_handling", result.get("objection_handling", "UNKNOWN"))
    decision_point = assessment.get("decision_point", result.get("decision_point", "UNKNOWN"))

    buying_signals = result.get("buying_signals", [])
    objections = result.get("objections", [])
    if not isinstance(buying_signals, list):
        buying_signals = []
    if not isinstance(objections, list):
        objections = []

    return {
        "intent": str(intent) if intent is not None else "UNKNOWN",
        "sentiment": str(sentiment) if sentiment is not None else "UNKNOWN",
        "engagement": str(engagement) if engagement is not None else "UNKNOWN",
        "buying_signal_count": len(buying_signals),
        "objection_count": len(objections),
        "objection_handling": str(objection_handling) if objection_handling is not None else "UNKNOWN",
        "decision_point": str(decision_point) if decision_point is not None else "UNKNOWN",
        "buying_signals": buying_signals,
        "objections": objections,
    }

def counter_dict(counter):
    return dict(sorted(counter.items(), key=lambda x: (-x[1], x[0])))

def build_summary(results, errors, elapsed_seconds):
    outcome_counts = Counter()
    by_outcome = defaultdict(lambda: {
        "intent": Counter(), "sentiment": Counter(), "engagement": Counter(),
        "objection_handling": Counter(), "decision_point": Counter(),
        "buying_signal_counts": [], "objection_counts": []
    })
    buying_signals_total = Counter()
    objections_total = Counter()

    for item in results:
        outcome = normalize_outcome(item["ground_truth"]["outcome"])
        a = item["analysis"]
        outcome_counts[outcome] += 1
        by_outcome[outcome]["intent"][a["intent"]] += 1
        by_outcome[outcome]["sentiment"][a["sentiment"]] += 1
        by_outcome[outcome]["engagement"][a["engagement"]] += 1
        by_outcome[outcome]["objection_handling"][a["objection_handling"]] += 1
        by_outcome[outcome]["decision_point"][a["decision_point"]] += 1
        by_outcome[outcome]["buying_signal_counts"].append(a["buying_signal_count"])
        by_outcome[outcome]["objection_counts"].append(a["objection_count"])

        for x in a["buying_signals"]:
            name = x.get("type") or x.get("name") if isinstance(x, dict) else str(x)
            buying_signals_total[str(name)] += 1
        for x in a["objections"]:
            name = x.get("type") or x.get("name") if isinstance(x, dict) else str(x)
            objections_total[str(name)] += 1

    def avg(values):
        return round(sum(values) / len(values), 3) if values else 0.0

    analysis_by_outcome = {}
    for outcome, d in by_outcome.items():
        analysis_by_outcome[outcome] = {
            "records": outcome_counts[outcome],
            "intent": counter_dict(d["intent"]),
            "sentiment": counter_dict(d["sentiment"]),
            "engagement": counter_dict(d["engagement"]),
            "objection_handling": counter_dict(d["objection_handling"]),
            "decision_point": counter_dict(d["decision_point"]),
            "average_buying_signal_count": avg(d["buying_signal_counts"]),
            "average_objection_count": avg(d["objection_counts"]),
        }

    return {
        "evaluation_version": "V1.2.1",
        "dataset": "ISDABI Sales Testing",
        "testing_file": str(TESTING_FILE),
        "total_testing_records": len(results) + len(errors),
        "completed": len(results),
        "errors": len(errors),
        "outcome_distribution": counter_dict(outcome_counts),
        "analysis_by_actual_outcome": analysis_by_outcome,
        "overall_intent": counter_dict(Counter(x["analysis"]["intent"] for x in results)),
        "overall_sentiment": counter_dict(Counter(x["analysis"]["sentiment"] for x in results)),
        "overall_engagement": counter_dict(Counter(x["analysis"]["engagement"] for x in results)),
        "overall_objection_handling": counter_dict(Counter(x["analysis"]["objection_handling"] for x in results)),
        "overall_decision_point": counter_dict(Counter(x["analysis"]["decision_point"] for x in results)),
        "buying_signals": counter_dict(buying_signals_total),
        "objections": counter_dict(objections_total),
        "methodology": {
            "ground_truth_used_for_analysis": False,
            "ground_truth_used_only_for_grouping": True,
            "engine": "ISDABI Sales Analysis Engine V1.2.1",
            "embedding_model": "microsoft/MiniLM-L12-H384-uncased",
            "note": "This evaluates engine behavior on unseen testing conversations; it is not supervised SUCCESS/FAILURE classifier accuracy."
        },
        "errors": errors,
        "runtime_seconds": round(elapsed_seconds, 2)
    }

def main():
    print("=" * 72)
    print("ISDABI SALES TESTING EVALUATION V1.2.1")
    print("=" * 72)
    print()
    REPORTS_DIR.mkdir(parents=True, exist_ok=True)
    engine = load_engine()
    print(f"Testing file: {TESTING_FILE}")
    print(f"Output file:  {OUTPUT_FILE}")
    print(f"Summary file: {SUMMARY_FILE}")
    print()
    records = load_testing_records()
    print(f"Total testing conversations: {len(records)}")
    print()

    results, errors = [], []
    start = time.time()

    with OUTPUT_FILE.open("w", encoding="utf-8") as output:
        for index, record in enumerate(records, start=1):
            cid = record.get("conversation_id", index - 1)
            try:
                analysis = engine.analyze_record(record)
                item = {
                    "conversation_id": cid,
                    "ground_truth": {"outcome": normalize_outcome(record.get("outcome"))},
                    "analysis": extract_prediction_fields(analysis)
                }
                results.append(item)
                output.write(json.dumps(item, ensure_ascii=False) + "\n")
            except Exception as exc:
                err = {"conversation_id": cid, "error_type": type(exc).__name__, "error": str(exc)}
                errors.append(err)
                output.write(json.dumps({"conversation_id": cid, "error": err}, ensure_ascii=False) + "\n")
            output.flush()

            if index == 1 or index % 25 == 0 or index == len(records):
                elapsed = time.time() - start
                rate = index / elapsed if elapsed else 0
                print(f"Progress: {index}/{len(records)} | Remaining: {len(records)-index} | Rate: {rate:.2f} conv/s")

    summary = build_summary(results, errors, time.time() - start)
    with SUMMARY_FILE.open("w", encoding="utf-8") as f:
        json.dump(summary, f, indent=2, ensure_ascii=False)

    print()
    print("=" * 72)
    print("TESTING EVALUATION SUMMARY")
    print("=" * 72)
    print(f"Total testing records: {len(records)}")
    print(f"Completed:             {len(results)}")
    print(f"Errors:                {len(errors)}")
    print()
    print("Actual Dataset Outcomes:")
    for k, v in summary["outcome_distribution"].items():
        print(f"- {k}: {v}")
    print()
    print("Customer Intent:")
    for k, v in summary["overall_intent"].items():
        print(f"- {k}: {v}")
    print()
    print("Customer Sentiment:")
    for k, v in summary["overall_sentiment"].items():
        print(f"- {k}: {v}")
    print()
    print("Engagement:")
    for k, v in summary["overall_engagement"].items():
        print(f"- {k}: {v}")
    print()
    print("Objection Handling:")
    for k, v in summary["overall_objection_handling"].items():
        print(f"- {k}: {v}")
    print()
    print("Decision Points:")
    for k, v in summary["overall_decision_point"].items():
        print(f"- {k}: {v}")
    print()
    print("Analysis by Actual Outcome:")
    for outcome, d in summary["analysis_by_actual_outcome"].items():
        print(f"\n{outcome}:")
        print(f"  Records: {d['records']}")
        for title in ["intent", "sentiment", "engagement", "decision_point", "objection_handling"]:
            print(f"  {title.replace('_',' ').title()}:")
            for k, v in d[title].items():
                print(f"    - {k}: {v}")
        print(f"  Average buying signals: {d['average_buying_signal_count']}")
        print(f"  Average objections: {d['average_objection_count']}")

    print()
    print(f"Evaluation output: {OUTPUT_FILE}")
    print(f"Evaluation summary: {SUMMARY_FILE}")
    print()
    print("STATUS: COMPLETE" if not errors else "STATUS: COMPLETE WITH ERRORS")

if __name__ == "__main__":
    main()
