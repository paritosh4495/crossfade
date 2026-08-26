import { Primary } from "../components/Chrome";

export function Landing({ onContinue }: { onContinue: () => void }) {
  return (
    <div className="flex h-full min-h-[400px] flex-col items-center justify-center text-center">
      <div className="mb-8 p-4 bg-brand-primary/10 rounded-full">
        <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-brand-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
        </svg>
      </div>
      
      <h1 className="text-3xl font-semibold text-text-primary tracking-tight mb-4">
        Move your playlists seamlessly.
      </h1>
      
      <p className="max-w-md text-text-secondary leading-relaxed mb-10">
        Transfer your library from Spotify to YouTube Music, or the other way around. 
        It runs safely in the background and respects your track details.
      </p>
      
      <Primary onClick={onContinue}>Get Started</Primary>
      
      <div className="mt-8 text-sm text-text-tertiary">
        Secure • Automatic • No track left behind
      </div>
    </div>
  );
}
