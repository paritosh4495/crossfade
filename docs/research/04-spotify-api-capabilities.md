# What Spotify's playlist API actually gives us

Research for [issue #5](https://github.com/paritosh4495/crossfade/issues/5).

**Date checked: 2026-08-25.** All statements below reflect the Spotify Web API
documentation as published on that date. This area moved a lot in 2026. See
[Things that changed recently](#things-that-changed-recently), then re-verify
before building against it.

Unless stated otherwise, everything here describes what a **new app in
Development Mode** gets. Extended Quota Mode is explicitly exempt from the
February 2026 restrictions, but is out of reach for this project (see
[Quota modes](#quota-modes-development-vs-extended)).

---

## Headline findings

Three facts dominate the design:

1. **A new app cannot read playlists it does not own.** Since February 2026,
   `GET /playlists/{id}/items` returns contents "only for playlists the user
   owns or collaborates on". For any other playlist, including public ones,
   the `items` field is simply absent from the response. Copying an arbitrary
   public playlist by URL is no longer possible in Development Mode.
2. **Extended Quota Mode requires 250k monthly active users and a registered
   company.** Crossfade cannot get there. The app is capped at 5 allowlisted
   users, permanently, unless the eligibility bar changes.
3. **ISRC survived.** `external_ids.isrc` was marked removed in the February
   2026 changelog and then reverted in March 2026. It is available today. It is
   the single strongest matching signal Spotify hands us, and it is also the
   field most recently at risk of being pulled.

Also load-bearing: the `/tracks` → `/items` endpoint and field rename,
`available_markets` / `linked_from` / `popularity` / `preview_url` now
deprecated, and search `limit` dropped from a max of 50 to a max of **10**.

---

## Reading a playlist

| Thing | Value |
| --- | --- |
| Endpoint | `GET /v1/playlists/{playlist_id}/items` |
| Legacy endpoint | `GET /v1/playlists/{playlist_id}/tracks`, removed for Development Mode apps |
| `limit` | default 20, max **50** |
| `offset` | default 0 |
| `market` | optional, ISO 3166-1 alpha-2 |
| `fields` | optional response filter, e.g. `items(item(name,external_ids,duration_ms))` |
| `additional_types` | `track` (default) and/or `episode` |
| Paging envelope | `href`, `limit`, `next`, `offset`, `previous`, `total`, `items[]` |
| Scope | `playlist-read-private` (plus `playlist-read-collaborative` for collaborative playlists) |

Each element of `items[]` is a `PlaylistTrackObject`:
`added_at`, `added_by`, `is_local`, and `item` (the track or episode).
`track` still appears as a deprecated alias of `item`.

### Cost of a 1000-track playlist

- **21 requests**: 1× `GET /playlists/{id}` for metadata (name, description,
  `items.total`, `snapshot_id`) + 20× `GET /playlists/{id}/items?limit=50`
  (ceil(1000 / 50) = 20).
- **20 requests** if you skip the metadata call and drive pagination purely off
  `next`.
- Follow `next` rather than incrementing `offset` yourself; it survives page
  size changes.

`GET /playlists/{id}` also embeds the first page of items under `items.items`,
so a playlist of ≤ 20 tracks costs exactly 1 request if you read it from there.

---

## Track metadata, field by field

From `TrackObject` inside a playlist item. "Deprecated" markers are Spotify's
own, taken from the Get Playlist Items reference page on 2026-08-25.

| Field | Type | Presence | Notes for matching |
| --- | --- | --- | --- |
| `id` | string | Always for catalogue tracks; **`null` for local files** | Spotify's own ID, useless to YouTube Music |
| `uri` | string | Always | `spotify:track:{id}`, or `spotify:local:...` for local files |
| `name` | string | Always | Includes remaster/feat. suffixes; needs normalising |
| `duration_ms` | integer | Always | Present even for local files. Best cheap tiebreaker after ISRC |
| `explicit` | boolean | Always | `false` also means "unknown", per the docs. Do not treat as authoritative |
| `disc_number` | integer | Always (0 for local files) | |
| `track_number` | integer | Always (0 for local files) | |
| `type` | string | Always | `"track"`. Items can also be `"episode"`, which is a different object shape |
| `is_local` | boolean | Always | **The local-file detector.** See below |
| `artists[]` | array of SimplifiedArtistObject | Always, all credited artists | Each has `name`, `id`, `uri`, `href`, `external_urls`. Featured artists are included here, not only in `name` |
| `album` | SimplifiedAlbumObject | Always | `name`, `album_type`, `total_tracks`, `release_date`, `release_date_precision`, `images[]`, `artists[]` |
| `album.release_date_precision` | string | Always | `year` / `month` / `day`. Never assume a full date |
| `external_ids.isrc` | string | **Conditional.** Present for most catalogue tracks, absent for some; `{}` for local files | Removed Feb 2026, **restored March 2026**. Primary matching key |
| `external_ids.ean` / `.upc` | string | Rare | Ignore |
| `external_urls.spotify` | string | Always for catalogue tracks | Good for the UI / audit trail |
| `href` | string | Always for catalogue tracks; `null` for local files | |
| `is_playable` | boolean | **Conditional**, only when Track Relinking applies, i.e. when `market` is supplied | Absent if you omit `market` |
| `linked_from` | object | **Conditional** and **deprecated** | Present only when relinking substituted a track; carries the originally requested track |
| `restrictions.reason` | string | **Conditional** | `market` / `product` / `explicit`, and Spotify warns more values may be added |
| `available_markets[]` | array | **Deprecated** | Do not build on it |
| `popularity` | integer | **Deprecated** | Removed for Development Mode apps; no longer a usable ranking signal |
| `preview_url` | string \| null | **Deprecated**, nullable | Also policy-restricted: preview clips may not be offered as a standalone service |

**Track relinking.** If you pass `market`, Spotify may swap the track for a
market-equivalent one and add `is_playable` plus `linked_from` (the original).
Since `linked_from` is deprecated, the safe posture for Crossfade is to **omit
`market` entirely** when reading a playlist for transfer. We want the track the
user actually saved, not a market substitution, and the ISRC of the relinked
track can differ from the original. Omitting `market` also means `is_playable`
will not be present. Accept that and do not branch on it.

---

## Local files

### How they appear

They are ordinary-looking `items[]` entries with `is_local: true`. The track
object has the same shape as a real track, but hollowed out:

```json
{
  "is_local": true,
  "track": {
    "album": {
      "album_type": null, "available_markets": [], "external_urls": {},
      "href": null, "id": null, "images": [],
      "name": "Donkey Kong Country: Tropical Freeze", "type": "album", "uri": null
    },
    "artists": [
      { "external_urls": {}, "href": null, "id": null,
        "name": "David Wise", "type": "artist", "uri": null }
    ],
    "available_markets": [], "disc_number": 0, "duration_ms": 127000,
    "explicit": false, "external_ids": {}, "external_urls": {},
    "href": null, "id": null, "name": "Snomads Island", "popularity": 0,
    "preview_url": null, "track_number": 0, "type": "track",
    "uri": "spotify:local:David+Wise:Donkey+Kong+Country%3A+Tropical+Freeze:Snomads+Island:127"
  }
}
```

Null / empty / zero: `id`, `href`, `album.id`, `album.href`, `album.uri`,
`album.album_type`, `artists[].id`, `artists[].href`, `artists[].uri`,
`preview_url`. Empty: `external_ids`, `external_urls`, `available_markets`,
`album.images`. Zero: `disc_number`, `track_number`, `popularity`.

Populated from the file's tags, best effort: `name`, `album.name`,
`artists[].name`, `duration_ms`. Spotify explicitly warns this metadata "is not
guaranteed to exist for all local files". Assume any of it can be missing too.

### How to detect them

**Use `is_local` on the playlist item (the outer object), and treat
`item.uri` starting with `spotify:local:` as a belt-and-braces second check.**
Do not detect by parsing the URI's five colon-delimited segments
(`spotify:local:{artist}:{album}:{title}:{duration_seconds}`). The segments are
URL-encoded and the album title in the example above itself contains an encoded
colon. Spotify's own docs say parsing it "should not be necessary".

Note the outer `is_local` and the inner `item.is_local` are separate fields.
Prefer the outer one; it is the field the docs name as the determinant.

### What breaks if you treat them as normal tracks

- `track.id` is `null` → any `NOT NULL` column or `UUID.fromString`-style parse
  on the Spotify track ID throws. This is the most likely v1 crash.
- `external_ids` is `{}` → no ISRC, so the ISRC-first matching path yields
  nothing and falls through to fuzzy text matching on possibly-garbage tag data.
- `album.uri`/`artists[].uri` are `null` → any URI-based dedupe key or lookup
  NPEs.
- Reverse direction: `spotify:local:...` URIs **cannot be added to a playlist**
  via the Web API ("It is not currently possible to add local files to playlists
  using the Web API, but they can be Reordered or Removed"). Sending one to
  `POST /playlists/{id}/items` will not work.
- `duration_ms` from a file tag may be rounded to whole seconds (the URI carries
  seconds), so duration scoring against a real catalogue track is coarse.

**Recommendation:** filter on `is_local` at ingest time, before the per-track
rows are written, and record them as a `SKIPPED_LOCAL_FILE` terminal state with
the name/artist preserved for the user-facing report. Never let one reach the
matcher.

---

## Writing

| Thing | Value |
| --- | --- |
| Add endpoint | `POST /v1/playlists/{playlist_id}/items` |
| Max URIs per add request | **100** |
| Body | `{"uris": ["spotify:track:...", ...], "position": 0}` |
| `position` | zero-based insertion index; appends if omitted |
| Query vs body | Query-string `uris` takes precedence over the body if both are sent. Use the body |
| Success | `201 Created`, returns `{"snapshot_id": "..."}` |
| Create playlist | `POST /v1/me/playlists` (the old `POST /users/{user_id}/playlists` is removed) |
| Create body | `name` (required), `description` (optional), `public` (default `true`), `collaborative` (default `false`) |
| Create success | `201 Created`, full playlist object |
| Scopes | `playlist-modify-public` for public playlists, `playlist-modify-private` for private ones |

- **Cost to write 1000 tracks:** 1 create + 10 adds = **11 requests**
  (ceil(1000 / 100) = 10). Send batches sequentially in playlist order; a
  parallel fan-out will scramble ordering unless every call carries an explicit
  `position`.
- **Duplicates are permitted.** The API does not reject a URI already present;
  it appends it again. Crossfade must dedupe on its own side if that is the
  desired behaviour, and should be careful about retrying a partially-succeeded
  batch, and a naive retry duplicates up to 100 tracks. Use `snapshot_id` to detect
  whether a write landed before retrying.
- **Playlist name uniqueness:** none. "Playlist names do not need to be unique;
  a user may have several playlists with the same name." So a retried transfer
  can silently create a second identically-named playlist. Store the created
  playlist ID on the job row before adding any tracks.
- **Playlists per user:** the Create Playlist reference states users are
  "generally limited to a maximum of 11000 playlists".
- **Playlist size ceiling:** *not documented in the Web API reference.* The
  10,000-items-per-playlist figure widely quoted for the Spotify client is not
  stated on any of the API pages checked. Treat it as an unverified client-side
  limit; do not encode it as a hard assumption, but do handle an unexpected
  4xx on a large add gracefully.
- `collaborative: true` requires both modify scopes and requires `public: false`.

---

## Rate limits and quota

Two separate mechanisms, and the docs are explicit that they are different.

**Rate limit.** Documented but *unquantified*: "calculated based on the number
of calls that your app makes to Spotify in a **rolling 30 second window**". No
number is published; it "varies depending on whether your app is in development
mode or extended quota mode", and individual endpoints may carry their own
limits. Exceeding it returns **429**, and "the header of the 429 response will
normally include a `Retry-After` header with a value in seconds."

Note the hedge, *normally*. Code defensively. parse `Retry-After` when present,
fall back to exponential backoff with jitter when it is not.

**Quota.** Separate from rate limiting. Endpoints are grouped into "quota
buckets" with shared limits; "the specific groupings and limits are subject to
change" and are not published. Since July 2026, quota is counted **per developer
account**, not per Client ID. Exceeding it also returns 429, distinguishable by
the body:

```json
{
  "error": {
    "status": 429,
    "message": "Too many requests",
    "reason": "QUOTA_EXCEEDED"
  }
}
```

**Implication for the job model:** a 429 handler must branch on
`error.reason == "QUOTA_EXCEEDED"`. A rate-limit 429 is a short pause
(`Retry-After`, seconds). A quota 429 is not something a 30-second backoff
fixes. The job should park and surface a distinct failure state rather than
burn retries. Given the window is rolling and the limit is unpublished, the
worker should be globally throttled per developer account, not per job.

---

## Search

`GET /v1/search`.

| Param | Value |
| --- | --- |
| `q` | required |
| `type` | required; comma-separated: `album`, `artist`, `playlist`, `track`, `show`, `episode`, `audiobook` |
| `market` | optional, ISO 3166-1 alpha-2 |
| `limit` | **default 5, max 10** (was default 20, max 50 before February 2026) |
| `offset` | default 0, max 1000 |
| `include_external` | `audio` |

**Field filters** in `q`:

| Filter | Applies to |
| --- | --- |
| `artist:` | albums, artists, tracks |
| `album:` | albums, tracks |
| `track:` | tracks |
| `year:` | albums, artists, tracks. Single year or range, `year:1955-1960` |
| `genre:` | artists, tracks |
| **`isrc:`** | **tracks only** |
| `upc:` | albums only |
| `tag:new` | albums only (last two weeks) |
| `tag:hipster` | albums only (bottom 10% popularity) |

**ISRC lookup is supported.** `q=isrc:USUM71703861&type=track`. This is the
exact reverse-direction primitive Crossfade needs: given an ISRC obtained from
YouTube Music, resolve it to a Spotify track. Note it is a *search*, not a
lookup, so it can return zero results, and it can return several (the same
recording appears under one ISRC on a single, an album and a compilation). Take
duration and album type into account when picking among them.

**Recovering a track from foreign or approximate metadata.** Spotify publishes
no accuracy guarantee, so this is a design constraint rather than a documented
fact. What the docs do establish:

- Free-text `q` is a fuzzy match; the documented example (`remaster track:Doxy
  artist:Miles Davis`) mixes free text with filters, which is the intended shape
  for approximate input.
- Over-constraining hurts. `album:` filters are brittle across regional
  releases, and `year:` breaks on reissues where the catalogue year differs from
  the original. Query `track: + artist:` first, then fall back to bare free text.
- **The max-10 limit is the real change here.** A recall strategy that relied on
  pulling 50 candidates and rescoring locally now needs either `offset`
  pagination (more requests, more rate-limit pressure) or a tighter first query.
  Budget on 10 candidates per query.
- Diacritics, non-Latin scripts and transliterations are not addressed anywhere
  in the docs. Assume ISRC-first, and treat text search as the degraded path.
- **Bulk lookup is gone.** `GET /tracks?ids=` (up to 50 at once) was removed for
  Development Mode apps; it is one request per track via `GET /tracks/{id}` now.
  Any matching design that assumed batch hydration needs rewriting.

---

## Quota modes, Development vs Extended

### Development Mode

- Newly created apps start here.
- **Cap: 5 authenticated Spotify users.** Every user must be on the allowlist.
- **The app owner must have an active Spotify Premium account** for the app to
  function at all. If Premium lapses the app stops working and resumes on
  resubscription. (Introduced February 2026.)
- **Allowlist mechanics:** Developer Dashboard → app → Settings → *Users
  Management* → *Add new user* → enter the user's **name and Spotify email
  address**. Then invite them to install the app. It is manual, per user, and
  requires knowing their Spotify account email.
- **Non-allowlisted user error:** they may successfully log in and complete
  OAuth, but "API requests with an access token associated to that user and app
  will receive a **403** status code error." The failure surfaces on the first
  API call, not at login, so the UI must handle an authenticated-but-forbidden
  state.
- **Client IDs per developer:** 1 as of February 2026, raised to **25** in July
  2026. Quota is shared across all of a developer's Development Mode Client IDs,
  so spinning up 25 apps does not multiply throughput and does not lift the
  5-users-per-app cap in any useful way.

### Extended Quota Mode

Unlimited users, no allowlist, higher rate limit, and exemption from every
February 2026 restriction. Requirements, all of which must be met:

1. Established business entity, a legally registered business or organisation.
   **As of 15 May 2025 Spotify accepts applications from organisations only, not
   individuals.**
2. An active, launched service.
3. **At least 250,000 monthly active users.**
4. Availability in key Spotify markets.
5. Commercial viability.
6. Adherence to Spotify's terms.

Applications go through a form, from a company email address. Review takes up to
six weeks, and app review evaluates compliance with the Developer Policy.

**This is a hard blocker for "multi-user public web app".** You cannot reach
250k MAU while capped at 5 users, and the application requires a registered
company. Crossfade is a 5-user tool on Spotify's side for the foreseeable
future.

---

## Does the Developer Policy allow a playlist migration tool?

The relevant clauses are in Section III, "Some prohibited applications". Two
matter, and they pull in opposite directions.

**Explicitly permitted (the carve-out that saves the project):**

> Do not build an SDA that enables the transfer of data to another service,
> except for the purpose of enabling a user to transfer their personal data, or
> the metadata of the user's playlists to another service.

Crossfade transfers the metadata of the user's own playlists. That is the named
exception. **Playlist migration is allowed, provided it moves metadata only, at
the user's initiative, and only for that user's own playlists.**

**The clause to watch:**

> Do not create any product or service which is integrated with streams or
> content from another service.

Read strictly, a Spotify↔YouTube Music tool is "integrated with content from
another service". The saving distinction is that Crossfade never plays,
streams, or displays audio from either service. It moves text metadata. Keep
that true. Specifically: **do not embed a YouTube/YouTube Music player, do not
show YouTube content alongside Spotify content in the same view, and do not
surface Spotify audio previews.** The moment there is playback in the product,
the exception in the transfer clause stops covering it.

**Other clauses that constrain us:**

- *Do not use the Spotify Platform or any Spotify Content to train a machine
  learning or AI model or otherwise ingest Spotify Content into a machine
  learning or AI model.*
  **This forbids training a matching model on Spotify
  metadata.** Deterministic scoring (ISRC equality, string distance, duration
  delta) is fine. Feeding Spotify track data into an embedding model or an LLM
  to do matching is not. If the matcher was ever going to be learned rather than
  rule-based, it can't be. It also means no sending Spotify track metadata to a
  third-party LLM API for fuzzy matching.
- *Do not analyze the Spotify Content or the Spotify Service for any purpose,
  including ... creating new or derived listenership metrics, benchmarking, ...
  usage statistics, user metrics, or building profiles of users.*
  No analytics
  built on the catalogue data we pull.
- *Do not build products or services that mimic, replicate or attempt to replace
  a core user experience of Spotify ... Your product or service must add
  independent value.*
  A transfer tool adds independent value; a Spotify client
  clone does not.
- *Do not build products or services which are targeted for use by businesses.*
  Personal use only.
- Audio preview clips "may not be offered as a standalone service or product."

---

## OAuth scopes

To read and write a user's own playlists, and nothing more:

| Scope | Spotify's description | Why Crossfade needs it |
| --- | --- | --- |
| `playlist-read-private` | Read access to user's private playlists. | List `GET /me/playlists` and read `GET /playlists/{id}/items` |
| `playlist-read-collaborative` | Include collaborative playlists when requesting a user's playlists. | Collaborative playlists are otherwise invisible, and they are among the ones whose contents we're still allowed to read |
| `playlist-modify-public` | Write access to a user's public playlists. | Create and populate a public destination playlist |
| `playlist-modify-private` | Write access to a user's private playlists. | Create and populate a private destination playlist |

That is the full set: **four scopes.**

- Reading a *public* playlist owned by the user still goes through
  `playlist-read-private` in practice, because the listing endpoint is
  `/me/playlists`.
- `ugc-image-upload` is only needed if Crossfade sets a custom playlist cover.
  Not required for v1.
- `user-read-private` / `user-read-email` are **not** needed for playlist work.
  Skip them; the February 2026 changes removed `country`, `email`, `product` and
  `explicit_content` from `GET /me` for Development Mode apps anyway.
- For linking a Spotify account to a Crossfade user record, use the
  `account_id` field added to the user object in May 2026, a "public,
  immutable, pseudoanonymous identifier for the user's account", explicitly
  recommended for account linking and stable for the account's lifetime.
  Prefer it over `id` or email.
- `collaborative: true` on create requires both `playlist-modify-private` and
  `playlist-modify-public`.

---

## Things that changed recently

A compressed timeline, because most third-party writeups predate all of it.

| Date | Change |
| --- | --- |
| 15 May 2025 | Extended Quota Mode applications accepted from organisations only |
| 6 Feb 2026 | Development Mode restrictions announced |
| 11 Feb 2026 | New Development Mode apps created under the new restrictions |
| 9 Mar 2026 | Existing Development Mode apps migrated to the restrictions |
| Mar 2026 | `external_ids` **reverted**, stays available on Track and Album |
| May 2026 | `account_id` added to the user object |
| Jul 2026 | Client IDs per developer raised 1 → 25; quota counted per developer account; `QUOTA_EXCEEDED` reason documented on 429 |

What February 2026 took away from Development Mode apps, relevant to us:

- `GET/POST/PUT/DELETE /playlists/{id}/tracks` → `/items`; response fields
  `tracks` → `items`, `tracks.tracks` → `items.items`,
  `tracks.tracks.track` → `items.items.item`
- `POST /users/{user_id}/playlists` → `POST /me/playlists`
- `GET /users/{id}` and `GET /users/{id}/playlists` removed outright
- `GET /tracks?ids=` and all other batch fetch endpoints removed
- `GET /artists/{id}/top-tracks`, `GET /markets`, browse endpoints removed
- Track fields removed: `available_markets`, `linked_from`, `popularity`
  (`external_ids` was on this list and was reverted)
- Search `limit` max 50 → 10, default 20 → 5

**Caveat on the concept pages.** The Playlists and Local Files concept pages
still show the pre-rename `"track"` key in their JSON examples, while the API
reference uses `"item"`. The reference pages are the ones that were updated.
Where the two disagree, trust the reference. Code should read `item` and fall
back to `track`.

---

## Open questions

- The exact playlist item ceiling is undocumented in the Web API reference.
  Worth an empirical check before promising to transfer very large playlists.
- Rate limit and quota numbers are both unpublished. Throughput planning has to
  be empirical, with a global throttle and adaptive backoff rather than a fixed
  request budget.
- ISRC coverage across the Spotify catalogue is not quantified anywhere. The
  fallback text-matching path will carry more traffic than an ISRC-first design
  implies; measure the miss rate early.
- Whether `external_ids` stays. It was removed once in February 2026 and only
  restored a month later. The matching design should degrade to text-only rather
  than assume ISRC forever.

---

## Sources

All checked 2026-08-25.

- [Get Playlist Items](https://developer.spotify.com/documentation/web-api/reference/get-playlists-items)
- [Get Playlist Items (deprecated `/tracks`)](https://developer.spotify.com/documentation/web-api/reference/get-playlists-tracks)
- [Get Playlist](https://developer.spotify.com/documentation/web-api/reference/get-playlist)
- [Get Current User's Playlists](https://developer.spotify.com/documentation/web-api/reference/get-a-list-of-current-users-playlists)
- [Add Items to Playlist](https://developer.spotify.com/documentation/web-api/reference/add-items-to-playlist)
- [Add Items to Playlist (deprecated `/tracks`)](https://developer.spotify.com/documentation/web-api/reference/add-tracks-to-playlist)
- [Create Playlist](https://developer.spotify.com/documentation/web-api/reference/create-playlist)
- [Search for Item](https://developer.spotify.com/documentation/web-api/reference/search)
- [Playlists (concepts)](https://developer.spotify.com/documentation/web-api/concepts/playlists)
- [Rate Limits](https://developer.spotify.com/documentation/web-api/concepts/rate-limits)
- [API Calls](https://developer.spotify.com/documentation/web-api/concepts/api-calls)
- [Quota Modes](https://developer.spotify.com/documentation/web-api/concepts/quota-modes)
- [Authorization Scopes](https://developer.spotify.com/documentation/web-api/concepts/scopes)
- [February 2026 Dev Mode Changes, Migration Guide](https://developer.spotify.com/documentation/web-api/tutorials/february-2026-migration-guide)
- [Changelog, February 2026](https://developer.spotify.com/documentation/web-api/references/changes/february-2026)
- [Changelog, March 2026](https://developer.spotify.com/documentation/web-api/references/changes/march-2026)
- [Changelog, May 2026](https://developer.spotify.com/documentation/web-api/references/changes/may-2026)
- [Changelog, July 2026](https://developer.spotify.com/documentation/web-api/references/changes/july-2026)
- [Spotify Developer Policy](https://developer.spotify.com/policy)
