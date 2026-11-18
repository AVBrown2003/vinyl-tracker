"""Pick each album's most popular song that has a YouTube video on its Discogs page.

Discogs lists YouTube videos on a release (the `videos` list in the data we download every day)
but does not say which song is popular. Deezer's public API ranks every song of an album, so:

    1. rank the album's songs by Deezer popularity (high to low)
    2. take the highest-ranked song that matches one of the Discogs videos
    3. if no song matches, fall back to the first suitable Discogs video

make_music.py runs this once for every record and writes assets/music.json, which the
"listen while you scroll" player on the site reads. Nothing here runs in the daily pipeline.
"""
from __future__ import annotations

import re
from urllib.parse import parse_qs, urlparse

# words in a video title that suggest it is not the studio song
UNWANTED = ("live", "interview", "reaction", "cover", "tutorial", "behind the scenes", "making of",
            "snippet", "teaser", "trailer", "performance", "session", "acoustic", "remix", "karaoke", "instrumental")


def norm(text: str, drop_feat: bool = True) -> str:
    """Lowercase, drop (brackets) and [brackets], punctuation to spaces.

    drop_feat also cuts a trailing 'feat. Someone' from a song name (not wanted for video titles,
    where the song often comes after the guest: 'Taylor Swift ft. Ice Spice - Karma')."""
    t = (text or "").lower().replace(chr(0x2019), "'")
    t = re.sub(r"\([^)]*\)|\[[^\]]*\]", " ", t)
    if drop_feat:
        t = re.sub(r"\b(feat|ft|featuring)\b.*$", " ", t)
    t = t.replace("'", "")
    t = re.sub(r"[^a-z0-9]+", " ", t)
    return re.sub(r"\s+", " ", t).strip()


def video_id(uri: str) -> str | None:
    """The YouTube id in a watch or youtu.be link."""
    if not uri:
        return None
    parsed = urlparse(uri)
    if "youtu.be" in parsed.netloc:
        return parsed.path.strip("/") or None
    ids = parse_qs(parsed.query).get("v")
    return ids[0] if ids else None


def video_score(song: str, title: str) -> int | None:
    """How good a match a video title is for a song.

    None when the song is not in the title, or when the video looks like a live clip, cover, remix
    and so on (unless the song's own name says so)."""
    s, t = norm(song), norm(title, drop_feat=False)
    if not s or not re.search(rf"(?<![a-z0-9]){re.escape(s)}(?![a-z0-9])", t):
        return None
    raw = (title or "").lower()                      # the bracketed words ("(Live)", "(Official Audio)") count here
    for word in UNWANTED:
        if re.search(rf"\b{re.escape(word)}\b", raw) and not re.search(rf"\b{re.escape(word)}\b", s):
            return None
    score = 10
    if "official" in raw:
        score += 3
    if "audio" in raw or "lyric" in raw:
        score += 2
    return score


def best_video(song: str, videos: list[dict], skip: set[str] | None = None) -> dict | None:
    """The best Discogs video for a song, or None."""
    skip = skip or set()
    best, best_score = None, None
    for v in videos:
        vid = video_id(v.get("uri", ""))
        if not vid or vid in skip:
            continue
        score = video_score(song, v.get("title", ""))
        if score is not None and (best_score is None or score > best_score):
            best, best_score = {"id": vid, "title": v.get("title", "")}, score
    return best


def fallback_video(videos: list[dict], skip: set[str] | None = None) -> dict | None:
    """The first video that does not look like a live clip, interview and so on."""
    skip = skip or set()
    for v in videos:
        vid = video_id(v.get("uri", ""))
        title = (v.get("title", "") or "").lower()
        if vid and vid not in skip and not any(re.search(rf"\b{re.escape(w)}\b", title) for w in UNWANTED):
            return {"id": vid, "title": v.get("title", "")}
    return None


ALTERNATE_TRACK = re.compile(r"\b(remix|acoustic|instrumental|karaoke|cover|demo|remaster(ed)?)\b|\blive (at|from|in|on)\b|[(\-] ?live\b", re.I)


def pick(tracks: list[dict], videos: list[dict], skip: set[str] | None = None) -> dict | None:
    """Choose the song and video for one album.

    tracks: [{"title": ..., "rank": ...}] from Deezer; videos: the Discogs `videos` list.
    Returns {"song", "video", "video_title", "how", "rank"} where `how` is
    "top" (the album's most popular song), "popular" (the most popular song that has a video)
    or "listed" (no song matched; the first Discogs video). Live, acoustic, remix and cover
    versions of a song are never chosen.
    """
    plain = [t for t in tracks if not ALTERNATE_TRACK.search(t["title"])]
    ranked = sorted(plain, key=lambda t: -(t.get("rank") or 0))
    for index, track in enumerate(ranked):
        found = best_video(track["title"], videos, skip)
        if found:
            return {"song": track["title"], "video": found["id"], "video_title": found["title"],
                    "how": "top" if index == 0 else "popular", "rank": track.get("rank")}
    found = fallback_video(videos, skip)
    if found:
        return {"song": clean_title(found["title"]), "video": found["id"], "video_title": found["title"], "how": "listed", "rank": None}
    return None


def clean_title(title: str) -> str:
    """A video title without the usual noise: 'Artist - Song (Official Video)' becomes 'Song'."""
    t = re.sub(r"\([^)]*\)|\[[^\]]*\]", " ", title or "")
    if " - " in t:
        t = t.split(" - ", 1)[1]
    return re.sub(r"\s+", " ", t).strip() or (title or "")
