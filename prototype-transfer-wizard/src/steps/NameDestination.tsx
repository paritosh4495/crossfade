import { mockSourcePlaylists } from "../mockData";
import { Primary } from "../components/Chrome";

export function NameDestination({
  selected,
  names,
  onRename,
  onContinue,
}: {
  selected: Set<string>;
  names: Record<string, string>;
  onRename: (id: string, name: string) => void;
  onContinue: () => void;
}) {
  const playlists = mockSourcePlaylists.filter((p) => selected.has(p.id));

  return (
    <div className="flex h-full flex-col justify-between">
      <div>
        <div className="mb-6">
          <h2 className="text-2xl font-semibold text-text-primary tracking-tight mb-2">Name your destinations</h2>
          <p className="text-text-secondary">By default, we keep the original names. You can customize them below before we start matching.</p>
        </div>

        <div className="flex flex-col gap-4">
          {playlists.map((p) => (
            <div key={p.id} className="bg-surface-card rounded-xl border border-border-subtle p-4 shadow-sm transition-all focus-within:border-brand-primary focus-within:ring-1 focus-within:ring-brand-primary">
              <label className="block text-xs font-medium text-text-tertiary uppercase tracking-wider mb-2">
                Original: {p.name}
              </label>
              <input
                value={names[p.id] ?? p.name}
                onChange={(e) => onRename(p.id, e.target.value)}
                placeholder="Playlist name"
                className="w-full bg-transparent text-text-primary text-lg font-medium outline-none placeholder:text-text-tertiary"
              />
            </div>
          ))}
        </div>
        
        <div className="mt-6 flex items-start gap-3 p-4 rounded-xl bg-blue-500/10 border border-blue-500/20 text-sm text-blue-200">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 shrink-0 text-blue-400 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p>
            If a playlist with this name already exists in YouTube Music, we'll automatically append the new tracks to it instead of creating a duplicate.
          </p>
        </div>
      </div>

      <div className="pt-6 mt-8 flex justify-end border-t border-border-subtle">
        <Primary onClick={onContinue}>Confirm and Continue</Primary>
      </div>
    </div>
  );
}
