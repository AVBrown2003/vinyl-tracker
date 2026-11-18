# Vinyl Tracker

[![tests](https://github.com/AVBrown2003/vinyl-tracker/actions/workflows/tests.yml/badge.svg)](https://github.com/AVBrown2003/vinyl-tracker/actions/workflows/tests.yml)

A tool that tracks **26 top-selling vinyl records**. Every day GitHub Actions asks the public Discogs database for each record's lowest asking price, how many copies are for sale, and how many collectors have it or want it. It adds one row per record per day to a history, opens a GitHub Issue with the biggest price moves, and publishes the result to a website.

- Live site: https://avbrown2003.github.io/vinyl-tracker/
- Daily issues: the repository's Issues tab (one per day, the previous day's is closed)

## How it works

1. `daily.yml` runs once a day (10:07 UTC) and calls `python -m tracker.pipeline`.
2. The source is called and its answer saved as `data/raw/<date>/<source>.<format>.gz`. If the source fails no raw file is written that day and the run goes on. The result of every source, success or failure, is in `data/raw/<date>/results.json`.
3. `data/history.csv` is rebuilt from the raw files alone (see "Build the history").
4. `data/status.json` is written for the latest run.
5. The day's GitHub Issue is opened (or updated, on a second run the same day) and the previous day's is closed. It is opened every day, even when nothing moved.
6. The raw files, history and status are committed.

A second run on the same UTC day deletes that day's raw files, fetches again, rebuilds the history and updates that day's issue, so each day counts once.

## Items

26 well-known top-selling albums, each pinned to one standard vinyl pressing on Discogs (see `tracker/items.py`). The **key** that lines a record up from one day to the next is `item_id`, a lowercase slug of artist and album such as `fleetwood-mac-rumours`. It never changes, even if the title is edited on Discogs. Records tracked: Taylor Swift (The Tortured Poets Department, Midnights, 1989 Taylor's Version, folklore, The Life of a Showgirl), Fleetwood Mac, Michael Jackson, Pink Floyd, The Beatles, Prince, Amy Winehouse, Nirvana, Kendrick Lamar, Billie Eilish, Olivia Rodrigo, Sabrina Carpenter, Lana Del Rey, Tyler the Creator, Bob Marley & The Wailers, Miles Davis, Radiohead, Harry Styles, Beyonce, Charli XCX, Gracie Abrams and The Weeknd.

## Source

| Source name | Format | What it is |
|---|---|---|
| `discogs` | JSON (`discogs.json.gz`) | The public Discogs API, no login. Two calls per record: `GET https://api.discogs.com/marketplace/stats/<release_id>` (copies for sale and lowest asking price) and `GET https://api.discogs.com/releases/<release_id>` (collectors who have or want it, rating, year, genre, format). All records go into one JSON document. |

Discogs allows 25 calls a minute without a login, so the 52 calls are paced (about 2.5 minutes). A record whose call fails stays in the file with empty values; the source counts as failed only if fewer than half of the records came back. A repository secret named `DISCOGS_TOKEN` is optional: if present it is sent as a header to get a higher limit, and it is never written to any file. Nothing is requested beyond the 26 tracked releases, so nothing needs to be filtered out.

## The history file: data/history.csv

One row per record per day, sorted by `date`, then `item_id`. Dates are UTC dates (`YYYY-MM-DD`) taken at the moment the run happens. A value Discogs does not report for a record on a day is left empty.

| Column | Meaning | Unit |
|---|---|---|
| `date` | UTC date of the run | `YYYY-MM-DD` |
| `item_id` | our key for the record (artist and album slug) | text |
| `item` | name, "Artist - Album" | text |
| `source` | which source gave the row (`discogs`) | text |
| `lowest_price` | lowest asking price among the copies for sale on the Discogs marketplace | `currency` units (US dollars) |
| `num_for_sale` | number of copies of this pressing currently for sale | copies |
| `have` | collectors who say they own this pressing | collectors |
| `want` | collectors who say they want this pressing | collectors |
| `rating` | average of Discogs members' ratings | stars, 0 to 5 |
| `rating_votes` | number of ratings behind `rating` | votes |
| `currency` | currency of `lowest_price` | text, `USD` |
| `artist` | artist | text |
| `album` | album title | text |
| `year` | release year of the tracked pressing | year |
| `genre` | first genre Discogs lists | text |
| `format` | format of the pressing, such as "Vinyl, LP, Album, Limited Edition" | text |
| `country` | country of the pressing | text |
| `release_id` | Discogs release id of the tracked pressing | number |
| `url` | the release's page on Discogs | URL |

`data/status.json` describes the latest run: `run_time` (UTC), `first_run_date` (date of the earliest raw file), `days_with_success` (number of different dates with a raw file), `items` (records in the latest run), `new_today` (records that appeared), `gone_today` (records that disappeared) and `sources` (a list of `name`, `ok`, `count`).

## The move rule

A **move** is the percent change of a record's lowest asking price (`lowest_price`) from the previous run to this run: `(new - old) / old * 100`. Only records with a price on both days count, and a record whose price did not change is not a move. Records are ranked by the size of the change, ignoring the sign, and the daily GitHub Issue lists the **5 biggest**, with the old and new price and the copies for sale. The "previous run" is the latest earlier date that has rows in the history, so a day when the source failed is skipped. A record in today's run but not the previous one is listed as **appeared**; the other way round, **disappeared**. A day when the source failed reports no appeared or disappeared records. The rule lives in `tracker/moves.py` and is repeated in `assets/common.js` so the Today page shows the same list.

## Build the history from the raw files

```
uv run python -m tracker.build
```

(or `python -m tracker.build` with any Python 3.11+; there are no dependencies). The history depends only on `data/raw/`, so the same raw files always give the same `data/history.csv`, and a change to the conversion applies to every day.

## The site

Three pages that load `data/status.json` and `data/history.csv` in the browser and compute everything there:

- **Today** (`index.html`): time of the last run, status of the source, the counts, the latest values of every record with its price change since the previous run, and the five biggest moves.
- **Browse** (`browse.html`): the latest values of every record, filters (artist, genre, decade, highest price), a search box for names, sorting by every numeric column up and down (click a heading), and a star on every record that saves it to a shortlist kept in the browser.
- **Trends** (`trends.html`): a time control and a chart of any value over the days with a control to pick records, and six sections whose headings state a finding (price change since the first run, the biggest one-day move, the price spread, collector demand, scarcity, ratings). Each gives the numbers and how they are computed from the history file, with a chart. All numbers are computed in the browser from `history.csv`. The **window** buttons (Daily = the latest run against the previous run, Monthly = the last 30 days, Yearly = the last 365 days, Decade = the last 10 years, All time) decide which dates every finding and the chart use, counted back from the latest date in the history; the findings about the latest day (price spread, demand, scarcity, ratings) always use the latest day. **Group the chart by** day, month, year or decade draws one point per period, each the average of the days in it.

The site is installable (`manifest.webmanifest`, `sw.js`). Online it loads fresh data; offline it opens and shows the last data it loaded.

## Files

| File | What it does |
|---|---|
| `tracker/items.py` | the 26 tracked records and their Discogs release ids |
| `tracker/sources.py` | the Discogs source: the calls, and conversion to the common columns |
| `tracker/build.py` | builds `data/history.csv` from the raw files |
| `tracker/moves.py` | the move rule, and which records appeared or disappeared |
| `tracker/pipeline.py` | the daily run: fetch, build, status, GitHub Issue |
| `tracker/__init__.py` | marks `tracker` as a Python package |
| `tests/conftest.py` | shared test setup: a fake source and an empty data folder |
| `tests/test_convert.py` | tests the conversion of the source to the common columns |
| `tests/test_moves.py` | tests the move rule and appeared/disappeared |
| `tests/test_build.py` | tests the history: sorting, rebuilding, a failed day, a second run on the same day |
| `tests/test_pipeline.py` | tests the status file, the issue text and issue handling |
| `.github/workflows/daily.yml` | daily schedule: runs the pipeline and commits `data/` |
| `.github/workflows/tests.yml` | runs pytest on every push |
| `index.html`, `browse.html`, `trends.html` | the three pages |
| `assets/style.css` | shared look (one navigation bar, fonts, colors) |
| `assets/common.js` | navigation bar, data loading, CSV parser, the move rule |
| `assets/today.js`, `assets/browse.js`, `assets/trends.js` | page logic |
| `assets/charts.js` | small SVG chart helpers |
| `manifest.webmanifest`, `sw.js` | installable app and offline support |
| `assets/icon-192.png`, `assets/icon-512.png`, `make_icons.py` | app icons and the script that draws them |
| `pyproject.toml`, `uv.lock` | project settings (pytest for development) |
| `.gitignore` | keeps caches and virtual environments out of the repository |
| `.gitattributes` | keeps line endings as LF so data files match across machines |
| `data/history.csv`, `data/status.json`, `data/raw/` | the history, the latest status and the raw answers of every run |
| `README.md` | this file |

## Run it yourself

```
uv run python -m tracker.pipeline --no-issues   # one run without opening an issue
uv run --with pytest python -m pytest           # tests
uv run python -m http.server 8000               # preview the site
```
