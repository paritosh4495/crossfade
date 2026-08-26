import { useEffect, useState } from "react";
import { Primary, Secondary } from "../components/Chrome";

export function OAuthConnect({
  provider,
  reason,
  viewport,
  onApproved,
}: {
  provider: "Spotify" | "YouTube";
  reason: string;
  viewport: "desktop" | "mobile";
  onApproved: () => void;
}) {
  const [phase, setPhase] = useState<"idle" | "redirecting" | "consent" | "returning">("idle");

  useEffect(() => {
    if (phase === "redirecting") {
      const id = setTimeout(() => setPhase("consent"), 600);
      return () => clearTimeout(id);
    }
  }, [phase]);

  if (phase === "idle") {
    return (
      <div className="flex h-full min-h-[400px] flex-col items-center justify-center text-center max-w-md mx-auto">
        <div className="w-16 h-16 bg-surface-card rounded-2xl flex items-center justify-center mb-6 shadow-inner border border-border-subtle">
          <span className="text-2xl font-bold text-text-primary">{provider[0]}</span>
        </div>
        <h2 className="text-2xl font-semibold text-text-primary mb-3">Connect {provider}</h2>
        <p className="text-text-secondary mb-8">{reason}</p>
        <Primary onClick={() => setPhase("redirecting")}>Continue to {provider}</Primary>
      </div>
    );
  }

  if (phase === "redirecting") {
    return (
      <div className="flex h-full min-h-[400px] flex-col items-center justify-center text-center">
        <div className="w-8 h-8 rounded-full border-2 border-brand-primary border-t-transparent animate-spin mb-4" />
        <p className="text-text-secondary">Redirecting securely to {provider}...</p>
      </div>
    );
  }

  if (phase === "consent") {
    return (
      <div className="flex h-full min-h-[400px] flex-col items-center justify-center w-full">
        <div className="w-full max-w-md bg-surface-card rounded-2xl border border-border-subtle shadow-lg p-6">
          <div className="flex items-center gap-3 mb-6 pb-6 border-b border-border-subtle">
             <div className="w-10 h-10 bg-brand-primary/10 rounded-full flex items-center justify-center">
               <span className="text-brand-primary font-bold">{provider[0]}</span>
             </div>
             <div className="text-left">
               <div className="text-sm text-text-tertiary font-medium uppercase tracking-wider">{provider} Authorization</div>
               <div className="text-text-primary font-medium">Crossfade wants to access your account</div>
             </div>
          </div>
          
          <div className="mb-8 text-left text-sm text-text-secondary">
            <p className="mb-3 font-medium text-text-primary">This allows Crossfade to:</p>
            <ul className="space-y-3">
              {provider === "Spotify" ? (
                <>
                  <li className="flex items-start gap-2"><span className="text-brand-primary">•</span> View your Spotify account data</li>
                  <li className="flex items-start gap-2"><span className="text-brand-primary">•</span> View your public and private playlists</li>
                </>
              ) : (
                <>
                  <li className="flex items-start gap-2"><span className="text-brand-primary">•</span> Manage your YouTube Music playlists</li>
                  <li className="flex items-start gap-2"><span className="text-brand-primary">•</span> View your YouTube Music library</li>
                </>
              )}
            </ul>
          </div>
          
          <div className="flex flex-col sm:flex-row gap-3">
            <Primary
              onClick={() => {
                setPhase("returning");
                setTimeout(onApproved, 400);
              }}
            >
              Agree
            </Primary>
            <Secondary onClick={() => setPhase("idle")}>Cancel</Secondary>
          </div>
        </div>
        {viewport === "desktop" && <p className="mt-4 text-xs text-text-tertiary text-center">This simulates an external OAuth popup window.</p>}
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-[400px] flex-col items-center justify-center text-center">
      <div className="w-12 h-12 bg-green-500/20 text-green-500 rounded-full flex items-center justify-center mb-4">
        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
      </div>
      <h3 className="text-xl font-medium text-text-primary mb-2">Connected Successfully</h3>
      <p className="text-text-secondary">Returning you to Crossfade...</p>
    </div>
  );
}
