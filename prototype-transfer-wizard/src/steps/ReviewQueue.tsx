import { useEffect, useMemo, useState } from "react";
import type { MatchCandidate, TrackTransfer } from "../mockData";
import { formatDuration } from "../mockData";
import { Primary, Secondary } from "../components/Chrome";

export function ReviewQueue({
  transfers,
  onResolve,
  onDone,
}: {
  transfers: TrackTransfer[];
  onResolve: (sourceId: string, chosen: MatchCandidate | null) => void;
  onDone: () => void;
}) {
  const queue = useMemo(() => transfers.filter((t) => t.state === "needs_review"), [transfers]);
  const [index, setIndex] = useState(0);
  const current = queue[index];

  useEffect(() => {
    function handler(e: KeyboardEvent) {
      if (!current) return;
      if (["1", "2", "3"].includes(e.key)) {
        const i = Number(e.key) - 1;
        if (current.candidates[i]) pick(current.candidates[i]);
      } else if (e.key.toLowerCase() === "s") {
        pick(null);
      }
    }
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current]);

  function pick(chosen: MatchCandidate | null) {
    if (!current) return;
    onResolve(current.source.id, chosen);
    if (index + 1 >= queue.length) {
      onDone();
    } else {
      setIndex((i) => i + 1);
    }
  }

  if (!current) {
    return (
      <div className="flex h-full min-h-[400px] flex-col items-center justify-center text-center">
        <div className="w-16 h-16 bg-brand-primary/10 text-brand-primary rounded-full flex items-center justify-center mb-6">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h2 className="text-2xl font-semibold text-text-primary mb-2">Review Complete</h2>
        <p className="text-text-secondary mb-8">All ambiguous tracks have been resolved.</p>
        <Primary onClick={onDone}>Continue to Transfer</Primary>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col justify-between">
      <div>
        <div className="flex items-center justify-between mb-6 pb-4 border-b border-border-subtle">
          <div>
            <h2 className="text-xl font-semibold text-text-primary tracking-tight">Needs Review</h2>
            <p className="text-sm text-text-secondary mt-1">We found multiple matches for this track.</p>
          </div>
          <div className="flex items-center justify-center w-12 h-12 bg-surface-card rounded-full border border-border-subtle font-medium text-text-primary">
            {index + 1}<span className="text-text-tertiary text-xs mx-0.5">/</span>{queue.length}
          </div>
        </div>

        <div className="bg-surface-bg rounded-2xl border border-border-subtle p-5 mb-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="text-xs font-semibold text-text-tertiary uppercase tracking-wider mb-1.5 flex items-center gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 text-text-tertiary" viewBox="0 0 20 20" fill="currentColor">
                <path d="M18 3a1 1 0 00-1.196-.98l-10 2A1 1 0 006 5v9.114A4.369 4.369 0 005 14c-1.657 0-3 .895-3 2s1.343 2 3 2 3-.895 3-2V7.82l8-1.6v5.894A4.37 4.37 0 0015 12c-1.657 0-3 .895-3 2s1.343 2 3 2 3-.895 3-2V3z" />
              </svg>
              Source Track
            </div>
            <div className="text-lg font-medium text-text-primary">{current.source.title}</div>
            <div className="text-sm text-text-secondary mt-1">
              {current.source.artists.join(", ")}
            </div>
          </div>
          <div className="text-sm text-text-tertiary font-medium bg-surface-card px-3 py-1.5 rounded-lg border border-border-subtle self-start sm:self-auto shrink-0">
            {current.source.album} • {formatDuration(current.source.durationMs)}
          </div>
        </div>

        <div className="flex flex-col gap-3">
          <div className="flex justify-between items-center px-1 mb-1">
            <span className="text-xs font-medium text-text-tertiary uppercase tracking-wider">Select best match</span>
            <span className="text-xs text-text-tertiary hidden sm:block">Press 1-{current.candidates.length} to select</span>
          </div>
          {current.candidates.map((c, i) => (
            <button
              key={c.id}
              onClick={() => pick(c)}
              className="flex items-center justify-between p-4 rounded-xl border border-border-subtle bg-surface-card transition-all hover:border-brand-primary hover:shadow-sm hover:bg-surface-card-hover group text-left"
            >
              <div className="flex items-start gap-4">
                <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded bg-surface-bg border border-border-strong text-xs font-medium text-text-secondary group-hover:text-brand-primary group-hover:border-brand-primary/50 transition-colors mt-0.5">
                  {i + 1}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-text-primary">{c.title}</span>
                    {c.verified && (
                      <span className="bg-brand-primary/10 text-brand-primary px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider">
                        Verified
                      </span>
                    )}
                  </div>
                  <div className="text-sm text-text-secondary mt-0.5">
                    {c.artists.join(", ")}
                  </div>
                  <div className="text-xs text-text-tertiary mt-1">
                    {c.album} • {formatDuration(c.durationMs)}
                  </div>
                </div>
              </div>
              <div className="flex flex-col items-end gap-1 shrink-0 ml-4">
                <span className="text-xs text-text-tertiary uppercase font-medium">Confidence</span>
                <span className={["font-semibold text-lg", c.score > 0.8 ? "text-green-500" : c.score > 0.6 ? "text-amber-500" : "text-red-400"].join(" ")}>
                  {Math.round(c.score * 100)}%
                </span>
              </div>
            </button>
          ))}
        </div>
      </div>

      <div className="pt-6 mt-8 border-t border-border-subtle flex flex-col sm:flex-row items-center justify-between gap-4">
        <span className="text-xs text-text-tertiary hidden sm:inline-block">Press <kbd className="font-sans px-1.5 py-0.5 bg-surface-card border border-border-strong rounded shadow-sm text-text-secondary">S</kbd> to skip track</span>
        <Secondary onClick={() => pick(null)}>
          Skip this track (None match)
        </Secondary>
      </div>
    </div>
  );
}
