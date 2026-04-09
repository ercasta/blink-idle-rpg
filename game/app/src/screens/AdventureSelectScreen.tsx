import type { AdventureDefinition, HeroClass } from '../types';

const ALL_CLASSES: HeroClass[] = ['Warrior', 'Mage', 'Ranger', 'Paladin', 'Rogue', 'Cleric'];

const CLASS_EMOJIS: Record<HeroClass, string> = {
  Warrior: '⚔️', Mage: '🧙', Ranger: '🏹', Paladin: '🛡️', Rogue: '🗡️', Cleric: '🙏',
};

const MODE_BADGE: Record<string, string> = {
  easy:   'bg-green-800 text-green-200',
  normal: 'bg-amber-800 text-amber-200',
  hard:   'bg-red-900 text-red-200',
  custom: 'bg-purple-800 text-purple-200',
};

const MODE_LABEL: Record<string, string> = {
  easy: 'Easy', normal: 'Normal', hard: 'Hard', custom: 'Custom',
};

interface AdventureSelectScreenProps {
  adventures: AdventureDefinition[];
  onSelect: (adventure: AdventureDefinition) => void;
  onManageAdventures: () => void;
  onBack: () => void;
}

function ClassPips({ classes }: { classes: HeroClass[] }) {
  const allAllowed = classes.length === ALL_CLASSES.length;
  if (allAllowed) {
    return <span className="text-xs text-stone-400">All classes</span>;
  }
  return (
    <span className="text-xs text-stone-400 flex items-center gap-0.5">
      {classes.map(c => (
        <span key={c} title={c}>{CLASS_EMOJIS[c]}</span>
      ))}
    </span>
  );
}

export function AdventureSelectScreen({
  adventures,
  onSelect,
  onManageAdventures,
  onBack,
}: AdventureSelectScreenProps) {
  return (
    <div className="flex flex-col min-h-screen bg-stone-900 text-stone-100 px-4 py-6">
      {/* Header */}
      <div className="flex items-center gap-3 mb-2">
        <button
          onClick={onBack}
          className="text-stone-400 hover:text-stone-100 text-2xl leading-none"
        >
          ←
        </button>
        <h1 className="text-xl font-bold">Choose an Adventure</h1>
      </div>
      <p className="text-stone-500 text-xs mb-4">
        Select an adventure to begin, then assemble your party.
      </p>

      {adventures.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-4 text-center py-12">
          <div className="text-5xl">🗺️</div>
          <p className="text-stone-400 text-sm">
            You have no adventures yet.<br />Create one in the Adventure Manager.
          </p>
          <button
            onClick={onManageAdventures}
            className="px-6 py-3 bg-amber-700 hover:bg-amber-600 rounded-xl font-bold transition-colors text-stone-100"
          >
            Manage Adventures
          </button>
        </div>
      ) : (
        <>
          {/* Adventure list */}
          <div className="flex flex-col gap-3 flex-1">
            {adventures.map((adv) => (
              <button
                key={adv.id}
                onClick={() => onSelect(adv)}
                className="w-full text-left bg-stone-800 hover:bg-stone-700 rounded-xl p-4 transition-colors border border-stone-700 hover:border-amber-600"
              >
                <div className="flex items-start justify-between gap-2 mb-1">
                  <span className="font-bold text-base leading-tight">{adv.name}</span>
                  <span className={`shrink-0 text-xs px-2 py-0.5 rounded-full font-semibold ${MODE_BADGE[adv.mode] ?? ''}`}>
                    {MODE_LABEL[adv.mode] ?? adv.mode}
                  </span>
                </div>
                <div className="flex items-center gap-3 mb-2 text-xs text-stone-400">
                  <span>👥 {adv.requiredHeroCount} {adv.requiredHeroCount === 1 ? 'hero' : 'heroes'}</span>
                  <ClassPips classes={adv.allowedClasses} />
                </div>
                <p className="text-xs text-stone-400 leading-relaxed line-clamp-2">
                  {adv.description.split('\n\n')[0]}
                </p>
              </button>
            ))}
          </div>

          {/* Manage link */}
          <div className="pt-4 mt-4 border-t border-stone-800 flex justify-center">
            <button
              onClick={onManageAdventures}
              className="text-sm text-stone-500 hover:text-stone-300 underline transition-colors"
            >
              🗺️ Manage Adventures
            </button>
          </div>
        </>
      )}
    </div>
  );
}
