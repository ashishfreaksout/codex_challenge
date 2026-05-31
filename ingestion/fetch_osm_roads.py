#!/usr/bin/env python3
"""Fetch drivable OpenStreetMap road segments.

The script first tries Overpass and can fall back to the official OSM map API.
It avoids osmnx/geopandas so the project stays lightweight. If all network
sources fail, it exits cleanly and leaves existing files untouched.
"""

from __future__ import annotations

import argparse
import csv
import json
import os
import time
from datetime import datetime, timezone
from pathlib import Path
from statistics import mean
from typing import Any
from xml.etree import ElementTree

import requests
from dotenv import load_dotenv


DEFAULT_OUTPUT = Path("data/raw/osm_roads_sanjose.json")
DEFAULT_BBOX = "37.20,-122.05,37.45,-121.70"  # south,west,north,east
DEFAULT_OVERPASS_URLS = [
    "https://overpass-api.de/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
    "https://overpass.openstreetmap.ru/api/interpreter",
]
DEFAULT_OSM_MAP_URL = "https://api.openstreetmap.org/api/0.6/map"
DRIVABLE_HIGHWAY_TYPES = {
    "motorway",
    "trunk",
    "primary",
    "secondary",
    "tertiary",
    "unclassified",
    "residential",
    "service",
    "living_street",
    "motorway_link",
    "trunk_link",
    "primary_link",
    "secondary_link",
    "tertiary_link",
}


def main() -> None:
    load_dotenv()
    args = parse_args()
    bbox = args.bbox

    if args.from_potholes and args.around_potholes:
        bboxes = bboxes_around_pothole_file(
            args.from_potholes,
            buffer_degrees=args.point_buffer_degrees,
            cluster_degrees=args.cluster_degrees,
            max_bboxes=args.max_bboxes,
        )
        if not bboxes:
            print("No pothole-derived point bboxes were created; nothing was written.")
            return
        roads, source_label = fetch_roads_for_bboxes(args, bboxes)
        roads = dedupe_roads(roads)
        if not roads:
            print("No usable OSM road data was fetched; nothing was written.")
            return
        write_output(
            args.output,
            roads,
            combined_bbox(bboxes),
            source_label,
            extra_metadata={
                "fetch_strategy": "around_potholes",
                "bbox_count": len(bboxes),
                "point_buffer_degrees": args.point_buffer_degrees,
                "cluster_degrees": args.cluster_degrees,
            },
        )
        print(f"Wrote {len(roads)} OSM road segments to {args.output}")
        return

    if args.from_potholes:
        derived_bbox = bbox_from_pothole_file(args.from_potholes, args.buffer_degrees)
        if derived_bbox:
            bbox = derived_bbox
            print(f"Using bbox from pothole reports: {bbox}")

    roads: list[dict[str, Any]] = []
    source_label = ""

    if args.source in ("auto", "overpass"):
        payload, source_label = fetch_overpass_with_fallbacks(args.overpass_url, bbox)
        if payload:
            roads = normalize_overpass_roads(payload)

    if not roads and args.source in ("auto", "osm-api"):
        xml_payload, source_label = fetch_osm_map_api(args.osm_api_url, bbox)
        if xml_payload:
            roads = normalize_osm_api_roads(xml_payload)

    roads = dedupe_roads(roads)
    if not roads:
        print("No usable OSM road data was fetched; nothing was written.")
        return

    write_output(args.output, roads, bbox, source_label)
    print(f"Wrote {len(roads)} OSM road segments to {args.output}")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--bbox",
        default=DEFAULT_BBOX,
        help="Overpass bbox as south,west,north,east. Default covers San Jose.",
    )
    parser.add_argument(
        "--from-potholes",
        type=Path,
        help="Optional raw 311 JSON/CSV file used to derive a tighter OSM bbox.",
    )
    parser.add_argument(
        "--around-potholes",
        action="store_true",
        help=(
            "Fetch multiple small OSM bboxes around pothole locations instead "
            "of one large combined bbox. Best for Bay Area demos."
        ),
    )
    parser.add_argument(
        "--buffer-degrees",
        type=float,
        default=0.015,
        help="Latitude/longitude buffer around pothole-derived bounds.",
    )
    parser.add_argument(
        "--point-buffer-degrees",
        type=float,
        default=0.007,
        help="Buffer around each pothole cluster when --around-potholes is used.",
    )
    parser.add_argument(
        "--cluster-degrees",
        type=float,
        default=0.02,
        help="Coordinate grid size used to group nearby pothole points into fewer OSM requests.",
    )
    parser.add_argument(
        "--max-bboxes",
        type=int,
        default=120,
        help="Safety limit for pothole-derived OSM requests.",
    )
    parser.add_argument(
        "--request-delay-seconds",
        type=float,
        default=0.2,
        help="Delay between small OSM bbox requests.",
    )
    parser.add_argument(
        "--source",
        choices=["auto", "overpass", "osm-api"],
        default="auto",
        help="Network source strategy. Default tries Overpass then OSM map API.",
    )
    parser.add_argument("--overpass-url", help="Override one Overpass API URL.")
    parser.add_argument(
        "--osm-api-url",
        default=os.getenv("OSM_MAP_API_URL") or DEFAULT_OSM_MAP_URL,
        help=f"OSM map API URL used as fallback. Default: {DEFAULT_OSM_MAP_URL}",
    )
    parser.add_argument(
        "--output",
        type=Path,
        default=DEFAULT_OUTPUT,
        help=f"Raw JSON output path. Default: {DEFAULT_OUTPUT}",
    )
    return parser.parse_args()


