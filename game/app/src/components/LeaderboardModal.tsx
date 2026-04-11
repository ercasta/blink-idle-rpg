import { useEffect, useState } from 'react';
import type { AdventureDefinition, AdventureLeaderboard } from '../types';
import { TrophyIcon } from './icons';
import { loadLeaderboard } from '../storage/leaderboardStorage';

function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString(undefined, {
    month: 'short', day: 'numeric', year: 'numeric',
  });
}

interface LeaderboardModalProps {
  adventure: AdventureDefinition;
  onClose: () => void;
}

export function LeaderboardModal({ adventure, onClose }: LeaderboardModalProps) {
  const [leaderboard, setLeaderboard] = useState<AdventureLeaderboard | null>(null);

  useEffect(() => {
    loadLeaderboard(adventure.id).then(setLeaderboard);
  }, [adventure.id]);

  useEffect(() => {
    function handleKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose(); }
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [onClose]);

  const RANK_MEDALS: Record<number, string> = { 1: '🥇', 2: '🥈', 3: '🥉' };

  return (
    <div
      className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 px-4"
      onClick={onClose}
    >
      <div
        className="bg-stone-800 border border-stone-600 rounded-2xl p-5 max-w-sm w-full flex flex-col gap-3 max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center gap-2">
          <TrophyIcon size={20} className="text-amber-400 shrink-0"/>
          <div>
            <h2 className="font-bold text-base text-stone-100">Leaderboard</h2>
            <p className="text-xs text-stone-400">{adventure.name}</p>
          </div>
        </div>

        {/* Entries */}
        {!leaderboard || leaderboard.entries.length === 0 ? (
          <p className="text-stone-500 text-sm text-center py-6">
            No runs recorded yet.<br />Complete an adventure to appear here!
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            {leaderboard.entries.map((entry, i) => {
              const rank = i + 1;
              const medal = RANK_MEDALS[rank];
              return (
                <div
                  key={entry.runId}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-xl border ${
                    rank === 1
                      ? 'bg-amber-900/30 border-amber-700'
                      : 'bg-stone-700/50 border-stone-700'
                  }`}
                >
                  <span className="text-lg w-6 text-center shrink-0">
                    {medal ?? <span className="text-stone-500 text-sm font-bold">#{rank}</span>}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-amber-400 text-sm">
                        {entry.score.toLocaleString()}
                        <span className="text-stone-500 font-normal text-xs ml-0.5">pts</span>
                      </span>
                      {entry.victory && (
                        <span className="text-xs text-green-400">✓ Victory</span>
                      )}
                    </div>
                    {entry.heroNames.length > 0 && (
                      <p className="text-xs text-stone-400 truncate">
                        {entry.heroNames.join(', ')}
                      </p>
                    )}
                    <p className="text-xs text-stone-600">{formatDate(entry.timestamp)}</p>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <button
          onClick={onClose}
          className="w-full py-2.5 rounded-xl bg-stone-700 hover:bg-stone-600 text-stone-200 text-sm font-medium transition-colors"
        >
          Close
        </button>
      </div>
    </div>
  );
}
