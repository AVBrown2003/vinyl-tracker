"""The vinyl records the tracker follows.

Each item is one well-known top-selling album, pinned to one standard vinyl pressing
on Discogs (the release id). The item_id is the key that lines an item up from one day
to the next; it never changes even if the album title is edited on Discogs.
"""
from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class Item:
    item_id: str       # our key: artist and album as a lowercase slug
    artist: str
    album: str
    release_id: int    # Discogs release id of the tracked vinyl pressing

    @property
    def name(self) -> str:
        return f"{self.artist} - {self.album}"


ITEMS = [
    Item("taylor-swift-the-tortured-poets-department", "Taylor Swift", "The Tortured Poets Department", 30444731),
    Item("taylor-swift-midnights", "Taylor Swift", "Midnights", 24890252),
    Item("taylor-swift-1989-taylors-version", "Taylor Swift", "1989 (Taylor's Version)", 28638091),
    Item("taylor-swift-folklore", "Taylor Swift", "folklore", 16244176),
    Item("taylor-swift-the-life-of-a-showgirl", "Taylor Swift", "The Life of a Showgirl", 35238409),
    Item("fleetwood-mac-rumours", "Fleetwood Mac", "Rumours", 14615614),
    Item("michael-jackson-thriller", "Michael Jackson", "Thriller", 10860293),
    Item("pink-floyd-the-dark-side-of-the-moon", "Pink Floyd", "The Dark Side of the Moon", 1873013),
    Item("the-beatles-abbey-road", "The Beatles", "Abbey Road", 4698262),
    Item("prince-purple-rain", "Prince", "Purple Rain", 2085604),
    Item("amy-winehouse-back-to-black", "Amy Winehouse", "Back to Black", 2848009),
    Item("nirvana-nevermind", "Nirvana", "Nevermind", 12885936),
    Item("kendrick-lamar-gnx", "Kendrick Lamar", "GNX", 33052227),
    Item("billie-eilish-hit-me-hard-and-soft", "Billie Eilish", "Hit Me Hard and Soft", 30694534),
    Item("olivia-rodrigo-guts", "Olivia Rodrigo", "GUTS", 27940287),
    Item("sabrina-carpenter-short-n-sweet", "Sabrina Carpenter", "Short n' Sweet", 31556044),
    Item("lana-del-rey-born-to-die", "Lana Del Rey", "Born to Die", 3433715),
    Item("tyler-the-creator-chromakopia", "Tyler, the Creator", "Chromakopia", 35518975),
    Item("bob-marley-and-the-wailers-legend", "Bob Marley & The Wailers", "Legend", 16242573),
    Item("miles-davis-kind-of-blue", "Miles Davis", "Kind of Blue", 12656600),
    Item("radiohead-ok-computer", "Radiohead", "OK Computer", 8664384),
    Item("harry-styles-harrys-house", "Harry Styles", "Harry's House", 23280668),
    Item("beyonce-cowboy-carter", "Beyonce", "Cowboy Carter", 30254198),
    Item("charli-xcx-brat", "Charli XCX", "Brat", 30891144),
    Item("gracie-abrams-the-secret-of-us", "Gracie Abrams", "The Secret of Us", 31023328),
    Item("the-weeknd-after-hours", "The Weeknd", "After Hours", 15829910),
]

BY_ID = {item.item_id: item for item in ITEMS}
