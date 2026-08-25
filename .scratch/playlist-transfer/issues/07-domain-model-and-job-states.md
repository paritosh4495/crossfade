# Transfer job domain model and state machine

Type: grilling
Status: open
Blocked by: 01
Parent: ../map.md

## Question

Pin down the vocabulary and the state machine, and write the result into `CONTEXT.md`.

- Name the entities. Transfer Job, Track Item, Provider Connection, Match Candidate are working names, not settled ones. Challenge each.
- Job states and the legal transitions between them, covering: queued, running, paused, awaiting review, finishing, completed, completed with failures, failed, expired.
- Per-track states and how they roll up into the job state.
- Pause semantics. Does pause stop mid-track or at a track boundary? Who can pause: the user, the system on rate limit, both?
- Resume after a long gap, when the provider access token has expired or been revoked.
- What identifies an anonymous user's job, how the resume link is formed, and how long it lives.
- Account claiming: how an anonymous job becomes an owned job, and what happens to jobs never claimed.
- Where provider tokens live, their lifetime, and when they are deleted. Blocked on ticket 01 because YouTube's auth shape decides whether tokens live in Spring Boot, the sidecar, or both.
- Retention: how long a completed job's track list is kept.
