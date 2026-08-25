# Register the Spotify and Google developer apps

Type: task
Status: open
Parent: ../map.md

## Question

Nothing here is a decision. This is the manual provisioning that later tickets need before anything can be verified against a live API.

Checklist for the owner:

1. Create a Spotify app in the Spotify Developer Dashboard. Record the client id and secret, set a local redirect URI, and add the owner's own Spotify account email to the Development Mode user allowlist.
2. Create a Google Cloud project. Enable whichever APIs the YouTube auth research turns out to need, create an OAuth client of the type that research names, and configure the consent screen.
3. Confirm the owner has a YouTube Music account with at least one existing playlist to test against, and note whether it sits on a brand channel.

Record in the answer: where credentials are stored, the exact OAuth client type created, the redirect URIs configured, and any friction hit along the way. Later tickets depend on those facts.

Do not commit credentials.
