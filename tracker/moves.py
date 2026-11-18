"""The move rule, and what appeared or disappeared, between one run and the previous one.

Move rule: for each record, the percent change of its lowest asking price (lowest_price)
from the previous run to this run, (new - old) / old * 100. Only records with a price on
both days count. The records are ranked by the size of the change, ignoring the sign, and the
GitHub Issue lists the TOP_MOVES biggest. A record whose price did not change is not a move.

The "previous run" is the latest earlier date that has rows in the history, so a day when the
source failed (no raw file) is skipped.
"""
from __future__ import annotations

TOP_MOVES = 5
MOVE_COLUMN = "lowest_price"


def pct_change(old, new) -> float | None:
    if old is None or new is None or old == 0:
        return None
    return (new - old) / old * 100.0


def previous_date(rows: list[dict], date: str) -> str | None:
    earlier = {r["date"] for r in rows if r["date"] < date}
    return max(earlier) if earlier else None


def collector_gains(rows: list[dict], date: str) -> dict:
    """The records that gained the most collectors (`have`) since the previous run.

    Discogs does not publish sales. The closest signal it gives is how many collectors say they
    own a record, so the "top seller" is the record whose `have` rose the most between the previous
    run and this run: gain = have_now - have_before. Records without a count on both days do not count.
    """
    today = {r["item_id"]: r for r in rows if r["date"] == date}
    prev_day = previous_date(rows, date)
    if not today or prev_day is None:
        return {"previous": prev_day, "gains": []}
    before = {r["item_id"]: r for r in rows if r["date"] == prev_day}
    gains = []
    for item_id, now in today.items():
        old = before.get(item_id)
        if old is None or old.get("have") is None or now.get("have") is None:
            continue
        gains.append({"item_id": item_id, "item": now["item"], "old": old["have"], "new": now["have"],
                      "gain": now["have"] - old["have"]})
    gains.sort(key=lambda g: (-g["gain"], g["item_id"]))
    return {"previous": prev_day, "gains": gains}


def compare(rows: list[dict], date: str, top: int = TOP_MOVES) -> dict:
    """What changed on `date` compared with the previous run.

    Returns {"previous": date or None, "moves": [...], "appeared": [...], "disappeared": [...]}.
    """
    today = {r["item_id"]: r for r in rows if r["date"] == date}
    prev_day = previous_date(rows, date)
    if not today or prev_day is None:
        return {"previous": prev_day, "moves": [], "appeared": [], "disappeared": []}
    before = {r["item_id"]: r for r in rows if r["date"] == prev_day}

    moves = []
    for item_id, new in today.items():
        old = before.get(item_id)
        if old is None:
            continue
        change = pct_change(old.get(MOVE_COLUMN), new.get(MOVE_COLUMN))
        if change:
            moves.append({
                "item_id": item_id, "item": new["item"],
                "old": old[MOVE_COLUMN], "new": new[MOVE_COLUMN], "pct": change,
                "old_for_sale": old.get("num_for_sale"), "new_for_sale": new.get("num_for_sale"),
            })
    moves.sort(key=lambda m: (-abs(m["pct"]), m["item_id"]))
    return {
        "previous": prev_day,
        "moves": moves[:top],
        "appeared": sorted((today[i]["item"] for i in today if i not in before)),
        "disappeared": sorted((before[i]["item"] for i in before if i not in today)),
    }
