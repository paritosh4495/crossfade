# YouTube Music write access for arbitrary users

Type: research
Status: open
Parent: ../map.md

## Question

How does a random user of a public web app grant this app permission to create and write playlists in *their* YouTube Music library, via `ytmusicapi` running in the sidecar?

This is the single riskiest unknown on the map. If there is no workable per-user write auth, the whole product changes shape.

Answer specifically:

- What auth methods does current `ytmusicapi` support for write operations? Browser header/cookie paste, OAuth, anything else?
- If OAuth: which Google Cloud OAuth client type is required, what is the grant flow from the user's point of view, and does it involve a device-code screen?
- What scopes are needed, and are they subject to Google's OAuth verification or restricted-scope review?
- Token lifetime and refresh: can the sidecar hold a per-user refresh token server-side and use it hours later when a paused job resumes?
- Does write auth work for accounts with YouTube Music brand/channel selection, and how is the target channel chosen?
- What are the practical rate limits and ban risks for server-side automated writes?
- Is cookie-paste the only thing that actually works today? If so, say so plainly, because that would make the public multi-user flow unbuildable as specified.

Empirical verification needs credentials from ticket 11, but the documentation-level answer does not. Do the reading first.
