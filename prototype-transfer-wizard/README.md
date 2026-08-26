# Transfer wizard prototype — THROWAWAY

Answers issue #10: what does the user actually see, landing page to finished
playlist. One clickable flow, React + mock data, no backend. Not production
code — thrown away once the decisions below are captured into the real spec.

## Run it

```
cd prototype-transfer-wizard
npm install
npm run dev
```

Open the printed localhost URL. Use the step nav at the top to jump to any
screen you've already reached, and the floating bar at the bottom to switch
viewport (desktop/mobile OAuth) and to drive the progress screen through
different scenarios (smooth run, quota throttling, write failures) without
manually clicking through 500 fake tracks.

## Flow covered

Landing → Spotify sign-in → pick source playlists → name the destination
playlist → matching (unauthenticated YouTube search) → review queue → connect
YouTube → write progress → done.

## Decisions this prototype embodies

- **Identity and source connect are one step.** CONTEXT.md ties login itself
  to Spotify OAuth — there's no separate "connect source" action when Spotify
  is the source, because signing in already grants the read scope.
- **YouTube OAuth moves to the last step, right before writing**, per the
  issue's update: unauthenticated search means matching and the whole review
  queue can run first. The prototype does this and says so on-screen.
- **Multi-day quota spans are shown as a day-by-day ribbon**, not a stalled
  progress bar, so hitting the 200-track/day ceiling reads as expected
  pacing rather than a failure.
- **Destination name-collision handling is stated as policy, not detected
  live** — checking whether a same-named playlist exists needs a YouTube
  read, which (per the OAuth-late decision above) hasn't happened yet at
  the naming step. The copy tells the user what will happen instead of
  pretending to check.
- **Review queue is optimized for speed**: number keys 1-3 pick a candidate,
  `S` skips, one track auto-advances to the next.
- **No anonymous/resume-link screen.** Issue #10 asked for one, but
  CONTEXT.md's Identity section explicitly rules out anonymous job creation,
  resume links, and account-claiming for v1. Skipped; see the "why no
  anonymous flow?" button in the prototype's dev bar for the reasoning
  inline. **This is a real conflict between the issue and CONTEXT.md that
  the issue should be corrected to reflect** — the anonymous-user language
  in issue #10 appears to predate (or overlook) that decision.
- **Only Spotify → YouTube Music is prototyped.** The reverse direction is
  shown disabled in the playlist picker. Reading a YouTube playlist as
  Source needs YouTube OAuth up front (PlaylistReadable, not the
  unauthenticated search sidecar), so the OAuth-late trick doesn't apply
  the same way in reverse — that's a genuinely different flow, out of scope
  for this pass.

## Open questions this prototype does NOT resolve

- Whether picking several playlists at once (as opposed to one at a time)
  is actually wanted, versus a simpler single-playlist-per-run picker. The
  prototype allows multi-select and queues jobs one at a time
  (ADR-0003), but that's a guess, not a tested answer.
- Real visual design (this uses plain Tailwind, not shadcn/ui).
