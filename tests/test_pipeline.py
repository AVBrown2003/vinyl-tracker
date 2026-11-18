"""Status file, GitHub Issue text and issue handling."""
import json

from conftest import payload

from tracker import build, pipeline
from tracker.items import ITEMS


def go(repo, date, body="keep"):
    if body != "keep":
        repo["body"] = body
    results = pipeline.run_sources(date)
    rows = build.build_history()
    build.write_history(rows)
    return results, rows


def test_status_has_every_key(repo):
    go(repo, "2026-03-01")
    results, rows = go(repo, "2026-03-02", payload({0: 10.0, 2: 5.0}))
    st = pipeline.make_status(rows, results, "2026-03-02T09:00:00Z", "2026-03-02")
    assert set(st) == {"run_time", "first_run_date", "days_with_success", "items", "new_today", "gone_today", "sources"}
    assert st["first_run_date"] == "2026-03-01" and st["days_with_success"] == 2
    assert st["items"] == 2 and st["new_today"] == 1 and st["gone_today"] == 1       # item 2 appeared, item 1 left
    assert st["sources"] == [{"name": "discogs", "ok": True, "count": 2}]


def test_status_counts_a_failed_source(repo):
    go(repo, "2026-03-01")
    results, rows = go(repo, "2026-03-02", None)
    st = pipeline.make_status(rows, results, "t", "2026-03-02")
    assert st["sources"] == [{"name": "discogs", "ok": False, "count": 0}]
    assert st["days_with_success"] == 1 and st["items"] == 0
    assert st["new_today"] == 0 and st["gone_today"] == 0           # a failed source is not "everything disappeared"


def test_issue_lists_biggest_moves_with_old_and_new_values(repo):
    go(repo, "2026-03-01", payload({0: 10.0, 1: 20.0}))
    results, rows = go(repo, "2026-03-02", payload({0: 15.0, 1: 20.0, 2: 7.0}))
    st = pipeline.make_status(rows, results, "2026-03-02T09:00:00Z", "2026-03-02")
    body = pipeline.issue_body(rows, "2026-03-02", st)
    assert "Biggest price moves since 2026-03-01" in body
    assert f"| {ITEMS[0].name} | $10.00 | $15.00 | +50.0% |" in body
    assert "## Biggest popularity gain since 2026-03-01" in body and "collectors" in body
    assert ITEMS[1].name not in body.split("## Appeared")[0].split("## Biggest popularity gain")[0]    # did not move
    assert f"- {ITEMS[2].name}" in body.split("## Appeared")[1]


def test_issue_on_a_day_with_no_changes_still_has_text(repo):
    go(repo, "2026-03-01")
    results, rows = go(repo, "2026-03-02")
    st = pipeline.make_status(rows, results, "2026-03-02T09:00:00Z", "2026-03-02")
    body = pipeline.issue_body(rows, "2026-03-02", st)
    assert "No record's lowest price moved." in body and "- none" in body


def test_issue_on_the_first_run_and_when_a_source_failed(repo):
    results, rows = go(repo, "2026-03-01", None)
    st = pipeline.make_status(rows, results, "t", "2026-03-01")
    body = pipeline.issue_body(rows, "2026-03-01", st)
    assert "Sources that failed today: discogs" in body and "nothing to compare" in body


def test_update_issues_opens_today_and_closes_older(monkeypatch):
    calls = []

    def fake_gh(*args, check=True):
        calls.append(args)
        if args[:2] == ("issue", "list"):
            return json.dumps([{"number": 3, "title": "2026-03-01"}, {"number": 2, "title": "2026-02-28"},
                               {"number": 9, "title": "not a date"}])
        return ""

    monkeypatch.setattr(pipeline, "gh", fake_gh)
    pipeline.update_issues("2026-03-02", "body")
    assert ("issue", "create", "--title", "2026-03-02", "--body", "body") in calls
    closed = [c[2] for c in calls if c[:2] == ("issue", "close")]
    assert sorted(closed) == ["2", "3"]


def test_a_second_run_updates_the_same_days_issue(monkeypatch):
    calls = []

    def fake_gh(*args, check=True):
        calls.append(args)
        return json.dumps([{"number": 7, "title": "2026-03-02"}]) if args[:2] == ("issue", "list") else ""

    monkeypatch.setattr(pipeline, "gh", fake_gh)
    pipeline.update_issues("2026-03-02", "new body")
    assert ("issue", "edit", "7", "--body", "new body") in calls
    assert not any(c[:2] == ("issue", "create") for c in calls) and not any(c[:2] == ("issue", "close") for c in calls)
