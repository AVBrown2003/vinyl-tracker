"""The daily run.

    python -m tracker.pipeline [--no-issues] [--date YYYY-MM-DD]

1. call every source and save data/raw/<date>/<source>.<format>.gz (a failing source
   writes no raw file; the result of every source goes in results.json)
2. build data/history.csv from the raw files
3. write data/status.json
4. open the day's GitHub Issue (the biggest moves, what appeared or disappeared)
   and close the previous day's
The workflow then commits data/.
"""
from __future__ import annotations

import argparse
import json
import shutil
import subprocess
import sys
from datetime import datetime, timezone

from . import build, moves, sources

STATUS_JSON = build.ROOT / "data" / "status.json"


def run_sources(date: str) -> list[dict]:
    """Fetch every source; return [{name, ok, count, error?}]. Replaces the day's raw files."""
    day_dir = build.RAW_DIR / date
    if day_dir.exists():
        shutil.rmtree(day_dir)
    day_dir.mkdir(parents=True)
    results = []
    for src in sources.SOURCES:
        try:
            body = src.fetch()
            count = len(src.convert(json.loads(body)))
            (day_dir / f"{src.name}.{src.format}.gz").write_bytes(sources.compress(body))
            results.append({"name": src.name, "ok": True, "count": count})
        except Exception as exc:  # noqa: BLE001 - one source failing must not stop the run
            results.append({"name": src.name, "ok": False, "count": 0, "error": str(exc)[:300]})
    (day_dir / "results.json").write_text(json.dumps(results, indent=2) + "\n", encoding="utf-8")
    return results


def make_status(rows: list[dict], results: list[dict], run_time: str, date: str) -> dict:
    files = build.raw_files()
    changes = moves.compare(rows, date)
    return {
        "run_time": run_time,
        "first_run_date": min(files) if files else date,
        "days_with_success": len(files),
        "items": len({r["item_id"] for r in rows if r["date"] == date}),
        "new_today": len(changes["appeared"]),
        "gone_today": len(changes["disappeared"]),
        "sources": [{"name": r["name"], "ok": r["ok"], "count": r["count"]} for r in results],
    }


def _price(value) -> str:
    return "-" if value is None else f"${value:,.2f}"


def issue_body(rows: list[dict], date: str, status: dict) -> str:
    changes = moves.compare(rows, date)
    failed = [s["name"] for s in status["sources"] if not s["ok"]]
    out = [f"Run {status['run_time']} UTC. {status['items']} items, "
           f"{status['new_today']} appeared, {status['gone_today']} disappeared."]
    if failed:
        out.append(f"Sources that failed today: {', '.join(failed)}.")
    if changes["previous"] is None:
        out += ["", "This is the first run with data, so there is nothing to compare yet."]
    else:
        out += ["", f"## Biggest price moves since {changes['previous']}",
                f"Rule: percent change of the lowest asking price, top {moves.TOP_MOVES}.", ""]
        if changes["moves"]:
            out += ["| Record | Old price | New price | Change | Copies for sale |", "|---|---|---|---|---|"]
            for m in changes["moves"]:
                out.append(f"| {m['item']} | {_price(m['old'])} | {_price(m['new'])} | {m['pct']:+.1f}% | "
                           f"{m['old_for_sale'] if m['old_for_sale'] is not None else '-'} to "
                           f"{m['new_for_sale'] if m['new_for_sale'] is not None else '-'} |")
        else:
            out.append("No record's lowest price moved.")
        gains = moves.collector_gains(rows, date)["gains"]
        out += ["", f"## Biggest popularity gain since {changes['previous']}",
                "Popularity is counted in collectors: the record that gained the most collectors who say they have it."]
        if gains and gains[0]["gain"] > 0:
            g = gains[0]
            out.append(f"**{g['item']}**: +{g['gain']:,} collectors ({g['old']:,} to {g['new']:,}).")
        else:
            out.append("No record gained collectors.")
        out += ["", f"## Appeared ({len(changes['appeared'])})", *([f"- {n}" for n in changes["appeared"]] or ["- none"]),
                "", f"## Disappeared ({len(changes['disappeared'])})", *([f"- {n}" for n in changes["disappeared"]] or ["- none"])]
    return "\n".join(out)


def gh(*args: str, check: bool = True) -> str:
    proc = subprocess.run(["gh", *args], capture_output=True, text=True)
    if check and proc.returncode != 0:
        raise RuntimeError(f"gh {' '.join(args)}: {proc.stderr.strip()}")
    return proc.stdout


def update_issues(date: str, body: str) -> None:
    """Open (or update) today's issue; close every older date-titled issue."""
    issues = json.loads(gh("issue", "list", "--state", "open", "--limit", "100", "--json", "number,title"))
    today = [i for i in issues if i["title"] == date]
    if today:
        gh("issue", "edit", str(today[0]["number"]), "--body", body)
    else:
        gh("issue", "create", "--title", date, "--body", body)
    for issue in issues:
        title = issue["title"]
        if title != date and build.DATE_RE.match(title) and title < date:
            gh("issue", "close", str(issue["number"]), "--comment", f"Superseded by {date}.")


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--no-issues", action="store_true")
    parser.add_argument("--date", help="override the UTC date (testing only)")
    args = parser.parse_args(argv)

    now = datetime.now(timezone.utc)
    date = args.date or now.strftime("%Y-%m-%d")
    run_time = now.strftime("%Y-%m-%dT%H:%M:%SZ")

    results = run_sources(date)
    for r in results:
        print(("ok  " if r["ok"] else "FAIL"), r["name"], r["count"], r.get("error", ""))

    rows = build.build_history()
    build.write_history(rows)
    status = make_status(rows, results, run_time, date)
    STATUS_JSON.write_text(json.dumps(status, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(status))

    if not args.no_issues:
        update_issues(date, issue_body(rows, date, status))
    return 0


if __name__ == "__main__":
    sys.exit(main())
