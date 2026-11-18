"""The move rule and appeared/disappeared."""
from tracker import moves


def row(date, item_id, price, for_sale=5):
    return {"date": date, "item_id": item_id, "item": item_id.upper(), "lowest_price": price, "num_for_sale": for_sale}


def test_pct_change():
    assert moves.pct_change(10, 12) == 20.0
    assert moves.pct_change(10, 5) == -50.0
    assert moves.pct_change(0, 5) is None and moves.pct_change(None, 5) is None and moves.pct_change(5, None) is None


def test_biggest_moves_are_ranked_by_size_ignoring_sign():
    rows = [row("d1", "a", 10), row("d1", "b", 10), row("d1", "c", 10), row("d1", "d", 10),
            row("d2", "a", 11), row("d2", "b", 5), row("d2", "c", 10), row("d2", "d", 13)]
    out = moves.compare(rows, "d2")
    assert out["previous"] == "d1"
    assert [m["item_id"] for m in out["moves"]] == ["b", "d", "a"]          # -50%, +30%, +10%; c did not move
    assert out["moves"][0]["pct"] == -50.0
    assert (out["moves"][0]["old"], out["moves"][0]["new"]) == (10, 5)


def test_only_the_top_moves_are_listed():
    rows = [row("d1", str(i), 10) for i in range(9)] + [row("d2", str(i), 10 + i + 1) for i in range(9)]
    assert len(moves.compare(rows, "d2")["moves"]) == moves.TOP_MOVES
    assert [m["item_id"] for m in moves.compare(rows, "d2", top=2)["moves"]] == ["8", "7"]


def test_an_item_without_a_price_on_either_day_is_not_a_move():
    rows = [row("d1", "a", None), row("d1", "b", 10), row("d2", "a", 5), row("d2", "b", None)]
    assert moves.compare(rows, "d2")["moves"] == []


def test_appeared_and_disappeared():
    rows = [row("d1", "a", 1), row("d1", "b", 1), row("d2", "b", 1), row("d2", "c", 1)]
    out = moves.compare(rows, "d2")
    assert out["appeared"] == ["C"] and out["disappeared"] == ["A"]


def hrow(date, item_id, have):
    return {"date": date, "item_id": item_id, "item": item_id.upper(), "have": have}


def test_top_seller_is_the_record_that_gained_the_most_collectors():
    rows = [hrow("d1", "a", 100), hrow("d1", "b", 50), hrow("d1", "c", None),
            hrow("d2", "a", 110), hrow("d2", "b", 90), hrow("d2", "c", 70), hrow("d2", "d", 5)]
    out = moves.collector_gains(rows, "d2")
    assert out["previous"] == "d1"
    assert [(g["item_id"], g["gain"]) for g in out["gains"]] == [("b", 40), ("a", 10)]   # c had no count before, d is new


def test_top_seller_needs_a_previous_run():
    assert moves.collector_gains([hrow("d1", "a", 1)], "d1") == {"previous": None, "gains": []}


def test_first_run_has_nothing_to_compare():
    out = moves.compare([row("d1", "a", 1)], "d1")
    assert out == {"previous": None, "moves": [], "appeared": [], "disappeared": []}


def test_previous_run_skips_a_day_with_no_rows():
    rows = [row("2026-01-01", "a", 10), row("2026-01-03", "a", 20)]      # nothing on the 2nd
    out = moves.compare(rows, "2026-01-03")
    assert out["previous"] == "2026-01-01" and out["moves"][0]["pct"] == 100.0


def test_a_day_with_no_rows_reports_no_changes():
    rows = [row("d1", "a", 10)]
    out = moves.compare(rows, "d2")
    assert out["moves"] == [] and out["disappeared"] == [] and out["appeared"] == []
