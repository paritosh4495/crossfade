# YouTube Music write access for arbitrary users

Research for [issue #2](https://github.com/paritosh4495/crossfade/issues/2).

- Date of research: 2026-08-25
- `ytmusicapi` version examined: **1.12.2** (released 2026-08-08, latest on PyPI)
- Method: read the 1.12.2 sdist source, the official docs, the upstream issue tracker, and Google's own OAuth and YouTube Data API docs. Nothing here was empirically tested. Credentials for that are blocked on #12.

## Short answer

No. A random user cannot grant Crossfade write access to their YouTube Music library through `ytmusicapi` in any way that is acceptable for a public web app.

`ytmusicapi` offers exactly two ways to authenticate a write. One is broken, the other is a session-cookie paste. Neither is shippable:

1. **OAuth device flow.** Broken since 2025-08-29 and still broken at 1.12.2. Upstream issue [#813](https://github.com/sigma67/ytmusicapi/issues/813) is open, the maintainer's own recommendation in the issue body is "use browser based auth instead of oauth", and fix attempts have failed to reproduce for the maintainer.
2. **Browser header paste.** Works, but it means asking strangers to open devtools and paste their entire Google session cookie into your website. That is an account-takeover credential, not a scoped grant. It is also IP-bound, so it breaks the moment your sidecar runs on a datacenter IP.

So yes: cookie paste is the only thing in `ytmusicapi` that actually writes today, and that makes the product unbuildable as specified. Confidence: high.

There is a way out, and it is not `ytmusicapi` at all. Use the official YouTube Data API v3 for the write half. See [Recommendation](#recommendation).

## Auth methods ytmusicapi 1.12.2 supports

From `ytmusicapi/auth/types.py`, the library recognises exactly four states:

- `UNAUTHORIZED` (read-only, no writes)
- `BROWSER` (pasted browser headers, SAPISIDHASH signing)
- `OAUTH_CUSTOM_CLIENT` (device flow with your own Google client id and secret)
- `OAUTH_CUSTOM_FULL` (you build the `Authorization` header yourself; same OAuth token, refresh logic moved outside the library)

`OAUTH_CUSTOM_FULL` is not a third method. So there are two real methods.

There is no API-key path, no standard web-server OAuth code flow, and no way to hand the library a token minted by a normal `Web application` client. Confidence: high, read from source.

Writes are gated the same way as any other authenticated call. `create_playlist` and `add_playlist_items` both start with `self._check_auth()` and then hit the same internal `/youtubei/v1/` endpoint as reads, with the same headers. No write-specific auth exists. Whatever authenticates a read authenticates a write.

### Browser header paste

`ytmusicapi` signs each request with a `SAPISIDHASH` computed from the `__Secure-3PAPISID` cookie plus the origin and a timestamp (`ytmusicapi/helpers.py`, `get_authorization`). The official docs say the credential lasts "as long as your YTMusic browser session is valid", about two years.

That claim no longer matches reality. In [#813](https://github.com/sigma67/ytmusicapi/issues/813), user `foobarth` (2026-01-26) reports browser cookies now lasting "only a few hours", and `ryansc0tt` (2025-12-31) had to refresh headers manually after a couple of weeks. Confidence: medium. These are user reports, not maintainer confirmation, and the maintainer's reply was to open a separate issue rather than to confirm.

Worse for us, [#962](https://github.com/sigma67/ytmusicapi/issues/962) (closed 2026-07) pins down a hard constraint. Google validates the rotating `__Secure-*PSIDTS` token against the IP that created the session. The reporter's test matrix:

| Setup | Library reads | Writes |
|---|---|---|
| Browser and script on same machine | works | works |
| Browser on A, script on B, different IP | empty | 401 |
| Browser on A, script on B, same public IP | works | works |

The reporter's conclusion, accepted by the maintainer when closing: browser auth works headless only if the server shares a public IP with the browser that captured the cookies. For a public web app with users worldwide and a sidecar in one datacenter, that is never true. Confidence: medium-high. One reporter, but the test design is sound and the maintainer closed on it.

The same issue states plainly that "OAuth tokens don't work regardless of IP".

### OAuth device flow

What the library actually does (`ytmusicapi/auth/oauth/credentials.py`, `ytmusicapi/constants.py`):

- Scope: `https://www.googleapis.com/auth/youtube`, a single scope, hardcoded as `OAUTH_SCOPE`.
- Device code endpoint: `https://www.youtube.com/o/oauth2/device/code`. Note this is YouTube's internal TV endpoint, not Google's documented `https://oauth2.googleapis.com/device/code`.
- Token endpoint: `https://oauth2.googleapis.com/token`, grant type `http://oauth.net/grant_type/device/1.0`.
- User agent is spoofed to `...Firefox/88.0 Cobalt/Version`. Cobalt is Google's own TV browser runtime. The library is pretending to be a television.

**Required Google Cloud client type:** `OAuth client ID` with application type **TVs and Limited Input devices**. The YouTube Data API must be enabled on the project. The docs state: "As of November 2024, YouTube Music requires a Client Id and Secret for the YouTube Data API to connect to the API." Before that, the library shipped a hardcoded client; that was removed in 1.9.0 ([#679](https://github.com/sigma67/ytmusicapi/issues/679)). Confidence: high.

**What the user sees:** `ytmusicapi oauth` prints a URL of the form `{verification_url}?user_code={user_code}` and blocks on `input()` until you press Enter (`token.py`, `prompt_for_token`). The user opens that URL on any device, signs into Google, and approves a consent screen. It is a device-code flow, with all the friction that implies: a code to read off one screen and type into another, plus an unverified-app warning if you have not been through Google review.

**And it does not work.** [#813](https://github.com/sigma67/ytmusicapi/issues/813), open since 2025-09-02, last activity 2026-08-10, 38 comments. Every OAuth-authenticated call to the internal endpoints returns:

```
YTMusicServerError: Server returned HTTP 400: Bad Request.
Request contains an invalid argument.
```

The issue body carries the maintainer's banner: "**Recommended workaround**: use browser based auth instead of oauth." A community PR ([#815](https://github.com/sigma67/ytmusicapi/pull/815)) attempting an iOS-client workaround was rejected because the maintainer could not reproduce a fix on his own account. As of 2026-08-10 the maintainer has not called it solved. Confidence: high. This is the most load-bearing fact in this document.

Note carefully what is broken. The OAuth *token acquisition* works fine. Google issues a valid token with a valid scope. It is YouTube Music's *internal* `/youtubei/v1/` endpoints that reject it. That distinction is what makes the fallback viable.

## Google verification and what it costs a solo developer

`https://www.googleapis.com/auth/youtube` is a **sensitive** scope, not a restricted one. Restricted is the Gmail and Drive tier that drags in a third-party CASA security assessment. YouTube is one rung below.

Sensitive scope verification, per Google's own docs:

- Requires a verified domain, an accurate consent screen, a published privacy policy that discloses the data use, a written justification per scope, and a YouTube demo video showing the grant flow and what you do with the data.
- Typically 3 to 5 business days.
- No fee.
- No third-party security assessment. Google's Trust and Safety team reviews it in-house.

Unverified apps get a warning screen and a cap on how many Google accounts can grant access. Confidence: high on the process, medium on the exact cap. Google's current sensitive-scope page says "a user cap" without naming a number; the widely cited figure is 100 test users, which I could not confirm verbatim on the current page.

**The trap for a solo dev is not the review. It is the publishing status.** Google's OAuth docs are explicit: a project with an external consent screen still in **Testing** status issues refresh tokens that **expire after 7 days**. For Crossfade, where a job can be paused and resumed hours or days later, that alone forces you through verification before launch. You cannot ship on test-mode tokens. Confidence: high.

The honest cost: a few days of paperwork, a demo video, a real privacy policy, a domain you control, and a review that can bounce. Free in money, annoying in time, and a hard blocker you must clear before the first public user.

## Refresh tokens and resuming a paused job

For the official Data API path, yes. Use the standard web-server flow with `access_type=offline`, store the refresh token per user, mint a fresh access token whenever a job wakes up. Google's device flow also always returns refresh tokens ("Note that refresh tokens are always returned for devices").

`ytmusicapi`'s `RefreshingToken` does this itself. It overrides `__getattribute__` so that reading `.access_token` triggers a refresh when the token is inside 60 seconds of expiry, then writes the new token back to `_local_cache`. That file-path caching is designed for a single user on a laptop and is wrong for a multi-user sidecar. We would keep tokens in Postgres and manage refresh ourselves rather than let the library write JSON files.

Caveats worth designing around:

- Refresh tokens die after 6 months unused.
- **Limit of 100 refresh tokens per Google account per OAuth client id.** Issuing a 101st silently kills the oldest. Re-authorising the same user repeatedly, for example on every transfer, will eventually revoke their own older token. Issue one token per user and reuse it.
- Users can revoke at any time. Handle `invalid_grant` as a normal state, not a crash.
- Testing-status projects: 7 days, as above.

Confidence: high, all from Google's OAuth 2.0 docs.

## Brand and channel selection

This is a real problem and it is worse on the device flow.

`ytmusicapi` exposes a `user` constructor argument that sets `context.user.onBehalfOfUser` on every request. You get the id from `https://myaccount.google.com/brandaccounts` by selecting the brand account and reading the id out of the URL. The FAQ recommends this, or setting `X-Goog-AuthUser`, when the library comes back empty because you are hitting the wrong account. The library sets `onBehalfOfUser` regardless of auth type; whether YouTube honours it for an OAuth token is untested. Confidence: medium on the mechanism, low on OAuth behaviour.

For the **standard web OAuth flow**, Google shows a brand-account channel picker between account selection and consent when YouTube scopes are requested. It is easy to break: passing `prompt=consent` alone skips both the account chooser and the channel picker, so a user with a brand channel silently authorises their personal channel instead. The fix is `prompt=consent select_account`. Confidence: medium. This comes from a well-documented bug report against another OAuth integration ([postiz-app#1238](https://github.com/gitroomhq/postiz-app/issues/1238)) rather than from Google's docs, which do not mention the picker at all.

For the **device flow**, Google's documentation says nothing about channel selection. Confidence: low, but the silence is itself informative. If we go the Data API route we get the picker; if we somehow revived `ytmusicapi`'s device flow we probably would not.

Whatever we build, we must resolve and show the user which channel they actually granted, by calling `channels.list(mine=true)` and displaying the channel title before the transfer starts. Do not guess.

## Rate limits and ban risk

For `ytmusicapi`'s internal endpoints, there are no published limits and no way to see your usage. What the upstream project knows:

- The FAQ says a rate limit exists but "you shouldn't run into it during normal usage", and links two issues.
- [#19](https://github.com/sigma67/ytmusicapi/issues/19) is the playlist-creation one. Roughly 20 `create_playlist` calls in 15 minutes triggered it. The nastier finding in that thread is not the limit but the propagation delay: playlists created via the API took minutes to hours to appear, and in one case playlists made on a Saturday afternoon showed up Sunday night. The maintainer reproduced the delay in the web UI too. For a transfer product that reports progress, this is a UX landmine. Confidence: high that it happened, low on whether it still behaves this way in 2026.
- `search` is cheap. The maintainer reports "hundreds to thousands of searches per hour" without trouble, and quota testing in [#400](https://github.com/sigma67/ytmusicapi/pull/400) put the search limit above 5000.

The ban risk is the part I would not wave away. Three things stack:

1. The maintainer's stated position in [#328](https://github.com/sigma67/ytmusicapi/issues/328): "this library is built on the principle of responsible use. Excessive use will likely lead to YT shutting things down, hence less good for all." A public multi-user transfer service funnelling every user's writes through one datacenter IP is the opposite of that.
2. Datacenter IPs already get bot-challenged. In the same issue, a user running on Vercel reports requests being blocked because Google "can't verify I'm not a bot".
3. The YouTube API Services Terms bind you to access YouTube "by the means described in the Agreement" and not to "exceed or circumvent use or quota restrictions". Reverse-engineered `/youtubei/v1/` calls with a spoofed Cobalt user agent are not that. I could not find a clause that names scraping or internal endpoints explicitly, so this is an argument from the general access clause rather than a specific prohibition. Confidence: medium.

The exposure is not really "Crossfade gets banned". It is that individual users' Google accounts get flagged for suspicious activity because a server on the other side of the world is driving their session. That is a much harder thing to apologise for.

## The way out: YouTube Data API v3 for writes

Buried in [#813](https://github.com/sigma67/ytmusicapi/issues/813), comment by `robindel` on 2026-07-31, is the most useful thing I found. The `oauth.json` that `ytmusicapi oauth` produces "is still perfectly accepted by the standard Google Data API, even though YouTube Music's internal endpoints are rejecting it."

That points at a split architecture:

- **Search:** `ytmusicapi` **unauthenticated**. Search works with no credentials, returns YouTube Music's own catalogue with proper `videoType` metadata (ATV vs OMV vs UGC), and costs no API quota. This is the half of `ytmusicapi` we actually want, and it is the half that is not broken.
- **Writes:** official YouTube Data API v3, `playlists.insert` and `playlistItems.insert`, with a normal `Web application` OAuth client, the standard authorization-code flow, `access_type=offline`, and a per-user refresh token in our database. Fully supported, documented, and Google will not sanction anyone for using it.

This gives us a real consent screen, a real channel picker, real refresh tokens, and no cookie paste.

### The catch, and it is a big one

Quota. From Google's quota page:

> Projects that enable the YouTube Data API have a default quota allocation of 100 `search.list` calls, 100 `videos.insert` calls, and 10,000 units per day combined for all other endpoints.

And the costs:

| Method | Units |
|---|---|
| `playlists.insert` | 50 |
| `playlistItems.insert` | 50 |
| `playlists.list` | 1 |
| `playlistItems.list` | 1 |

10,000 units per day divided by 50 is **200 track insertions per day for the entire project, across all users**. One user transferring a 300-song playlist would blow the whole daily budget and fail halfway. Quota resets at midnight Pacific.

That is not a soft limit you can engineer around. Batching does not help; `playlistItems.insert` is one track per call.

The fix is the YouTube quota extension, which requires passing a compliance audit. Free, no stated timeline, and it demands a working app, accepted API Services Terms, and a review by YouTube's API Services team. Solo developers do get through it, but it is a gate with a human on the other side and no SLA. Confidence: high on the numbers, medium on how winnable the audit is for a hobby project.

### Open question: do Data API playlists show up in YouTube Music?

YouTube and YouTube Music share a playlist store, so a playlist created via `playlists.insert` should appear in the user's YouTube Music library. I could not confirm this from a primary source, and there is a known wrinkle where YouTube Music filters or presents non-music playlists differently. **Confidence: low. This must be verified empirically before we commit to the architecture.** It belongs in #12 as the first test: create a playlist via Data API v3, insert an ATV video id, then check music.youtube.com.

If that test fails, the fallback fails with it, and Crossfade's YouTube Music write direction does not exist as a public product.

## Recommendation

1. **Drop `ytmusicapi` for writes. Keep it for search.** The sidecar stays, but it becomes a stateless, unauthenticated search-and-match service. No user credentials ever touch it. That is a smaller thing to operate and a smaller thing to get wrong.
2. **Do the writes from Spring Boot via YouTube Data API v3**, standard web OAuth, `scope=https://www.googleapis.com/auth/youtube`, `access_type=offline`, `prompt=consent select_account`. Refresh tokens encrypted at rest, one per user, refreshed on job resume. This answers the paused-job requirement cleanly.
3. **Run the compatibility test in #12 before writing any of it.** Create a playlist via Data API v3 and confirm it appears in YouTube Music with music tracks in it. Everything above depends on this and nothing above proves it.
4. **Start Google verification early.** You cannot ship on Testing-status tokens because they expire in 7 days. Budget for the privacy policy, the domain, and the demo video now, not at launch.
5. **Apply for the quota extension immediately after.** At 200 inserts per day the app is a demo, not a product. Until the extension lands, cap transfers hard and say so in the UI rather than failing at track 200.

### If the #12 test fails

If Data API playlists do not surface in YouTube Music, the honest options are all bad, in descending order of dignity:

- **Ship Spotify to YouTube Music as YouTube playlists** and be upfront that they land in YouTube, not the Music app. Half a product, honestly labelled.
- **Ship read-only for YouTube Music.** Unauthenticated `ytmusicapi` can read public playlists. So YouTube Music to Spotify works fine, since Spotify's official API has proper multi-user OAuth with writes. The other direction gets disabled. Crossfade becomes a one-way tool with a waiting list on the second direction.
- **Watch [#813](https://github.com/sigma67/ytmusicapi/issues/813).** If upstream fixes OAuth against the internal endpoints, the device-flow path reopens. It has been open eleven months with the maintainer unable to reproduce a fix. Do not plan around it.
- **Cookie paste.** No. Not for a public app. Asking strangers for their Google session cookie is indistinguishable from phishing, exposes you to their account being compromised through your database, and does not even work reliably from a datacenter IP per #962.

My read: the Data API v3 path is the only version of this product that can exist in public. It is more work than the sidecar plan assumed, it puts a Google review on the critical path, and it hinges on one untested compatibility question. Answer that question first.

## Sources

Primary, official:

- ytmusicapi 1.12.2 source, from the PyPI sdist. Files read: `ytmusicapi/auth/types.py`, `ytmusicapi/auth/oauth/credentials.py`, `ytmusicapi/auth/oauth/token.py`, `ytmusicapi/constants.py`, `ytmusicapi/helpers.py`, `ytmusicapi/ytmusic.py`, `ytmusicapi/mixins/playlists.py`, `docs/source/faq.rst`. https://pypi.org/project/ytmusicapi/
- ytmusicapi OAuth setup docs: https://ytmusicapi.readthedocs.io/en/stable/setup/oauth.html
- ytmusicapi browser setup docs: https://ytmusicapi.readthedocs.io/en/stable/setup/browser.html
- ytmusicapi FAQ: https://ytmusicapi.readthedocs.io/en/stable/faq.html
- Google, YouTube Data API quota costs: https://developers.google.com/youtube/v3/determine_quota_cost
- Google, quota and compliance audits: https://developers.google.com/youtube/v3/guides/quota_and_compliance_audits
- Google, OAuth 2.0 for TV and limited-input devices (YouTube): https://developers.google.com/youtube/v3/guides/auth/devices
- Google, OAuth 2.0 overview, refresh token expiration: https://developers.google.com/identity/protocols/oauth2
- Google, sensitive scope verification: https://developers.google.com/identity/protocols/oauth2/production-readiness/sensitive-scope-verification
- Google Cloud, OAuth app verification: https://support.google.com/cloud/answer/13463073
- YouTube API Services Terms of Service: https://developers.google.com/youtube/terms/api-services-terms-of-service

Upstream issue tracker (sigma67/ytmusicapi):

- [#813](https://github.com/sigma67/ytmusicapi/issues/813) oauth authentication: Request contains an invalid argument. Open, 2025-09-02 to 2026-08-10. The central finding.
- [#962](https://github.com/sigma67/ytmusicapi/issues/962) browser cookies on headless servers, IP binding. Closed 2026-07.
- [#19](https://github.com/sigma67/ytmusicapi/issues/19) create_playlist rate limit and propagation delay.
- [#328](https://github.com/sigma67/ytmusicapi/issues/328) API quota values, maintainer's responsible-use position.
- [#400](https://github.com/sigma67/ytmusicapi/pull/400) quota testing.
- [#679](https://github.com/sigma67/ytmusicapi/issues/679) oauth requires client_id and client_secret as of 1.9.0.
- [#887](https://github.com/sigma67/ytmusicapi/issues/887), [#921](https://github.com/sigma67/ytmusicapi/issues/921), [#926](https://github.com/sigma67/ytmusicapi/issues/926) device flow crashes on Google's `refresh_token_expires_in` field. Fixed in 1.12.1.

Secondary, flagged as such in the text:

- [postiz-app#1238](https://github.com/gitroomhq/postiz-app/issues/1238) brand account channel picker and the `prompt=consent select_account` fix.
