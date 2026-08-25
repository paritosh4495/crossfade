# What Spotify's playlist API actually gives us

Type: research
Status: open
Parent: ../map.md

## Question

Establish the facts that the matching model and the job model both depend on.

- Reading a playlist: pagination, page size, and the total cost in requests for a 1000-track playlist.
- Track metadata available per item: ISRC and other external ids, duration, album, all artists, explicit flag, `is_local`, `is_playable`, available markets, and the track-relinking fields.
- How local files appear in a playlist response, and what breaks if you treat them as normal tracks.
- Writing: max tracks per add request, playlist size ceiling, whether duplicate tracks are permitted, and how to create a playlist with a name and description.
- Rate limits: are they documented, what does a 429 look like, is `Retry-After` returned, and is the window rolling.
- Search: what fields can be queried, whether ISRC lookup is supported, and how well it finds a track from foreign metadata.
- Development Mode mechanics: the exact user allowlist process, the cap, and what error a non-allowlisted user sees.
- OAuth scopes needed to read and write a user's own playlists.

Local files are permanently out of scope as transferable items, but v1 must skip them cleanly. Nail down how to detect them.
