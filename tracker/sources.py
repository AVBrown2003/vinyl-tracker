"""The data source: the public Discogs database API (JSON, no login).

For every tracked record the tool makes two calls and keeps both answers exactly as Discogs
sent them:

    GET https://api.discogs.com/marketplace/stats/<release_id>   copies for sale and the lowest asking price
    GET https://api.discogs.com/releases/<release_id>             collectors who have it / want it, rating, details

The answers for all records are put in one JSON document (one raw file per day,
data/raw/<date>/discogs.json.gz). Discogs allows 25 calls a minute without a login, so
the calls are paced. If the repository has a secret named DISCOGS_TOKEN it is sent as a
header to get a higher limit; it is optional and never written to any file.
"""
from __future__ import annotations

import gzip
import json
import os
import time
import urllib.error
import urllib.request
from dataclasses import dataclass
from typing import Callable

from .items import BY_ID, ITEMS

API = "https://api.discogs.com"
USER_AGENT = "VinylTracker/1.0 (FDA class project; +https://github.com/AVBrown2003/vinyl-tracker)"
PAUSE = 2.6          # seconds between calls: stays under 25 calls a minute
MIN_OK_SHARE = 0.5   # the source counts as failed if fewer than half of the records came back

# the columns every source converts to (after date, item_id, item and source)
VALUE_COLUMNS = ["lowest_price", "num_for_sale", "have", "want", "rating", "rating_votes"]
EXTRA_COLUMNS = ["artist", "album", "year", "genre", "format", "country", "release_id", "currency", "url", "cover"]


@dataclass
class Source:
    name: str
    format: str                       # file ending of the raw file: <name>.<format>.gz
    fetch: Callable[[], bytes]
    convert: Callable[[dict], list[dict]]


def _get_json(url: str, timeout: int = 30, attempts: int = 4) -> dict:
    """One Discogs call, with a wait and retry when told to slow down."""
    headers = {"User-Agent": USER_AGENT, "Accept": "application/json"}
    token = os.environ.get("DISCOGS_TOKEN")
    if token:
        headers["Authorization"] = f"Discogs token={token}"
    last: Exception | None = None
    for attempt in range(attempts):
        try:
            req = urllib.request.Request(url, headers=headers)
            with urllib.request.urlopen(req, timeout=timeout) as resp:
                return json.load(resp)
        except urllib.error.HTTPError as exc:
            last = exc
            if exc.code == 429:                              # rate limit: wait out the minute
                time.sleep(float(exc.headers.get("Retry-After", 30)) + 2)
            elif exc.code in (404, 410):
                raise
            else:
                time.sleep(3 * (attempt + 1))
        except Exception as exc:  # noqa: BLE001 - timeouts and resets are retried
            last = exc
            time.sleep(3 * (attempt + 1))
    raise RuntimeError(f"{url}: {last}")


def fetch_discogs(pause: float = PAUSE) -> bytes:
    """Download both answers for every tracked record; return one JSON document."""
    entries = []
    for item in ITEMS:
        entry = {"item_id": item.item_id, "release_id": item.release_id, "stats": None, "release": None, "errors": []}
        for key, path in (("stats", f"/marketplace/stats/{item.release_id}"), ("release", f"/releases/{item.release_id}")):
            try:
                entry[key] = _get_json(API + path)
            except Exception as exc:  # noqa: BLE001 - one record failing must not stop the others
                entry["errors"].append(f"{key}: {str(exc)[:160]}")
            time.sleep(pause)
        entries.append(entry)
    good = sum(1 for e in entries if e["stats"] and e["release"])
    if good < len(entries) * MIN_OK_SHARE:
        raise RuntimeError(f"only {good} of {len(entries)} records came back")
    return json.dumps({"items": entries}).encode()


def _number(value) -> float | int | None:
    return value if isinstance(value, (int, float)) and not isinstance(value, bool) else None


def convert_discogs(payload: dict) -> list[dict]:
    """One row per tracked record with the common columns. A value Discogs did not report is None."""
    rows = []
    for entry in payload.get("items", []):
        item = BY_ID.get(entry.get("item_id"))
        if item is None:
            continue
        stats = entry.get("stats") or {}
        release = entry.get("release") or {}
        community = release.get("community") or {}
        rating = community.get("rating") or {}
        low = stats.get("lowest_price") or {}
        images = release.get("images") or [{}]
        formats = release.get("formats") or [{}]
        genres = release.get("genres") or []
        rows.append({
            "item_id": item.item_id,
            "item": item.name,
            "artist": item.artist,
            "album": item.album,
            "year": _number(release.get("year")),
            "genre": genres[0] if genres else None,
            "format": ", ".join([formats[0].get("name", "")] + list(formats[0].get("descriptions") or [])).strip(", ") or None,
            "country": release.get("country"),
            "release_id": item.release_id,
            "url": f"https://www.discogs.com/release/{item.release_id}",
            "cover": release.get("thumb") or images[0].get("uri150") or None,
            "lowest_price": _number(low.get("value")),
            "currency": low.get("currency"),
            "num_for_sale": _number(stats.get("num_for_sale")),
            "have": _number(community.get("have")),
            "want": _number(community.get("want")),
            "rating": _number(rating.get("average")),
            "rating_votes": _number(rating.get("count")),
        })
    return rows


SOURCES = [Source("discogs", "json", fetch_discogs, convert_discogs)]
BY_NAME = {s.name: s for s in SOURCES}


def compress(body: bytes) -> bytes:
    # mtime=0 so identical content gives identical bytes
    return gzip.compress(body, compresslevel=9, mtime=0)


def load_rows(source_name: str, gz_bytes: bytes) -> list[dict]:
    payload = json.loads(gzip.decompress(gz_bytes))
    return BY_NAME[source_name].convert(payload)
