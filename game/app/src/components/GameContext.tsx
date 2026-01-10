import { createContext, useContext } from 'react';
import type { ReactNode } from 'react';
import { useBlinkEngine } from '../lib/useBlinkEngine';
import type { IRModule, EntityData, TraceEvent } from '@/types/ide';

interface BlinkGameInstance {
  loadRulesFromObject: (ir: IRModule) => void;
  mergeRulesFromObject?: (irObject: unknown, options?: { mergeEntities?: boolean; overrideOnConflict?: boolean; reassignRuleIds?: boolean }) => void;
  step: () => { time: number; event: { eventType: string } } | null;
  getTime: () => number;
  hasEvents: () => boolean;
  getAllEntities: () => Map<number | string, Map<string, Record<string, unknown>>>;
  getComponent: (entityId: number | string, componentName: string) => Record<string, unknown> | undefined;
  getEntityData: (entityId: number | string) => EntityData | null;
  getRules: () => Array<{ id?: number; name: string; trigger: { event: string } }>;
  getIR: () => IRModule | null;
  getIsPaused?: () => boolean;
  scheduleEvent: (eventType: string, delay?: number, options?: { source?: number; target?: number; fields?: Record<string, unknown> }) => number;
  reset: () => void;
  destroy: () => void;
  setDevMode: (enabled: boolean) => void;
  setTraceEnabled: (enabled: boolean) => void;
  onTrace: (callback: (event: TraceEvent) => void) => () => void;
  onDebug: (callback: (event: { type: string; rule?: { name: string } }) => void) => () => void;
  createEntity: (id?: number | string) => number | string;
  addComponent: (entityId: number | string, componentName: string, data: Record<string, unknown>) => void;
  removeEntity: (entityId: number | string) => void;
  query: (...componentNames: string[]) => (number | string)[];
}

interface GameContextType {
  engine: BlinkGameInstance | null;
  isInitialized: boolean;
  initialize: (ir: IRModule) => Promise<void>;
}

const GameContext = createContext<GameContextType | undefined>(undefined);

export const GameProvider = ({ children }: { children: ReactNode }) => {
  const gameEngine = useBlinkEngine();

  return (
    <GameContext.Provider value={gameEngine}>
      {children}
    </GameContext.Provider>
  );
};

export const useGame = () => {
  const context = useContext(GameContext);
  if (context === undefined) {
    throw new Error('useGame must be used within a GameProvider');
  }
  return context;
};