def fetch_roads_for_bboxes(args: argparse.Namespace, bboxes: list[str]) -> tuple[list[dict[str, Any]], str]:
    roads: list[dict[str, Any]] = []
    successful_sources: list[str] = []
    print(f"Fetching OSM roads for {len(bboxes)} pothole-derived bboxes.")

    for index, bbox in enumerate(bboxes, start=1):
        print(f"[{index}/{len(bboxes)}] OSM bbox {bbox}")
        bbox_roads: list[dict[str, Any]] = []
        source_label = ""

        if args.source in ("auto", "overpass"):
            payload, source_label = fetch_overpass_with_fallbacks(args.overpass_url, bbox)
            if payload:
                bbox_roads = normalize_overpass_roads(payload)

        if not bbox_roads and args.source in ("auto", "osm-api"):
            xml_payload, source_label = fetch_osm_map_api(args.osm_api_url, bbox)
            if xml_payload:
                bbox_roads = normalize_osm_api_roads(xml_payload)

        if bbox_roads:
            roads.extend(bbox_roads)
            successful_sources.append(source_label)
            print(f"  fetched {len(bbox_roads)} road segments")
        else:
            print("  no road segments fetched for this bbox")

        if args.request_delay_seconds > 0 and index < len(bboxes):
            time.sleep(args.request_delay_seconds)

    unique_sources = []
    for source in successful_sources:
        if source and source not in unique_sources:
            unique_sources.append(source)
    source_summary = f"multi-bbox fetch using {len(unique_sources)} source endpoint(s)"
    if unique_sources:
        source_summary = f"{source_summary}: {', '.join(unique_sources[:3])}"
    return roads, source_summary


def fetch_overpass_with_fallbacks(
    overpass_url: str | None,
    bbox: str,
) -> tuple[dict[str, Any] | None, str]:
    env_url = os.getenv("OVERPASS_API_URL")
    urls = [url for url in [overpass_url, env_url, *DEFAULT_OVERPASS_URLS] if url]
    seen_urls = []
    for url in urls:
        if url in seen_urls:
            continue
        seen_urls.append(url)
        payload = fetch_overpass(url, bbox)
        if payload:
            return payload, url
        time.sleep(0.4)
    return None, ""


