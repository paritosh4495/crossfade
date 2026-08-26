import { useEffect, useState } from "react";
import { Primary, Secondary } from "../components/Chrome";

export type ProgressScenario = "smooth" | "throttled" | "failures";

type JobState =
  | "queued"
  | "running"
  | "throttled"
  | "paused"
  | "completed"
  | "completed_with_failures";

const DAILY_QUOTA = 200;

export function Progress({
  totalTracks,
  scenario,
  onDone,
}: {
  totalTracks: number;
  scenario: ProgressScenario;
  onDone: (failures: number) => void;
}) {
  const [written, setWritten] = useState(0);
  const [failed, setFailed] = useState(0);
  const [jobState, setJobState] = useState<JobState>("queued");
  const [userPaused, setUserPaused] = useState(false);

  const day = Math.floor(written / DAILY_QUOTA) + 1;
  const totalDays = Math.max(1, Math.ceil(totalTracks / DAILY_QUOTA));

  useEffect(() => {
    if (jobState === "queued") {
      const id = setTimeout(() => setJobState("running"), 300);
      return () => clearTimeout(id);
    }
  }, [jobState]);

  useEffect(() => {
    if (jobState !== "running") return;
    if (written >= totalTracks) {
      setJobState(failed > 0 ? "completed_with_failures" : "completed");
      return;
    }
    if (scenario === "throttled" && written > 0 && written % DAILY_QUOTA === 0) {
      setJobState("throttled");
      return;
    }
    const id = setTimeout(() => {
      if (scenario === "failures" && written === 30) {
        setFailed((f) => f + 1);
        setWritten((w) => w + 1);
      } else {
        setWritten((w) => w + 1);
      }
    }, 15);
    return () => clearTimeout(id);
  }, [jobState, written, totalTracks, scenario, failed]);

  useEffect(() => {
    if (jobState === "completed" || jobState === "completed_with_failures") {
      onDone(failed);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobState]);

  function simulateNextDay() {
    setJobState("running");
  }

  const pct = Math.round((written / totalTracks) * 100);

  return (
    <div className="flex h-full flex-col justify-between">
      <div>
        <div className="flex items-center justify-between mb-8 pb-6 border-b border-border-subtle">
          <div>
            <h2 className="text-2xl font-semibold text-text-primary tracking-tight">Transferring</h2>
            <p className="text-sm text-text-secondary mt-1">Writing tracks safely to YouTube Music.</p>
          </div>
          
          <div className={["flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium border", 
            jobState === 'running' ? "bg-brand-primary/10 text-brand-primary border-brand-primary/20" :
            jobState === 'paused' ? "bg-surface-card text-text-primary border-border-strong" :
            jobState === 'throttled' ? "bg-amber-500/10 text-amber-500 border-amber-500/20" :
            "bg-surface-card text-text-secondary border-border-subtle"
          ].join(" ")}>
            {jobState === 'running' && <span className="w-1.5 h-1.5 rounded-full bg-brand-primary animate-pulse" />}
            {jobState.replace("_", " ").toUpperCase()}
          </div>
        </div>

        <div className="bg-surface-card rounded-2xl border border-border-subtle p-6 shadow-sm mb-6">
          <div className="flex justify-between items-end mb-4">
            <div>
              <div className="text-3xl font-semibold text-text-primary">{written} <span className="text-lg text-text-tertiary font-normal">/ {totalTracks}</span></div>
              <div className="text-sm text-text-secondary mt-1">tracks successfully written</div>
            </div>
            <div className="text-2xl font-medium text-brand-primary">{pct}%</div>
          </div>
          
          <div className="h-3 w-full bg-surface-bg rounded-full overflow-hidden border border-border-subtle relative">
            <div
              className={["h-full transition-all duration-150 rounded-full", jobState === 'paused' ? "bg-text-secondary" : jobState === 'throttled' ? "bg-amber-500" : "bg-brand-primary"].join(" ")}
              style={{ width: `${pct}%` }}
            />
          </div>
          
          {failed > 0 && (
            <div className="mt-4 flex items-center gap-2 text-sm text-red-400 bg-red-400/10 px-3 py-2 rounded-lg">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
              {failed} tracks failed to write (will retry)
            </div>
          )}
        </div>

        {totalDays > 1 && (
          <div className="mb-6">
            <div className="flex items-center justify-between mb-3 px-1">
              <span className="text-sm font-medium text-text-primary">Multi-day Transfer Plan</span>
              <span className="text-xs text-text-tertiary">YouTube limits: {DAILY_QUOTA} tracks/day</span>
            </div>
            <div className="flex gap-2">
              {Array.from({ length: totalDays }).map((_, i) => {
                const dayNum = i + 1;
                const state = dayNum < day ? "done" : dayNum === day ? "active" : "pending";
                return (
                  <div
                    key={i}
                    className={[
                      "h-10 flex-1 rounded-xl flex items-center justify-center text-xs font-medium border transition-colors",
                      state === "done"
                        ? "bg-brand-primary/10 border-brand-primary/20 text-brand-primary"
                        : state === "active"
                          ? "bg-brand-primary border-brand-primary text-white shadow-md shadow-brand-primary/20"
                          : "bg-surface-card border-border-subtle text-text-tertiary",
                    ].join(" ")}
                  >
                    Day {dayNum}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {jobState === "throttled" && (
          <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-5 mb-6">
            <div className="flex gap-3">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
              </svg>
              <div>
                <h4 className="text-amber-500 font-medium mb-1">Daily quota reached</h4>
                <p className="text-sm text-amber-500/80 mb-4">
                  We've safely written {DAILY_QUOTA} tracks today. We will automatically resume exactly where we left off when your quota resets tomorrow. No action needed.
                </p>
                <button 
                  onClick={simulateNextDay}
                  className="text-xs font-medium text-surface-bg bg-amber-500 hover:bg-amber-400 px-3 py-1.5 rounded-lg transition-colors"
                >
                  Simulate Tomorrow
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="flex items-center justify-between pt-6 border-t border-border-subtle">
        <span className="text-xs text-text-tertiary max-w-[250px]">
          Pausing only delays the next track. Current writes will finish safely.
        </span>
        {jobState === "running" && (
          <Secondary
            onClick={() => {
              setUserPaused(true);
              setJobState("paused");
            }}
          >
            Pause Transfer
          </Secondary>
        )}
        {jobState === "paused" && userPaused && (
          <Primary onClick={() => setJobState("running")}>Resume Transfer</Primary>
        )}
      </div>
    </div>
  );
}
