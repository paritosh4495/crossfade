import { useState } from "react";
import type { ProgressScenario } from "../steps/Progress";

export function DevToolbar({
  viewport,
  onViewport,
  scenario,
  onScenario,
}: {
  viewport: "desktop" | "mobile";
  onViewport: (v: "desktop" | "mobile") => void;
  scenario: ProgressScenario;
  onScenario: (s: ProgressScenario) => void;
}) {
  const [showNote, setShowNote] = useState(false);

  return (
    <>
      <div className="fixed bottom-4 left-1/2 z-50 flex -translate-x-1/2 items-center gap-3 rounded-full border border-border-subtle bg-surface-card/95 px-4 py-2 text-xs shadow-lg backdrop-blur">
        <div className="flex items-center gap-1">
          <span className="text-text-tertiary">Viewport</span>
          {(["desktop", "mobile"] as const).map((v) => (
            <button
              key={v}
              onClick={() => onViewport(v)}
              className={[
                "rounded px-2 py-0.5",
                viewport === v ? "bg-brand-primary text-white" : "text-text-secondary hover:bg-surface-card-hover",
              ].join(" ")}
            >
              {v}
            </button>
          ))}
        </div>
        <div className="h-4 w-px bg-border-subtle" />
        <div className="flex items-center gap-1">
          <span className="text-text-tertiary">Progress scenario</span>
          {(["smooth", "throttled", "failures"] as const).map((s) => (
            <button
              key={s}
              onClick={() => onScenario(s)}
              className={[
                "rounded px-2 py-0.5",
                scenario === s ? "bg-brand-primary text-white" : "text-text-secondary hover:bg-surface-card-hover",
              ].join(" ")}
            >
              {s}
            </button>
          ))}
        </div>
        <div className="h-4 w-px bg-border-subtle" />
        <button onClick={() => setShowNote(true)} className="text-text-tertiary hover:text-text-primary">
          Note
        </button>
      </div>

      {showNote && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
          onClick={() => setShowNote(false)}
        >
          <div
            className="max-w-md rounded-2xl border border-border-subtle bg-surface-card p-6 text-sm text-text-secondary shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 font-semibold text-text-primary text-base">Not prototyped: anonymous resume link</div>
            <p>
              In production, if you close the tab before the transfer finishes (which takes
              days for large libraries due to YouTube quota limits), you aren't lost.
            </p>
            <p className="mt-2">
              Crossfade relies entirely on your Spotify account as your identity. If you
              close the tab, you just go to crossfade.app again, click "Sign in with Spotify",
              and it automatically drops you right back onto the Progress screen for your
              active transfer.
            </p>
            <p className="mt-2">
              (We don't prototype this because it requires a real backend session).
            </p>
            <button
              onClick={() => setShowNote(false)}
              className="mt-6 w-full rounded-lg bg-surface-card-hover border border-border-strong px-4 py-2 text-text-primary font-medium hover:bg-surface-bg transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </>
  );
}