def fetch_overpass(overpass_url: str, bbox: str) -> dict[str, Any] | None:
    query = f"""
    [out:json][timeout:25];
    (
      way["highway"~"^(motorway|trunk|primary|secondary|tertiary|unclassified|residential|service|living_street|motorway_link|trunk_link|primary_link|secondary_link|tertiary_link)$"]({bbox});
    );
    out body geom;
    """
    headers = {
        "Accept": "application/json",
        "User-Agent": "codex-challenge-road-risk-pipeline/1.0",
    }

    try:
        response = requests.post(overpass_url, data={"data": query}, headers=headers, timeout=45)
        if response.status_code == 406:
            response = requests.get(overpass_url, params={"data": query}, headers=headers, timeout=45)
        response.raise_for_status()
        return response.json()
    except requests.RequestException as exc:
        print(f"Overpass request failed gracefully at {overpass_url}: {exc}")
        return None


def fetch_osm_map_api(osm_api_url: str, bbox: str) -> tuple[str | None, str]:
    west, south, east, north = bbox_to_wsen(bbox)
    params = {"bbox": f"{west},{south},{east},{north}"}
    headers = {
        "Accept": "application/xml",
        "User-Agent": "codex-challenge-road-risk-pipeline/1.0",
    }

    try:
        response = requests.get(osm_api_url, params=params, headers=headers, timeout=60)
        response.raise_for_status()
        return response.text, f"{osm_api_url}?bbox={params['bbox']}"
    except requests.RequestException as exc:
        print(f"OSM map API request failed gracefully: {exc}")
        return None, ""


def normalize_overpass_roads(payload: dict[str, Any]) -> list[dict[str, Any]]:
    roads = []
    for element in payload.get("elements", []):
        if element.get("type") != "way":
            continue

        geometry = element.get("geometry") or []
        coordinates = [
            [float(point["lon"]), float(point["lat"])]
            for point in geometry
            if "lat" in point and "lon" in point
        ]
        if len(coordinates) < 2:
            continue

        tags = element.get("tags") or {}
        highway_type = tags.get("highway")
        if highway_type not in DRIVABLE_HIGHWAY_TYPES:
            continue
        latitudes = [coordinate[1] for coordinate in coordinates]
        longitudes = [coordinate[0] for coordinate in coordinates]
        roads.append(
            {
                "osm_id": str(element.get("id")),
                "name": tags.get("name"),
                "highway_type": highway_type,
                "latitude": mean(latitudes),
                "longitude": mean(longitudes),
                "geometry_geojson": {
                    "type": "LineString",
                    "coordinates": coordinates,
                },
            }
        )
    return roads


def normalize_osm_api_roads(xml_payload: str) -> list[dict[str, Any]]:
    root = ElementTree.fromstring(xml_payload)
    nodes: dict[str, tuple[float, float]] = {}
    for node in root.findall("node"):
        node_id = node.attrib.get("id")
        lat = node.attrib.get("lat")
        lon = node.attrib.get("lon")
        if not node_id or lat is None or lon is None:
            continue
        nodes[node_id] = (float(lat), float(lon))

    roads = []
    for way in root.findall("way"):
        tags = {tag.attrib.get("k"): tag.attrib.get("v") for tag in way.findall("tag")}
        highway_type = tags.get("highway")
        if highway_type not in DRIVABLE_HIGHWAY_TYPES:
            continue

        coordinates = []
        for nd in way.findall("nd"):
            ref = nd.attrib.get("ref")
            if ref not in nodes:
                continue
            lat, lon = nodes[ref]
            coordinates.append([lon, lat])

        if len(coordinates) < 2:
            continue

        latitudes = [coordinate[1] for coordinate in coordinates]
        longitudes = [coordinate[0] for coordinate in coordinates]
        roads.append(
            {
                "osm_id": str(way.attrib.get("id")),
                "name": tags.get("name"),
                "highway_type": highway_type,
                "latitude": mean(latitudes),
                "longitude": mean(longitudes),
                "geometry_geojson": {
                    "type": "LineString",
                    "coordinates": coordinates,
                },
            }
        )
    return roads


