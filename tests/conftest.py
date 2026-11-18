import json
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from tracker import build, pipeline, sources  # noqa: E402
from tracker.items import ITEMS  # noqa: E402


def entry(item, price=10.0, for_sale=5, have=100, want=20, rating=4.5, votes=30, year=2020, currency="USD"):
    """What the source sends for one record (the parts the converter reads)."""
    return {
        "item_id": item.item_id, "release_id": item.release_id, "errors": [],
        "stats": {"num_for_sale": for_sale, "blocked_from_sale": False,
                  "lowest_price": None if price is None else {"value": price, "currency": currency}},
        "release": {"year": year, "country": "US", "genres": ["Rock"], "thumb": f"https://i.discogs.com/cover-{item.release_id}.jpeg",
                    "formats": [{"name": "Vinyl", "descriptions": ["LP", "Album"]}],
                    "community": {"have": have, "want": want, "rating": {"average": rating, "count": votes}}},
    }


def payload(prices: dict[int, float | None]) -> bytes:
    """Raw source document for records ITEMS[i] with the given lowest prices."""
    return json.dumps({"items": [entry(ITEMS[i], price=p) for i, p in prices.items()]}).encode()


@pytest.fixture
def repo(tmp_path, monkeypatch):
    """Point the tracker at an empty data folder, with one fake source whose answer the test sets."""
    monkeypatch.setattr(build, "RAW_DIR", tmp_path / "raw")
    monkeypatch.setattr(build, "HISTORY_CSV", tmp_path / "history.csv")
    monkeypatch.setattr(pipeline, "STATUS_JSON", tmp_path / "status.json")
    state = {"body": payload({0: 10.0, 1: 20.0})}

    def fetch():
        if state["body"] is None:
            raise RuntimeError("source is down")
        return state["body"]

    fake = sources.Source("discogs", "json", fetch, sources.convert_discogs)
    monkeypatch.setattr(sources, "SOURCES", [fake])
    monkeypatch.setattr(sources, "BY_NAME", {"discogs": fake})
    return state
