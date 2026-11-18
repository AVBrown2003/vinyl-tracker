"""Build data/history.csv from the raw files alone.

    python -m tracker.build

The history depends only on data/raw/<date>/<source>.<format>.gz, so running it again gives
the same file, and a change to the conversion applies to every day of the history.
Rows are sorted by date, then by item_id.
"""
from __future__ import annotations

import csv
import re
import sys
from pathlib import Path

from . import sources

ROOT = Path(__file__).resolve().parent.parent
RAW_DIR = ROOT / "data" / "raw"
HISTORY_CSV = ROOT / "data" / "history.csv"

# date, item_id, item and source come first; then the numeric values; then the descriptive columns
COLUMNS = ["date", "item_id", "item", "source"] + sources.VALUE_COLUMNS + ["currency"] + [
    c for c in sources.EXTRA_COLUMNS if c != "currency"]
NUMERIC = set(sources.VALUE_COLUMNS) | {"year", "release_id"}

DATE_RE = re.compile(r"^\d{4}-\d{2}-\d{2}$")


def raw_files(raw_dir: Path | None = None) -> dict[str, dict[str, Path]]:
    """{date: {source_name: path}} for every raw file of a known source."""
    raw_dir = raw_dir or RAW_DIR
    found: dict[str, dict[str, Path]] = {}
    if not raw_dir.exists():
        return found
    for day_dir in sorted(raw_dir.iterdir()):
        if not (day_dir.is_dir() and DATE_RE.match(day_dir.name)):
            continue
        for src in sources.SOURCES:
            path = day_dir / f"{src.name}.{src.format}.gz"
            if path.exists():
                found.setdefault(day_dir.name, {})[src.name] = path
    return found


def build_history(raw_dir: Path | None = None) -> list[dict]:
    """One row per item per source per day, converted from the raw files, sorted by date then item_id."""
    rows: dict[tuple, dict] = {}
    for date, by_source in raw_files(raw_dir).items():
        for name, path in by_source.items():
            for row in sources.load_rows(name, path.read_bytes()):
                row = dict(row, date=date, source=name)
                rows[(date, row["item_id"], name)] = row      # a repeated item in one file keeps the last
    return [rows[k] for k in sorted(rows)]


def _fmt(value) -> str:
    if value is None:
        return ""
    if isinstance(value, float):
        return str(int(value)) if value.is_integer() else repr(value)
    return str(value)


def write_history(rows: list[dict], path: Path | None = None) -> None:
    path = path or HISTORY_CSV
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", newline="", encoding="utf-8") as fh:
        writer = csv.writer(fh, lineterminator="\n")
        writer.writerow(COLUMNS)
        for row in rows:
            writer.writerow([_fmt(row.get(c)) for c in COLUMNS])


def read_history(path: Path | None = None) -> list[dict]:
    """Read history.csv back into rows with numbers as numbers and missing values as None."""
    path = path or HISTORY_CSV
    rows = []
    with path.open(newline="", encoding="utf-8") as fh:
        for rec in csv.DictReader(fh):
            row = {}
            for key, text in rec.items():
                if text == "":
                    row[key] = None
                elif key in NUMERIC:
                    row[key] = float(text) if "." in text else int(text)
                else:
                    row[key] = text
            rows.append(row)
    return rows


def main() -> int:
    rows = build_history()
    write_history(rows)
    days = len({r["date"] for r in rows})
    print(f"wrote {HISTORY_CSV} : {len(rows)} rows, {days} days")
    return 0


if __name__ == "__main__":
    sys.exit(main())
