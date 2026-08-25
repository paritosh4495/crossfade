# The track matching and confidence model

Type: grilling
Status: open
Blocked by: 04, 05
Parent: ../map.md

## Question

Define how a source track becomes a destination track, and what "confident" means numerically.

- Normalisation rules for title and artist before comparison: feat. credits, parenthesised suffixes, remaster years, punctuation, case, non-Latin scripts.
- Which signals feed the score, and their weights. Duration delta and album match are the obvious ones. ISRC only helps if one side exposes it, which ticket 05 will settle.
- The threshold. What score auto-accepts, what score goes to review, and is there a floor below which the track is marked "not found" rather than offered for review?
- How many candidates does the review queue show, and in what order?
- Song versus music video preference when both match.
- Duplicate handling: what happens when the same track resolves twice within one playlist.
- Dedupe on append. The destination playlist may already exist and already contain tracks. Decide whether appending skips tracks already present, and how "already present" is judged given matching is fuzzy in the first place.
- Whether the threshold is fixed, configurable per transfer, or learned from review decisions.
- Whether match results are cached across users, and the privacy implication of doing so.
