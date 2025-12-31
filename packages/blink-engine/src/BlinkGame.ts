/**
 * BlinkGame - Main game class
 * Coordinates all engine subsystems
 */

import { Store, EntityId, ComponentData } from './ecs/Store';
import { Timeline, ScheduledEvent } from './timeline/Timeline';
import { RuleExecutor } from './rules/Executor';
import { TrackerSystem, TrackerOutput } from './trackers/Tracker';
import { loadIRFromString, loadIRFromObject, IRModule, IRFieldValue } from './ir';

export interface GameOptions {
  /** Enable debug mode */
  debug?: boolean;
  /** Time scale (1.0 = real time, 10.0 = 10x speed) */
  timeScale?: number;
  /** Maximum events per frame */
  maxEventsPerFrame?: number;
}

export interface GameState {
  entities: EntityDefinition[];
}

export interface EntityDefinition {
  id?: number | string;
  components: Record<string, ComponentData>;
}

export interface GameStateSnapshot {
  time: number;
  entities: Map<EntityId, Map<string, ComponentData>>;
}

export interface StepResult {
  time: number;
  event: ScheduledEvent;
  trackerOutput: TrackerOutput[];
}

export interface SimulationEvent {
  type: 'started' | 'paused' | 'resumed' | 'stopped' | 'completed' | 'error' | 'step';
  time?: number;
  error?: Error;
  event?: ScheduledEvent;
}

type Unsubscribe = () => void;
type TrackerCallback = (event: TrackerOutput) => void;
type SimulationCallback = (event: SimulationEvent) => void;

/**
 * Main game engine class
 */
export class BlinkGame {
  private store: Store;
  private timeline: Timeline;
  private executor: RuleExecutor;
  private trackerSystem: TrackerSystem;
  
  private options: Required<GameOptions>;
  private isRunning: boolean = false;
  private isPaused: boolean = false;
  private animationFrameId: number | null = null;
  private lastFrameTime: number = 0;
  private currentSimulationTime: number = 0;
  
  private trackerCallbacks: Set<TrackerCallback> = new Set();
  private simulationCallbacks: Set<SimulationCallback> = new Set();
  
  private ir: IRModule | null = null;

  private constructor(options: GameOptions = {}) {
    this.options = {
      debug: options.debug ?? false,
      timeScale: options.timeScale ?? 1.0,
      maxEventsPerFrame: options.maxEventsPerFrame ?? 100,
    };
    
    this.store = new Store();
    this.timeline = new Timeline();
    this.executor = new RuleExecutor();
    this.trackerSystem = new TrackerSystem();
  }

  /**
   * Create a new game instance
   */
  static async create(options: GameOptions = {}): Promise<BlinkGame> {
    return new BlinkGame(options);
  }

  /**
   * Create a new game instance (synchronous)
   */
  static createSync(options: GameOptions = {}): BlinkGame {
    return new BlinkGame(options);
  }

