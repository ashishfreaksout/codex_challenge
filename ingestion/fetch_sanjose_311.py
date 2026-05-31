#!/usr/bin/env python3
"""Fetch San Jose 311 pothole/service request data into a local raw file.

This script does not invent records. By default it expects a real endpoint in
SAN_JOSE_311_API_URL or --api-url. For classroom/local demos, pass --demo to
copy the bundled sample CSV into the same raw JSON shape used by the loader.
"""

from __future__ import annotations

import argparse
import csv
import json
import os
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from dotenv import load_dotenv


DEFAULT_OUTPUT = Path("data/raw/sanjose_311_potholes.json")
DEFAULT_DEMO_FILE = Path("data/sample_san_jose_311_potholes.csv")


def main() -> None:
    load_dotenv()
    args = parse_args()

    if args.demo:
        records = read_demo_csv(args.demo_file)
        source = f"demo:{args.demo_file}"
    else:
        api_url = args.api_url or os.getenv("SAN_JOSE_311_API_URL")
        if not api_url:
            print(
                "No San Jose 311 API URL was provided. Set SAN_JOSE_311_API_URL, "
                "pass --api-url, or run with --demo to use the bundled sample file."
            )
            return
        records = fetch_api_records(api_url)
        source = api_url

    if not records:
        print("No 311 records were fetched; nothing was written.")
        return

    write_raw_output(args.output, records, source)
    print(f"Wrote {len(records)} San Jose 311 records to {args.output}")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--api-url", help="Full San Jose 311 API URL to request.")
    parser.add_argument(
        "--output",
        type=Path,
        default=DEFAULT_OUTPUT,
        help=f"Raw JSON output path. Default: {DEFAULT_OUTPUT}",
    )
    parser.add_argument(
        "--demo",
        action="store_true",
        help="Use the bundled sample CSV instead of a live API endpoint.",
    )
    parser.add_argument(
        "--demo-file",
        type=Path,
        default=DEFAULT_DEMO_FILE,
        help=f"CSV used only with --demo. Default: {DEFAULT_DEMO_FILE}",
    )
    return parser.parse_args()


def fetch_api_records(api_url: str) -> list[dict[str, Any]]:
    try:
        import requests
    except ImportError:
        print("The requests package is required for live API fetches. Install requirements.txt first.")
        return []

    try:
        response = requests.get(api_url, timeout=30)
        response.raise_for_status()
    except requests.RequestException as exc:
        print(f"San Jose 311 request failed gracefully: {exc}")
        return []

    payload = response.json()
    return normalize_payload(payload)


def normalize_payload(payload: Any) -> list[dict[str, Any]]:
    """Support common civic-data response shapes without assuming one vendor."""
    if isinstance(payload, list):
        return [record for record in payload if isinstance(record, dict)]

    if not isinstance(payload, dict):
        return []

    if isinstance(payload.get("records"), list):
        return [record for record in payload["records"] if isinstance(record, dict)]

    if isinstance(payload.get("data"), list):
        return [record for record in payload["data"] if isinstance(record, dict)]

    if isinstance(payload.get("features"), list):
        records = []
        for feature in payload["features"]:
            if not isinstance(feature, dict):
                continue
            attributes = feature.get("attributes") or feature.get("properties") or {}
            geometry = feature.get("geometry") or {}
            record = dict(attributes)
            if "latitude" not in record and "y" in geometry:
                record["latitude"] = geometry["y"]
            if "longitude" not in record and "x" in geometry:
                record["longitude"] = geometry["x"]
            records.append(record)
        return records

    return []


def read_demo_csv(path: Path) -> list[dict[str, str]]:
    if not path.exists():
        print(f"Demo file was not found: {path}")
        return []

    with path.open("r", encoding="utf-8", newline="") as file:
        return list(csv.DictReader(file))


def write_raw_output(path: Path, records: list[dict[str, Any]], source: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    payload = {
        "source": source,
        "fetched_at": datetime.now(timezone.utc).isoformat(),
        "record_count": len(records),
        "records": records,
    }
    path.write_text(json.dumps(payload, indent=2), encoding="utf-8")


if __name__ == "__main__":
    main()
