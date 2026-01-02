/**
 * @blink/engine - Blink Idle RPG Browser Engine
 * 
 * A JavaScript/TypeScript implementation of the Blink game engine
 * that runs entirely in the browser.
 */

// Main game class
export { BlinkGame } from './BlinkGame';
export type {
  GameOptions,
  GameState,
  EntityDefinition,
  GameStateSnapshot,
  StepResult,
  SimulationEvent,
} from './BlinkGame';

// IR types and loader
export {
  loadIR,
  loadIRFromString,
  loadIRFromObject,
} from './ir';
export type {
  IRModule,
  IRComponent,
  IRField,
  IRRule,
  IRTrigger,
  IRAction,
  IRExpression,
  IRFunction,
  IRTracker,
  IRFieldValue,
} from './ir';

// ECS
export { Store } from './ecs';
export type { EntityId, ComponentData } from './ecs';

// Timeline
export { Timeline } from './timeline';
export type { ScheduledEvent } from './timeline';

// Rules
export { RuleExecutor } from './rules';
export type { ExecutionContext } from './rules';

// Trackers
export { TrackerSystem } from './trackers';
export type { TrackerOutput, EntityComponentData } from './trackers';
