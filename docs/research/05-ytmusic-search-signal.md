# What YouTube Music search returns for matching

Research for [issue #6](https://github.com/paritosh4495/crossfade/issues/6). Search only. Write auth is issue #2.

- **Date checked:** 2026-08-25
- **Library version:** `ytmusicapi` 1.12.2 (installed from PyPI, Python 3.12.10)
- **Method:** live unauthenticated calls against `music.youtube.com` from a residential IP in India, plus reading the installed package source, the official docs, and the upstream issue tracker.

Everything below with a concrete value in it came from an actual call made on the date above, not from the docs. Where I am quoting docs instead of observed behaviour I say so.

## The headline: search needs no auth

`YTMusic()` with no arguments works, and `search()` on it works. The library models this as a first-class state, `AuthType.UNAUTHORIZED`, set in the constructor before any credential parsing happens (`ytmusicapi/ytmusic.py:105`). The only thing an unauthenticated client fetches on first use is an `X-Goog-Visitor-Id` (`ytmusicapi/helpers.py:45`), which is an anonymous visitor token, not an account.

I ran 420 searches over about five minutes with no credentials and got 420 successes.

The one thing that does need auth is `scope`. `search(..., scope="library")` on an unauthenticated client returns:

```
YTMusicServerError: Server returned HTTP 401: Unauthorized.
Request is missing required authentication credential. Expected OAuth 2 access token, login cookie or other valid authentication credential
```

That is the correct and expected behaviour, since a library search is by definition account-scoped. Catalogue search, which is what Crossfade needs, has no such requirement.

**Architectural consequence:** the sidecar can run the whole match-and-review pass before the user has ever touched YouTube. Import the Spotify playlist, search, score, queue the ambiguous ones, let the human resolve them, and only then ask for YouTube write consent. The YouTube OAuth prompt becomes the last step instead of the first, which is a much better funnel and means a failed or abandoned connect does not throw away the matching work. It also means search is cheap to parallelise across users, because there is no per-user credential to rotate or refresh.

The caveat is that the anonymous path is also the bot-visible path. See [rate limits](#rate-limits-and-throttling).

## ISRC works, and this is the biggest finding here

The issue said to assume no external identifier unless proven otherwise. The truthful answer is in two halves.

**ISRC is never returned.** I dumped the full `get_song()` response for `J7p4bzqLvCw` and grepped the raw JSON for `isrc`, `upc`, `musicbrainz`, `externalId` and `spotify`. All absent. Same for search results. Upstream confirms it: sigma67, the maintainer, closed [issue #144](https://github.com/sigma67/ytmusicapi/issues/144) with "Unfortunately no, seems it's only available in the backend for search. It was not contained in search or get_song response."

**But ISRC is indexed as a search term.** The second half of that same sentence is the useful part. You can pass a bare ISRC as the query string and YouTube Music's backend resolves it to the exact recording. I tested this with real ISRCs pulled from MusicBrainz:

| ISRC | Expected | Results | Top hit |
|---|---|---|---|
| `INS172203702` | Kesariya, Arijit Singh | 1 | Kesariya (From "Brahmastra"), 4:29, `NJAv_7lHUIU` |
| `INS181303031` | Tum Hi Ho, Arijit Singh | 1 | Tum Hi Ho, 4:22, `fsiPzT50ZiM` |
| `INU252102408` | 295, Sidhu Moose Wala | 1 | 295, 4:30, `gD4EtH2Plik` |
| `JPP301900716` | 夜に駆ける, YOASOBI | 1 | 夜に駆ける, 4:22, `by4SYYWlhEs` |
| `INV119800029` | Chaiyya Chaiyya | 1 | Chaiyya Chaiyya, 6:47, `9MX-QejdVaQ` |
| `INS172000675` | Vaathi Coming, Anirudh | 1 | Vaathi Coming (From "Master"), 3:49, `BMFxVtsXgRk` |
| `USSM19500010` | Earth Song, Michael Jackson | 1 | Earth Song, 6:47, `gbAd62jzrNI` |
| `USUG11904206` | Blinding Lights | 1 | Blinding Lights, 3:22, `J7p4bzqLvCw` |
| `USUG11904251` | Blinding Lights (other release) | 0 | miss |

Note the last two rows. Blinding Lights has more than one ISRC across releases, and only one of them is the one YouTube Music indexed. So the lookup is exact but not complete: it hits the specific recording YTM holds, and a different regional or reissue ISRC for the same song misses. Six of seven real ISRCs from MusicBrainz landed, including every Indian-language one.

Two failure modes to guard against:

- **A miss returns zero results.** Easy to detect, fall back to text search.
- **A wrong or malformed ISRC returns a plausible but unrelated result.** I fed it a made-up code, `INS181300106`, and got back a 50-minute Bollywood DJ megamix. It did not return nothing. So an ISRC hit must still be verified against title, artist and duration before you trust it.

UPC works the same way for albums. `search("886448747697", filter="albums")` returned exactly one result, SAVAGE MODE II by 21 Savage and Metro Boomin.

**Recommendation:** ISRC first, text search as fallback. Spotify gives us `external_ids.isrc` on every track. Try the ISRC, accept it only if title similarity and duration are within tolerance, otherwise fall through to the normal scored text search. This should convert a large slice of what would have been review-queue items into auto-accepts, and it does it in one cheap call.

## Example search result

`YTMusic().search("Blinding Lights The Weeknd", filter="songs", limit=3)`, first element, verbatim:

```json
{
  "category": "Songs",
  "resultType": "song",
  "title": "Blinding Lights",
  "album": {
    "name": "Blinding Lights",
    "id": "MPREb_4U7yfKKFZLv"
  },
  "inLibrary": false,
  "pinnedToListenAgain": false,
  "videoId": "J7p4bzqLvCw",
  "videoType": "MUSIC_VIDEO_TYPE_ATV",
  "duration": "3:22",
  "year": null,
  "artists": [
    {
      "name": "The Weeknd",
      "id": "UClYV6hHlupm_S_ObS1W-DYw"
    }
  ],
  "duration_seconds": 202,
  "views": "3.6B",
  "isExplicit": false,
  "thumbnails": [
    {
      "url": "https://yt3.googleusercontent.com/R_cjQK3ww...=w60-h60-l90-rj",
      "width": 60,
      "height": 60
    },
    {
      "url": "https://yt3.googleusercontent.com/R_cjQK3ww...=w120-h120-l90-rj",
      "width": 120,
      "height": 120
    }
  ]
}
```

Note that `limit=3` returned 20 items. `limit` is a target the continuation loop stops at, not a hard cap on the first shelf.

## Field table

Fields on a `filter="songs"` result. "Signal" is my read on usefulness for scoring.

| Field | Type | Always present | Signal | Notes |
|---|---|---|---|---|
| `videoId` | string | yes | identity | The only thing you actually store. What you add to a playlist. |
| `title` | string | yes | strong | Carries version info in parentheses. See [version markers](#remixes). |
| `artists` | list of `{name, id}` | yes | strong | `id` is a stable YouTube channel ID, so artist identity is comparable across queries without string matching. Order roughly tracks Spotify's primary-then-featured order. |
| `album` | `{name, id}` or null | on `songs` filter | strong | `id` is an `MPRE...` browseId usable with `get_album()`. Null for singles with no album entity, and absent on non-`songs` searches. |
| `duration` | string `"m:ss"` | on `songs` filter | strong | |
| `duration_seconds` | int | on `songs` filter | strong | The library parses this from `duration` (`parsers/songs.py:102`), the API does not send it. Absent whenever `duration` is absent. |
| `videoType` | string enum | yes | strong | See [song versus music video](#song-versus-music-video). |
| `isExplicit` | bool | on `song` and `album` | weak | Derived from a badge being present, so it is `false` both for "clean" and for "no badge rendered". Do not treat `false` as proof of a clean version. Source: `parsers/search.py`, `nav(data, BADGE_LABEL, True) is not None`. |
| `views` | string `"3.6B"` | usually | weak | Rounded and localised text, not a number. It also disagrees with the per-video count: search reported `3.6B` for `J7p4bzqLvCw` while `get_song()` on that same id reported `viewCount: "982051850"`. The search figure looks like an aggregate across versions. Useful only as a tiebreak for "which of these identical-looking rows is the canonical one". |
| `year` | string or null | rarely | weak | `null` on essentially every `songs` result I saw. `get_watch_playlist()` does return it. |
| `thumbnails` | list of `{url, width, height}` | yes | none | Album art. For display in the review queue, not for scoring. |
| `resultType` | string | yes | routing | One of `album`, `artist`, `playlist`, `song`, `video`, `station`, `profile`, `podcast`, `episode` (`parsers/search.py`, `ALL_RESULT_TYPES`). |
| `category` | string or null | yes | routing | Shelf heading, for example `"Songs"`, `"Top result"`, `"More from YouTube"`. Localised, which matters. See [the locale bug](#do-not-set-language). |
| `inLibrary`, `pinnedToListenAgain`, `feedbackTokens`, `listenAgainFeedbackTokens` | mixed | on `songs` | none | Account state. Meaningless unauthenticated. |

Nothing here is a genre, a release date, a track number, a BPM, or a label. The scorer has title, artist, album, duration, and a type flag. That is the whole budget.

### Always pass `filter="songs"`

Unfiltered search is close to useless for matching. I dumped all 33 results for `search("Tum Hi Ho Arijit Singh")` with no filter:

```
Top result       | song   | Tum Hi Ho                          | dur= 4:22 | album= None
More from YouTube| video  | Arijit Singh singing Tum Hi Ho Live| dur= 6:23 | album= None
More from YouTube| video  | TUM HI HO - Arijit Singh | MTV ...  | dur= 9:02 | album= None
None             | album  | Best Of Arijit Singh - Revisited   | dur= None | album= None
None             | song   | Meri Aashiqui                      | dur= None | album= None
None             | song   | Tum Hi Aana (From "Marjaavaan")    | dur= None | album= None
...
None             | episode| Tum Hi Ho                          | dur= None | album= None
None             | podcast| 90'S Old Hindi Songs               | dur= None | album= None
```

Only the first four rows carried a duration. Every row past the top shelf had `duration: null` and `album: null`, and the mix was padded with artists, playlists, episodes and podcasts. YouTube Music renders fewer flex columns on those cards, so the parser has nothing to read. Duration is one of the two or three signals worth anything, so throwing it away is not an option. Filtered search returned duration and album on 20 of 20.

## Song versus music video

`videoType` is the flag. Values I observed:

| Value | Meaning | Seen in |
|---|---|---|
| `MUSIC_VIDEO_TYPE_ATV` | Art track. The audio-only official release, an auto-generated "Topic" upload sourced from the label. This is the thing you want. | every `filter="songs"` result across every query I ran |
| `MUSIC_VIDEO_TYPE_OMV` | Official music video. Right artist, but the video edit, so intros, outros and dialogue mean the duration drifts. | `filter="videos"`, and inside `get_album()` track lists |
| `MUSIC_VIDEO_TYPE_UGC` | User-generated. Lyric videos, covers, dance choreography, radio rips. | dominates `filter="videos"` |
| `MUSIC_VIDEO_TYPE_PODCAST_EPISODE` | Podcast episode. Referenced in the parser's type mapping (`parsers/search.py`), and podcast rows do appear in unfiltered results. | unfiltered |

Can you filter to songs only? Effectively yes. Every single result from `filter="songs"` across roughly a dozen queries in five languages was `ATV`. `filter="videos"` was the mirror image: ten of ten were `UGC` or `OMV`, top hit "The Weeknd - Blinding Lights (Lyrics)" by a channel called "7clouds Indie". The split is clean enough to rely on.

I would still assert `videoType == "MUSIC_VIDEO_TYPE_ATV"` in the scorer rather than trusting the filter, because it costs nothing and the `resultType` fallback in the parser explicitly maps unknown non-ATV items to `"video"`, which tells you the boundary is inferred rather than guaranteed.

One thing that caught me out: the same song has different ids depending on where you look. `search()` gave `J7p4bzqLvCw` (ATV) for Blinding Lights, while `get_album("MPREb_4U7yfKKFZLv")` gave `4NRXx6U8ABQ` (OMV) for track 1 of the same album. Do not assume a videoId round-trips between endpoints.

## Query construction

Free text only. There is no structured query object. The signature is:

```python
search(query: str,
       filter: Literal["songs","videos","albums","artists","playlists",
                       "community_playlists","featured_playlists",
                       "profiles","podcasts","episodes"] | None = None,
       scope: Literal["uploads","library"] | None = None,
       limit: int = 20,
       ignore_spelling: bool = False) -> list[dict]
```

`filter` is not a client-side predicate. It maps to an opaque protobuf-style `params` string sent to the server (`get_search_params()` in `parsers/search.py`, where `songs` becomes `II`, `videos` becomes `IQ`, `albums` becomes `IY`, and so on). The server does the filtering, and the response shape genuinely differs per filter, which is why `songs` gets you album and duration and unfiltered does not.

Filter behaviour:

- `songs`: art tracks only. Returns `title`, `artists`, `album`, `duration`, `duration_seconds`, `videoId`, `videoType`, `isExplicit`, `views`. This is the one to use.
- `videos`: user uploads and official videos. Returns `title`, `artists`, `videoId`, `videoType`, `duration`, `views`. No `album`, and `year` is always null. The `artists` field here is the uploading channel, not the recording artist, which makes it actively misleading for scoring.
- `albums`: `title`, `type` ("Album", "Single", "EP"), `browseId` (`MPRE...`), `playlistId` (`OLAK5uy_...`), `year`, `artists`, `isExplicit`. This is the only filter that reliably gives you a release year.
- `artists`: `artist`, `browseId` (channel id), `radioId`, `shuffleId`. No track data.

`ignore_spelling=True` disables YouTube's autocorrect. On a deliberately mangled query, `"blinding lites weekend"`, both modes found the right track at position one, but the corrected mode's second result drifted to "Starboy" while the uncorrected mode stayed on Blinding Lights variants. Autocorrect is generally helping, so leave it on. It is a useful escape hatch for the case where a real title looks like a typo.

`get_search_suggestions(query)` also works unauthenticated and returns a plain list of strings. Probably not worth a round trip in the matching path, but it exists.

### Do not set `language`

This one is a live bug and it would have bitten us directly, given the India focus.

```
YTMusic(location="IN", language="hi").search("Kesariya Arijit Singh", filter="songs")  ->  []
YTMusic(location="IN").search("Kesariya Arijit Singh", filter="songs")                 ->  20 results
YTMusic(language="hi").search("Kesariya Arijit Singh", filter="songs")                 ->  []
```

Any non-English `language` silently returns zero results for every filtered search. The cause is in `mixins/search.py`:

```python
if category and internal_filter[:-1].lower() not in category.lower():
    continue
```

The code checks that the shelf heading contains the filter name. Under a Hindi locale the heading comes back as Hindi text, `"song"` is not a substring of it, and the shelf is skipped. Unfiltered search still returns results under `language="hi"`, which makes the failure quiet rather than loud.

`location="IN"` on its own is safe and changes nothing about the parse. Set the location, leave the language at the default `"en"`.

## Behaviour on real catalogue

### Indian-language catalogue

This is the good news, and it surprised me. Devanagari input works and the catalogue metadata comes back romanised.

`search("तुम ही हो आशिकी 2", filter="songs")` returned, in order: "Tum Hi Ho" by Arijit Singh, album "Aashiqui 2", 4:22, 1.2B views, `fsiPzT50ZiM`. Then "Meri Aashiqui", "Chahun Main Ya Naa", "Tu Hi Hai Aashiqui", and a second "Tum Hi Ho" by Shahid Mallya with 55K views. The Devanagari query and the romanised query `"Tum Hi Ho Arijit Singh Aashiqui 2"` returned the same top result with the same videoId.

`search("कल हो ना हो", filter="songs")` returned "Kal Ho Naa Ho" by Shankar Ehsaan Loy and Sonu Nigam, album "Kal Ho Naa Ho (Original Motion Picture Soundtrack)", 5:22.

That romanisation is convenient, because Spotify romanises Hindi titles too. Both sides speak Latin script for Hindi, so string similarity works without a transliteration layer.

Punjabi and Telugu also resolved cleanly. "Sidhu Moose Wala 295" hit `295` from Moosetape at position one. The artist name came back as both "Sidhu Moose Wala" and "Sidhu Moosewala" within a single result set, so artist matching needs normalisation that ignores spacing.

The Indian-specific hazard is film soundtracks. `search("Naatu Naatu RRR", filter="songs")` returned five rows where four shared the exact duration 3:35 and the exact view count 115M:

```
Naatu Naatu        | Rahul Sipligunj, Kaala Bhairava | 3:35 | AbaAxgufFA8
Naacho Naacho      | Vishal Mishra, Rahul Sipligunj  | 3:35 | -eoMTGNtjoQ
Naattu Koothu      | Rahul Sipligunj, Yazin Nizar    | 3:35 | gpRlVjW8J8w
Halli Naatu        | Rahul Sipligunj, Kaala Bhairava | 3:35 | EmhVB4ZhOo0
```

These are the Telugu, Hindi, Tamil and Kannada dubs of the same recording. Identical duration, near-identical artist credits, similar titles, and the album field varies between "Rrr" and "RRR (from \"RRR\")". Duration is worthless as a discriminator here and title similarity is dangerously close. This is a category where ISRC-first matters a lot, because each dub has its own ISRC.

### Japanese

Japanese metadata comes back in native script, not romaji. `search("夜に駆ける YOASOBI", filter="songs")` returned `夜に駆ける` by YOASOBI, 4:22, `by4SYYWlhEs`.

The search backend handles cross-script queries well. Both `"Yoru ni Kakeru YOASOBI"` (romaji) and `"Racing Into The Night YOASOBI"` (English title) returned the same `by4SYYWlhEs` at position one. So retrieval is fine. Scoring is where it breaks: the result title is `夜に駆ける` and Spotify may hold the same track as `"Yoru ni Kakeru"`, and any character-level similarity between those two is zero. Japanese and other non-Latin catalogues need the artist name and duration to carry the score, or a normalisation step, or the ISRC path.

Also present in that result set: `夜に駆ける (From "THE FIRST TAKE")` at 4:09 and `夜に駆ける (初音ミク Ver.)` credited to Ayase at 4:20. Three versions within 13 seconds of each other.

### Remixes

`search("Levels Skrillex Remix Avicii", filter="songs")`:

```
Levels (Skrillex Remix)                             | Avicii   | 4:42 | album: Levels (Remixes) | 109M
Levels (Radio Edit)                                 | Avicii   | 3:20 | album: Levels           | 1B
Levels                                              | Avicii   | 5:39 | album: Levels           | 1B
Levels (Cazzette's NYC Mode Radio Mix) (feat. ...)  | Avicii   | 3:38 | album: Levels (Remixes) | 1.7M
HUMBLE. (SKRILLEX REMIX)                            | Skrillex, Kendrick Lamar | 2:37 | 104M
```

Remix handling is good. The version marker is in the title in parentheses, the remixer is sometimes in the title and sometimes in `artists`, and the album name often carries "(Remixes)". Durations spread widely, 3:20 to 5:39, so duration is a real discriminator here. The fifth row is a warning: a completely different song scored highly on the token "SKRILLEX REMIX", so the scorer must weight the base title far above version tokens.

### Live versions

`search("Hotel California Live Eagles Hell Freezes Over", filter="songs")` did not find the Hell Freezes Over version at all. It returned:

```
Hotel California                                                      | 6:32 | album: Legacy
Hotel California (Live at the Millennium Concert, ... 2018 Remaster)  | 6:58 | album: Legacy
The Last Resort                                                       | 7:25 | album: Legacy
Hotel California (Live at The Forum, Los Angeles, CA, 10/20-22/1976)  | 6:50 | album: To the Limit
Hotel California                                                      | 4:04 | album: The Eagles (8K views)
```

Live versions exist and are labelled, but with long free-text venue-and-date strings that will not align with Spotify's phrasing for the same recording. The requested one was not in the top five. The last row is a trap worth naming: a studio-length 4:04 "Hotel California" by "The Eagles" with 8K views. Wrong artist string, wrong duration, almost certainly a re-recording or a bootleg upload, and it would pass a naive title-plus-artist check. View count is the only thing separating it from the real one.

### Remasters

`search("Come Together Remastered 2009 The Beatles", filter="songs")`:

```
Come Together                                | The Beatles | 4:19 | album: 1           | 341M
Come Together (Remastered 2009)              | The Beatles | 4:20 | album: Abbey Road  | 341M
Here Comes The Sun (Remastered 2009)         | The Beatles | 3:06 | album: Abbey Road  | 515M
Come Together (Take 1 - Remastered)          | The Beatles | 3:41 | album: Anthology   | 12K
Let It Be (Remastered 2009)                  | The Beatles | 4:04 | album: Let It Be   | 467M
```

Remasters are the hardest case and the least harmful one. The top two differ by one second of duration and share a view count, and the only distinguishing signal is the album name, "1" versus "Abbey Road". If Spotify's track came from Abbey Road, album matching resolves it. If it came from a compilation, you are guessing. The saving grace is that picking the wrong remaster gives the user the right song, so this belongs in the auto-accept bucket with slightly lower confidence, not the review queue. Sending every remaster to a human would drown the queue for no listener benefit.

Rows three and five show the same problem as the remix case, sibling album tracks scoring on a shared version token.

## Rate limits and throttling

Nothing official. The FAQ says only "There most certainly is, although you shouldn't run into it during normal usage", and links the two known cases, both writes: playlist creation ([#19](https://github.com/sigma67/ytmusicapi/issues/19)) and uploads. There is no published number, and [#328](https://github.com/sigma67/ytmusicapi/issues/328) "API quota values" is still open with the maintainer's guess: "In my personal experience the quota for `search` is probably quite high, as you can do at least several hundreds of searches without issue."

What I measured, unauthenticated, from one residential IP in India on 2026-08-25:

| Test | Requests | Concurrency | Errors | Wall time | Mean latency | p95 | Throughput |
|---|---|---|---|---|---|---|---|
| Sequential burst | 120 | 1 | 0 | 67.9s | 0.57s | 0.84s | 1.8 req/s |
| Threaded burst | 300 | 10 | 0 | 17.4s | 0.56s | 1.00s | 17.3 req/s |

420 searches in about five minutes, no 429, no captcha, no degradation, and latency stayed flat under ten-way concurrency. Whatever the search quota is, it is well above anything a playlist transfer needs. A 200-track playlist is 200 searches, which is twelve seconds of wall time at that concurrency.

Things that still worry me:

**No retry handling in the library.** I grepped the package for 429, retry and backoff logic in the request path. There is none. `_send_request()` raises `YTMusicServerError` on any status at or above 400 (`ytmusic.py:247`) and that is the whole story. Whatever backoff, jitter and circuit-breaking we want, the sidecar has to implement.

**Cloud IPs get bot-blocked.** This is the real deployment risk, and it is separate from rate limiting. From [#328](https://github.com/sigma67/ytmusicapi/issues/328), a user running on Vercel: "requests to the YTmusic API get blocked because they 'can't verify I'm not a bot' so I need to authenticate myself in some way." That is an IP reputation problem, not a request-count problem. My clean 420 might be entirely down to running from a residential connection. Datacenter ranges belonging to AWS, GCP, Azure, Vercel and Fly are exactly what Google's abuse systems distrust.

This deserves a spike of its own before we commit to a host. Deploy the sidecar somewhere representative and run the same burst. If it gets blocked, the options are a residential or ISP proxy pool, or passing a user's auth into search after all, which would undo the architectural win described at the top.

**The maintainer's request.** From #328: "this library is built on the principle of responsible use. Excessive use will likely lead to YT shutting things down, hence less good for all." Worth honouring, and it aligns with our interests anyway. Cache search results by normalised query and by ISRC, since a public multi-user app will see the same popular tracks over and over. Cap concurrency per user. Do not re-search a playlist we already matched.

## Two-step lookup: is there richer metadata elsewhere?

Yes, but less than I hoped, and the extra fields are mostly not matching signals.

### `get_song(videoId)`

Works unauthenticated. Returns `playabilityStatus`, `streamingData`, `playbackTracking`, `videoDetails`, `microformat`. The useful parts:

```json
{
  "videoId": "J7p4bzqLvCw",
  "title": "Blinding Lights",
  "lengthSeconds": "202",
  "channelId": "UClYV6hHlupm_S_ObS1W-DYw",
  "viewCount": "982051850",
  "author": "The Weeknd",
  "musicVideoType": "MUSIC_VIDEO_TYPE_ATV",
  "isLiveContent": false
}
```

What it adds over search:

- **Exact duration in seconds.** `lengthSeconds: "202"` versus search's `"3:22"`. Search already parses to 202, so no real gain.
- **Exact view count.** `982051850` versus search's `"3.6B"`. As noted, these disagree, and the precise number is the one you would want for a canonicality tiebreak.
- **`isLiveContent`.** A boolean for live recordings, which search does not expose. Directly useful for the live-version problem, though it was `false` for the Eagles live tracks I checked, so it may only flag actual livestreams rather than live album recordings. Verify before relying on it.
- **`microformat.availableCountries`.** A list of ISO country codes. For `295` by Sidhu Moose Wala this was 249 entries including `IN`. This answers a question search cannot: is this track playable in this user's region. Worth checking on low-confidence matches, and worth checking generally if we ever see users report tracks that added but will not play.
- **`microformat.tags`.** Alternate-script name variants. For Blinding Lights: `["The Weeknd", "ザウィークエンド", "ザ・ウィークエンド", "Blinding Lights", "ブラインディングライツ", "ブラインディング・ライツ"]`. This is a genuine cross-script matching aid, since it gives you the Japanese renderings of a Latin title and presumably the reverse. The label populates it, so coverage will be patchy.

No ISRC. No release date. No genre.

### `get_watch_playlist(videoId)`

Works unauthenticated. Returns `tracks`, `playlistId`, `lyrics`, `related`. Track zero is the requested video, and it carries one field search does not:

```json
{
  "videoId": "J7p4bzqLvCw",
  "title": "Blinding Lights",
  "length": "3:22",
  "videoType": "MUSIC_VIDEO_TYPE_ATV",
  "artists": [{"name": "The Weeknd", "id": "UClYV6hHlupm_S_ObS1W-DYw"}],
  "album": {"name": "Blinding Lights", "id": "MPREb_4U7yfKKFZLv"},
  "year": "2019"
}
```

`year: "2019"`, where search returned `year: null`. Release year is a decent remaster and re-release discriminator. This is the cheapest way to get it for a single track.

### `get_album(browseId)`

Works unauthenticated. Give it the `album.id` from a search result and you get `year`, `trackCount`, `duration_seconds`, `isExplicit`, `audioPlaylistId`, `other_versions` (deluxe editions, reissues, regional variants of the same release) and a full `tracks` list with `trackNumber`, `duration_seconds`, `isAvailable` and per-track `videoType`.

`other_versions` is the interesting one for remaster and re-release disambiguation, since it enumerates the alternate releases explicitly instead of making you infer them from search noise.

### Verdict on two-step

Do not do it on the hot path. It doubles or triples the request count for `year` plus an exact view count, and the search fields already decide the great majority of matches. Reserve it for the ambiguous band:

1. ISRC lookup. If it hits and verifies, done.
2. Text search with `filter="songs"`. If the top result clears the confidence threshold, done.
3. Only if the top two or three candidates sit within scoring noise of each other, fetch `get_watch_playlist()` or `get_album()` on those specific candidates to break the tie on `year` and album version, and check `availableCountries` if the region matters.

That keeps the extra calls proportional to the number of hard cases rather than the size of the playlist.

## Sources

Primary, in rough order of how much I trusted them.

- Live API calls, `ytmusicapi` 1.12.2, 2026-08-25. Every table value and JSON block above came from these.
- Installed package source, `ytmusicapi/`:
  - `ytmusic.py` (constructor, `AuthType.UNAUTHORIZED`, `_send_request`, absence of retry logic)
  - `mixins/search.py` (signature, filter validation, shelf routing, the locale bug)
  - `parsers/search.py` (`ALL_RESULT_TYPES`, `parse_search_result`, `get_search_params`, `isExplicit` derivation)
  - `parsers/songs.py` (`parse_song_runs`, `duration_seconds` derivation)
  - `helpers.py` (`get_visitor_id`)
  - Public mirror: https://github.com/sigma67/ytmusicapi
- https://ytmusicapi.readthedocs.io/en/stable/faq.html (rate limit statement)
- https://ytmusicapi.readthedocs.io/en/stable/setup/index.html ("Further setup is only needed if you want to access account data using authenticated requests.")
- https://ytmusicapi.readthedocs.io/en/stable/reference.html
- https://github.com/sigma67/ytmusicapi/issues/144 (ISRC and UPC not in responses, but searchable)
- https://github.com/sigma67/ytmusicapi/issues/328 (search quota guess, Vercel bot-blocking, responsible-use request)
- https://github.com/sigma67/ytmusicapi/issues/19 (rate limit on playlist creation)
- https://musicbrainz.org/ws/2/ (real ISRCs for the coverage test)

## Assessment

**How good can matching get.** For mainstream Western catalogue with a Spotify ISRC in hand, very good. The ISRC path is close to exact, and the text path has title, artist channel id, album name and duration, which is enough to separate a correct match from a wrong one most of the time. I would expect a high auto-accept rate, with the review queue catching version ambiguity rather than outright wrong songs.

The `artists[].id` field is underrated and I would build the scorer around it. It is a stable channel identifier, so once you have resolved an artist you can compare artist identity by id instead of by string, which sidesteps "Sidhu Moose Wala" versus "Sidhu Moosewala" and the whole romanisation problem for the artist half of the score.

The ISRC discovery changes the shape of the project. It turns a fuzzy-matching problem into an exact-lookup problem with a fuzzy fallback, and it works on Indian and Japanese catalogue as well as Western. Build that path first and measure the review queue with and without it.

**What will reliably fail.**

1. **Multi-language dubs of Indian film songs.** The RRR case. Identical duration, overlapping artist credits, similar titles, inconsistent album strings. No signal in the search response separates them. ISRC handles it, nothing else does. Given the owner is in India and Indian catalogue matters, treat this as the primary failure mode rather than an edge case.
2. **Non-Latin-script titles without an ISRC.** Japanese, Korean, Chinese, and Hindi tracks whose Spotify title is romanised while YTM's is native script, or the reverse. Character-level similarity gives zero on a correct match. Needs `microformat.tags`, a transliteration library, or acceptance that these go to review.
3. **Specific live recordings.** Venue-and-date strings are free text and will not align across services, and the requested recording is often not in the top results at all. The Hell Freezes Over query failed outright.
4. **Remaster and edition disambiguation.** Multiple near-identical rows separated by one second and an album name. Low harm, since the user gets the right song either way, so accept with reduced confidence rather than escalating.
5. **Clean versus explicit.** `isExplicit` is a badge check, so `false` conflates "clean version" with "no badge rendered". If a user cares about this distinction, we cannot honour it reliably.
6. **Anything absent from YouTube Music's catalogue.** Regional licensing gaps, podcast-adjacent audio, DJ mixes, and tracks pulled from the service. Search returns the closest thing rather than nothing, so the scorer must be willing to reject its own top result and report "no match" instead of forcing one.
7. **Deployment-level failure.** If the sidecar's host IP is bot-blocked, everything above is moot. Test this on the target host before building on the unauthenticated assumption.
