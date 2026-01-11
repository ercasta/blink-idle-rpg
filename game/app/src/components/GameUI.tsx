import { useState, useMemo, useEffect } from 'react';
import './GameUI.css';
import { useGame } from './GameContext';
import type { IRModule } from '@/types/ide';

// Data structures
interface Character {
  id: string | number;
  name: string;
  class: string;
  level: number;
  baseHealth: number;
  baseMana: number;
  baseDamage: number;
  baseDefense: number;
  description: string;
  role: string;
  difficulty: string;
}

interface Entity {
    id: string | number;
    components: Record<string, any>;
}

// Functions
async function fetchGameFile(path: string): Promise<string> {
  const response = await fetch(`/game-files/${path}`);
  if (!response.ok) {
    throw new Error(`Failed to fetch game file: ${path}`);
  }
  return response.text();
}

async function compileScenario(scenarioId: string): Promise<IRModule> {
  if (!window.BlinkCompiler) {
    throw new Error('BlinkCompiler is not available.');
  }

  const scenarioMap: Record<string, string> = {
    easy: 'scenario-easy.bdl',
    normal: 'scenario-normal.bdl',
    hard: 'scenario-hard.bdl',
  };

  const brlContent = await fetchGameFile('classic-rpg.brl');
  const heroesContent = await fetchGameFile('heroes.bdl');
  const enemiesContent = await fetchGameFile('enemies.bdl');
  const scenarioContent = await fetchGameFile(scenarioMap[scenarioId]);

  const sources = [
    { path: 'classic-rpg.brl', content: brlContent, language: 'brl' },
    { path: 'heroes.bdl', content: heroesContent, language: 'bdl' },
    { path: 'enemies.bdl', content: enemiesContent, language: 'bdl' },
    { path: scenarioMap[scenarioId], content: scenarioContent, language: 'bdl' },
  ];

  const result = window.BlinkCompiler.compile(sources, { moduleName: `classic-rpg-${scenarioId}` });

  if (result.errors.length > 0) {
    throw new Error(`Compilation failed: ${result.errors.map(e => e.message).join(', ')}`);
  }

  return result.ir;
}

function extractCharactersFromIR(ir: IRModule): Character[] {
  if (!ir || !ir.initial_state || !ir.initial_state.entities) {
    console.error('No initial_state.entities in IR');
    return [];
  }

  const heroes = ir.initial_state.entities.filter(entity => {
    return entity.components.HeroInfo && 
           entity.components.Team && 
           (entity.components.Team as { isPlayer: boolean }).isPlayer === true;
  });
  
  return heroes.map(entity => {
    const components = entity.components;
    return {
      id: entity.id,
      name: (components.Character as { name: string })?.name || 'Unknown Hero',
      class: (components.Character as { class: string })?.class || 'Adventurer',
      level: (components.Character as { level: number })?.level || 1,
      baseHealth: (components.Health as { max: number })?.max || 100,
      baseMana: (components.Mana as { max: number })?.max || 0,
      baseDamage: (components.Combat as { damage: number })?.damage || 10,
      baseDefense: (components.Combat as { defense: number })?.defense || 5,
      description: (components.HeroInfo as { description: string })?.description || '',
      role: (components.HeroInfo as { role: string })?.role || 'Unknown',
      difficulty: (components.HeroInfo as { difficulty: string })?.difficulty || 'Normal',
    };
  });
}

// Components
const ScenarioSelection = ({ onScenarioSelected }: { onScenarioSelected: (scenarioId: string) => void }) => (
  <div id="scenario-selection-screen">
    <h2>🎯 Choose Your Scenario 🎯</h2>
    <div className="scenarios-container">
      <div className="scenario-card easy" onClick={() => onScenarioSelected('easy')}>
        <div className="scenario-name">Casual Adventure</div>
      </div>
      <div className="scenario-card normal" onClick={() => onScenarioSelected('normal')}>
        <div className="scenario-name">Classic Campaign</div>
      </div>
      <div className="scenario-card hard" onClick={() => onScenarioSelected('hard')}>
        <div className="scenario-name">Nightmare Mode</div>
      </div>
    </div>
  </div>
);

