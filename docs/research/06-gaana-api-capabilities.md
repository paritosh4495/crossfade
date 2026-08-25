# What Gaana's playlist API actually gives us

Research for [issue #14](https://github.com/paritosh4495/crossfade/issues/14).

**Date checked: 2026-08-25.**

---

## Headline findings

1. **Gaana has no working official public API today.** A developer program
   ("Gaana Developers' Platform") was announced in late 2013 and covered in
   the press in February 2014, offering Meta Data APIs (catalogue browsing)
   and User Data APIs (favourite songs, recently heard, activity), but it was
   pitched at "select partners" rather than the general public even at launch.
   `developer.gaana.com` does not resolve to a working page today. Direct
   fetch and a proxy fetch both failed. There is no current sign-up flow, no
   published reference docs, and no evidence the program still exists in any
   form.
2. **The entire unofficial ecosystem is read-only, unauthenticated, and
   catalogue-scoped.** Every actively maintained unofficial client found
   (roughly 15+ repos on GitHub, several updated within the last few months)
   exposes search, song/album/artist detail, and *public* playlist lookup by
   ID or `seokey`. None of them implement login, session/cookie auth, a
   user's own private playlists, playlist creation, or adding a track to a
   playlist. Several READMEs say this explicitly ("does not include
   functionality for creating playlists or adding tracks").
3. **A hobbyist already tried to build exactly this tool and gave up on
   automation.** [`deebong/Gaana-YouTube-Playlist-Importer`](https://github.com/deebong/Gaana-YouTube-Playlist-Importer)
   converts a Gaana playlist to a YouTube playlist "without using any
   official APIs, logins, quotas, or tracking". It works by having the user
   manually copy the playlist table out of their browser and paste it into a
   web form.
   That is strong first-hand evidence that no one has a working automated
   read path for a user's own Gaana playlist, not even at hobbyist scale.
4. **No ISRC-equivalent field appears anywhere in the unofficial ecosystem.**
   Every track-detail response documented across these clients tops out at
   title, artist name(s), album name, duration, bitrate, language, release
   date, artwork URL, and a stream URL. No external/catalogue ID beyond
   Gaana's own internal track ID and `seokey`.

---

## Official developer program

| Thing | Value |
| --- | --- |
| Program name | "Gaana Developers' Platform" |
| Announced | November 2013, opened February 2014 |
| API families (as reported) | Meta Data APIs (tracks, artists, genres, popularity, recommendations) and User Data APIs (favourite songs, recently heard, recent activity) |
| Access model at launch | "Previously available for select partners only" (Singalong, Zoom) |
| Sign-up | `developer.gaana.com` / `developer@gaana.com`, per contemporaneous coverage |
| Status today (2026-08-25) | `developer.gaana.com` unreachable by both a direct fetch and a reader-proxy fetch (422/failure on both). No developer docs, dashboard, or registration flow found |
| Playlist write mentioned anywhere | No. Even the original 2014 announcement describes reading user favourites/history, not creating or modifying playlists |

**Confidence: high that no usable official API exists today.** This isn't
"undocumented" the way some APIs are. The program was covered by press a
decade ago, and the domain it was hosted on doesn't serve a page anymore.
Treat this as a dead program, not a hidden one.

---

## The unofficial ecosystem

GitHub search for `gaana api` returns 25+ repositories, most named `gaana-api`,
`GaanaAPI`, `GaanaPy`, or similar. The pattern across the whole set is
consistent enough to generalize from a representative sample, checked for
last-push date, open issues, and documented capability:

| Repo | Last push | Open issues | Auth | Read: catalogue | Read: user's own/private playlists | Write |
| --- | --- | --- | --- | --- | --- | --- |
| [`cyberboysumanjay/GaanaAPI`](https://github.com/cyberboysumanjay/GaanaAPI) | 2020-10-01 | 4, including a 2021 report that stream-CDN access was denied | None | Single-song lookup by Gaana URL only, no search | No | No |
| [`ZingyTomato/GaanaPy`](https://github.com/ZingyTomato/GaanaPy) | 2026-08-24 | 0 | None | Search + song/album/artist/playlist detail by ID | No, "user playlists" and "write" both unsupported | No |
| [`notdeltaxd/Gaana-API`](https://github.com/notdeltaxd/Gaana-API) | 2026-03-27 | 0 | Optional bearer token, gates the wrapper's own server, not a Gaana credential | Search + song/album/artist/playlist/chart detail, decrypted stream URLs | No | No |
| [`rkaran112/gaana_api`](https://github.com/rkaran112/gaana_api) | 2026-07-23 | 3, all dependency-bump bots, no functional bug reports | None | Search + detail; playlist lookup is explicitly public-only, via a `seokey` parameter | No, README states this directly | No, explicitly: "does not include functionality for creating playlists or adding tracks" |
| [`ppalone/gaana`](https://github.com/ppalone/gaana) (Go) | 2026-05-18 | 0 | None | Search, song detail by track ID or SEO key | No | No |

The rest of the search results follow the same pattern (`shnwazdeveloper`,
`gautamjethe`, `johnxsmiths`, `Sudhirxd`, and others): unauthenticated GET
wrappers around Gaana's own internal web endpoints for public catalogue and
public-playlist data, several with "for educational/research purposes only"
disclaimers.

**Maintenance signal:** the ecosystem is churny rather than dead. New
forks/rewrites appear every few months as old ones break (`cyberboysumanjay`'s
2020 project has an open, unaddressed "access denied" issue; newer
TypeScript/Python/Go rewrites from 2026 currently work against the same style
of endpoint). That's consistent with these being unauthorized clients against
undocumented internal endpoints that Gaana doesn't guarantee, not a stable
platform. None of that churn has ever produced a client with write support or
private-playlist read support. The gap isn't "nobody's gotten to it yet":
every project stops at the same boundary.

**Confirming data point.** [`deebong/Gaana-YouTube-Playlist-Importer`](https://github.com/deebong/Gaana-YouTube-Playlist-Importer)
(pushed January 2026) is a tool with the same goal as this issue, moving a
Gaana playlist to another service, built by someone who evidently looked at
the same set of unofficial clients and chose manual copy/paste over
automation: "This tool does not use any official YouTube or Gaana APIs."
That's a builder voting with their architecture.

---

## Track metadata available, field by field

Aggregated from the READMEs/response shapes across the unofficial clients
above. No client documents a full response schema with a formal spec, so
treat field presence as "observed", not contractual.

| Field | Available? | Notes |
| --- | --- | --- |
| Title | Yes | |
| Artist name(s) | Yes | |
| Album name | Yes | |
| Duration | Yes | |
| Release date | Yes | |
| Language | Yes | Gaana is catalogue-segmented by Indian language, unlike Spotify |
| Bitrate | Yes | |
| Artwork URL | Yes | |
| Stream URL (decrypted HLS) | Yes, on several clients | Explicitly out of scope for Crossfade. A metadata-transfer tool has no reason to touch this, and pulling it raises separate ToS/DRM problems (see below) |
| Lyrics | Sometimes | |
| Gaana internal track ID / `seokey` | Yes | Gaana's own identifier, not portable to any other service |
| **ISRC or equivalent cross-service ID** | **No** | Not present in any documented response across the sample. This is the single biggest matching-quality gap versus the Spotify research in issue #5 |

Without ISRC, matching a Gaana track to a Spotify/YouTube Music track would
have to run entirely on fuzzy text (title + artist + duration), the "degraded
path" the Spotify doc treats as a fallback. For Gaana it would be the *only*
path.

---

## Reading a user's own playlists

**Not possible via any client examined.** Every playlist-read capability
found is scoped to a *public* playlist looked up by its Gaana-assigned ID or
`seokey`, the same shape as pasting a public Spotify playlist URL. None of
the unofficial clients authenticate as a Gaana user, so none can enumerate
"my playlists" or read a private one. This mirrors the "can't read a playlist
you don't own" problem from the Spotify research, except here it isn't a
February-2026 policy tightening. It has apparently never been solved by
anyone whose code is public.

## Writing: create playlist / add track

**Not possible via any client examined.** No repository in the sample
implements playlist creation or track addition, and one (`rkaran112/gaana_api`)
states outright that it's out of scope. There is no reverse-engineered
write path documented anywhere found in this research.

## Auth, if a write or private-read path existed

None of the unofficial clients implement any authentication against a real
Gaana account, so there is no documented answer to "what does a write path
need." From general knowledge of how the Gaana app/web client works (not
sourced to a primary document, flagged as such): Gaana account login is via
mobile number + OTP, or third-party OAuth (Google/Facebook/Truecaller-style),
the same pattern JioSaavn and most Indian consumer apps use. No public
project reverse-engineers this login flow to obtain a session usable against
Gaana's playlist endpoints, so even the credential type needed for a
hypothetical write path is undocumented in practice, not just unimplemented.

---

## Terms of Service

Read directly from `gaana.com/terms.html` (fetched 2026-08-25; the page
carries no visible "Last updated"/"Effective date" marker. The only date
available is the HTTP response's `Date` header at fetch time, so the
document's age cannot be pinned down from the page itself). Do not confuse
this with `getgaana.com`, an unrelated AI video-production company that
happens to also use the word "Gaana". That domain's terms are not Gaana the
Indian music service's terms, and several search results conflate the two.

**Automated access, Section 5 ("Your Obligations"):**

> "use or launch any 'robots', 'spiders', 'offline readers' etc. or any
> other automated system, that accesses the Site and/or Gaana Service in a
> manner that sends numerous automated requests"

This directly prohibits the access pattern every unofficial client in this
research uses, and by extension the access pattern Crossfade would need for
a Gaana integration: an automated system issuing repeated requests to
Gaana's endpoints, official or not.

**Third-party incorporation, same section:**

> "incorporate the Content into, or stream or retransmit the Content via,
> any hardware or software application"

Read broadly, this covers pulling track/playlist metadata into a third-party
tool at all, not only streaming audio. A metadata-only transfer tool is a
much weaker case for staying inside this clause than the equivalent
"transfer metadata only" carve-out issue #5 found in Spotify's Developer
Policy. **Gaana's ToS contains no such carve-out.** There is no clause
anywhere in this document that permits data portability or third-party
transfer tools.

**Index-building, same section:**

> "create, recreate, distribute or advertise an index of any significant
> portion of the ... Content"

Relevant if Crossfade were to cache Gaana catalogue data for matching
purposes at any scale.

**License grant, Section 2 ("Access to Use"):** the Service is licensed
"personal, limited, non-exclusive, non-transferable, freely revocable" and
"for personal and non-commercial" use: a license to *use the Gaana app*,
not a license to build against it programmatically.

**Governing law, Section 13:** laws of India, exclusive jurisdiction of
courts at New Delhi. Relevant if enforcement risk is ever weighed: this
is not a US-style DMCA/CFAA analysis, it's an Indian-law one.

**`robots.txt` (`gaana.com/robots.txt`), corroborating signal, not a legal
document:** disallows crawling of login pages, search, AMP pages, and
"various API endpoints" for general user-agents, while separately
allow-listing named AI crawlers (GPTBot, ClaudeBot, PerplexityBot, Bingbot,
Google). The disallowed "API endpoints" line is circumstantial confirmation
that the internal endpoints the unofficial clients hit are ones Gaana
actively doesn't want crawled, though `robots.txt` is a request to
well-behaved crawlers, not a technical or legal barrier on its own.

**Direct-fetch evidence of anti-bot posture.** A plain HTTPS fetch to
`gaana.com` (and to `developer.gaana.com`) failed outright during this
research, while a reader-proxy fetch of the same URL succeeded. That's
consistent with bot-detection/WAF infrastructure in front of gaana.com that a
naive HTTP client won't get past, on top of the ToS prohibition.

---

## Bottom line

**Not possible today at a confidence level Crossfade could build on.**

- **Official path: does not exist.** The one that was announced in 2014
  appears defunct. No working portal, no docs, no sign-up.
- **Unofficial read path (catalogue/public playlists): exists, but is the
  wrong shape.** It can look up a *public* playlist by ID, which is useless
  for "transfer my own playlist" the same way an arbitrary-public-playlist
  read would be useless for Spotify's post-February-2026 API. It cannot list
  or read a user's own playlists at all, because nothing in the public
  ecosystem authenticates as a user.
- **Unofficial write path: does not exist.** No project examined implements
  playlist creation or track addition, and the most actively maintained one
  says so explicitly.
- **Policy risk, if a write/auth path were built from scratch anyway:**
  Gaana's ToS prohibits exactly the access pattern required (automated
  requests; incorporating Content into third-party software), with no data-
  portability carve-out of the kind Spotify's Developer Policy provides.
  Building an authenticated scraper that logs in as the user (mobile
  OTP or OAuth, reverse-engineered) to read/write playlists would mean
  reverse-engineering both the login flow and the playlist endpoints from
  scratch, maintaining it against an anti-bot layer that already defeats a
  plain HTTP fetch, and doing so in violation of the ToS's plain language.

**Recommendation:** do not treat Gaana as a viable provider for v1 or any
near-term milestone. If this is revisited later, the trigger condition
should be "Gaana ships a real public developer program with playlist
scopes", not "someone reverse-engineers a login flow", because the evidence
here shows that even the read-only, unauthenticated, lowest-risk slice of
Gaana's API is maintained by a rotating cast of small hobbyist projects that
periodically break, and nobody in that
community has taken on the harder authenticated-write problem despite the
transfer-tool use case existing in the same GitHub search results (the
manual-copy-paste importer).

---

## Open questions

- Whether Gaana's mobile app uses a materially different, better-documented
  API than the web client the unofficial scrapers target. Not
  checked here; would require mobile traffic interception, which is a
  different research method than the primary-source doc review this issue
  asked for.
- Whether Gaana's parent company (ENIL / Times Group) offers any B2B/partner
  API distinct from the defunct 2014 consumer developer program. No evidence
  found either way; the 2014 program's own description ("previously
  available for select partners only") suggests such a thing might exist
  privately, but nothing public documents it.
- Exact mechanics of Gaana account login (OTP flow, token lifetime, whether
  session cookies or bearer tokens are issued) are not documented anywhere
  found in this research, official or unofficial. Flagged in the Auth
  section above as unverified.

---

## Sources

All checked 2026-08-25.

- [Gaana Terms & Conditions](https://gaana.com/terms.html): primary source, quoted directly above
- [Gaana Privacy Policy](https://gaana.com/privacy_policy.html): checked, no automated-access language found
- [Gaana robots.txt](https://gaana.com/robots.txt): corroborating signal, not a legal document
- [`developer.gaana.com`](https://developer.gaana.com): checked, unreachable (direct fetch and proxy fetch both failed)
- [MediaNama, "Gaana.com Will Open It's API For Music App Development" (Nov 2013)](https://www.medianama.com/2013/11/223-gaana-com-will-open-its-api-for-music-app-development/)
- [MediaNama, "Gaana opens up its APIs to music app developers" (Feb 2014)](https://www.medianama.com/2014/02/223-gaana-developer-api/)
- [IndianTelevision.com, "Gaana.com Introduces Developer API Program For Music Apps"](https://www.indiantelevision.com/technology/software/applications/gaanacom-introduces-developer-api-program-for-music-apps-140224)
- [`cyberboysumanjay/GaanaAPI`](https://github.com/cyberboysumanjay/GaanaAPI): repo and open issues checked via `gh api`
- [`ZingyTomato/GaanaPy`](https://github.com/ZingyTomato/GaanaPy)
- [`notdeltaxd/Gaana-API`](https://github.com/notdeltaxd/Gaana-API)
- [`rkaran112/gaana_api`](https://github.com/rkaran112/gaana_api): repo and open issues checked via `gh api`
- [`ppalone/gaana`](https://github.com/ppalone/gaana)
- [`deebong/Gaana-YouTube-Playlist-Importer`](https://github.com/deebong/Gaana-YouTube-Playlist-Importer): the manual-copy-paste transfer tool cited above
- [GitHub search, `gaana api`](https://github.com/search?q=gaana+api&type=repositories): used to establish the breadth and recency pattern of the unofficial ecosystem
