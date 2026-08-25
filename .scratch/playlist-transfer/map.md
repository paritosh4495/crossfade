# Map: Playlist transfer app

Label: `wayfinder:map`

## Destination

A buildable v1 spec for a multi-user web app that copies a user-owned playlist from Spotify to YouTube Music and back, with no open decisions left. The spec is written once every ticket below is resolved; writing it is the handoff, not a ticket.

## Notes

- Domain: consumer music streaming, playlist portability, third-party provider APIs.
- Stack is settled: Spring Boot backend, a thin stateless Python sidecar wrapping `ytmusicapi`, Postgres, React + TypeScript + Vite + Tailwind + shadcn/ui frontend.
- Every session: call the Skill tool for `grilling` and `domain-modeling` unless the ticket names otherwise.
- Standing preference: v1 is deliberately small. Push features to later versions rather than widening the spec.
- The owner is comfortable in Java, not Python. Any Python that exists must stay small enough to rewrite in a weekend.

## Decisions so far

<!-- the index: one line per closed ticket, enough to judge relevance, then zoom the link for the detail -->

Settled during charting, before any ticket existed:

- **Destination artifact**: a spec, not an implementation. Nothing gets built until the map is clear.
- **Audience**: multi-user public app, anyone can transfer. Accepted that Spotify Development Mode makes this invite-only in practice until Extended Quota Mode is granted.
- **Providers in v1**: Spotify and YouTube Music, both directions.
- **Transfer semantics**: one-shot copy. The source playlist is never modified or deleted.
- **Destination playlist**: create new. If one with the same name already exists at the destination, append to it instead.
- **Matching**: confidence-scored. Above threshold auto-accepts, below threshold goes to a review queue.
- **Review timing**: confident matches are written as the job runs. The job then enters `awaiting review`, the user resolves leftovers, and a second write pass finishes.
- **YouTube Music driver**: Python sidecar over `ytmusicapi`. Rejected the official YouTube Data API v3 outright (see Out of scope) and rejected porting InnerTube to Java.
- **Sidecar contract**: stateless, two jobs only, search and write. No business logic, no database.
- **Identity**: anonymous transfers tracked by browser session, optional account that claims jobs later. Pause and resume are properties of the job, not the account.
- **Transfer is a job**, not an HTTP request: persisted, per-track state, worker-processed, progress streamed to the UI.
- **Frontend**: React + TypeScript on Vite, Tailwind, shadcn/ui, deployed as static files. Thymeleaf rejected for looking dated.

## Not yet specified

<!-- in scope for v1, not yet sharp enough to ticket -->

- Retry and backoff policy when a provider is down or returns 429 mid-job. Shape depends on what [What Spotify's playlist API actually gives us](./issues/04-spotify-api-capabilities.md) finds about rate limit behaviour.
- Storage and encryption of per-user provider tokens at rest, and what happens when a refresh token is revoked mid-job.
- Rate limiting and abuse handling for public anonymous traffic.
- Observability: what a stuck job looks like from the outside, and how the owner notices.
- Account sign-in mechanics. Sign in with Google is the assumption but the session, cookie, and job-claiming details are unresolved.
- Privacy policy and data retention for stored playlist contents and tokens.

## Out of scope

<!-- beyond the v1 destination; never graduates -->

- **Apple Music**: needs a $99/year Apple Developer account before any working code exists. Deferred to a later version. The provider abstraction must accommodate it.
- **JioSaavn, Gaana, Amazon Music**: wanted eventually, out of v1. Same abstraction constraint.
- **Liked/saved songs, saved albums, followed artists, podcasts, cover art**: later versions.
- **Local files**: never transferable. v1 must skip them without crashing, which is a requirement on [What Spotify's playlist API actually gives us](./issues/04-spotify-api-capabilities.md), not a feature.
- **Ongoing sync**: v1 is one-shot copy only. Sync is a different product.
- **Modifying or deleting the source playlist**: the user is switching platforms, the old account stays as it was.
- **Official YouTube Data API v3 as the YouTube Music driver**: 10,000 quota units/day, 100 per search, 50 per insert. One 300-song playlist costs roughly 45,000 units, so three days of the app's entire quota for one playlist. It also writes music videos rather than songs.
- **Spotify Extended Quota Mode application and the developer-policy question**: owner chose to build against Development Mode first and deal with approval later. Returns as a fresh effort when v1 works.
