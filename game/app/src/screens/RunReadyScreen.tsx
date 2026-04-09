/**
 * RunReadyScreen – shown after the simulation finishes but before the
 * battle playback begins.  The "▶ Play" button lets friends in the same
 * room start watching the adventure at the same time on their own devices.
 */

interface RunReadyScreenProps {
  onPlay: () => void;
}

export function RunReadyScreen({ onPlay }: RunReadyScreenProps) {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-stone-900 text-stone-100 gap-6 px-6 text-center">
      <div className="text-6xl">⚔️</div>
      <h1 className="text-2xl font-bold text-amber-400">Ready!</h1>
      <p className="text-stone-400 text-sm max-w-xs">
        The simulation is complete. Tap <span className="text-amber-300 font-semibold">Play</span> when
        your party is ready — so everyone can watch the adventure unfold together.
      </p>
      <button
        onClick={onPlay}
        className="px-10 py-4 bg-amber-700 hover:bg-amber-600 rounded-2xl font-bold text-xl text-stone-100 transition-colors shadow-lg"
      >
        ▶ Play
      </button>
    </div>
  );
}
