# Transfer wizard UI flow

Type: prototype
Status: open
Blocked by: 06, 07
Parent: ../map.md

## Question

What does the user actually see, from landing page to finished playlist? Build a rough clickable prototype to react to, in React with mock data and no backend.

Screens to work through:

- Landing, with no account and no explanation demanded of the user.
- Pick source provider, connect via OAuth, come back.
- Pick playlists. One at a time or several? Show track counts?
- Pick destination provider, connect, handle the case where a playlist of that name already exists.
- Progress. What a 500-track job looks like while it runs, and how pause and resume are surfaced.
- The review queue. This is the screen that decides whether the product feels good. Show a source track and its candidates, and make choosing fast enough that 40 of them is not miserable.
- Done, including partial success with tracks that were never found.
- The "come back later" path: what an anonymous user sees on returning via their resume link, and where the offer to create an account appears.

Also decide how the OAuth round trip behaves on mobile, since a phone browser is a likely entry point.

Prototype only. Throw the code away afterwards, keep the decisions.
