"""The vinyl records the tracker follows.

Each item is one well-known, widely owned album, pinned to one standard vinyl pressing
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
    Item("pink-floyd-wish-you-were-here", "Pink Floyd", "Wish You Were Here", 2846035),
    Item("pink-floyd-the-wall", "Pink Floyd", "The Wall", 495681),
    Item("the-beatles-sgt-peppers-lonely-hearts-club-band", "The Beatles", "Sgt. Pepper's Lonely Hearts Club Band", 4942841),
    Item("the-beatles-rubber-soul", "The Beatles", "Rubber Soul", 3204310),
    Item("led-zeppelin-led-zeppelin-iv", "Led Zeppelin", "Led Zeppelin IV", 1015465),
    Item("eagles-hotel-california", "Eagles", "Hotel California", 17536279),
    Item("eagles-their-greatest-hits-1971-1975", "Eagles", "Their Greatest Hits 1971-1975", 10455839),
    Item("ac-dc-back-in-black", "AC/DC", "Back In Black", 5595114),
    Item("guns-n-roses-appetite-for-destruction", "Guns N' Roses", "Appetite For Destruction", 3388102),
    Item("queen-greatest-hits", "Queen", "Greatest Hits", 3419603),
    Item("queen-a-night-at-the-opera", "Queen", "A Night At The Opera", 1361079),
    Item("the-rolling-stones-exile-on-main-st", "The Rolling Stones", "Exile On Main St.", 375854),
    Item("david-bowie-the-rise-and-fall-of-ziggy-stardust-and-the-spiders-from-mars", "David Bowie", "The Rise And Fall Of Ziggy Stardust And The Spiders From Mars", 8039703),
    Item("bob-dylan-highway-61-revisited", "Bob Dylan", "Highway 61 Revisited", 8213987),
    Item("bruce-springsteen-born-to-run", "Bruce Springsteen", "Born To Run", 1663765),
    Item("fleetwood-mac-fleetwood-mac", "Fleetwood Mac", "Fleetwood Mac", 4603854),
    Item("santana-abraxas", "Santana", "Abraxas", 1925952),
    Item("carole-king-tapestry", "Carole King", "Tapestry", 1287594),
    Item("joni-mitchell-blue", "Joni Mitchell", "Blue", 24747581),
    Item("simon-garfunkel-bridge-over-troubled-water", "Simon & Garfunkel", "Bridge Over Troubled Water", 2002805),
    Item("the-doors-the-doors", "The Doors", "The Doors", 2909733),
    Item("jimi-hendrix-are-you-experienced", "Jimi Hendrix", "Are You Experienced", 1435384),
    Item("the-velvet-underground-the-velvet-underground-nico", "The Velvet Underground", "The Velvet Underground & Nico", 3494799),
    Item("stevie-wonder-songs-in-the-key-of-life", "Stevie Wonder", "Songs In The Key Of Life", 266650),
    Item("marvin-gaye-whats-going-on", "Marvin Gaye", "What's Going On", 5219787),
    Item("john-coltrane-a-love-supreme", "John Coltrane", "A Love Supreme", 8268956),
    Item("dave-brubeck-time-out", "Dave Brubeck", "Time Out", 10844247),
    Item("metallica-master-of-puppets", "Metallica", "Master Of Puppets", 6025044),
    Item("metallica-metallica", "Metallica", "Metallica", 20138908),
    Item("nirvana-in-utero", "Nirvana", "In Utero", 7545132),
    Item("red-hot-chili-peppers-californication", "Red Hot Chili Peppers", "Californication", 22983965),
    Item("oasis-whats-the-story-morning-glory", "Oasis", "(What's The Story) Morning Glory?", 939519),
    Item("radiohead-kid-a", "Radiohead", "Kid A", 20857672),
    Item("radiohead-in-rainbows", "Radiohead", "In Rainbows", 1174296),
    Item("the-smiths-the-queen-is-dead", "The Smiths", "The Queen Is Dead", 494927),
    Item("joy-division-unknown-pleasures", "Joy Division", "Unknown Pleasures", 11400),
    Item("the-cure-disintegration", "The Cure", "Disintegration", 2289504),
    Item("daft-punk-random-access-memories", "Daft Punk", "Random Access Memories", 4570366),
    Item("arctic-monkeys-am", "Arctic Monkeys", "AM", 4904158),
    Item("the-strokes-is-this-it", "The Strokes", "Is This It", 667892),
    Item("tame-impala-currents", "Tame Impala", "Currents", 7252111),
    Item("lana-del-rey-norman-fucking-rockwell", "Lana Del Rey", "Norman Fucking Rockwell!", 14099496),
    Item("taylor-swift-lover", "Taylor Swift", "Lover", 14401235),
    Item("taylor-swift-red-taylors-version", "Taylor Swift", "Red (Taylor's Version)", 20939464),
    Item("taylor-swift-evermore", "Taylor Swift", "evermore", 18893731),
    Item("taylor-swift-fearless-taylors-version", "Taylor Swift", "Fearless (Taylor's Version)", 20414812),
    Item("billie-eilish-when-we-all-fall-asleep-where-do-we-go", "Billie Eilish", "When We All Fall Asleep, Where Do We Go?", 13414611),
    Item("billie-eilish-happier-than-ever", "Billie Eilish", "Happier Than Ever", 19676596),
    Item("harry-styles-fine-line", "Harry Styles", "Fine Line", 14525240),
    Item("olivia-rodrigo-sour", "Olivia Rodrigo", "SOUR", 19893769),
    Item("dua-lipa-future-nostalgia", "Dua Lipa", "Future Nostalgia", 17991814),
    Item("adele-21", "Adele", "21", 2664589),
    Item("adele-30", "Adele", "30", 21122347),
    Item("the-weeknd-starboy", "The Weeknd", "Starboy", 9778270),
    Item("kendrick-lamar-good-kid-m-a-a-d-city", "Kendrick Lamar", "good kid, m.A.A.d city", 3975953),
    Item("kendrick-lamar-to-pimp-a-butterfly", "Kendrick Lamar", "To Pimp A Butterfly", 7557957),
    Item("kendrick-lamar-damn", "Kendrick Lamar", "DAMN.", 10559651),
    Item("tyler-the-creator-igor", "Tyler, The Creator", "IGOR", 14215683),
    Item("tyler-the-creator-flower-boy", "Tyler, The Creator", "Flower Boy", 11195697),
    Item("frank-ocean-blonde", "Frank Ocean", "Blonde", 25500877),
    Item("frank-ocean-channel-orange", "Frank Ocean", "channel ORANGE", 36080959),
    Item("kanye-west-my-beautiful-dark-twisted-fantasy", "Kanye West", "My Beautiful Dark Twisted Fantasy", 2606952),
    Item("kanye-west-the-college-dropout", "Kanye West", "The College Dropout", 233445),
    Item("travis-scott-astroworld", "Travis Scott", "Astroworld", 12773291),
    Item("drake-take-care", "Drake", "Take Care", 3294598),
    Item("beyonce-lemonade", "Beyonce", "Lemonade", 10781508),
    Item("beyonce-renaissance", "Beyonce", "Renaissance", 24746675),
    Item("sza-sos", "SZA", "SOS", 27139257),
    Item("lauryn-hill-the-miseducation-of-lauryn-hill", "Lauryn Hill", "The Miseducation Of Lauryn Hill", 6546645),
    Item("outkast-speakerboxxx-the-love-below", "Outkast", "Speakerboxxx / The Love Below", 218471),
    Item("wu-tang-clan-enter-the-wu-tang-36-chambers", "Wu-Tang Clan", "Enter The Wu-Tang (36 Chambers)", 153749),
    Item("nas-illmatic", "Nas", "Illmatic", 3207332),
    Item("2pac-all-eyez-on-me", "2Pac", "All Eyez On Me", 1058605),
    Item("amy-winehouse-frank", "Amy Winehouse", "Frank", 1432894),
]

BY_ID = {item.item_id: item for item in ITEMS}
