// PROTOTYPE mock data. Shapes mirror CONTEXT.md vocabulary (Track, Match Candidate,
// Track Transfer, Transfer Job) but nothing here is real domain code.

export type Track = {
  id: string;
  title: string;
  artists: string[];
  album: string;
  durationMs: number;
  isrc?: string;
};

export type MatchCandidate = Track & {
  score: number; // 0..1
  verified: boolean; // isrc + duration confirmed
};

export type TrackTransferState =
  | "pending"
  | "matched"
  | "needs_review"
  | "resolved"
  | "written"
  | "failed"
  | "skipped_unsupported"
  | "skipped_not_found"
  | "skipped_declined";

export type TrackTransfer = {
  source: Track;
  state: TrackTransferState;
  candidates: MatchCandidate[];
  chosen?: MatchCandidate;
};

export type SourcePlaylist = {
  id: string;
  name: string;
  trackCount: number;
};

export const mockSpotifyUser = {
  displayName: "Rudra",
  email: "rudra@example.com",
};

export const mockSourcePlaylists: SourcePlaylist[] = [
  { id: "pl1", name: "Late Night Drive", trackCount: 87 },
  { id: "pl2", name: "gym but make it sad", trackCount: 34 },
  { id: "pl3", name: "2016 Rewind", trackCount: 212 },
  { id: "pl4", name: "Focus / Instrumental", trackCount: 51 },
  { id: "pl5", name: "Road Trip 500", trackCount: 500 },
];

function track(
  id: string,
  title: string,
  artists: string[],
  album: string,
  durationMs: number,
  isrc?: string,
): Track {
  return { id, title, artists, album, durationMs, isrc };
}

// A representative sample of Track Transfers for the review queue, spanning every
// interesting case: verified auto-match, needs review with close candidates,
// not found, and unsupported (local file).
export const mockTrackTransfers: TrackTransfer[] = [
  {
    source: track("t1", "Nights", ["Frank Ocean"], "Blonde", 307534, "USQX91600025"),
    state: "matched",
    candidates: [
      {
        ...track("c1", "Nights", ["Frank Ocean"], "Blonde", 307534, "USQX91600025"),
        score: 0.98,
        verified: true,
      },
    ],
  },
  {
    source: track("t2", "Motion Sickness", ["Phoebe Bridgers"], "Stranger in the Alps", 232000),
    state: "needs_review",
    candidates: [
      {
        ...track("c2a", "Motion Sickness", ["Phoebe Bridgers"], "Stranger in the Alps", 232000),
        score: 0.81,
        verified: false,
      },
      {
        ...track("c2b", "Motion Sickness - Live", ["Phoebe Bridgers"], "Live From Newport Folk Festival", 241000),
        score: 0.61,
        verified: false,
      },
      {
        ...track("c2c", "Motion Sickness (Acoustic)", ["Phoebe Bridgers"], "Acoustic Sessions", 228000),
        score: 0.58,
        verified: false,
      },
    ],
  },
  {
    source: track("t3", "Half Right", ["Now, Now"], "Saved", 226000),
    state: "needs_review",
    candidates: [
      {
        ...track("c3a", "Half Right", ["Now, Now"], "Saved", 226000),
        score: 0.79,
        verified: false,
      },
      {
        ...track("c3b", "Half Right", ["Now, Now", "Diet Cig"], "Saved (Deluxe)", 226000),
        score: 0.72,
        verified: false,
      },
    ],
  },
  {
    source: track("t4", "Homemade Song (Unreleased Demo)", ["Local Artist"], "", 198000),
    state: "skipped_not_found",
    candidates: [],
  },
  {
    source: track("t5", "voice memo 04:12:23.m4a", ["Unknown"], "", 45000),
    state: "skipped_unsupported",
    candidates: [],
  },
];

// Generates a filler batch so the review queue and progress screens can be driven
// against a realistic count (e.g. the 500-track "Road Trip 500" playlist) without
// hand-authoring hundreds of rows.
export function generateMockTransferBatch(count: number): TrackTransfer[] {
  const base = mockTrackTransfers;
  const out: TrackTransfer[] = [];
  for (let i = 0; i < count; i++) {
    const template = base[i % base.length];
    out.push({
      ...template,
      source: { ...template.source, id: `${template.source.id}-${i}` },
    });
  }
  return out;
}

export function formatDuration(ms: number): string {
  const totalSeconds = Math.round(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}