def bbox_from_pothole_file(path: Path, buffer_degrees: float) -> str | None:
    records = read_records(path, key="records")
    points = []
    for record in records:
        latitude = number_from(record, "latitude", "lat", "y")
        longitude = number_from(record, "longitude", "long", "lng", "x")
        if latitude is None or longitude is None:
            continue
        points.append((latitude, longitude))

    if not points:
        print(f"No coordinates found in {path}; using explicit/default bbox.")
        return None

    south = min(latitude for latitude, _ in points) - buffer_degrees
    north = max(latitude for latitude, _ in points) + buffer_degrees
    west = min(longitude for _, longitude in points) - buffer_degrees
    east = max(longitude for _, longitude in points) + buffer_degrees
    return f"{south:.6f},{west:.6f},{north:.6f},{east:.6f}"


def bboxes_around_pothole_file(
    path: Path,
    buffer_degrees: float,
    cluster_degrees: float,
    max_bboxes: int,
) -> list[str]:
    records = read_records(path, key="records")
    groups: dict[tuple[int, int], list[tuple[float, float]]] = {}
    for record in records:
        latitude = number_from(record, "latitude", "lat", "y")
        longitude = number_from(record, "longitude", "long", "lng", "x")
        if latitude is None or longitude is None:
            continue
        key = (
            round(latitude / cluster_degrees),
            round(longitude / cluster_degrees),
        )
        groups.setdefault(key, []).append((latitude, longitude))

    bboxes = []
    for points in groups.values():
        south = min(latitude for latitude, _ in points) - buffer_degrees
        north = max(latitude for latitude, _ in points) + buffer_degrees
        west = min(longitude for _, longitude in points) - buffer_degrees
        east = max(longitude for _, longitude in points) + buffer_degrees
        bboxes.append(f"{south:.6f},{west:.6f},{north:.6f},{east:.6f}")

    bboxes = sorted(set(bboxes))
    if len(bboxes) > max_bboxes:
        print(f"Created {len(bboxes)} bboxes; limiting to {max_bboxes}.")
        bboxes = bboxes[:max_bboxes]

    return bboxes


def combined_bbox(bboxes: list[str]) -> str:
    parsed = [[float(value.strip()) for value in bbox.split(",")] for bbox in bboxes]
    south = min(item[0] for item in parsed)
    west = min(item[1] for item in parsed)
    north = max(item[2] for item in parsed)
    east = max(item[3] for item in parsed)
    return f"{south:.6f},{west:.6f},{north:.6f},{east:.6f}"


def read_records(path: Path, key: str) -> list[dict[str, Any]]:
    if not path.exists():
        print(f"Input file not found: {path}")
        return []

    if path.suffix.lower() == ".csv":
        with path.open("r", encoding="utf-8", newline="") as file:
            return list(csv.DictReader(file))

    payload = json.loads(path.read_text(encoding="utf-8"))
    if isinstance(payload, list):
        return [item for item in payload if isinstance(item, dict)]
    if isinstance(payload, dict) and isinstance(payload.get(key), list):
        return [item for item in payload[key] if isinstance(item, dict)]
    return []


def dedupe_roads(roads: list[dict[str, Any]]) -> list[dict[str, Any]]:
    deduped = {}
    for road in roads:
        osm_id = road.get("osm_id")
        if osm_id:
            deduped[str(osm_id)] = road
    return list(deduped.values())


def bbox_to_wsen(bbox: str) -> tuple[float, float, float, float]:
    south, west, north, east = [float(value.strip()) for value in bbox.split(",")]
    return west, south, east, north


def value_from(record: dict[str, Any], *keys: str) -> Any:
    for key in keys:
        value = record.get(key)
        if value not in (None, ""):
            return value
    return None


def number_from(record: dict[str, Any], *keys: str) -> float | None:
    value = value_from(record, *keys)
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def write_output(
    path: Path,
    roads: list[dict[str, Any]],
    bbox: str,
    source_url: str,
    extra_metadata: dict[str, Any] | None = None,
) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    payload = {
        "source": "OpenStreetMap",
        "source_url": source_url,
        "bbox": bbox,
        "fetched_at": datetime.now(timezone.utc).isoformat(),
        "road_count": len(roads),
        "roads": roads,
    }
    if extra_metadata:
        payload.update(extra_metadata)
    path.write_text(json.dumps(payload, indent=2), encoding="utf-8")


if __name__ == "__main__":
    main()