  /**
   * Load compiled game rules from a URL
   */
  async loadRules(url: string): Promise<void> {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to load rules from ${url}: ${response.statusText}`);
    }
    const json = await response.text();
    this.loadRulesFromString(json);
  }

  /**
   * Load compiled game rules from a JSON string
   */
  loadRulesFromString(json: string): void {
    const ir = loadIRFromString(json);
    this.loadRulesFromIR(ir);
  }

  /**
   * Load compiled game rules from a parsed object
   */
  loadRulesFromObject(obj: unknown): void {
    const ir = loadIRFromObject(obj);
    this.loadRulesFromIR(ir);
  }

  /**
   * Load compiled game rules from IR module
   */
  private loadRulesFromIR(ir: IRModule): void {
    this.ir = ir;
    
    // Register component defaults
    for (const component of ir.components) {
      const defaults: ComponentData = {};
      for (const field of component.fields) {
        if (field.default !== undefined) {
          defaults[field.name] = field.default;
        }
      }
      this.store.setComponentDefaults(component.name, defaults);
    }
    
    // Load rules
    this.executor.loadRules(ir.rules);
    
    // Load functions
    this.executor.loadFunctions(ir.functions);
    
    // Load trackers
    this.trackerSystem.loadTrackers(ir.trackers);
    
    // Load initial state if provided
    if (ir.initial_state) {
      this.loadState(ir.initial_state.entities);
    }
    
    if (this.options.debug) {
      console.log(`[BlinkGame] Loaded IR module: ${ir.module}`);
      console.log(`[BlinkGame] Components: ${ir.components.length}`);
      console.log(`[BlinkGame] Rules: ${ir.rules.length}`);
      console.log(`[BlinkGame] Trackers: ${ir.trackers.length}`);
    }
  }

  /**
   * Load initial game state
   */
  setInitialState(state: GameState): void {
    this.loadState(state.entities);
  }

  private loadState(entities: EntityDefinition[]): void {
    for (const entityDef of entities) {
      const entityId = typeof entityDef.id === 'number'
        ? this.store.createEntity(entityDef.id)
        : this.store.createEntity();
      
      for (const [componentName, componentData] of Object.entries(entityDef.components)) {
        this.store.addComponent(entityId, componentName, componentData);
      }
    }
  }

  /**
   * Start the simulation
   */
  start(): void {
    if (this.isRunning) {
      return;
    }
    
    this.isRunning = true;
    this.isPaused = false;
    this.lastFrameTime = performance.now();
    this.currentSimulationTime = this.timeline.getTime();
    
    this.emitSimulationEvent({ type: 'started', time: this.timeline.getTime() });
    
    // Start the game loop
    this.scheduleNextFrame();
  }

  /**
   * Pause the simulation
   */
  pause(): void {
    if (!this.isRunning || this.isPaused) {
      return;
    }
    
    this.isPaused = true;
    
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
    
    this.emitSimulationEvent({ type: 'paused', time: this.timeline.getTime() });
  }

  /**
   * Resume paused simulation
   */
  resume(): void {
    if (!this.isRunning || !this.isPaused) {
      return;
    }
    
    this.isPaused = false;
    this.lastFrameTime = performance.now();
    this.currentSimulationTime = this.timeline.getTime();
    
    this.emitSimulationEvent({ type: 'resumed', time: this.timeline.getTime() });
    
    this.scheduleNextFrame();
  }

  /**
   * Stop the simulation
   */
  stop(): void {
    this.isRunning = false;
    this.isPaused = false;
    
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
    
    this.emitSimulationEvent({ type: 'stopped', time: this.timeline.getTime() });
  }

  /**
   * Reset the simulation to initial state
   */
  reset(): void {
    this.stop();
    this.store.clear();
    this.timeline.clear();
    this.currentSimulationTime = 0;
    
    // Reload initial state
    if (this.ir?.initial_state) {
      this.loadState(this.ir.initial_state.entities);
    }
  }

  /**
   * Step forward by one event
   */
  step(): StepResult | null {
    const event = this.timeline.pop();
    if (!event) {
      return null;
    }
    
    // Execute matching rules
    const matchingRules = this.executor.getMatchingRules(event.eventType);
    for (const rule of matchingRules) {
      this.executor.executeRule(rule, event, this.store, this.timeline);
    }
    
    // Capture tracker output
    const trackerOutput = this.trackerSystem.capture(event, this.store, this.timeline.getTime());
    
    // Emit tracker events
    for (const output of trackerOutput) {
      this.emitTrackerEvent(output);
    }
    
    const result: StepResult = {
      time: this.timeline.getTime(),
      event,
      trackerOutput,
    };
    
    this.emitSimulationEvent({ type: 'step', time: result.time, event });
    
    return result;
  }

  /**
   * Run until no more events or max steps reached
   */
  runUntilComplete(maxSteps: number = 10000): StepResult[] {
    const results: StepResult[] = [];
    let steps = 0;
    
    while (this.timeline.hasEvents() && steps < maxSteps) {
      const result = this.step();
      if (result) {
        results.push(result);
      }
      steps++;
    }
    
    this.emitSimulationEvent({ type: 'completed', time: this.timeline.getTime() });
    
    return results;
  }

  /**
   * Get current simulation time
   */
  getTime(): number {
    return this.timeline.getTime();
  }

  /**
   * Get current game state snapshot
   */
  getState(): GameStateSnapshot {
    return {
      time: this.timeline.getTime(),
      entities: this.store.getSnapshot(),
    };
  }

  /**
   * Query entities with specific components
   */
  query(...componentNames: string[]): EntityId[] {
    return this.store.query(...componentNames);
  }

  /**
   * Get an entity's component data
   */
  getComponent(entityId: EntityId, componentName: string): ComponentData | undefined {
    return this.store.getComponent(entityId, componentName);
  }

  /**
   * Schedule an event
   */
  scheduleEvent(
    eventType: string,
    delay: number = 0,
    options: {
      source?: EntityId;
      target?: EntityId;
      fields?: Record<string, IRFieldValue>;
    } = {}
  ): number {
    return this.timeline.schedule(eventType, delay, options);
  }

  /**
   * Subscribe to tracker events
   */
  onTracker(callback: TrackerCallback): Unsubscribe {
    this.trackerCallbacks.add(callback);
    return () => this.trackerCallbacks.delete(callback);
  }

  /**
   * Subscribe to simulation events
   */
  onSimulation(callback: SimulationCallback): Unsubscribe {
    this.simulationCallbacks.add(callback);
    return () => this.simulationCallbacks.delete(callback);
  }

  /**
   * Set time scale (1.0 = real time)
   */
  setTimeScale(scale: number): void {
    this.options.timeScale = scale;
  }

  /**
   * Check if simulation is running
   */
  getIsRunning(): boolean {
    return this.isRunning;
  }

  /**
   * Check if simulation is paused
   */
  getIsPaused(): boolean {
    return this.isPaused;
  }

  /**
   * Check if there are pending events
   */
  hasEvents(): boolean {
    return this.timeline.hasEvents();
  }

  /**
   * Destroy the game instance and free resources
   */
  destroy(): void {
    this.stop();
    this.trackerCallbacks.clear();
    this.simulationCallbacks.clear();
    this.store.clear();
    this.timeline.clear();
  }

  // ===== Private methods =====

  private scheduleNextFrame(): void {
    if (typeof requestAnimationFrame !== 'undefined') {
      this.animationFrameId = requestAnimationFrame(this.gameLoop.bind(this));
    } else {
      // Fallback for non-browser environments
      setTimeout(() => this.gameLoop(performance.now()), 16);
    }
  }

  private gameLoop(currentTime: number): void {
    if (!this.isRunning || this.isPaused) {
      return;
    }
    
    const deltaTime = (currentTime - this.lastFrameTime) / 1000; // Convert to seconds
    this.lastFrameTime = currentTime;
    
    // Calculate how much simulation time to advance
    const simulationDelta = deltaTime * this.options.timeScale;
    this.currentSimulationTime += simulationDelta;
    const targetTime = this.currentSimulationTime;
    
    // Process events up to target time (or max events per frame)
    let eventsProcessed = 0;
    
    while (
      eventsProcessed < this.options.maxEventsPerFrame &&
      this.timeline.hasEvents()
    ) {
      const nextEvent = this.timeline.peek();
      if (!nextEvent || nextEvent.time > targetTime) {
        break;
      }
      
      this.step();
      eventsProcessed++;
    }
    
    // Check if simulation is complete
    if (!this.timeline.hasEvents()) {
      this.isRunning = false;
      this.emitSimulationEvent({ type: 'completed', time: this.timeline.getTime() });
      return;
    }
    
    // Schedule next frame
    this.scheduleNextFrame();
  }

  private emitTrackerEvent(event: TrackerOutput): void {
    for (const callback of this.trackerCallbacks) {
      try {
        callback(event);
      } catch (error) {
        console.error('[BlinkGame] Error in tracker callback:', error);
      }
    }
  }

  private emitSimulationEvent(event: SimulationEvent): void {
    for (const callback of this.simulationCallbacks) {
      try {
        callback(event);
      } catch (error) {
        console.error('[BlinkGame] Error in simulation callback:', error);
      }
    }
  }
}
