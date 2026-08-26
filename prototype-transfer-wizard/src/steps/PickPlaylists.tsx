import { mockSourcePlaylists } from "../mockData";
import { Primary } from "../components/Chrome";

export function PickPlaylists({
  selected,
  onToggle,
  onContinue,
}: {
  selected: Set<string>;
  onToggle: (id: string) => void;
  onContinue: () => void;
}) {
  const selectedCount = selected.size;
  const totalTracks = mockSourcePlaylists
    .filter((p) => selected.has(p.id))
    .reduce((sum, p) => sum + p.trackCount, 0);

  return (
    <div className="flex h-full flex-col h-full justify-between">
      <div>
        <div className="mb-6 flex flex-col gap-2">
          <div className="flex items-center gap-2 mb-2">
            <span className="bg-brand-primary/20 text-brand-primary text-xs font-semibold px-2.5 py-1 rounded-full uppercase tracking-wider">
              Spotify → YouTube Music
            </span>
          </div>
          <h2 className="text-2xl font-semibold text-text-primary tracking-tight">Select Playlists</h2>
          <p className="text-text-secondary">Choose the playlists you want to transfer. We'll handle them one by one.</p>
        </div>

        <div className="bg-surface-card rounded-2xl border border-border-subtle shadow-sm overflow-hidden mb-6">
          <div className="max-h-[300px] overflow-y-auto divide-y divide-border-subtle">
            {mockSourcePlaylists.map((p) => {
              const checked = selected.has(p.id);
              return (
                <label
                  key={p.id}
                  className={["flex items-center justify-between p-4 cursor-pointer transition-colors hover:bg-surface-card-hover", checked ? "bg-brand-primary/5" : ""].join(" ")}
                >
                  <input
                    type="checkbox"
                    className="sr-only"
                    checked={checked}
                    onChange={() => onToggle(p.id)}
                  />
                  <div className="flex items-center gap-4">
                    <div className={["w-5 h-5 rounded flex items-center justify-center border transition-colors", checked ? "bg-brand-primary border-brand-primary" : "border-border-strong bg-transparent"].join(" ")}>
                      {checked && (
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 text-white" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                      )}
                    </div>
                    <span className={["font-medium transition-colors", checked ? "text-text-primary" : "text-text-secondary"].join(" ")}>{p.name}</span>
                  </div>
                  <span className="text-sm text-text-tertiary bg-surface-bg px-2.5 py-1 rounded-full border border-border-subtle">{p.trackCount} tracks</span>
                </label>
              );
            })}
          </div>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-6 border-t border-border-subtle">
        <div className="text-sm text-text-secondary font-medium">
          {selectedCount === 0
            ? "No playlists selected"
            : `${selectedCount} playlist${selectedCount !== 1 ? 's' : ''} selected (${totalTracks} tracks)`}
        </div>
        <Primary onClick={onContinue} disabled={selectedCount === 0}>
          Continue
        </Primary>
      </div>
    </div>
  );
}
