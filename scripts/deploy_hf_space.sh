#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SPACE_ID="${1:-${HF_SPACE_ID:-}}"

if [[ -z "$SPACE_ID" ]]; then
  echo "Usage: scripts/deploy_hf_space.sh <huggingface-user-or-org>/bay-area-pothole-prediction-api"
  echo "Or set HF_SPACE_ID=<huggingface-user-or-org>/bay-area-pothole-prediction-api"
  exit 1
fi

if ! command -v hf >/dev/null 2>&1; then
  echo "Install the Hugging Face CLI first: python3 -m pip install -U huggingface_hub"
  exit 1
fi

"$ROOT_DIR/scripts/prepare_hf_space.sh"

hf repos create "$SPACE_ID" --type space --space-sdk docker --exist-ok
hf upload "$SPACE_ID" "$ROOT_DIR/dist/huggingface-space" . \
  --repo-type space \
  --commit-message "Deploy pothole prediction API"

printf "Uploaded Hugging Face Space: https://huggingface.co/spaces/%s\n" "$SPACE_ID"
