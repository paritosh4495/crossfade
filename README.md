# Crossfade

Move a playlist from one music service to another. Built because switching from Spotify to YouTube Music means rebuilding hundreds of songs by hand, and nobody should have to do that.

A crossfade is the blend where one track hands off to the next. That is the idea here, one platform handing your music to another.

## Status

Planning. Nothing is implemented yet. The route from idea to spec is charted in `.scratch/playlist-transfer/map.md`, with open questions as tickets in `.scratch/playlist-transfer/issues/`.

## What v1 does

Copies a user-owned playlist between Spotify and YouTube Music, in either direction. One-shot copy, the source playlist is never touched. Tracks that match confidently are added automatically. Ambiguous ones go to a review queue you resolve yourself.

Crossfade is privately hosted for its owner and up to four other people. That is not a modesty statement, it is Spotify's rule: Extended Quota Mode requires 250,000 monthly active users and a registered company, so a solo developer is permanently capped at five hand-allowlisted users.

Transfers run as background jobs, so a 500-song playlist can be paused, closed, and picked up later.

## Planned stack

- Spring Boot backend, Java
- A thin stateless Python sidecar wrapping `ytmusicapi` for **search only**, which works unauthenticated
- Writes to YouTube go through the official YouTube Data API v3, because `ytmusicapi` cannot write on behalf of another user
- Postgres
- React, TypeScript, Vite, Tailwind, shadcn/ui

## Not in v1

Apple Music, JioSaavn, Gaana, Amazon Music, liked songs, albums, podcasts, cover art, and ongoing sync. Local files are never transferable.
