#!/usr/bin/env python3
"""
CLIP + BLIP photo analyzer for public/photos/
- CLIP: category classification + detailed tags
- BLIP: natural language description
Generates src/data/photo-data.json
"""

import json
import re
import sys
from pathlib import Path

import open_clip
import torch
from deep_translator import GoogleTranslator
from PIL import Image
from transformers import BlipForConditionalGeneration, BlipProcessor

PHOTOS_DIR = Path(__file__).parent.parent / "public" / "photos"
OUTPUT_FILE = Path(__file__).parent.parent / "src" / "data" / "photo-data.json"

CATEGORIES = [
    "landscape", "portrait", "night scene", "cityscape", "nature",
    "architecture", "street photography", "food", "animal", "abstract",
]

CATEGORY_LABELS_JP = {
    "landscape": "風景", "portrait": "ポートレート", "night scene": "夜景",
    "cityscape": "都市", "nature": "自然", "architecture": "建築",
    "street photography": "スナップ", "food": "食べ物", "animal": "動物",
    "abstract": "その他",
}

# Detailed tag groups
TAG_GROUPS = {
    "time": ["sunrise", "sunset", "golden hour", "blue hour", "daytime", "nighttime", "dusk", "dawn"],
    "weather": ["clear sky", "cloudy", "overcast", "foggy", "rainy", "snowy", "stormy"],
    "nature": ["forest", "mountain", "ocean", "river", "lake", "waterfall", "desert", "field", "valley", "cliff"],
    "flora": ["cherry blossom", "flower", "tree", "grass", "autumn leaves", "bamboo"],
    "urban": ["building", "bridge", "road", "train", "alley", "park", "tunnel", "staircase"],
    "light": ["backlight", "shadow", "reflection", "silhouette", "beam of light", "neon light"],
    "mood": ["calm", "dramatic", "minimal", "vibrant", "moody", "serene"],
    "season": ["spring", "summer", "autumn", "winter"],
    "composition": ["wide angle", "close up", "symmetry", "leading lines", "bokeh"],
}

ALL_TAGS = [tag for tags in TAG_GROUPS.values() for tag in tags]


def load_models():
    print("Loading CLIP model...", file=sys.stderr)
    clip_model, _, clip_preprocess = open_clip.create_model_and_transforms(
        "ViT-B-32", pretrained="openai"
    )
    clip_model.eval()
    clip_tokenizer = open_clip.get_tokenizer("ViT-B-32")

    print("Loading BLIP model...", file=sys.stderr)
    blip_processor = BlipProcessor.from_pretrained(
        "Salesforce/blip-image-captioning-base"
    )
    blip_model = BlipForConditionalGeneration.from_pretrained(
        "Salesforce/blip-image-captioning-base"
    )
    blip_model.eval()

    return clip_model, clip_preprocess, clip_tokenizer, blip_processor, blip_model


def analyze_image(image_path, clip_model, clip_preprocess, clip_tokenizer, blip_processor, blip_model):
    img = Image.open(image_path).convert("RGB")
    clip_input = clip_preprocess(img).unsqueeze(0)

    # CLIP: category
    category_texts = clip_tokenizer([f"a photo of {c}" for c in CATEGORIES])
    with torch.no_grad():
        img_features = clip_model.encode_image(clip_input)
        cat_features = clip_model.encode_text(category_texts)
        img_features /= img_features.norm(dim=-1, keepdim=True)
        cat_features /= cat_features.norm(dim=-1, keepdim=True)
        cat_probs = (100.0 * img_features @ cat_features.T).softmax(dim=-1)
    category_en = CATEGORIES[cat_probs[0].argmax().item()]
    category = CATEGORY_LABELS_JP[category_en]

    # CLIP: detailed tags (top 8, prob > 3%)
    tag_texts = clip_tokenizer([f"a photo with {t}" for t in ALL_TAGS])
    with torch.no_grad():
        tag_features = clip_model.encode_text(tag_texts)
        tag_features /= tag_features.norm(dim=-1, keepdim=True)
        tag_probs = (100.0 * img_features @ tag_features.T).softmax(dim=-1)[0]
    tags = [
        ALL_TAGS[i]
        for i in tag_probs.argsort(descending=True)[:8]
        if tag_probs[i].item() > 0.03
    ]

    # BLIP: description (English → Japanese)
    blip_inputs = blip_processor(img, return_tensors="pt")
    with torch.no_grad():
        out = blip_model.generate(**blip_inputs, max_new_tokens=60)
    description_en = blip_processor.decode(out[0], skip_special_tokens=True)
    try:
        description = GoogleTranslator(source="en", target="ja").translate(description_en)
    except Exception:
        description = description_en  # fallback to English

    return category, tags, description


def main(target_files=None):
    OUTPUT_FILE.parent.mkdir(parents=True, exist_ok=True)

    existing = {}
    if OUTPUT_FILE.exists():
        with open(OUTPUT_FILE) as f:
            for item in json.load(f):
                existing[item["filename"]] = item

    if target_files:
        photos = [Path(f) for f in target_files if Path(f).suffix.lower() in (".jpg", ".jpeg")]
    else:
        photos = sorted(PHOTOS_DIR.glob("*.jpg")) + sorted(PHOTOS_DIR.glob("*.jpeg"))
        photos = [p for p in photos if re.match(r"^\d{4}\.\d{2}", p.name)]

    # Only process files missing description (re-analyze old entries without description too)
    new_files = [p for p in photos if p.name not in existing or "description" not in existing[p.name]]

    if not new_files:
        print("No new photos to analyze.", file=sys.stderr)
        all_photos = sorted(existing.values(), key=lambda x: x["filename"], reverse=True)
        with open(OUTPUT_FILE, "w") as f:
            json.dump(all_photos, f, ensure_ascii=False, indent=2)
        return

    print(f"Analyzing {len(new_files)} photo(s)...", file=sys.stderr)
    clip_model, clip_preprocess, clip_tokenizer, blip_processor, blip_model = load_models()

    for photo in new_files:
        print(f"  {photo.name}", file=sys.stderr, end=" ", flush=True)
        try:
            match = re.match(r"^(\d{4})\.(\d{2})\.(\d{2})", photo.name)
            date = f"{match.group(1)}.{match.group(2)}.{match.group(3)}" if match else photo.stem
            year = match.group(1) if match else "Unknown"
            category, tags, description = analyze_image(
                photo, clip_model, clip_preprocess, clip_tokenizer, blip_processor, blip_model
            )
            existing[photo.name] = {
                "filename": photo.name,
                "date": date,
                "year": year,
                "category": category,
                "tags": tags,
                "description": description,
            }
            print(f"→ {category} / {description[:40]}...", file=sys.stderr)
        except Exception as e:
            print(f"ERROR: {e}", file=sys.stderr)

    all_photos = sorted(existing.values(), key=lambda x: x["filename"], reverse=True)
    with open(OUTPUT_FILE, "w") as f:
        json.dump(all_photos, f, ensure_ascii=False, indent=2)
    print(f"\nSaved {len(all_photos)} entries to {OUTPUT_FILE}", file=sys.stderr)


if __name__ == "__main__":
    files = sys.argv[1:] if len(sys.argv) > 1 else None
    main(files)
