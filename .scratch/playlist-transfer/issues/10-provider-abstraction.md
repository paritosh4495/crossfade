# The provider abstraction

Type: grilling
Status: open
Blocked by: 04, 05
Parent: ../map.md

## Question

Define the interface a music provider implements, so that JioSaavn, Gaana, Amazon Music, and Apple Music become plugins later rather than rewrites.

- The operations every provider must support, and what a provider is allowed not to support.
- The normalised track representation that flows between providers, and which fields are optional.
- How the abstraction survives providers with very different auth: Spotify's server-side OAuth, YouTube's sidecar-mediated auth, and Apple's browser-issued user token.
- Where provider-specific code is allowed to leak: rate limits, batch sizes, pagination, and the song-versus-video distinction are all provider-shaped facts.
- Whether matching lives inside the provider or outside it. Search is provider-specific, scoring probably is not.
- How the Python sidecar sits behind this interface without the rest of the app knowing it exists.
- Which parts of the interface are shaped by having exactly two providers today, and would need to change on the third. Name them honestly rather than pretending the abstraction is universal.
