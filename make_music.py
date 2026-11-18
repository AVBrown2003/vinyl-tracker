"""Choose the song the "listen while you scroll" player plays for each record.

    python make_music.py

For every record in tracker/items.py:
  1. read its Discogs videos from the latest raw file in data/raw/
  2. rank the album's songs with the public Deezer API (no login)
  3. pick the most popular song that has a Discogs video (tracker/music.py)
  4. ask YouTube's oEmbed whether that video may be embedded; if not, try the next one
and write assets/music.json. Run it again whenever the list of records changes. It is not part of
the daily pipeline, so the daily run does not depend on Deezer or YouTube.
"""
from __future__ import annotations

import gzip
import json
import re
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

from tracker import build, music
from tracker.items import ITEMS

OUT = Path(__file__).parent / "assets" / "music.json"
UA = "VinylVault/1.0 (FDA class project)"
PAUSE = 0.35


def get_json(url: str, tries: int = 4):
    for attempt in range(tries):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": UA})
            with urllib.request.urlopen(req, timeout=25) as resp:
                return json.load(resp)
        except urllib.error.HTTPError as exc:
            if exc.code in (401, 403, 404):
                return None
            time.sleep(2 * (attempt + 1))
        except Exception:  # noqa: BLE001
            time.sleep(2 * (attempt + 1))
    return None


def embeddable(video: str) -> bool:
    """YouTube's oEmbed answers 200 only for videos that exist and allow embedding."""
    url = "https://www.youtube.com/oembed?format=json&url=" + urllib.parse.quote(f"https://www.youtube.com/watch?v={video}", safe="")
    try:
        with urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": UA}), timeout=20) as resp:
            return resp.status == 200
    except Exception:  # noqa: BLE001
        return False


def deezer_tracks(artist: str, album: str) -> list[dict]:
    """The album's songs with Deezer's popularity rank.

    Deezer gives each edition of an album (standard, remastered, deluxe) its own rank for a song, and a
    single edition can mislead, so up to four editions are read and a song keeps its highest rank."""
    albums = []
    for q in (f'artist:"{artist}" album:"{album}"', f"{artist} {album}"):          # exact first, then loose
        found = get_json("https://api.deezer.com/search/album?limit=10&q=" + urllib.parse.quote(q))
        time.sleep(PAUSE)
        albums = (found or {}).get("data") or []
        if albums:
            break
    if not albums:
        return []
    wanted = music.norm(album)
    skip_words = re.compile(r"\b(live|tribute|karaoke|instrumental|covers?)\b")
    editions = [a for a in albums if wanted and wanted in music.norm(a.get("title", "")) and not skip_words.search(a.get("title", "").lower())] or albums[:1]
    editions.sort(key=lambda a: len(a.get("title", "")))                       # the plainest title first
    best: dict[str, dict] = {}
    for edition in editions[:4]:
        data = get_json(f"https://api.deezer.com/album/{edition['id']}/tracks?limit=100")
        time.sleep(PAUSE)
        for t in (data or {}).get("data", []):
            key = music.norm(t["title"])
            if key not in best:
                best[key] = {"title": t["title"], "rank": t.get("rank", 0)}
            else:
                best[key]["rank"] = max(best[key]["rank"], t.get("rank", 0))
    return list(best.values())


LONG_VIDEO_SECONDS = 15 * 60


def label_long_videos(out: dict, videos_by_item: dict) -> None:
    """A fallback video longer than 15 minutes is a whole-album upload: say so instead of naming a song."""
    for item_id, entry in out.items():
        if entry["how"] != "listed":
            continue
        for v in videos_by_item.get(item_id, []):
            if music.video_id(v.get("uri", "")) == entry["video"] and (v.get("duration") or 0) > LONG_VIDEO_SECONDS:
                entry["song"] = f"{entry['album']} (full album)"
                entry["how"] = "album"


def load_videos() -> dict:
    days = build.raw_files()
    latest = max(days)
    payload = json.loads(gzip.decompress(days[latest]["discogs"].read_bytes()))
    return {e["item_id"]: ((e.get("release") or {}).get("videos") or []) for e in payload["items"]}


def main() -> int:
    if "--relabel" in sys.argv:                                 # only redo the labels of the existing file
        out = json.loads(OUT.read_text(encoding="utf-8"))
        label_long_videos(out, load_videos())
        OUT.write_text(json.dumps(out, indent=1, ensure_ascii=False) + "\n", encoding="utf-8")
        print("relabelled", sum(1 for e in out.values() if e["how"] == "album"), "full-album videos")
        return 0
    if not build.raw_files():
        print("no raw files")
        return 1
    videos_by_item = load_videos()

    out, counts = {}, {"top": 0, "popular": 0, "listed": 0, "none": 0}
    for item in ITEMS:
        videos = videos_by_item.get(item.item_id, [])
        tracks = deezer_tracks(item.artist, item.album) if videos else []
        skip: set[str] = set()
        choice = None
        for _ in range(6):                                     # try the next best when a video cannot be embedded
            choice = music.pick(tracks, videos, skip)
            if choice is None or embeddable(choice["video"]):
                break
            skip.add(choice["video"])
            choice = None
        time.sleep(PAUSE)
        if choice is None:
            counts["none"] += 1
            print("NONE ", item.name)
            continue
        counts[choice["how"]] += 1
        out[item.item_id] = {"item": item.name, "artist": item.artist, "album": item.album, **choice}
        print(f"{choice['how']:8}", item.name, "->", choice["song"], "|", choice["video"])
    label_long_videos(out, videos_by_item)
    OUT.parent.mkdir(exist_ok=True)
    OUT.write_text(json.dumps(out, indent=1, ensure_ascii=False) + "\n", encoding="utf-8")
    print("wrote", OUT, len(out), "records", counts)
    return 0


if __name__ == "__main__":
    sys.exit(main())
