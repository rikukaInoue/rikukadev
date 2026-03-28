#!/usr/bin/env python3
"""
CLIP-based photo classifier for public/photos/
Generates src/data/photo-data.json with category and tags for each photo.
"""

import json
import sys
from pathlib import Path

import open_clip
import torch
from PIL import Image

PHOTOS_DIR = Path(__file__).parent.parent / "public" / "photos"
OUTPUT_FILE = Path(__file__).parent.parent / "src" / "data" / "photo-data.json"

CATEGORIES = [
    "landscape",
    "portrait",
    "night scene",
    "cityscape",
    "nature",
    "architecture",
    "street photography",
    "food",
    "animal",
    "abstract",
]

TAGS = [
    "sunset", "sunrise", "blue sky", "cloudy", "rain", "snow", "fog",
    "forest", "mountain", "ocean", "river", "lake", "desert",
    "flower", "tree", "grass",
    "building", "bridge", "road", "train", "car",
    "people", "crowd", "alone",
    "colorful", "monochrome", "dark", "bright",
    "indoor", "outdoor",
    "Japan", "urban", "rural",
]

CATEGORY_LABELS_JP = {
    "landscape": "風景",
    "portrait": "ポートレート",
    "night scene": "夜景",
    "cityscape": "都市",
    "nature": "自然",
    "architecture": "建築",
    "street photography": "スナップ",
    "food": "食べ物",
    "animal": "動物",
    "abstract": "その他",
}


def load_model():
    print("Loading CLIP model...", file=sys.stderr)
    model, _, preprocess = open_clip.create_model_and_transforms(
        "ViT-B-32", pretrained="openai"
    )
    model.eval()
    tokenizer = open_clip.get_tokenizer("ViT-B-32")
    return model, preprocess, tokenizer


def classify_image(image_path, model, preprocess, tokenizer):
    image = preprocess(Image.open(image_path).convert("RGB")).unsqueeze(0)

    # Classify category
    category_texts = tokenizer([f"a photo of {c}" for c in CATEGORIES])
    with torch.no_grad():
        image_features = model.encode_image(image)
        text_features = model.encode_text(category_texts)
        image_features /= image_features.norm(dim=-1, keepdim=True)
        text_features /= text_features.norm(dim=-1, keepdim=True)
        category_probs = (100.0 * image_features @ text_features.T).softmax(dim=-1)

    top_category_idx = category_probs[0].argmax().item()
    category_en = CATEGORIES[top_category_idx]
    category = CATEGORY_LABELS_JP[category_en]

    # Get top tags (threshold: top 5 with prob > 5%)
    tag_texts = tokenizer([f"a photo with {t}" for t in TAGS])
    with torch.no_grad():
        text_features = model.encode_text(tag_texts)
        text_features /= text_features.norm(dim=-1, keepdim=True)
        tag_probs = (100.0 * image_features @ text_features.T).softmax(dim=-1)[0]

    top_tags = [
        TAGS[i]
        for i in tag_probs.argsort(descending=True)[:5]
        if tag_probs[i].item() > 0.05
    ]

    return category, top_tags


def main(target_files=None):
    OUTPUT_FILE.parent.mkdir(parents=True, exist_ok=True)

    # Load existing data
    existing = {}
    if OUTPUT_FILE.exists():
        with open(OUTPUT_FILE) as f:
            for item in json.load(f):
                existing[item["filename"]] = item

    # Determine which files to process
    if target_files:
        photos = [Path(f) for f in target_files if Path(f).suffix.lower() in (".jpg", ".jpeg")]
    else:
        photos = sorted(PHOTOS_DIR.glob("*.jpg")) + sorted(PHOTOS_DIR.glob("*.jpeg"))
        photos = [p for p in photos if re.match(r"^\d{4}\.\d{2}", p.name)]

    new_files = [p for p in photos if p.name not in existing]

    if not new_files:
        print("No new photos to classify.", file=sys.stderr)
        # Still write out to ensure file exists
        all_photos = sorted(
            [v for v in existing.values()],
            key=lambda x: x["filename"],
            reverse=True,
        )
        with open(OUTPUT_FILE, "w") as f:
            json.dump(all_photos, f, ensure_ascii=False, indent=2)
        return

    print(f"Classifying {len(new_files)} new photo(s)...", file=sys.stderr)
    model, preprocess, tokenizer = load_model()

    for photo in new_files:
        print(f"  {photo.name}", file=sys.stderr)
        try:
            category, tags = classify_image(photo, model, preprocess, tokenizer)
            match = re.match(r"^(\d{4})\.(\d{2})\.(\d{2})", photo.name)
            date = f"{match.group(1)}.{match.group(2)}.{match.group(3)}" if match else photo.stem
            year = match.group(1) if match else "Unknown"
            existing[photo.name] = {
                "filename": photo.name,
                "date": date,
                "year": year,
                "category": category,
                "tags": tags,
            }
        except Exception as e:
            print(f"  ERROR: {photo.name}: {e}", file=sys.stderr)

    all_photos = sorted(existing.values(), key=lambda x: x["filename"], reverse=True)
    with open(OUTPUT_FILE, "w") as f:
        json.dump(all_photos, f, ensure_ascii=False, indent=2)
    print(f"Saved {len(all_photos)} entries to {OUTPUT_FILE}", file=sys.stderr)


if __name__ == "__main__":
    import re
    files = sys.argv[1:] if len(sys.argv) > 1 else None
    main(files)
