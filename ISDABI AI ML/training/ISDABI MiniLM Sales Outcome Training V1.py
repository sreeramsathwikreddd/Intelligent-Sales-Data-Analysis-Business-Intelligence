import os
import json
import torch
from torch.utils.data import Dataset, DataLoader
from transformers import AutoTokenizer, AutoModel
from torch.optim import AdamW
from tqdm import tqdm

ROOT = r"A:\5.Projects & Information\16.Intelligent Sales Data Analysis & Business Intelligence"

os.environ["HF_HOME"] = ROOT + r"\ISDABI Model\HuggingFaceCache"
os.environ["HF_HUB_CACHE"] = ROOT + r"\ISDABI Model\HuggingFaceCache\hub"
os.environ["TORCH_HOME"] = ROOT + r"\ISDABI Model\TorchCache"
os.environ["TRANSFORMERS_CACHE"] = ROOT + r"\ISDABI Model\HuggingFaceCache"

TRAIN_FILE = ROOT + r"\ISDABI Dataset\training\ISDABI Sales Training.jsonl"
MODEL_DIR = ROOT + r"\ISDABI Model\MiniLM"
OUTPUT_DIR = ROOT + r"\ISDABI Model\checkpoints\MiniLM Sales Outcome V1"

os.makedirs(OUTPUT_DIR, exist_ok=True)

DEVICE = torch.device("cuda" if torch.cuda.is_available() else "cpu")
EPOCHS = 3
BATCH_SIZE = 16
MAX_LENGTH = 256
LR = 2e-5

print("=" * 60)
print("ISDABI MINILM SALES OUTCOME TRAINING V1")
print("=" * 60)
print("Device:", DEVICE)
print("Epochs:", EPOCHS)
print("Batch size:", BATCH_SIZE)
print("Max length:", MAX_LENGTH)

if DEVICE.type == "cuda":
    print("GPU:", torch.cuda.get_device_name(0))

records = []
with open(TRAIN_FILE, "r", encoding="utf-8") as f:
    for line in f:
        if line.strip():
            records.append(json.loads(line))

print("Training records:", len(records))

labels = {"FAILURE": 0, "SUCCESS": 1}

class SalesDataset(Dataset):
    def __init__(self, rows, tokenizer):
        self.rows = rows
        self.tokenizer = tokenizer

    def __len__(self):
        return len(self.rows)

    def __getitem__(self, idx):
        row = self.rows[idx]

        text = ""
        conversation = row["conversation"]

        if isinstance(conversation, list):
            for turn in conversation:
                role = turn.get("role", "")
                message = turn.get("text", "")
                text += f"{role}: {message}\n"
        else:
            text = str(conversation)

        encoded = self.tokenizer(
            text,
            truncation=True,
            padding="max_length",
            max_length=MAX_LENGTH,
            return_tensors="pt"
        )

        return {
            "input_ids": encoded["input_ids"].squeeze(0),
            "attention_mask": encoded["attention_mask"].squeeze(0),
            "labels": torch.tensor(labels[row["outcome"]], dtype=torch.long)
        }

print("Loading MiniLM...")

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

model = SalesClassifier(encoder).to(DEVICE)

dataset = SalesDataset(records, tokenizer)

loader = DataLoader(
    dataset,
    batch_size=BATCH_SIZE,
    shuffle=True,
    num_workers=0
)

success_count = sum(1 for r in records if r["outcome"] == "SUCCESS")
failure_count = len(records) - success_count

weights = torch.tensor(
    [
        len(records) / (2 * failure_count),
        len(records) / (2 * success_count)
    ],
    dtype=torch.float32,
    device=DEVICE
)

criterion = torch.nn.CrossEntropyLoss(weight=weights)

optimizer = AdamW(
    model.parameters(),
    lr=LR,
    weight_decay=0.01
)

print("SUCCESS:", success_count)
print("FAILURE:", failure_count)
print("Class weights:", weights.detach().cpu().tolist())
print()

best_accuracy = 0.0

for epoch in range(EPOCHS):

    model.train()

    total_loss = 0.0
    correct = 0
    total = 0

    progress = tqdm(
        loader,
        desc=f"Epoch {epoch + 1}/{EPOCHS}"
    )

    for batch in progress:

        input_ids = batch["input_ids"].to(DEVICE)
        attention_mask = batch["attention_mask"].to(DEVICE)
        batch_labels = batch["labels"].to(DEVICE)

        optimizer.zero_grad()

        logits = model(
            input_ids=input_ids,
            attention_mask=attention_mask
        )

        loss = criterion(logits, batch_labels)

        loss.backward()

        torch.nn.utils.clip_grad_norm_(
            model.parameters(),
            max_norm=1.0
        )

        optimizer.step()

        total_loss += loss.item()

        predictions = torch.argmax(logits, dim=1)

        correct += (predictions == batch_labels).sum().item()
        total += batch_labels.size(0)

        accuracy = correct / total

        progress.set_postfix(
            loss=f"{loss.item():.4f}",
            accuracy=f"{accuracy:.4f}"
        )

    epoch_loss = total_loss / len(loader)
    epoch_accuracy = correct / total

    print()
    print(
        f"Epoch {epoch + 1}: "
        f"Loss={epoch_loss:.4f} "
        f"Accuracy={epoch_accuracy:.4f}"
    )

    checkpoint = os.path.join(
        OUTPUT_DIR,
        f"epoch-{epoch + 1}"
    )

    os.makedirs(checkpoint, exist_ok=True)

    torch.save(
        model.state_dict(),
        os.path.join(checkpoint, "model.pt")
    )

    tokenizer.save_pretrained(checkpoint)

    if epoch_accuracy > best_accuracy:
        best_accuracy = epoch_accuracy

        torch.save(
            model.state_dict(),
            os.path.join(OUTPUT_DIR, "best_model.pt")
        )

print()
print("=" * 60)
print("TRAINING COMPLETE")
print("=" * 60)
print("Best training accuracy:", round(best_accuracy, 4))
print("Output:", OUTPUT_DIR)
print("STATUS: PASS")
