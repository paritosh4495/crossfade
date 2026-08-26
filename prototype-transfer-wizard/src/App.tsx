import { useEffect, useMemo, useState } from "react";
import { STEP_ORDER, StepNav, Screen, type StepId } from "./components/Chrome";
import { DevToolbar } from "./components/DevToolbar";
import {
  generateMockTransferBatch,
  mockSourcePlaylists,
  type MatchCandidate,
  type TrackTransfer,
} from "./mockData";
import type { ProgressScenario } from "./steps/Progress";

import { Landing } from "./steps/Landing";
import { OAuthConnect } from "./steps/OAuthConnect";
import { PickPlaylists } from "./steps/PickPlaylists";
import { NameDestination } from "./steps/NameDestination";
import { Matching } from "./steps/Matching";
import { ReviewQueue } from "./steps/ReviewQueue";
import { Progress } from "./steps/Progress";
import { Done } from "./steps/Done";

const initial = {
  step: "landing" as StepId,
  furthest: 0,
  viewport: "desktop" as "desktop" | "mobile",
  selected: new Set<string>(),
  destNames: {} as Record<string, string>,
  transfers: [] as TrackTransfer[],
  scenario: "smooth" as ProgressScenario,
  doneStats: { written: 0, notFound: 0, failed: 0 },
};

export default function App() {
  const [step, setStep] = useState<StepId>(initial.step);
  const [furthest, setFurthest] = useState(initial.furthest);
  const [viewport, setViewport] = useState(initial.viewport);
  const [selected, setSelected] = useState<Set<string>>(initial.selected);
  const [destNames, setDestNames] = useState<Record<string, string>>(initial.destNames);
  const [transfers, setTransfers] = useState<TrackTransfer[]>(initial.transfers);
  const [scenario, setScenario] = useState<ProgressScenario>(initial.scenario);
  const [doneStats, setDoneStats] = useState(initial.doneStats);
  const [theme, setTheme] = useState<"light" | "dark">("dark");

  // Sync theme with document root so CSS variables apply globally
  useEffect(() => {
    if (theme === "dark") {
      document.documentElement.classList.add("dark");
      document.documentElement.classList.remove("light");
    } else {
      document.documentElement.classList.add("light");
      document.documentElement.classList.remove("dark");
    }
  }, [theme]);

  function goTo(next: StepId) {
    const idx = STEP_ORDER.indexOf(next);
    setStep(next);
    setFurthest((f) => Math.max(f, idx));
  }

  function jump(next: StepId) {
    setStep(next);
  }

  function toggleSelected(id: string) {
    setSelected((prev) => {
      const copy = new Set(prev);
      if (copy.has(id)) copy.delete(id);
      else copy.add(id);
      return copy;
    });
  }

  const totalTracks = useMemo(
    () => mockSourcePlaylists.filter((p) => selected.has(p.id)).reduce((s, p) => s + p.trackCount, 0),
    [selected],
  );

  function startMatching() {
    setTransfers(generateMockTransferBatch(totalTracks));
    goTo("matching");
  }

  function resolveReview(sourceId: string, chosen: MatchCandidate | null) {
    setTransfers((prev) =>
      prev.map((t) =>
        t.source.id === sourceId
          ? { ...t, state: chosen ? "resolved" : "skipped_declined", chosen: chosen ?? undefined }
          : t,
      ),
    );
  }

  function afterMatching() {
    const anyNeedsReview = transfers.some((t) => t.state === "needs_review");
    goTo(anyNeedsReview ? "review" : "youtubeAuth");
  }

  function afterReview() {
    goTo("youtubeAuth");
  }

  function afterProgress(failed: number) {
    const skippedTotal = transfers.filter((t) => t.state.startsWith("skipped")).length;
    const notFound = transfers.filter((t) => t.state === "skipped_not_found").length;
    const eligibleToWrite = totalTracks - skippedTotal;
    const written = Math.max(eligibleToWrite - failed, 0);
    setDoneStats({ written, notFound, failed });
    goTo("done");
  }

  function restart() {
    setSelected(new Set());
    setDestNames({});
    setTransfers([]);
    setDoneStats(initial.doneStats);
    setStep("landing");
    setFurthest(0);
  }

  const stateSnapshot = {
    step,
    viewport,
    selectedPlaylists: [...selected],
    totalTracks,
    transfersGenerated: transfers.length,
    needsReview: transfers.filter((t) => t.state === "needs_review").length,
  };

  return (
    <div className={["flex h-screen flex-col bg-surface-bg text-text-primary selection:bg-brand-primary/30 selection:text-white transition-colors", theme].join(" ")}>
      <div className="border-b border-border-subtle bg-surface-card px-4 py-2 text-xs font-medium text-brand-primary flex justify-between items-center">
        <span>Crossfade Transfer Wizard (Prototype)</span>
        <div className="flex gap-4 items-center">
          <button onClick={() => setTheme(theme === "dark" ? "light" : "dark")} className="text-text-primary hover:text-brand-primary flex items-center gap-1.5 transition-colors">
            {theme === "dark" ? (
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
              </svg>
            )}
            Toggle {theme === "dark" ? "Light" : "Dark"}
          </button>
          <span className="text-text-tertiary">MOCK DATA ONLY</span>
        </div>
      </div>
      <StepNav current={step} furthestUnlocked={furthest} onJump={jump} />

      <Screen viewport={viewport}>
        {step === "landing" && <Landing onContinue={() => goTo("spotifyAuth")} />}

        {step === "spotifyAuth" && (
          <OAuthConnect
            provider="Spotify"
            reason="Spotify sign-in is how Crossfade knows who you are — it's also how we read this playlist."
            viewport={viewport}
            onApproved={() => goTo("pickPlaylists")}
          />
        )}

        {step === "pickPlaylists" && (
          <PickPlaylists selected={selected} onToggle={toggleSelected} onContinue={() => goTo("nameDestination")} />
        )}

        {step === "nameDestination" && (
          <NameDestination
            selected={selected}
            names={destNames}
            onRename={(id, name) => setDestNames((prev) => ({ ...prev, [id]: name }))}
            onContinue={startMatching}
          />
        )}

        {step === "matching" && <Matching transfers={transfers} onDone={afterMatching} />}

        {step === "review" && (
          <ReviewQueue transfers={transfers} onResolve={resolveReview} onDone={afterReview} />
        )}

        {step === "youtubeAuth" && (
          <OAuthConnect
            provider="YouTube"
            reason="We only ask for this now, right before writing anything — matching didn't need it."
            viewport={viewport}
            onApproved={() => goTo("progress")}
          />
        )}

        {step === "progress" && (
          <Progress totalTracks={Math.max(totalTracks, 1)} scenario={scenario} onDone={afterProgress} />
        )}

        {step === "done" && (
          <Done
            written={doneStats.written}
            notFound={doneStats.notFound}
            failed={doneStats.failed}
            onRestart={restart}
          />
        )}
      </Screen>

      <details className="border-t border-border-subtle px-4 py-2 text-xs text-text-tertiary bg-surface-card">
        <summary className="cursor-pointer select-none">state</summary>
        <pre className="mt-2 max-h-40 overflow-auto text-text-secondary">
          {JSON.stringify(stateSnapshot, null, 2)}
        </pre>
      </details>

      <DevToolbar viewport={viewport} onViewport={setViewport} scenario={scenario} onScenario={setScenario} />
    </div>
  );
}
