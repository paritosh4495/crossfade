# What JioSaavn's playlist API actually gives us

Research for [issue #15](https://github.com/paritosh4495/crossfade/issues/15).

**Date checked: 2026-08-25.** All statements below reflect JioSaavn's published
Terms of Use, its API Policy (dated 11.08.2026 — two weeks before this check),
and the state of the public unofficial-API ecosystem on GitHub as of that date.

---

## Headline findings

1. **There is no official public developer API.** JioSaavn's own API Policy
   states the API is "a private, restricted interface" for "the exclusive use
   of JioSaavn and its Licensed Affiliates," that "no right of access is
   granted to the public, to developers, to researchers... or to any other
   person," and that any other access "will be considered as Unauthorised
   Use... and will be legally pursued." There is no registration form, no
   scope model, no quota — because there is no program to register for.
2. **JioSaavn published a new, unusually explicit API Policy on 11 August
   2026** — three months before v1 of this project and two weeks before this
   check. It names "playlist data" specifically as protected content, defines
   "API" broadly enough to cover undocumented/internal endpoints, and states
   that the absence of a rate limit or auth challenge on an endpoint "does not
   constitute a grant of access." One of the more actively developed unofficial
   wrappers (`rajput-hemant/jiosaavn-api`) discontinued itself and stripped its
   source in June 2026, before this policy was even published, which suggests
   the unofficial ecosystem was already retreating on its own.
3. **The unofficial ecosystem is read-only and does not do what the issue
   asks.** Every unofficial JioSaavn "API" surveyed (several GitHub projects,
   the most complete being `sumitkolhe/jiosaavn-api`) is a thin wrapper around
   JioSaavn's own internal, unauthenticated web endpoint
   (`www.jiosaavn.com/api.php?__call=playlist.getDetails...`). They can fetch a
   playlist **you already know the ID or URL of** — i.e. a public playlist —
   because that endpoint needs no login. **None of them can list "my
   playlists" for a logged-in user, and none implement any login/auth flow at
   all.** No create-playlist or add-track write path exists in any repo
   inspected.
4. **No ISRC-equivalent field exists anywhere in the unofficial schema.**
   Track metadata is title, artist(s), album, duration, year, label,
   JioSaavn's own internal song ID — nothing that maps to an industry
   recording identifier. Matching against Spotify/YouTube Music would be
   fuzzy-text-and-duration only, with no ISRC-first path at all.

---

## Official developer program

There isn't one. Searches for "JioSaavn developer API," "JioSaavn API docs,"
and probes of `jiosaavn.com/developers`, `/developer`, `/api`, `/api-docs`,
and `/partners` turned up nothing resembling a Spotify- or Google-style
developer portal, no registration flow, and no scopes/quota documentation.
The only JioSaavn-authored document that even uses the word "API" is the
API Policy discussed below, and it exists specifically to say access is not
granted (see [Terms of Service and API Policy](#terms-of-service-and-api-policy-risk)).

**Confidence: high.** This is an absence claim, so it rests on the API Policy's
own explicit "no right of access is granted to the public" language plus
failure to find a portal, rather than on a positive documentation trail — but
the API Policy text is about as direct a confirmation as a primary source can
give.

---

## The unofficial API landscape

All of the unofficial "APIs" found on GitHub are wrappers around the same
thing: JioSaavn's own internal endpoint used by its website,
`www.jiosaavn.com/api.php?__call=<method>&_format=json`, called with methods
like `playlist.getDetails`, `song.getDetails`, `search.getResults`. This
endpoint needs no authentication because it's the same one the public website
uses to render a song or playlist page. Every wrapper below re-implements a
client for it; none of them talk to anything requiring a logged-in session.

| Project | Language | Last push | Open issues | Status |
| --- | --- | --- | --- | --- |
| [`sumitkolhe/jiosaavn-api`](https://github.com/sumitkolhe/jiosaavn-api) | TypeScript (Bun/Hono) | 2026-06-23 | 63 | Not archived, most actively developed of the set. Documented at `saavn.dev/docs` — **that domain no longer resolves** (`NXDOMAIN` as of this check). Its alternate hosted instance, `saavn.sumit.co`, returned HTTP 429 / Cloudflare error `1027` on every request made during this research |
| [`cyberboysumanjay/JioSaavnAPI`](https://github.com/cyberboysumanjay/JioSaavnAPI) | Python 3 | 2024-08-08 | 11 | Over two years stale, not formally archived |
| [`rajput-hemant/jiosaavn-api`](https://github.com/rajput-hemant/jiosaavn-api) | TypeScript (Hono) | 2026-06-12 | 7 | **Archived.** Last commit message: "Discontinue project and remove public API source." README now reads only: "Project Discontinued. This repository no longer contains source code, documentation, deployment instructions, or hosted-service information for the former API project. No public hosted instance is operated or maintained by me." |
| `vidyasagar1432/jiosaavn-api`, `anxkhn/jiosaavn-api`, `naveennamani/JioSaavnAPI`, `adityaprakashgupta/Jio-Saavn-API`, `rajput-hemant/jiosaavn-api-rs`, `rpakishore/JiosaavnDownloader` | Mixed | Not individually audited | — | Long tail of smaller forks/clones following the same `api.php` pattern. Not inspected in depth; no reason to expect any of them differ on the read-only/no-auth finding, since they all wrap the same underlying endpoint |

`sumitkolhe/jiosaavn-api`'s own maintainer, replying to an issue titled
["Is using this API legal?"](https://github.com/sumitkolhe/jiosaavn-api/issues/32)
(opened March 2023), wrote: *"Jio most likely knows about the loopholes in
their APIs and still they haven't fixed it for a long time now, so it's on
them to fix the issues."* That is the closest thing to a legal opinion
anywhere in the ecosystem, and it is a "they haven't stopped us yet" argument,
not a legal assessment. It also predates the 11 August 2026 API Policy by
over three years.

**Confidence: medium-high** on what exists and its maintenance state (verified
against GitHub's own commit/push metadata via `gh api`, not blog summaries).
**Low** on how long any given instance stays reachable — one host was
rate-limited/blocked outright during this single research session, and a
comparable project was fully discontinued mid-2026.

---

## Reading a playlist

Verified by reading the source of `sumitkolhe/jiosaavn-api` (the most
complete, most recently pushed wrapper) directly via the GitHub API, module by
module.

| Thing | Value |
| --- | --- |
| Playlist lookup | By JioSaavn playlist **ID** or **share URL** only (`get-playlist-by-id`, `get-playlist-by-link` use cases). No "list my playlists" use case exists anywhere in the codebase |
| Auth module | **None exists in the repository.** No login, no OTP, no session/cookie handling, no token module, in any file under `src/` |
| Underlying call | `GET www.jiosaavn.com/api.php?__call=playlist.getDetails&...` — the same unauthenticated endpoint the public website's playlist page uses |
| Practical implication | You can pull a **public** playlist if you already have its ID/URL — the same capability as "paste a public playlist link." You **cannot** enumerate a signed-in user's own playlists, public or private, through any surveyed unofficial API |

This directly fails the read requirement in the issue: "can an unofficial or
official path list a user's own playlists and their tracks." **No.** The only
read capability that exists anywhere in the unofficial ecosystem is
look-up-by-known-ID of a public playlist, which is a different and much
narrower capability than what Spotify's `GET /me/playlists` or YouTube
Music's equivalent gives Crossfade.

---

## Track metadata, field by field

From `SongModel` in `sumitkolhe/jiosaavn-api` (`src/modules/songs/models/song.model.ts`),
which is what a playlist's `songs[]` array is built from.

| Field | Notes for matching |
| --- | --- |
| `id` | JioSaavn's own internal song ID. Useless outside JioSaavn |
| `name` | Track title, includes JioSaavn's own formatting conventions |
| `album.id` / `album.name` / `album.url` | Album name only, no further album metadata (no release-type, no track count) |
| `artists.primary` / `.featured` / `.all` | Each artist has `id`, `name`, `role`, `image`, `type`, `url` — no external ID |
| `duration` | Seconds, nullable |
| `year` / `releaseDate` | Both present, both nullable |
| `language` | Present — useful for disambiguating regional re-recordings, which are common in this catalogue |
| `label`, `copyright` | Present, low matching value |
| `hasLyrics` / `lyricsId` | Not useful for transfer matching |
| `playCount`, `explicitContent` | Present, not matching-relevant |
| **ISRC or any other cross-service identifier** | **Absent.** Not in this model, not in the raw `SongAPIResponseModel` either. There is nothing in the entire schema that maps to an industry recording identifier |

**Consequence for a matcher:** there is no ISRC-first path in either
direction. Any Crossfade↔JioSaavn matching design would have to fall back
immediately to the degraded text-matching path that the Spotify research
(`04-spotify-api-capabilities.md`) treats as a last resort — for every track,
not as an occasional miss.

---

## Writing

**Nothing found, anywhere.** No GitHub repo, no documentation site, no forum
post surfaced by search describes a create-playlist or add-track-to-playlist
capability against JioSaavn, official or unofficial. Every unofficial project
inspected wraps read-only, unauthenticated JioSaavn website endpoints; none
implement the authenticated app/session traffic that JioSaavn's own clients
must use internally to let a user create a playlist and add songs (confirmed
this exists as a first-party feature via JioSaavn's own help center article,
["How do I create or add songs to my playlist?"](https://help.jiosaavn.com/hc/en-us/articles/360020259552-How-do-I-create-or-add-songs-to-my-playlist),
which walks through the in-app "three dots → add to playlist" flow and a
"Create Playlist" button under My Library on jiosaavn.com — client-side
buttons, not an API).

**Auth required, if this were built:** unknown in detail, and that unknown is
itself the finding. Building a write path would mean reverse-engineering the
authenticated traffic of JioSaavn's own mobile app or logged-in web session
(likely cookie- or token-based, tied to whatever login method — the Terms of
Use only says "sign up for an account, and select a password and username,"
without specifying phone-OTP, email, or social login as the mechanism, and no
primary source checked here pins that down further). Nobody in the surveyed
unofficial-API ecosystem has published this, which is itself informative:
reverse-engineered write access to a consumer app's authenticated session is a
materially bigger undertaking than wrapping a public read-only JSON endpoint,
and apparently nobody has found it worth publishing, or has kept it private.

---

## Terms of Service and API Policy risk

Two separate JioSaavn-authored documents matter here, both hosted on
`jiosaavn.com` under the entity **Saavn Media Limited** — not a bundled
Reliance Jio telecom terms-of-service. Saavn Media Limited is a subsidiary of
Reliance Industries Limited, formed when Reliance's JioMusic and Saavn merged
into JioSaavn in 2018; JioSaavn maintains its own dedicated legal documents
distinct from Reliance Jio Infocomm's telecom ToS.

### 1. Main Terms of Use (`jiosaavn.com/corporate/terms/`)

The operative clause, under "Your Use of JioSaavn":

> You agree not to access (or attempt to access) any of the Services by any
> means other than through the interface that is provided by JioSaavn, unless
> you have been specifically allowed to do so in a separate agreement with
> JioSaavn. You specifically agree not to access (or attempt to access) any of
> the Services through any automated or unofficial means (**including use of
> scripts or web crawlers or programming interfaces**) and shall ensure that
> you comply with the instructions set out in any robots.txt file present on
> the Services.

"Programming interfaces" is named explicitly, alongside scripts and crawlers.
This forecloses the entire unofficial-API approach on its face, not just
scraping the website's HTML.

Also present, mirroring Spotify's Developer Policy and Gaana's ToS on the AI
point:

> You specifically agree to not use the Content or Services on the JioSaavn
> Platform to train any Large Language Models (LLMs) or for machine learning
> or any Artificial Intelligence (A.I) model/system...

Disputes are resolved by binding arbitration in Mumbai, India (Arbitration and
Conciliation Act, 1996), with an opt-out window of 30 days from first
acceptance and courts of Mumbai as the fallback venue.

### 2. API Policy (`jiosaavn.com/corporate/api-policy`, PDF, "Updated on 11.08.2026")

This is a standalone document, separate from the general Terms of Use, and it
is considerably more aggressive than anything in the Spotify or Gaana
research. Key clauses, quoted directly:

> The API is a private, restricted interface. It is provided for the
> exclusive use of JioSaavn and its Licensed Affiliates. No right of access is
> granted to the public, to developers, to researchers, to academics, to
> journalists, to archivists, or to any other person, whether or not the
> intended purpose is educational or commercial. Access by any person other
> than JioSaavn is permitted only where that person holds valid credentials
> issued by JioSaavn. **Any other access will be considered as Unauthorised
> Use, is a circumvention of technological protection measures, and will be
> legally pursued.**

> This Policy applies to every API, **whether or not documented, whether or
> not publicly announced, whether or not protected by TPM**... The absence of
> documentation, the absence of a rate limit, the absence of an
> authentication challenge, or the technical accessibility of an endpoint
> does not constitute a grant of access and shall not be construed as one.

That second clause is aimed squarely at the "it's just an open endpoint with
no auth, so it must be fine" reasoning the entire unofficial ecosystem runs
on. It pre-empts that argument by name.

Under "Prohibited Activities," the transfer-specific clause is the mirror
image of Spotify's carve-out, not an equivalent to it:

> 5. Not build products or services that enable the transfer of data to
>    another service.

Where Spotify's Developer Policy explicitly *permits* "the transfer of...
the metadata of the user's playlists to another service," JioSaavn's API
Policy explicitly *prohibits* it, with no carve-out for user-initiated,
metadata-only transfer. There is no reading of this clause under which a
JioSaavn-to-anywhere or anywhere-to-JioSaavn playlist migration tool is
compliant.

Also relevant, under "Improper use":

> using any robot, spider, site search/retrieval application, or other tool to
> retrieve, duplicate, or index any portion of the JioSaavn Service or
> JioSaavn Content (**which includes playlist data**) or collect information
> about JioSaavn users for any unauthorized purpose

"Playlist data" is named explicitly as protected content, not left to
inference from "Content" generally.

And, matching the Terms of Use:

> modifying, editing, altering, creating derivative works, disassembling,
> decompiling, **reverse-engineering**, or extracting source code from the
> JioSaavn Platform (including any music libraries)...

**Reading the two documents together:** the API Policy is dated three weeks
before this check and reads like a direct response to exactly the ecosystem
described above — reverse-engineered wrappers around an internal endpoint,
publicly documented on GitHub, some hosted as public services. Whether it was
written *because of* that ecosystem is speculation this research can't
confirm, but the timing (one visible project discontinuing itself the same
quarter) and the specificity of the "absence of an authentication challenge...
does not constitute a grant of access" clause both point toward active,
recent attention to this exact class of unofficial client.

**Confidence: high** that a Crossfade-style integration would violate both
documents as written. Both are primary-sourced, dated, and unambiguous on the
transfer-of-data and programming-interface points specifically.

---

## Bottom line

**Not possible today, at any confidence level worth building against.**

- **Official, documented path: does not exist.** No developer program, no
  registration, no scopes. The API Policy is JioSaavn affirmatively stating
  there is no public access, not merely an absence of documentation.
- **Reverse-engineered path: read-only, and not even the right kind of read.**
  The unofficial ecosystem can fetch a public playlist by known ID/URL. It
  cannot list a user's own playlists (no auth exists in any wrapper surveyed),
  it has no ISRC-equivalent field for matching, and its most actively
  maintained project's own documentation domain (`saavn.dev`) is dead as of
  this check, with its alternate host actively blocking requests.
- **Write path: does not exist in the unofficial ecosystem at all**, not even
  in a fragile or abandoned form. It would have to be built from scratch by
  reverse-engineering JioSaavn's authenticated mobile/web session traffic —
  which is a materially bigger undertaking than anything else surveyed across
  the Spotify, YouTube Music, or Gaana research, and for which zero prior art
  was found.
- **Policy risk is not a soft "grey area."** JioSaavn's API Policy names
  "playlist data" specifically, explicitly rejects the "no auth wall means
  it's open" argument, and prohibits data transfer to another service outright
  — the opposite of Spotify's explicit carve-out for exactly this kind of
  tool. Combined with Mumbai arbitration/venue and a Reliance-backed legal
  entity behind it, this is the highest policy risk of any provider in the
  `docs/research/` set so far.

If JioSaavn integration is ever revisited, the trigger condition is a genuine
change of state — JioSaavn publishing an actual developer program — not an
unofficial wrapper getting more mature. Nothing short of that changes this
verdict.

---

## Sources

All checked 2026-08-25.

- [JioSaavn API Policy (PDF), "Updated on 11.08.2026"](https://www.jiosaavn.com/corporate/api-policy)
- [JioSaavn Terms & Conditions](https://www.jiosaavn.com/corporate/terms/)
- [JioSaavn Help Center — How do I create or add songs to my playlist?](https://help.jiosaavn.com/hc/en-us/articles/360020259552-How-do-I-create-or-add-songs-to-my-playlist)
- [`sumitkolhe/jiosaavn-api` (GitHub repo, source inspected via GitHub API)](https://github.com/sumitkolhe/jiosaavn-api)
- [`sumitkolhe/jiosaavn-api` issue #32, "Is using this API legal?"](https://github.com/sumitkolhe/jiosaavn-api/issues/32)
- [`cyberboysumanjay/JioSaavnAPI` (GitHub repo, source inspected via GitHub API)](https://github.com/cyberboysumanjay/JioSaavnAPI)
- [`rajput-hemant/jiosaavn-api` (GitHub repo, archived, discontinuation commit inspected)](https://github.com/rajput-hemant/jiosaavn-api)
- [`saavn.dev/docs`](https://saavn.dev/docs) — domain does not resolve as of this check (`NXDOMAIN`)
- [`saavn.sumit.co`](https://saavn.sumit.co/) — returned HTTP 429 / Cloudflare error 1027 on every request during this check
- [JioSaavn robots.txt](https://www.jiosaavn.com/robots.txt)
- [JioMusic and Saavn integrate to create South Asia's largest platform — JioSaavn corporate blog, Dec 2018](https://www.jiosaavn.com/corporate/blog/2018/12/04/jiomusic-and-saavn-integrate-to-create-south-asias-largest-platform-for-music-media-and-artists-jiosaavn/)
- `docs/research/04-spotify-api-capabilities.md` — used as the format and rigor reference for this document