const HeroCard = ({ hero }: { hero: Character }) => (
  <div className="hero-card">
    <div className="character-header">
      <div className="character-title">
        <h3>{hero.name}</h3>
        <div className="character-class">{hero.class}</div>
      </div>
    </div>
    <div className="character-description">{hero.description}</div>
    <div className="character-stats-preview">
      <div className="stat-preview">
        <span>❤️ Health:</span>
        <span className="stat-preview-value">{hero.baseHealth}</span>
      </div>
      <div className="stat-preview">
        <span>⚔️ Damage:</span>
        <span className="stat-preview-value">{hero.baseDamage}</span>
      </div>
    </div>
  </div>
);

const PartySelection = ({ heroes, onPartySelected }: { heroes: Character[], onPartySelected: (party: (Character | null)[]) => void }) => {
    const [party, setParty] = useState<(Character | null)[]>([null, null, null, null]);
    const [carouselIndex, setCarouselIndex] = useState([0, 1, 2, 3]);

    const handleSelectHero = (slotIndex: number, hero: Character) => {
        const newParty = [...party];
        newParty[slotIndex] = hero;
        setParty(newParty);
    };
    
    const handleCarousel = (slotIndex: number, direction: number) => {
        const newCarouselIndex = [...carouselIndex];
        newCarouselIndex[slotIndex] = (newCarouselIndex[slotIndex] + direction + heroes.length) % heroes.length;
        setCarouselIndex(newCarouselIndex);
        handleSelectHero(slotIndex, heroes[newCarouselIndex[slotIndex]]);
    };

    const isPartyFull = useMemo(() => party.every(p => p !== null), [party]);

    return (
        <div id="party-selection-screen">
            <h2>⚔️ Choose Your Party ⚔️</h2>
            <div className="slots-container">
                {party.map((_, i) => (
                    <div key={i} className="hero-slot">
                        <div className="slot-header">
                            <h3 className="slot-title">Hero Slot {i + 1}</h3>
                        </div>
                        <div className="carousel-container">
                            <div className="carousel-controls">
                                <button className="carousel-btn" onClick={() => handleCarousel(i, -1)}>◀</button>
                                <div className="carousel-indicator">{carouselIndex[i] + 1} / {heroes.length}</div>
                                <button className="carousel-btn" onClick={() => handleCarousel(i, 1)}>▶</button>
                            </div>
                            <HeroCard hero={heroes[carouselIndex[i]]} />
                        </div>
                    </div>
                ))}
            </div>
            <button className="start-game-btn" onClick={() => onPartySelected(party)} disabled={!isPartyFull}>
                🎮 Start Adventure
            </button>
        </div>
    );
};


