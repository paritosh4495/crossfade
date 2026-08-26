import type { ReactNode } from "react";

export const STEP_ORDER = [
  "landing",
  "spotifyAuth",
  "pickPlaylists",
  "nameDestination",
  "matching",
  "review",
  "youtubeAuth",
  "progress",
  "done",
] as const;

export type StepId = (typeof STEP_ORDER)[number];

export const STEP_LABELS: Record<StepId, string> = {
  landing: "Start",
  spotifyAuth: "Connect Spotify",
  pickPlaylists: "Select Playlists",
  nameDestination: "Name Target",
  matching: "Matching",
  review: "Review Queue",
  youtubeAuth: "Connect YouTube",
  progress: "Transferring",
  done: "Complete",
};

export function StepNav({
  current,
  furthestUnlocked,
  onJump,
}: {
  current: StepId;
  furthestUnlocked: number;
  onJump: (step: StepId) => void;
}) {
  return (
    <nav className="flex items-center gap-1 border-b border-border-subtle bg-surface-card/50 backdrop-blur-md px-6 py-3 text-sm overflow-x-auto sticky top-0 z-10 no-scrollbar">
      {STEP_ORDER.map((step, i) => {
        const unlocked = i <= furthestUnlocked;
        const active = step === current;
        return (
          <div key={step} className="flex items-center">
            <button
              disabled={!unlocked}
              onClick={() => onJump(step)}
              className={[
                "flex items-center gap-2 rounded-full px-3 py-1.5 transition-all duration-200",
                active
                  ? "bg-brand-primary text-white font-medium shadow-[0_0_15px_rgba(59,130,246,0.3)]"
                  : unlocked
                    ? "text-text-secondary hover:bg-surface-card-hover hover:text-text-primary"
                    : "text-text-tertiary cursor-not-allowed opacity-50",
              ].join(" ")}
            >
              <span className={[
                "flex items-center justify-center w-5 h-5 rounded-full text-[10px]",
                active ? "bg-white/20" : unlocked ? "bg-surface-border" : "bg-transparent border border-border-subtle"
              ].join(" ")}>
                {i + 1}
              </span>
              {STEP_LABELS[step]}
            </button>
            {i < STEP_ORDER.length - 1 && (
              <div className="w-4 h-[1px] mx-1 bg-border-subtle" />
            )}
          </div>
        );
      })}
    </nav>
  );
}

export function Screen({
  viewport,
  children,
}: {
  viewport: "desktop" | "mobile";
  children: ReactNode;
}) {
  return (
    <div className="flex flex-1 items-start justify-center overflow-y-auto p-4 sm:p-8 relative">
      {/* Soft background glow */}
      <div className="absolute top-[-20%] left-[20%] w-[60%] h-[60%] rounded-full bg-brand-primary/10 blur-[120px] pointer-events-none" />
      
      <div
        className={[
          "min-h-[560px] rounded-2xl border border-border-subtle bg-surface-card/80 backdrop-blur-xl p-8 shadow-2xl transition-all flex flex-col relative z-10",
          viewport === "mobile" ? "w-[380px]" : "w-full max-w-2xl",
        ].join(" ")}
      >
        {children}
      </div>
    </div>
  );
}

export function Primary({
  children,
  onClick,
  disabled,
}: {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="rounded-lg bg-brand-primary px-6 py-2.5 font-medium text-white transition-all duration-200 hover:bg-brand-hover hover:shadow-[0_4px_20px_rgba(59,130,246,0.4)] disabled:cursor-not-allowed disabled:bg-surface-card-hover disabled:text-text-tertiary disabled:shadow-none active:scale-[0.98]"
    >
      {children}
    </button>
  );
}

export function Secondary({
  children,
  onClick,
}: {
  children: ReactNode;
  onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="rounded-lg border border-border-strong bg-transparent px-6 py-2.5 font-medium text-text-primary transition-all duration-200 hover:bg-surface-card-hover active:scale-[0.98]"
    >
      {children}
    </button>
  );
}
