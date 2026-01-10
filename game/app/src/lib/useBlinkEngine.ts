import { useState, useCallback } from 'react';
import type { IRModule, EntityData, TraceEvent } from '@/types/ide';

declare global {
  interface Window {
    BlinkEngine?: {
      BlinkGame: {
        create: (options?: { debug?: boolean; msPerFrame?: number; maxEventsPerFrame?: number; devMode?: boolean; enableTrace?: boolean }) => Promise<BlinkGameInstance>;
      };
    };
  }
}

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

export function useBlinkEngine() {
  const [engine, setEngine] = useState<BlinkGameInstance | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);

  const initialize = useCallback(async (ir: IRModule) => {
    if (!window.BlinkEngine) {
      console.error('BlinkEngine not found on window object.');
      return;
    }

    try {
      const game = await window.BlinkEngine.BlinkGame.create({ debug: true });
      game.loadRulesFromObject(ir);
      setEngine(game);
      setIsInitialized(true);
      console.log('Blink engine initialized.');
    } catch (error) {
      console.error('Failed to initialize Blink engine:', error);
    }
  }, []);

  return {
    engine,
    isInitialized,
    initialize,
  };
}
