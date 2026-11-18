"""History logic: raw files in, history out; a failed day; a second run on the same day."""
from conftest import payload

from tracker import build, pipeline
from tracker.items import ITEMS


def run(date):
    return pipeline.run_sources(date)


def test_history_has_one_row_per_item_per_day_sorted_by_date_then_item_id(repo):
    repo["body"] = payload({1: 20.0, 0: 10.0})
    run("2026-02-02")
    repo["body"] = payload({0: 11.0, 1: 21.0})
    run("2026-02-01")
    rows = build.build_history()
    assert [(r["date"], r["item_id"]) for r in rows] == sorted(
        [("2026-02-01", ITEMS[0].item_id), ("2026-02-01", ITEMS[1].item_id),
         ("2026-02-02", ITEMS[0].item_id), ("2026-02-02", ITEMS[1].item_id)])
    assert all(r["source"] == "discogs" for r in rows)


def test_building_again_gives_the_same_file(repo):
    run("2026-02-01")
    repo["body"] = payload({0: 12.0, 1: 22.0})
    run("2026-02-02")
    build.write_history(build.build_history())
    first = build.HISTORY_CSV.read_bytes()
    build.write_history(build.build_history())
    assert build.HISTORY_CSV.read_bytes() == first


def test_a_day_with_no_raw_file_has_no_rows(repo):
    run("2026-02-01")
    repo["body"] = None                              # the source is down on the 2nd
    results = run("2026-02-02")
    assert results[0]["ok"] is False and "down" in results[0]["error"]
    assert not (build.RAW_DIR / "2026-02-02" / "discogs.json.gz").exists()
    assert (build.RAW_DIR / "2026-02-02" / "results.json").exists()      # the failure is still recorded
    assert {r["date"] for r in build.build_history()} == {"2026-02-01"}


def test_a_second_run_on_the_same_day_replaces_the_day(repo):
    repo["body"] = payload({0: 10.0, 1: 20.0})
    run("2026-02-01")
    repo["body"] = payload({0: 99.0})                # the later run: a different answer
    run("2026-02-01")
    rows = build.build_history()
    assert [(r["item_id"], r["lowest_price"]) for r in rows] == [(ITEMS[0].item_id, 99.0)]
    assert len(build.raw_files()["2026-02-01"]) == 1  # still one raw file for the day


def test_a_second_run_that_fails_removes_that_days_old_raw_file(repo):
    run("2026-02-01")
    repo["body"] = None
    run("2026-02-01")
    assert build.build_history() == []


def test_a_rule_change_applies_to_every_day(repo, monkeypatch):
    run("2026-02-01")
    run("2026-02-02")
    from tracker import sources
    original = sources.convert_discogs
    src = sources.SOURCES[0]
    monkeypatch.setattr(src, "convert", lambda doc: [dict(r, lowest_price=1.0) for r in original(doc)])
    assert {r["lowest_price"] for r in build.build_history()} == {1.0}


def test_write_and_read_history_keep_empty_values_empty(repo):
    repo["body"] = payload({0: None, 1: 20.0})
    run("2026-02-01")
    build.write_history(build.build_history())
    text = build.HISTORY_CSV.read_text(encoding="utf-8")
    assert text.splitlines()[0].split(",")[:4] == ["date", "item_id", "item", "source"]
    rows = {r["item_id"]: r for r in build.read_history()}
    assert rows[ITEMS[0].item_id]["lowest_price"] is None and rows[ITEMS[1].item_id]["lowest_price"] == 20
    assert rows[ITEMS[0].item_id]["have"] == 100


def test_unknown_folders_and_files_are_ignored(repo):
    run("2026-02-01")
    (build.RAW_DIR / "notes").mkdir()
    (build.RAW_DIR / "2026-02-01" / "other.json.gz").write_bytes(b"junk")
    assert list(build.raw_files()) == ["2026-02-01"]
