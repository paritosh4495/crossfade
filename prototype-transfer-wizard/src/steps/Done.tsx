import { Primary } from "../components/Chrome";

export function Done({
  written,
  notFound,
  failed,
  onRestart,
}: {
  written: number;
  notFound: number;
  failed: number;
  onRestart: () => void;
}) {
  const hasIssues = notFound > 0 || failed > 0;

  return (
    <div className="flex h-full min-h-[400px] flex-col items-center justify-center text-center">
      <div className={["w-20 h-20 rounded-full flex items-center justify-center mb-6", hasIssues ? "bg-amber-500/10 text-amber-500" : "bg-green-500/10 text-green-500"].join(" ")}>
        {hasIssues ? (
          <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        ) : (
          <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        )}
      </div>
      
      <h2 className="text-3xl font-semibold text-text-primary mb-2">
        {hasIssues ? "Transfer Complete with Exceptions" : "Transfer Complete!"}
      </h2>
      
      <p className="text-text-secondary mb-8">
        We successfully moved <strong className="text-text-primary font-semibold">{written}</strong> tracks to your new library.
      </p>

      {hasIssues && (
        <div className="w-full max-w-sm bg-surface-card rounded-2xl border border-border-subtle p-5 mb-8 text-left shadow-sm">
          <h3 className="text-sm font-semibold text-text-primary mb-3">What couldn't be transferred:</h3>
          <div className="space-y-3">
            {notFound > 0 && (
              <div className="flex items-start gap-3">
                <div className="w-6 h-6 rounded bg-surface-bg border border-border-subtle flex items-center justify-center text-text-secondary shrink-0">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
                  </svg>
                </div>
                <div>
                  <div className="text-sm font-medium text-text-primary">{notFound} tracks not found</div>
                  <div className="text-xs text-text-secondary">No confident match existed on YouTube Music</div>
                </div>
              </div>
            )}
            {failed > 0 && (
              <div className="flex items-start gap-3">
                <div className="w-6 h-6 rounded bg-red-400/10 border border-red-400/20 flex items-center justify-center text-red-400 shrink-0">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                  </svg>
                </div>
                <div>
                  <div className="text-sm font-medium text-text-primary">{failed} tracks failed</div>
                  <div className="text-xs text-text-secondary">Network or internal API errors</div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      <div className="mt-2 flex flex-col items-center gap-6">
        <Primary onClick={onRestart}>Start Another Transfer</Primary>
        <p className="text-xs text-text-tertiary">
          This history is saved in your browser. You can safely close this tab.
        </p>
      </div>
    </div>
  );
}
