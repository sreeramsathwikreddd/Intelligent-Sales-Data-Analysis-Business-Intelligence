import os
import json
import torch
from transformers import AutoTokenizer, AutoModel
from sklearn.metrics import accuracy_score, precision_score, recall_score, f1_score, confusion_matrix, classification_report

ROOT = r"A:\5.Projects & Information\16.Intelligent Sales Data Analysis & Business Intelligence"

TEST_FILE = ROOT + r"\ISDABI Dataset\testing\ISDABI Sales Testing.jsonl"
MODEL_DIR = ROOT + r"\ISDABI Model\MiniLM"
CHECKPOINT = ROOT + r"\ISDABI Model\checkpoints\MiniLM Sales Outcome V1\best_model.pt"
REPORT_DIR = ROOT + r"\ISDABI Reports"
REPORT_FILE = REPORT_DIR + r"\ISDABI MiniLM Sales Outcome V1 Test Evaluation.json"

os.makedirs(REPORT_DIR, exist_ok=True)

DEVICE = torch.device("cuda" if torch.cuda.is_available() else "cpu")
BATCH_SIZE = 32
MAX_LENGTH = 256

print("=" * 60)
print("ISDABI MINILM SALES OUTCOME V1")
print("UNSEEN TEST EVALUATION")
print("=" * 60)
print("Device:", DEVICE)

records = []

with open(TEST_FILE, "r", encoding="utf-8") as f:
    for line in f:
        if line.strip():
            records.append(json.loads(line))

print("Testing records:", len(records))

labels = {"FAILURE": 0, "SUCCESS": 1}

tokenizer = AutoTokenizer.from_pretrained(
    MODEL_DIR,
    local_files_only=True
)

encoder = AutoModel.from_pretrained(
    MODEL_DIR,
    local_files_only=True
)

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
        pooled = (output.last_hidden_state * mask).sum(dim=1)
        pooled = pooled / mask.sum(dim=1).clamp(min=1e-9)
        pooled = self.dropout(pooled)

        return self.classifier(pooled)

model = SalesClassifier(encoder)

state = torch.load(
    CHECKPOINT,
    map_location=DEVICE,
    weights_only=True
)

model.load_state_dict(state)
model.to(DEVICE)
model.eval()

texts = []
true_labels = []

for row in records:
    conversation = row["conversation"]
    text = ""

    if isinstance(conversation, list):
        for turn in conversation:
            role = turn.get("role", "")
            message = turn.get("text", "")
            text += f"{role}: {message}\n"
    else:
        text = str(conversation)

    texts.append(text)
    true_labels.append(labels[row["outcome"]])

predictions = []

print("Running inference...")

with torch.no_grad():
    for start in range(0, len(texts), BATCH_SIZE):

        batch_texts = texts[start:start + BATCH_SIZE]

        encoded = tokenizer(
            batch_texts,
            truncation=True,
            padding=True,
            max_length=MAX_LENGTH,
            return_tensors="pt"
        )

        input_ids = encoded["input_ids"].to(DEVICE)
        attention_mask = encoded["attention_mask"].to(DEVICE)

        logits = model(
            input_ids=input_ids,
            attention_mask=attention_mask
        )

        predictions.extend(
            torch.argmax(logits, dim=1).cpu().tolist()
        )

        completed = min(start + BATCH_SIZE, len(texts))

        if completed % 320 == 0 or completed == len(texts):
            print(f"Processed: {completed}/{len(texts)}")

accuracy = accuracy_score(true_labels, predictions)
precision = precision_score(true_labels, predictions, zero_division=0)
recall = recall_score(true_labels, predictions, zero_division=0)
f1 = f1_score(true_labels, predictions, zero_division=0)

cm = confusion_matrix(
    true_labels,
    predictions,
    labels=[0, 1]
)

report = classification_report(
    true_labels,
    predictions,
    target_names=["FAILURE", "SUCCESS"],
    zero_division=0
)

results = {
    "model": "MiniLM-L12-H384-uncased",
    "task": "SUCCESS vs FAILURE",
    "training_records": 9598,
    "testing_records": len(records),
    "epochs": 3,
    "device": str(DEVICE),
    "metrics": {
        "accuracy": accuracy,
        "precision_success": precision,
        "recall_success": recall,
        "f1_success": f1
    },
    "confusion_matrix": {
        "labels": ["FAILURE", "SUCCESS"],
        "matrix": cm.tolist()
    },
    "classification_report": report
}

with open(REPORT_FILE, "w", encoding="utf-8") as f:
    json.dump(results, f, indent=2)

print()
print("=" * 60)
print("FINAL TEST RESULTS")
print("=" * 60)
print(f"Accuracy:          {accuracy:.4f}")
print(f"Precision SUCCESS:  {precision:.4f}")
print(f"Recall SUCCESS:     {recall:.4f}")
print(f"F1 SUCCESS:         {f1:.4f}")
print()
print("Confusion Matrix:")
print(cm)
print()
print(report)
print("Report:", REPORT_FILE)
print("STATUS: PASS")
