import { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import './GameUI.css';
import { useGame } from './GameContext';
import type { IRModule } from '@/types/ide';
import { HeroFigurine } from './HeroFigurine';
import { HeroGallery } from './HeroGallery';
import type { HeroData } from '../lib/figurineUtils';
import { getClassEmoji } from '../lib/figurineUtils';

// ─── Types ────────────────────────────────────────────────────────────────────

export type Character = HeroData & {
  id: string | number;
  isCustom?: boolean;
};

interface ClassDef {
  name: string;
  role: string;
  description: string;
  difficulty: string;
  baseHealth: number;
  baseMana: number;
  baseDamage: number;
  baseDefense: number;
  critChance: number;
}

// ─── Class definitions ────────────────────────────────────────────────────────

const HERO_CLASSES: ClassDef[] = [
  {
    name: 'Warrior',
    role: 'Tank / Melee DPS',
    description: 'A stalwart defender with unmatched strength. High HP and damage with solid defense.',
    difficulty: 'Easy',
    baseHealth: 120,
    baseMana: 30,
    baseDamage: 18,
    baseDefense: 10,
    critChance: 0.10,
  },
  {
    name: 'Mage',
    role: 'Burst Caster',
    description: 'Glass cannon with powerful spells and low defense. Massive burst damage potential.',
    difficulty: 'Hard',
    baseHealth: 70,
    baseMana: 100,
    baseDamage: 25,
    baseDefense: 4,
    critChance: 0.15,
  },
  {
    name: 'Ranger',
    role: 'Ranged DPS',
    description: 'High attack speed and critical hit chance. Targets the weakest enemy first.',
    difficulty: 'Medium',
    baseHealth: 90,
    baseMana: 60,
    baseDamage: 20,
    baseDefense: 6,
    critChance: 0.20,
  },
  {
    name: 'Paladin',
    role: 'Support / Tank',
    description: 'Heals allies while staying resilient. Great survivability and party support.',
    difficulty: 'Medium',
    baseHealth: 110,
    baseMana: 80,
    baseDamage: 14,
    baseDefense: 9,
    critChance: 0.08,
  },
  {
    name: 'Rogue',
    role: 'Burst Melee',
    description: 'Extreme critical hit chance. High risk, high reward glass cannon melee fighter.',
    difficulty: 'Hard',
    baseHealth: 80,
    baseMana: 50,
    baseDamage: 16,
    baseDefense: 5,
    critChance: 0.30,
  },
  {
    name: 'Cleric',
    role: 'Healer',
    description: 'Keeps the party alive with powerful heals. Low damage but essential support.',
    difficulty: 'Medium',
    baseHealth: 85,
    baseMana: 90,
    baseDamage: 12,
    baseDefense: 7,
    critChance: 0.08,
  },
];

const DIFFICULTY_COLORS: Record<string, string> = {
  Easy: '#4ade80',
  Medium: '#f59e0b',
  Hard: '#f87171',
};

// ─── Local hero storage ───────────────────────────────────────────────────────

const HEROES_KEY = 'blink-rpg-heroes';

function loadCustomHeroes(): Character[] {
  try {
    const raw = localStorage.getItem(HEROES_KEY);
    return raw ? (JSON.parse(raw) as Character[]) : [];
  } catch {
    return [];
  }
}

function saveCustomHeroes(heroes: Character[]): void {
  localStorage.setItem(HEROES_KEY, JSON.stringify(heroes));
}

function createHeroFromClass(cls: ClassDef, name: string): Character {
  return {
    id: (typeof crypto !== 'undefined' && crypto.randomUUID)
      ? crypto.randomUUID()
      : `custom-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    name: name.trim() || `${cls.name} Hero`,
    class: cls.name,
    level: 1,
    baseHealth: cls.baseHealth,
    baseMana: cls.baseMana,
    baseDamage: cls.baseDamage,
    baseDefense: cls.baseDefense,
    description: cls.description,
    role: cls.role,
    difficulty: cls.difficulty,
    isCustom: true,
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function fetchGameFile(path: string): Promise<string> {
  const response = await fetch(`/game-files/${path}`);
  if (!response.ok) throw new Error(`Failed to fetch: ${path}`);
  return response.text();
}

export async function compileScenario(scenarioId: string): Promise<IRModule> {
  if (!window.BlinkCompiler) throw new Error('BlinkCompiler not available.');

  const scenarioMap: Record<string, string> = {
    easy: 'scenario-easy.bdl',
    normal: 'scenario-normal.bdl',
    hard: 'scenario-hard.bdl',
  };

  const [brlContent, heroesContent, enemiesContent, scenarioContent] =
    await Promise.all([
      fetchGameFile('classic-rpg.brl'),
      fetchGameFile('heroes.bdl'),
      fetchGameFile('enemies.bdl'),
      fetchGameFile(scenarioMap[scenarioId]),
    ]);

  const sources = [
    { path: 'classic-rpg.brl', content: brlContent, language: 'brl' },
    { path: 'heroes.bdl', content: heroesContent, language: 'bdl' },
    { path: 'enemies.bdl', content: enemiesContent, language: 'bdl' },
    { path: scenarioMap[scenarioId], content: scenarioContent, language: 'bdl' },
  ];

  const result = window.BlinkCompiler.compile(sources, {
    moduleName: `classic-rpg-${scenarioId}`,
  });

  if (result.errors.length > 0) {
    throw new Error(
      `Compilation failed: ${result.errors.map((e: { message: string }) => e.message).join(', ')}`
    );
  }

  return result.ir;
}

function extractHeroesFromIR(ir: IRModule): Character[] {
  if (!ir?.initial_state?.entities) return [];
  return ir.initial_state.entities
    .filter(
      (e: { components: Record<string, unknown> }) =>
        e.components.HeroInfo &&
        e.components.Team &&
        (e.components.Team as { isPlayer: boolean }).isPlayer === true
    )
    .map((e: { id: string | number; components: Record<string, unknown> }) => {
      const c = e.components;
      return {
        id: e.id,
        name: (c.Character as { name: string })?.name ?? 'Unknown',
        class: (c.Character as { class: string })?.class ?? 'Adventurer',
        level: (c.Character as { level: number })?.level ?? 1,
        baseHealth: (c.Health as { max: number })?.max ?? 100,
        baseMana: (c.Mana as { max: number })?.max ?? 0,
        baseDamage: (c.Combat as { damage: number })?.damage ?? 10,
        baseDefense: (c.Combat as { defense: number })?.defense ?? 5,
        description: (c.HeroInfo as { description: string })?.description ?? '',
        role: (c.HeroInfo as { role: string })?.role ?? 'Unknown',
        difficulty: (c.HeroInfo as { difficulty: string })?.difficulty ?? 'Normal',
      };
    });
}

// ─── Screens ──────────────────────────────────────────────────────────────────

type Screen =
  | 'title'
  | 'hero-management'
  | 'create-hero'
  | 'party-selection'
  | 'difficulty'
  | 'game';

// ─── TitleScreen ─────────────────────────────────────────────────────────────

interface TitleScreenProps {
  onPlay: () => void;
  onManageHeroes: () => void;
  onGallery: () => void;
}

function TitleScreen({ onPlay, onManageHeroes, onGallery }: TitleScreenProps) {
  return (
    <div className="screen title-screen">
      <div className="title-hero-art">⚔️</div>
      <h1 className="game-title">Blink Idle RPG</h1>
      <p className="game-tagline">Assemble your party. Fight endless battles.</p>

      <div className="title-menu">
        <button className="menu-btn menu-btn-primary" onClick={onPlay}>
          ▶ New Adventure
        </button>
        <button className="menu-btn" onClick={onManageHeroes}>
          🦸 Manage Heroes
        </button>
        <button className="menu-btn" onClick={onGallery}>
          📚 Hero Gallery
        </button>
      </div>

      <p className="title-footer">All combat happens automatically — in a blink!</p>
    </div>
  );
}

// ─── HeroManagementScreen ────────────────────────────────────────────────────

interface HeroManagementProps {
  onBack: () => void;
  onCreateHero: () => void;
  heroes: Character[];
  onDelete: (id: string | number) => void;
  onViewFigurine: (hero: Character) => void;
}

function HeroManagementScreen({
  onBack,
  onCreateHero,
  heroes,
  onDelete,
  onViewFigurine,
}: HeroManagementProps) {
  const [confirmDelete, setConfirmDelete] = useState<string | number | null>(null);

  const handleDelete = (id: string | number) => {
    if (confirmDelete === id) {
      onDelete(id);
      setConfirmDelete(null);
    } else {
      setConfirmDelete(id);
    }
  };

  return (
    <div className="screen management-screen">
      <div className="screen-header">
        <button className="back-btn" onClick={onBack}>
          ← Back
        </button>
        <h2>🦸 My Heroes</h2>
        <button className="icon-btn" onClick={onCreateHero}>
          ＋
        </button>
      </div>

      {heroes.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">🧝</div>
          <p>No heroes yet!</p>
          <p className="empty-sub">Create your first hero to get started.</p>
          <button className="menu-btn menu-btn-primary" onClick={onCreateHero}>
            ＋ Create Hero
          </button>
        </div>
      ) : (
        <>
          <div className="hero-list">
            {heroes.map((hero) => (
              <div key={hero.id} className="hero-list-card">
                <div className="hero-list-avatar">
                  {getClassEmoji(hero.class)}
                </div>
                <div className="hero-list-info">
                  <div className="hero-list-name">{hero.name}</div>
                  <div className="hero-list-class">
                    {hero.class} · Lv.{hero.level}
                  </div>
                  <div className="hero-list-stats">
                    ❤️ {hero.baseHealth} &nbsp;⚔️ {hero.baseDamage} &nbsp;🛡️ {hero.baseDefense}
                  </div>
                </div>
                <div className="hero-list-actions">
                  <button
                    className="card-action-btn"
                    onClick={() => onViewFigurine(hero)}
                    title="View figurine"
                  >
                    🖼️
                  </button>
                  {hero.isCustom && (
                    <button
                      className={`card-action-btn delete-btn${confirmDelete === hero.id ? ' confirm' : ''}`}
                      onClick={() => handleDelete(hero.id)}
                      title={confirmDelete === hero.id ? 'Tap again to confirm' : 'Delete hero'}
                    >
                      {confirmDelete === hero.id ? '⚠️' : '🗑️'}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
          <div className="screen-footer">
            <button className="menu-btn menu-btn-primary" onClick={onCreateHero}>
              ＋ Create New Hero
            </button>
          </div>
        </>
      )}
    </div>
  );
}

// ─── CreateHeroScreen ─────────────────────────────────────────────────────────

interface CreateHeroProps {
  onBack: () => void;
  onCreate: (hero: Character) => void;
}

function CreateHeroScreen({ onBack, onCreate }: CreateHeroProps) {
  const [selectedClass, setSelectedClass] = useState<ClassDef | null>(null);
  const [heroName, setHeroName] = useState('');
  const [step, setStep] = useState<'class' | 'name'>('class');
  const nameRef = useRef<HTMLInputElement>(null);

  const handleClassSelect = (cls: ClassDef) => {
    setSelectedClass(cls);
    setStep('name');
    setHeroName('');
    setTimeout(() => nameRef.current?.focus(), 100);
  };

  const handleCreate = () => {
    if (!selectedClass) return;
    const name = heroName.trim() ||
      `${selectedClass.name} ${selectedClass.difficulty === 'Easy' ? 'Defender' : selectedClass.difficulty === 'Hard' ? 'Slayer' : 'Wanderer'} ${Math.floor(Math.random() * 90) + 10}`;
    onCreate(createHeroFromClass(selectedClass, name));
  };

  if (step === 'name' && selectedClass) {
    return (
      <div className="screen create-hero-screen">
        <div className="screen-header">
          <button className="back-btn" onClick={() => setStep('class')}>
            ← Back
          </button>
          <h2>Name Your {selectedClass.name}</h2>
          <div />
        </div>

        <div className="class-preview-card">
          <div className="class-preview-emoji">{getClassEmoji(selectedClass.name)}</div>
          <div className="class-preview-info">
            <div className="class-preview-name">{selectedClass.name}</div>
            <div className="class-preview-role">{selectedClass.role}</div>
            <div
              className="class-preview-difficulty"
              style={{ color: DIFFICULTY_COLORS[selectedClass.difficulty] }}
            >
              Difficulty: {selectedClass.difficulty}
            </div>
          </div>
        </div>

        <div className="stat-row-preview">
          <span>❤️ {selectedClass.baseHealth}</span>
          <span>💧 {selectedClass.baseMana}</span>
          <span>⚔️ {selectedClass.baseDamage}</span>
          <span>🛡️ {selectedClass.baseDefense}</span>
        </div>

        <p className="class-desc">{selectedClass.description}</p>

        <div className="name-input-group">
          <label className="name-label">Hero Name</label>
          <input
            ref={nameRef}
            className="name-input"
            type="text"
            placeholder={`e.g. Bold ${selectedClass.name}`}
            value={heroName}
            onChange={(e) => setHeroName(e.target.value)}
            maxLength={24}
            onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
          />
        </div>

        <button className="menu-btn menu-btn-primary create-confirm-btn" onClick={handleCreate}>
          ✨ Create Hero
        </button>
      </div>
    );
  }

  return (
    <div className="screen create-hero-screen">
      <div className="screen-header">
        <button className="back-btn" onClick={onBack}>
          ← Back
        </button>
        <h2>Choose a Class</h2>
        <div />
      </div>

      <div className="class-grid">
        {HERO_CLASSES.map((cls) => (
          <button
            key={cls.name}
            className="class-card"
            onClick={() => handleClassSelect(cls)}
          >
            <div className="class-emoji">{getClassEmoji(cls.name)}</div>
            <div className="class-name">{cls.name}</div>
            <div className="class-role">{cls.role}</div>
            <div
              className="class-difficulty"
              style={{ color: DIFFICULTY_COLORS[cls.difficulty] }}
            >
              {cls.difficulty}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── PartySelectionScreen ────────────────────────────────────────────────────

const MAX_PARTY_SIZE = 4;

interface PartySelectionProps {
  allHeroes: Character[];
  onBack: () => void;
  onConfirm: (party: Character[]) => void;
  onCreateHero: () => void;
}

function PartySelectionScreen({
  allHeroes,
  onBack,
  onConfirm,
  onCreateHero,
}: PartySelectionProps) {
  const [party, setParty] = useState<Character[]>([]);
  const [figurineHero, setFigurineHero] = useState<Character | null>(null);
  const [filter, setFilter] = useState<string>('All');

  const classes = useMemo(
    () => ['All', ...Array.from(new Set(allHeroes.map((h) => h.class)))],
    [allHeroes]
  );

  const filtered = useMemo(
    () => (filter === 'All' ? allHeroes : allHeroes.filter((h) => h.class === filter)),
    [allHeroes, filter]
  );

  const toggle = (hero: Character) => {
    setParty((prev) => {
      const inParty = prev.some((h) => h.id === hero.id);
      if (inParty) return prev.filter((h) => h.id !== hero.id);
      if (prev.length >= MAX_PARTY_SIZE) return prev;
      return [...prev, hero];
    });
  };

  const isInParty = (hero: Character) => party.some((h) => h.id === hero.id);

  return (
    <div className="screen party-screen">
      <div className="screen-header">
        <button className="back-btn" onClick={onBack}>
          ← Back
        </button>
        <h2>Build Your Party</h2>
        <button className="icon-btn" onClick={onCreateHero} title="Create hero">
          ＋
        </button>
      </div>

      {/* Party slots */}
      <div className="party-slots">
        {Array.from({ length: MAX_PARTY_SIZE }).map((_, i) => {
          const hero = party[i];
          return (
            <div
              key={i}
              className={`party-slot${hero ? ' filled' : ' empty'}`}
              onClick={() => hero && toggle(hero)}
            >
              {hero ? (
                <>
                  <span className="slot-emoji">{getClassEmoji(hero.class)}</span>
                  <span className="slot-name">{hero.name.split(' ')[0]}</span>
                </>
              ) : (
                <span className="slot-plus">＋</span>
              )}
            </div>
          );
        })}
      </div>

      {/* Filter tabs */}
      <div className="filter-tabs">
        {classes.map((cls) => (
          <button
            key={cls}
            className={`filter-tab${filter === cls ? ' active' : ''}`}
            onClick={() => setFilter(cls)}
          >
            {cls === 'All' ? 'All' : getClassEmoji(cls)}
          </button>
        ))}
      </div>

      {/* Hero roster */}
      <div className="hero-roster">
        {filtered.length === 0 && (
          <div className="empty-state">
            <p>No heroes of this class yet.</p>
            <button className="menu-btn menu-btn-primary" onClick={onCreateHero}>
              ＋ Create One
            </button>
          </div>
        )}
        {filtered.map((hero) => {
          const inParty = isInParty(hero);
          const partyFull = party.length >= MAX_PARTY_SIZE;
          return (
            <div
              key={hero.id}
              className={`roster-card${inParty ? ' selected' : ''}${
                !inParty && partyFull ? ' disabled' : ''
              }`}
              onClick={() => (!partyFull || inParty) && toggle(hero)}
            >
              <div className="roster-avatar">{getClassEmoji(hero.class)}</div>
              <div className="roster-info">
                <div className="roster-name">{hero.name}</div>
                <div className="roster-class">{hero.class} · Lv.{hero.level}</div>
                <div className="roster-stats">
                  ❤️ {hero.baseHealth} &nbsp;⚔️ {hero.baseDamage} &nbsp;🛡️ {hero.baseDefense}
                </div>
              </div>
              <div className="roster-right">
                <button
                  className="card-action-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    setFigurineHero(hero);
                  }}
                  title="View figurine"
                >
                  🖼️
                </button>
                <div className={`roster-check${inParty ? ' active' : ''}`}>
                  {inParty ? '✓' : '○'}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {party.length > 0 && (
        <div className="screen-footer">
          <button
            className="menu-btn menu-btn-primary"
            onClick={() => onConfirm(party)}
          >
            Advance with {party.length} Hero{party.length !== 1 ? 'es' : ''} →
          </button>
        </div>
      )}

      {figurineHero && (
        <HeroFigurine
          hero={figurineHero}
          onClose={() => setFigurineHero(null)}
        />
      )}
    </div>
  );
}

// ─── DifficultyScreen ─────────────────────────────────────────────────────────

interface DifficultyScreenProps {
  onBack: () => void;
  onSelect: (scenarioId: string) => void;
  isLoading: boolean;
}

const DIFFICULTIES = [
  {
    id: 'easy',
    label: 'Casual Adventure',
    emoji: '🌿',
    desc: 'Relaxed pacing. Great for learning the game.',
    color: '#4ade80',
  },
  {
    id: 'normal',
    label: 'Classic Campaign',
    emoji: '⚔️',
    desc: 'Balanced challenge. The intended experience.',
    color: '#f59e0b',
  },
  {
    id: 'hard',
    label: 'Nightmare Mode',
    emoji: '💀',
    desc: 'Enemies hit harder. Heroes die faster.',
    color: '#f87171',
  },
];

function DifficultyScreen({ onBack, onSelect, isLoading }: DifficultyScreenProps) {
  return (
    <div className="screen difficulty-screen">
      <div className="screen-header">
        <button className="back-btn" onClick={onBack} disabled={isLoading}>
          ← Back
        </button>
        <h2>Choose Difficulty</h2>
        <div />
      </div>

      {isLoading ? (
        <div className="loading-state">
          <div className="loading-spinner">⚙️</div>
          <p>Compiling scenario…</p>
        </div>
      ) : (
        <div className="difficulty-list">
          {DIFFICULTIES.map((d) => (
            <button
              key={d.id}
              className="difficulty-card"
              style={{ borderColor: d.color }}
              onClick={() => onSelect(d.id)}
            >
              <div className="diff-emoji" style={{ color: d.color }}>
                {d.emoji}
              </div>
              <div className="diff-info">
                <div className="diff-label" style={{ color: d.color }}>
                  {d.label}
                </div>
                <div className="diff-desc">{d.desc}</div>
              </div>
              <div className="diff-arrow">›</div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── GameScreen ──────────────────────────────────────────────────────────────

interface CombatantCardProps {
  name: string;
  hpCurrent: number;
  hpMax: number;
  isPlayer: boolean;
  heroClass?: string;
}

function CombatantCard({ name, hpCurrent, hpMax, isPlayer, heroClass }: CombatantCardProps) {
  const pct = hpMax > 0 ? Math.max(0, (hpCurrent / hpMax) * 100) : 0;
  const barColor = pct > 50 ? '#4ade80' : pct > 25 ? '#f59e0b' : '#f87171';
  return (
    <div className={`combatant-card${isPlayer ? ' player-combatant' : ' enemy-combatant'}`}>
      <div className="combatant-header">
        <span className="combatant-emoji">{isPlayer ? '🛡️' : '👹'}</span>
        <span className="combatant-name">{heroClass ? `${name} (${heroClass})` : name}</span>
        <span className="combatant-hp">
          {hpCurrent}/{hpMax}
        </span>
      </div>
      <div className="hp-bar-track">
        <div
          className="hp-bar-fill"
          style={{ width: `${pct}%`, background: barColor }}
        />
      </div>
    </div>
  );
}

interface GameScreenProps {
  onReturnToTitle: () => void;
}

function GameScreen({ onReturnToTitle }: GameScreenProps) {
  const { engine } = useGame();
  const [combatants, setCombatants] = useState<
    Array<{
      id: string | number;
      name: string;
      class: string;
      hpCurrent: number;
      hpMax: number;
      isPlayer: boolean;
      alive: boolean;
    }>
  >([]);
  const [log, setLog] = useState<string[]>(['⚔️ Battle begins!']);
  const [gameOver, setGameOver] = useState<string | null>(null);
  const [wave, setWave] = useState(1);
  const [running, setRunning] = useState(true);
  const [kills, setKills] = useState(0);
  const logRef = useRef<HTMLDivElement>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Scroll log to bottom when new entries arrive
  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [log]);

  const appendLog = useCallback((msg: string) => {
    setLog((prev) => {
      const next = [...prev, msg];
      return next.length > 80 ? next.slice(next.length - 80) : next;
    });
  }, []);

  const refreshState = useCallback(() => {
    if (!engine) return;

    const allIds = engine.query('Character', 'Team');
    const updated = allIds.map((id) => {
      const char = engine.getComponent(id, 'Character') as {
        name: string;
        class: string;
      } | undefined;
      const health = engine.getComponent(id, 'Health') as {
        current: number;
        max: number;
      } | undefined;
      const team = engine.getComponent(id, 'Team') as {
        isPlayer: boolean;
      } | undefined;
      return {
        id,
        name: char?.name ?? 'Unknown',
        class: char?.class ?? '',
        hpCurrent: health?.current ?? 0,
        hpMax: health?.max ?? 1,
        isPlayer: team?.isPlayer ?? false,
        alive: (health?.current ?? 0) > 0,
      };
    });
    setCombatants(updated);

    // Check wave / game state
    const gsIds = engine.query('GameState');
    if (gsIds.length > 0) {
      const gs = engine.getComponent(gsIds[0], 'GameState') as {
        currentWave?: number;
        enemiesDefeated?: number;
        gameOver?: boolean;
        victory?: boolean;
      } | undefined;
      if (gs) {
        if (gs.currentWave !== undefined) setWave(gs.currentWave);
        if (gs.enemiesDefeated !== undefined) setKills(gs.enemiesDefeated);
        if (gs.gameOver) {
          setGameOver('💀 Game Over — your party has fallen.');
          setRunning(false);
        }
        if (gs.victory) {
          setGameOver('🏆 Victory! You defeated all enemies!');
          setRunning(false);
        }
      }
    }
  }, [engine]);

  useEffect(() => {
    if (!engine) return;

    // Wire up trace events for the combat log
    const unsubTrace = engine.onTrace((evt) => {
      const t = evt as { type?: string; event?: string; fields?: Record<string, unknown> };
      if (!t.event) return;
      const ev = t.event;
      if (ev === 'DoAttack') {
        appendLog(`⚔️ Attack lands!`);
      } else if (ev === 'EnemyDefeated') {
        appendLog(`💀 Enemy defeated!`);
      } else if (ev === 'HeroDeath') {
        appendLog(`☠️ A hero has fallen!`);
      } else if (ev === 'LevelUp') {
        appendLog(`⬆️ Level up!`);
      } else if (ev === 'GameOver') {
        appendLog(`💀 Game Over!`);
      } else if (ev === 'Victory') {
        appendLog(`🏆 Victory!`);
      }
    });

    // Schedule GameStart
    engine.scheduleEvent('GameStart', 0);

    // Run simulation loop
    intervalRef.current = setInterval(() => {
      if (!engine) return;
      for (let i = 0; i < 10; i++) {
        if (!engine.hasEvents()) break;
        engine.step();
      }
      refreshState();
    }, 100);

    return () => {
      unsubTrace();
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [engine, appendLog, refreshState]);

  const players = combatants.filter((c) => c.isPlayer);
  const enemies = combatants.filter((c) => !c.isPlayer);

  const handleTogglePause = () => {
    setRunning((prev) => {
      if (prev) {
        // pause
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
      } else {
        // resume
        intervalRef.current = setInterval(() => {
          if (!engine) return;
          for (let i = 0; i < 10; i++) {
            if (!engine.hasEvents()) break;
            engine.step();
          }
          refreshState();
        }, 100);
      }
      return !prev;
    });
  };

  return (
    <div className="screen game-screen">
      {/* Status bar */}
      <div className="game-status-bar">
        <div className="status-item">
          <span className="status-label">Wave</span>
          <span className="status-value">{wave}</span>
        </div>
        <div className="status-item">
          <span className="status-label">Kills</span>
          <span className="status-value">{kills}</span>
        </div>
        <div className="status-item">
          <span className="status-label">Party</span>
          <span className="status-value">
            {players.filter((p) => p.alive).length}/{players.length}
          </span>
        </div>
        <button
          className={`pause-btn${running ? '' : ' paused'}`}
          onClick={handleTogglePause}
          disabled={!!gameOver}
        >
          {running ? '⏸' : '▶'}
        </button>
      </div>

      {gameOver && (
        <div className="game-over-banner">
          <p>{gameOver}</p>
          <button className="menu-btn menu-btn-primary" onClick={onReturnToTitle}>
            Return to Title
          </button>
        </div>
      )}

      {/* Combat area */}
      <div className="combat-area">
        <div className="team-col">
          <div className="team-label player-label">🛡️ Party</div>
          {players.map((p) => (
            <CombatantCard
              key={p.id}
              name={p.name}
              heroClass={p.class}
              hpCurrent={p.hpCurrent}
              hpMax={p.hpMax}
              isPlayer={true}
            />
          ))}
        </div>

        <div className="vs-divider">⚡</div>

        <div className="team-col">
          <div className="team-label enemy-label">👹 Enemies</div>
          {enemies.length === 0 ? (
            <div className="no-enemies">Waiting for wave…</div>
          ) : (
            enemies.map((e) => (
              <CombatantCard
                key={e.id}
                name={e.name}
                hpCurrent={e.hpCurrent}
                hpMax={e.hpMax}
                isPlayer={false}
              />
            ))
          )}
        </div>
      </div>

      {/* Combat log */}
      <div className="combat-log-section">
        <div className="combat-log-title">📜 Combat Log</div>
        <div className="combat-log-scroll" ref={logRef}>
          {log.map((entry, i) => (
            <div key={i} className="log-entry">
              {entry}
            </div>
          ))}
        </div>
      </div>

      {!gameOver && (
        <div className="screen-footer">
          <button className="menu-btn menu-btn-danger" onClick={onReturnToTitle}>
            Abandon Run
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Root GameUI ─────────────────────────────────────────────────────────────

export function GameUI() {
  const [screen, setScreen] = useState<Screen>('title');
  const [customHeroes, setCustomHeroes] = useState<Character[]>(loadCustomHeroes);
  const [prebuiltHeroes, setPrebuiltHeroes] = useState<Character[]>([]);
  const [showGallery, setShowGallery] = useState(false);
  const [figurineHero, setFigurineHero] = useState<Character | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const { initialize } = useGame();

  // Preload prebuilt heroes from BDL on mount
  useEffect(() => {
    (async () => {
      try {
        const ir = await compileScenario('easy');
        setPrebuiltHeroes(extractHeroesFromIR(ir));
      } catch (err) {
        console.warn('Could not preload prebuilt heroes:', (err as Error).message);
      }
    })();
  }, []);

  const allHeroes = useMemo(
    () => [...customHeroes, ...prebuiltHeroes],
    [customHeroes, prebuiltHeroes]
  );

  const handleCreateHero = (hero: Character) => {
    const updated = [hero, ...customHeroes];
    setCustomHeroes(updated);
    saveCustomHeroes(updated);
    setScreen('hero-management');
  };

  const handleDeleteHero = (id: string | number) => {
    const updated = customHeroes.filter((h) => h.id !== id);
    setCustomHeroes(updated);
    saveCustomHeroes(updated);
  };

  const handleDifficultySelect = async (scenarioId: string) => {
    setIsLoading(true);
    try {
      const ir = await compileScenario(scenarioId);
      await initialize(ir);

      // Inject custom party into engine after initialize
      // (prebuilt heroes are already in the IR; custom heroes need adding)

      setScreen('game');
    } catch (err) {
      alert(`Failed to start: ${(err as Error).message}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="app-root">
      {screen === 'title' && (
        <TitleScreen
          onPlay={() => {
            if (allHeroes.length === 0) {
              setScreen('create-hero');
            } else {
              setScreen('party-selection');
            }
          }}
          onManageHeroes={() => setScreen('hero-management')}
          onGallery={() => setShowGallery(true)}
        />
      )}

      {screen === 'hero-management' && (
        <HeroManagementScreen
          heroes={allHeroes}
          onBack={() => setScreen('title')}
          onCreateHero={() => setScreen('create-hero')}
          onDelete={handleDeleteHero}
          onViewFigurine={(hero) => setFigurineHero(hero)}
        />
      )}

      {screen === 'create-hero' && (
        <CreateHeroScreen
          onBack={() =>
            setScreen(
              customHeroes.length > 0 ? 'hero-management' : 'title'
            )
          }
          onCreate={handleCreateHero}
        />
      )}

      {screen === 'party-selection' && (
        <PartySelectionScreen
          allHeroes={allHeroes}
          onBack={() => setScreen('title')}
          onConfirm={() => {
            setScreen('difficulty');
          }}
          onCreateHero={() => setScreen('create-hero')}
        />
      )}

      {screen === 'difficulty' && (
        <DifficultyScreen
          onBack={() => setScreen('party-selection')}
          onSelect={handleDifficultySelect}
          isLoading={isLoading}
        />
      )}

      {screen === 'game' && (
        <GameScreen
          onReturnToTitle={() => setScreen('title')}
        />
      )}

      {showGallery && <HeroGallery onClose={() => setShowGallery(false)} />}

      {figurineHero && (
        <HeroFigurine
          hero={figurineHero}
          onClose={() => setFigurineHero(null)}
        />
      )}
    </div>
  );
}