const GameScreen = () => {
    const { engine } = useGame();
    const [entities, setEntities] = useState<Entity[]>([]);

    useEffect(() => {
        if (!engine) return;

        const gameLoop = setInterval(() => {
            engine.step();
            const allEntities = engine.query('Character', 'Team');
            const entityData = allEntities.map(id => {
                const character = engine.getComponent(id, 'Character');
                const team = engine.getComponent(id, 'Team');
                const health = engine.getComponent(id, 'Health');
                return { id, components: { Character: character, Team: team, Health: health } };
            });
            setEntities(entityData);
        }, 100);

        return () => clearInterval(gameLoop);
    }, [engine]);

    const { playerTeam, enemyTeam } = useMemo(() => {
        const playerTeam: Entity[] = [];
        const enemyTeam: Entity[] = [];
        entities.forEach(entity => {
            if (entity.components.Team?.isPlayer) {
                playerTeam.push(entity);
            } else {
                enemyTeam.push(entity);
            }
        });
        return { playerTeam, enemyTeam };
    }, [entities]);

    return (
        <div id="game-screen">
            <div className="status-bar"></div>
            <div className="game-container">
                <div className="team-section player-team">
                    <h2>🛡️ Your Party</h2>
                    <div id="player-party">
                        {playerTeam.map(entity => (
                            <div key={entity.id} className="character-card">
                                <div className="char-name">{entity.components.Character.name}</div>
                                <div className="health-bar" style={{ width: `${(entity.components.Health.current / entity.components.Health.max) * 100}%` }}></div>
                            </div>
                        ))}
                    </div>
                </div>
                <div className="team-section enemy-team">
                    <h2>👹 Enemies</h2>
                    <div id="enemy-party">
                        {enemyTeam.map(entity => (
                            <div key={entity.id} className="character-card">
                                <div className="char-name">{entity.components.Character.name}</div>
                                <div className="health-bar" style={{ width: `${(entity.components.Health.current / entity.components.Health.max) * 100}%` }}></div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
            <div className="combat-log">
                <h2>📜 Combat Log</h2>
            </div>
        </div>
    );
};

export function GameUI() {
  const [currentScreen, setCurrentScreen] = useState('scenario');
  const [availableHeroes, setAvailableHeroes] = useState<Character[]>([]);
  const { engine, initialize } = useGame();

  const handleScenarioSelected = async (scenarioId: string) => {
    try {
      // Load BRL/BCL/BDL into the IDE and let it compile so errors are highlighted
      const brlContent = await fetchGameFile('classic-rpg.brl');
      // load a default BCL (party/config or skills) so the IDE shows BCL content
      const bclContent = await fetchGameFile('party-config.bcl').catch(() => '');
      const heroesContent = await fetchGameFile('heroes.bdl');
      const enemiesContent = await fetchGameFile('enemies.bdl');
      const scenarioMap: Record<string, string> = {
        easy: 'scenario-easy.bdl',
        normal: 'scenario-normal.bdl',
        hard: 'scenario-hard.bdl',
      };
      const scenarioContent = await fetchGameFile(scenarioMap[scenarioId]);

      const mergedBdl = [heroesContent, enemiesContent, scenarioContent].join('\n\n');

      if (!window.BlinkIDE || typeof window.BlinkIDE.loadSources !== 'function') {
        throw new Error('IDE API not available. Make sure the IDE is loaded.');
      }

      const result = await window.BlinkIDE.loadSources({ brl: brlContent, bcl: bclContent, bdl: mergedBdl });

      if (result.errors && result.errors.length > 0) {
        // Errors will be shown/highlighted in the IDE; notify the user and stop
        alert(`Compilation failed with ${result.errors.length} error(s). See IDE for details.`);
        return;
      }

      // If compile succeeded, initialize engine with the IR and continue
      if (result.ir) {
        await initialize(result.ir);
        const heroes = extractCharactersFromIR(result.ir);
        setAvailableHeroes(heroes);
        setCurrentScreen('party');
      } else {
        throw new Error('No IR produced by compilation.');
      }
    } catch (error) {
      console.error(error);
      alert(`Failed to load scenario: ${(error as Error).message}`);
    }
  };

  const handlePartySelected = (party: (Character | null)[]) => {
    if (!engine) {
        return;
    }
    party.forEach((hero, index) => {
        if (hero) {
            // This is a simplified version of createHeroEntity from the demo
            engine.createEntity(100 + index);
            engine.addComponent(100 + index, 'Character', { name: hero.name, class: hero.class, level: hero.level });
            engine.addComponent(100 + index, 'Health', { current: hero.baseHealth, max: hero.baseHealth });
            engine.addComponent(100 + index, 'Team', { isPlayer: true });
        }
    });
    setCurrentScreen('game');
  };

  return (
    <div className="container">
      <h1>⚔️ Blink Idle RPG</h1>
      {currentScreen === 'scenario' && <ScenarioSelection onScenarioSelected={handleScenarioSelected} />}
      {currentScreen === 'party' && <PartySelection heroes={availableHeroes} onPartySelected={handlePartySelected} />}
      {currentScreen === 'game' && <GameScreen />}
    </div>
  );
}
