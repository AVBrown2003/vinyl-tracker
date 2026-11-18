"""Picking each album's most popular song that has a video."""
from tracker import music


def vid(title, id_="abc"):
    return {"title": title, "uri": f"https://www.youtube.com/watch?v={id_}"}


def test_norm_drops_brackets_features_and_punctuation():
    assert music.norm("Anti-Hero (Official Music Video)") == "anti hero"
    assert music.norm("Karma (feat. Ice Spice)") == "karma"
    assert music.norm("Don’t Stop") == "dont stop"
    assert music.norm("") == ""


def test_video_id_from_both_link_styles():
    assert music.video_id("https://www.youtube.com/watch?v=b7kmP1fsGg8") == "b7kmP1fsGg8"
    assert music.video_id("https://youtu.be/XzOvgu3GPwY") == "XzOvgu3GPwY"
    assert music.video_id("https://example.com/") is None and music.video_id("") is None


def test_the_song_must_be_a_whole_word_match_in_the_video_title():
    assert music.video_score("Karma", "Taylor Swift ft. Ice Spice - Karma (Official Music Video)") is not None
    assert music.video_score("Love", "Taylor Swift - Lover (Official Video)") is None          # not a whole word
    assert music.video_score("Karma", "Something else entirely") is None


def test_live_covers_and_remixes_are_never_chosen():
    assert music.video_score("Fortnight", "Taylor Swift - Fortnight (Official Music Video)") is not None
    assert music.video_score("Fortnight", "Taylor Swift - Fortnight (Live at the Eras Tour)") is None
    assert music.video_score("Thriller", "Michael Jackson - Thriller (Acoustic Cover)") is None
    assert music.video_score("Thriller", "Thriller (Official Video)") > music.video_score("Thriller", "Thriller")


def test_best_video_prefers_the_better_match_and_can_skip_one():
    videos = [vid("Dreams (Live)", "live1"), vid("Fleetwood Mac - Dreams (Official Audio)", "studio"), vid("Dreams", "plain")]
    assert music.best_video("Dreams", videos)["id"] == "studio"
    assert music.best_video("Dreams", videos, skip={"studio"})["id"] == "plain"
    assert music.best_video("Dreams", videos, skip={"studio", "plain"}) is None
    assert music.best_video("Dreams", [], skip=None) is None


def test_remixes_and_live_versions_of_a_song_are_not_picked():
    tracks = [{"title": "Song (Remix)", "rank": 999}, {"title": "Song (Live at Wembley)", "rank": 800}, {"title": "Song", "rank": 10}]
    got = music.pick(tracks, [vid("Artist - Song (Official Video)", "ok")])
    assert got["song"] == "Song" and got["how"] == "top"


def test_pick_takes_the_most_popular_song_that_has_a_video():
    tracks = [{"title": "Song A", "rank": 100}, {"title": "Song B", "rank": 900}, {"title": "Song C", "rank": 500}]
    videos = [vid("Artist - Song C (Official Video)", "cc"), vid("Artist - Song A", "aa")]
    got = music.pick(tracks, videos)
    assert got["song"] == "Song C" and got["video"] == "cc" and got["how"] == "popular" and got["rank"] == 500
    top = music.pick(tracks, videos + [vid("Artist - Song B (Official Audio)", "bb")])
    assert top["song"] == "Song B" and top["how"] == "top"


def test_pick_falls_back_to_the_first_plain_video_then_to_nothing():
    got = music.pick([{"title": "Unknown", "rank": 5}], [vid("Artist - Interview 2020", "iv"), vid("Artist - Other Song (Official Video)", "os")])
    assert got["video"] == "os" and got["how"] == "listed" and got["song"] == "Other Song"
    assert music.pick([{"title": "X", "rank": 1}], []) is None


def test_pick_skips_videos_that_cannot_be_embedded():
    tracks = [{"title": "Song", "rank": 1}]
    videos = [vid("Artist - Song (Official Video)", "blocked"), vid("Artist - Song (Official Audio)", "fine")]
    assert music.pick(tracks, videos, skip={"blocked"})["video"] == "fine"
