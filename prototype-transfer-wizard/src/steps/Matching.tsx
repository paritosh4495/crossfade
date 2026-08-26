import { useEffect, useState } from "react";
import type { TrackTransfer } from "../mockData";
import { Primary } from "../components/Chrome";

export function Matching({
  transfers,
  onDone,
}: {
  transfers: TrackTransfer[];
  onDone: () => void;
}) {
  const [scanned, setScanned] = useState(0);
  const total = transfers.length;
  const finished = scanned >= total;

  useEffect(() => {
    if (finished) return;
    const id = setInterval(() => {
      setScanned((n) => Math.min(n + Math.ceil(total / 20), total));
    }, 80);
    return () => clearInterval(id);
  }, [finished, total]);

  const matched = transfers.filter((t) => t.state === "matched").length;
  const needsReview = transfers.filter((t) => t.state === "needs_review").length;
  const skipped = transfers.filter((t) => t.state.startsWith("skipped")).length;

  return (
    <div className="flex h-full min-h-[400px] flex-col items-center justify-center text-center max-w-md mx-auto">
      <div className="w-16 h-16 bg-surface-card rounded-2xl flex items-center justify-center mb-6 shadow-inner border border-border-subtle relative">
        {!finished && (
          <div className="absolute inset-0 rounded-2xl border-2 border-brand-primary border-t-transparent animate-spin" />
        )}
        <svg xmlns="http://www.w3.org/2000/svg" className={["h-8 w-8 transition-colors", finished ? "text-brand-primary" : "text-text-secondary"].join(" ")} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
      </div>

      <h2 className="text-2xl font-semibold text-text-primary mb-2">Finding your music</h2>
      <p className="text-text-secondary mb-10">We're matching your tracks against the YouTube Music catalog.</p>

      <div className="w-full bg-surface-card rounded-2xl border border-border-subtle p-6 shadow-sm mb-8">
        <div className="flex justify-between text-sm font-medium text-text-primary mb-3">
          <span>{scanned} of {total} checked</span>
          <span className="text-brand-primary">{Math.round((scanned / total) * 100)}%</span>
        </div>
        <div className="h-2.5 w-full bg-surface-bg rounded-full overflow-hidden border border-border-subtle mb-6">
          <div
            className="h-full bg-brand-primary transition-all duration-75 rounded-full"
            style={{ width: `${(scanned / total) * 100}%` }}
          />
        </div>

        {finished && (
          <div className="grid grid-cols-3 gap-2 pt-4 border-t border-border-subtle">
            <div className="flex flex-col">
              <span className="text-2xl font-semibold text-text-primary">{matched}</span>
              <span className="text-xs font-medium text-text-tertiary uppercase tracking-wider mt-1">Matched</span>
            </div>
            <div className="flex flex-col">
              <span className="text-2xl font-semibold text-amber-500">{needsReview}</span>
              <span className="text-xs font-medium text-text-tertiary uppercase tracking-wider mt-1">Review</span>
            </div>
            <div className="flex flex-col">
              <span className="text-2xl font-semibold text-text-secondary">{skipped}</span>
              <span className="text-xs font-medium text-text-tertiary uppercase tracking-wider mt-1">Skipped</span>
            </div>
          </div>
        )}
      </div>

      <div className="h-12 w-full">
        {finished && (
          <Primary onClick={onDone}>
            {needsReview > 0 ? `Review ${needsReview} tracks` : "Continue"}
          </Primary>
        )}
      </div>
    </div>
  );
}
