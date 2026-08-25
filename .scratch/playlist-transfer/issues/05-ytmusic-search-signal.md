# What YouTube Music search returns for matching

Type: research
Status: open
Parent: ../map.md

## Question

Matching quality is capped by what the destination search can tell us. Find out what `ytmusicapi` search results actually contain.

- Result fields per track: title, artists, album, duration, `videoId`, `videoType`, explicit flag, view count, anything else usable as a matching signal.
- Is ISRC or any external identifier ever exposed? Assume no unless proven otherwise, and say so clearly.
- The song versus music-video distinction: how is it flagged, and can search be filtered to songs only?
- Query construction: does the API support structured queries, or only a free-text string? How do the `songs`, `videos`, and `albums` filters behave?
- Behaviour on non-Latin scripts, remixes, live versions, and remasters. Concrete examples beat generalities here.
- Rate limits and throttling behaviour for repeated automated searches.
- Whether unauthenticated search is possible, or whether every search needs a user context. This matters a lot: if search needs no auth, the sidecar can match before the user has connected YouTube at all.

Write access is a separate question, see ticket 01. This ticket is search only.
