"""Conversion of the source (Discogs) to the common columns."""
import json

from conftest import entry, payload

from tracker import build, sources
from tracker.items import BY_ID, ITEMS


def test_at_least_ten_items_with_unique_keys():
    assert len(ITEMS) >= 10
    assert len({i.item_id for i in ITEMS}) == len(ITEMS)
    assert len({i.release_id for i in ITEMS}) == len(ITEMS)


def test_convert_gives_one_row_per_item_with_every_value():
    rows = sources.convert_discogs(json.loads(payload({0: 12.5, 1: 30.0})))
    assert [r["item_id"] for r in rows] == [ITEMS[0].item_id, ITEMS[1].item_id]
    r = rows[0]
    assert r["item"] == ITEMS[0].name
    assert (r["lowest_price"], r["num_for_sale"], r["have"], r["want"]) == (12.5, 5, 100, 20)
    assert (r["rating"], r["rating_votes"], r["year"], r["currency"]) == (4.5, 30, 2020, "USD")
    assert r["genre"] == "Rock" and r["format"] == "Vinyl, LP, Album" and r["country"] == "US"
    assert r["url"] == f"https://www.discogs.com/release/{ITEMS[0].release_id}"


def test_every_value_column_is_a_number():
    for row in sources.convert_discogs(json.loads(payload({0: 9.99}))):
        for col in sources.VALUE_COLUMNS:
            assert isinstance(row[col], (int, float)), col


def test_a_value_the_source_does_not_report_is_empty():
    doc = {"items": [entry(ITEMS[0], price=None), {"item_id": ITEMS[1].item_id, "stats": None, "release": None, "errors": ["x"]}]}
    rows = sources.convert_discogs(doc)
    assert rows[0]["lowest_price"] is None and rows[0]["have"] == 100
    assert rows[1]["lowest_price"] is None and rows[1]["have"] is None and rows[1]["item"] == ITEMS[1].name


def test_unknown_item_is_ignored():
    doc = {"items": [{"item_id": "not-a-tracked-record", "stats": {}, "release": {}}]}
    assert sources.convert_discogs(doc) == []


def test_history_columns_start_with_the_four_fixed_ones():
    assert build.COLUMNS[:4] == ["date", "item_id", "item", "source"]
    assert {"lowest_price", "num_for_sale", "have", "want"} <= set(build.COLUMNS)
    assert set(build.COLUMNS) >= {"artist", "album", "year", "genre", "currency", "url"}


def test_every_item_id_is_known():
    assert set(BY_ID) == {i.item_id for i in ITEMS}


def test_raw_file_round_trip():
    body = payload({0: 11.0})
    rows = sources.load_rows("discogs", sources.compress(body))
    assert rows[0]["lowest_price"] == 11.0
    assert sources.compress(body) == sources.compress(body)       # same input, same bytes
