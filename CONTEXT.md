# Context

Domain glossary and decisions for Crossfade. See `docs/agents/domain.md` for how this file is meant to be used.

## Glossary

- **Transfer Job** — one playlist, one direction (Spotify → YouTube Music or the reverse), one run. The aggregate root. Persisted, worker-processed, not a synchronous HTTP request. Pause and resume are properties of the job.
- **Track Transfer** — the per-track line item inside a Transfer Job. Carries its own state; job state rolls up from the set of its Track Transfers.
- **Provider Credential** — a stored OAuth token pair (access + refresh) for one user, one provider. Lives in Spring Boot, not the Python sidecar, because writes go through the official YouTube Data API v3 rather than `ytmusicapi`.
- **Match Candidate** — one of up to three ranked YouTube Music matches surfaced for a Track Transfer that didn't auto-accept. Shown in the review queue so the user picks from ranked options rather than a single guess.
- **Match score** — the numeric confidence, 0 to 1, that a Match Candidate is the same recording as the source track. Built from title similarity, artist match, duration delta, and album match, weighted 0.4/0.3/0.2/0.1.
- **Verified match** — a Match Candidate whose ISRC equals the source track's ISRC and whose duration confirms it. Auto-accepted outright, without going through the weighted match score.

### Rejected/superseded terms

- "Track Item" → renamed to Track Transfer, to read as "the per-track unit of the same operation the Transfer Job represents."
- "Provider Connection" → renamed to Provider Credential. "Connection" implied a live, stateful session; what actually exists is a stored, refreshable token pair with its own lifetime.

## Identity

No separate account entity. Login via Spotify OAuth identifies the user. At five hand-allowlisted users, the anonymous-session-plus-optional-account design considered earlier is over-built: there is no anonymous job creation, no resume link, no account-claiming flow. Every Transfer Job belongs to a known user from creation.

This is revisited only if the deferred public-demo-mode idea (unauthenticated use against curated/pasted source tracks) gets built, since that needs identity that isn't Spotify OAuth.

## Track Transfer states

```
pending → matched (auto-accepted: match score at or above 0.85, or a verified match)
        → needs_review (best match score between 0.55 and 0.85, up to 3 Match Candidates shown)
            → resolved (user picks a candidate or rejects all)
matched | resolved → written (destination write succeeded)
                   → failed (destination write exhausted retries)
pending → skipped
    reason: unsupported   (e.g. local files, can never match)
    reason: not_found     (no Match Candidate reached 0.55; never shown for review)
    reason: declined      (user rejected every Match Candidate in review)
```

Roll-up into Transfer Job state:

- Job is `awaiting review` only while at least one Track Transfer is `needs_review`.
- Job reaches `completed` only when every Track Transfer is `written` or `skipped`, with zero `failed`. Otherwise `completed with failures`.
- A job with nothing in `needs_review` skips `awaiting review` and `finishing` entirely.

## Transfer Job states and transitions

States: `queued`, `running`, `throttled`, `paused`, `awaiting review`, `finishing`, `completed`, `completed with failures`, `failed`, `expired`.

- `queued → running`: worker claims the job (Postgres `SKIP LOCKED` claim transaction, per the queue-vs-broker decision).
- `running`: confident matches write to the destination immediately, as they're matched. Writes are paced deliberately against the known daily quota ceiling rather than bursting until rate-limited. Transient 429s are retried with backoff at the Track Transfer level and never surface as a job state; a Track Transfer only becomes `failed` once its retries are exhausted.
- `running → throttled`: the daily 200-insertions ceiling (10,000 YouTube quota units/day at 50/insert) is hit. System-triggered only, never user-triggered. Not a failure.
- `running → paused`: user-triggered only. Track-boundary only — pause never interrupts a track mid-write, only stops the job from claiming the next one.
- `throttled → running` and `paused → running`: picked up automatically by the same claim/reaper loop that starts `queued` jobs, once the job is claimable again (quota window reset, or user resumed). No separate "resume" action needed, and no distinction between the app having stayed running versus the user having quit and reopened it later — the claim loop notices either way.
- Every resume (`paused → running`, `throttled → running`, `awaiting review → finishing`) first reconciles the job's Track Transfer state against the actual destination playlist contents (a 1-quota-unit read) before writing anything further. This guards against stale or lost local state, e.g. a deleted Postgres volume, and prevents duplicate writes.
- `running → awaiting review`: after the first pass, if any Track Transfer is `needs_review`.
- `running → completed` / `completed with failures`: if nothing needs review, skipping `awaiting review` and `finishing`.
- `awaiting review → finishing`: after the user resolves the review queue. Reconciles against the destination (as above), then writes the resolved Track Transfers.
- `finishing → completed` / `completed with failures`: per the Track Transfer roll-up rule.
- `→ failed`: the job pipeline itself can't proceed — e.g. the destination playlist is deleted out from under the job, or an unhandled exception kills the worker for this job. Distinct from individual Track Transfer failures (which produce `completed with failures`) and from `expired` (credential-specific).
- `→ expired`: the Provider Credential is discovered to be revoked (not merely near-expiry) during a resume attempt or the destination reconciliation read. There is no elapsed-time trigger for `expired` — a paused job costs nothing to leave alone indefinitely.

## Tokens

Provider Credentials are designed around a **verified** YouTube OAuth app. A Testing-status consent screen issues refresh tokens that expire in 7 days, which would break long-paused-job resume, but that's treated as a bring-up-only constraint to resolve before launch, not something the job/token model handles as a routine case. Access token refresh mid-transfer is standard OAuth and requires no special handling.

A Provider Credential is deleted automatically when its Transfer Job reaches `expired`, since a revoked, expired credential has no remaining value. A manual "disconnect" action per provider is also available to the user at any time.

## Retention

Completed Transfer Jobs, including their Track Transfer history, are kept indefinitely. At five allowlisted users this is low volume with no external retention obligation, and transfer history has standalone value to the user. Revisit if this ever becomes a public product.

## Open, deliberately not decided here

- Exact requests-per-second pacing budget against the YouTube Data API v3: a fact to pull from Google's published quota docs at implementation time, not domain vocabulary.
