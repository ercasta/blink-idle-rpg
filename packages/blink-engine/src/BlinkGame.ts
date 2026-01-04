/**
 * BlinkGame - Main game class
 * Coordinates all engine subsystems
 */

import { Store, EntityId, ComponentData } from './ecs/Store';
import { Timeline, ScheduledEvent } from './timeline/Timeline';
import { RuleExecutor } from './rules/Executor';
// Tracker system removed
import { loadIRFromString, loadIRFromObject, IRModule, IRFieldValue, IRRule, IRAction, SourceLocation, SourceFile, IRBoundFunctions, IRBoundFunction } from './ir';

export interface GameOptions {
  /** Enable debug mode */
  debug?: boolean;
  /** Time scale (1.0 = real time, 10.0 = 10x speed) */
  timeScale?: number;
  /** Maximum events per frame */
  maxEventsPerFrame?: number;
  /** Discrete time step in seconds (e.g., 0.01 for 1/100th second steps) */
  discreteTimeStep?: number;
  /** Enable dev mode for step-by-step debugging */
  devMode?: boolean;
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
}

export interface SimulationEvent {
  type: 'started' | 'paused' | 'resumed' | 'stopped' | 'completed' | 'error' | 'step';
  time?: number;
  error?: Error;
  event?: ScheduledEvent;
}

/**
 * Debug event emitted during step-by-step execution
 */
export interface DebugEvent {
  type: 'rule_start' | 'rule_end' | 'action_start' | 'action_end' | 'condition_eval';
  rule?: IRRule;
  action?: IRAction;
  sourceLocation?: SourceLocation;
  time: number;
  entityId?: EntityId;
  conditionResult?: boolean;
  actionIndex?: number;
}

type Unsubscribe = () => void;
type TrackerCallback = (event: TrackerOutput) => void;
type SimulationCallback = (event: SimulationEvent) => void;
type DebugCallback = (event: DebugEvent) => void;

/**
 * Main game engine class
 */
export class BlinkGame {
  private store: Store;
  private timeline: Timeline;
  private executor: RuleExecutor;
  // trackerSystem removed
  
  private options: Required<GameOptions>;
  private isRunning: boolean = false;
  private isPaused: boolean = false;
  private animationFrameId: number | null = null;
  private lastFrameTime: number = 0;
  private currentSimulationTime: number = 0;
  
  // trackerCallbacks removed
  private simulationCallbacks: Set<SimulationCallback> = new Set();
  private debugCallbacks: Set<DebugCallback> = new Set();
  
  private ir: IRModule | null = null;
  private devMode: boolean = false;

  private constructor(options: GameOptions = {}) {
    this.options = {
      debug: options.debug ?? false,
      timeScale: options.timeScale ?? 1.0,
      maxEventsPerFrame: options.maxEventsPerFrame ?? 100,
      discreteTimeStep: options.discreteTimeStep ?? 0,
      devMode: options.devMode ?? false,
    };
    this.devMode = this.options.devMode;
    
    this.store = new Store();
    this.timeline = new Timeline();
    this.executor = new RuleExecutor();
    // trackerSystem removed
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
    
    // Trackers removed from runtime; IR may still contain tracker metadata.
    
    // Load initial state if provided
    if (ir.initial_state) {
      this.loadState(ir.initial_state.entities);
    }
    
    if (this.options.debug) {
      console.log(`[BlinkGame] Loaded IR module: ${ir.module}`);
      console.log(`[BlinkGame] Components: ${ir.components.length}`);
      console.log(`[BlinkGame] Rules: ${ir.rules.length}`);
      console.log(`[BlinkGame] Trackers: ${(ir.trackers ?? []).length}`);
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
      // In dev mode, emit debug events for each rule and action
      if (this.devMode) {
        this.executeRuleWithDebug(rule, event);
      } else {
        this.executor.executeRule(rule, event, this.store, this.timeline);
      }
    }
    
    const result: StepResult = {
      time: this.timeline.getTime(),
      event,
    };
    
    this.emitSimulationEvent({ type: 'step', time: result.time, event });
    
    return result;
  }

  /**
   * Execute a rule with debug events emitted
   */
  private executeRuleWithDebug(rule: IRRule, event: ScheduledEvent): void {
    // Emit rule_start event
    this.emitDebugEvent({
      type: 'rule_start',
      rule,
      sourceLocation: rule.source_location,
      time: this.timeline.getTime(),
    });

    // Execute the rule (this will also emit action events if executor supports it)
    this.executor.executeRule(rule, event, this.store, this.timeline);

    // Emit rule_end event
    this.emitDebugEvent({
      type: 'rule_end',
      rule,
      sourceLocation: rule.source_location,
      time: this.timeline.getTime(),
    });
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
   * Schedule a recurring event
   * The event will automatically reschedule itself after each execution
   * Returns the event ID which can be used with cancelEvent() to stop the recurring event
   */
  scheduleRecurringEvent(
    eventType: string,
    interval: number,
    options: {
      delay?: number;
      source?: EntityId;
      target?: EntityId;
      fields?: Record<string, IRFieldValue>;
    } = {}
  ): number {
    return this.timeline.scheduleRecurring(eventType, interval, options);
  }

  /**
   * Cancel a scheduled event (including recurring events)
   */
  cancelEvent(eventId: number): boolean {
    return this.timeline.cancel(eventId);
  }



  /**
   * Subscribe to simulation events
   */
  onSimulation(callback: SimulationCallback): Unsubscribe {
    this.simulationCallbacks.add(callback);
    return () => this.simulationCallbacks.delete(callback);
  }

  /**
   * Subscribe to debug events (for dev mode)
   */
  onDebug(callback: DebugCallback): Unsubscribe {
    this.debugCallbacks.add(callback);
    return () => this.debugCallbacks.delete(callback);
  }

  /**
   * Enable or disable dev mode (step-by-step debugging)
   */
  setDevMode(enabled: boolean): void {
    this.devMode = enabled;
    this.options.devMode = enabled;
  }

  /**
   * Check if dev mode is enabled
   */
  getDevMode(): boolean {
    return this.devMode;
  }

  /**
   * Get the source map from the loaded IR (if available)
   */
  getSourceMap(): { files: SourceFile[] } | null {
    return this.ir?.source_map ?? null;
  }

  /**
   * Get all loaded rules (for debugging/display)
   */
  getRules(): IRRule[] {
    return this.ir?.rules ?? [];
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

  /**
   * Run multiple steps efficiently, optionally respecting discrete time steps
   * Returns summary of what happened
   */
  runSteps(maxSteps: number = 100, maxTime?: number): {
    stepsExecuted: number;
    timeAdvanced: number;
    eventsProcessed: number;
  } {
    const startTime = this.timeline.getTime();
    const discreteStep = this.options.discreteTimeStep;
    let stepsExecuted = 0;
    let eventsProcessed = 0;
    
    while (stepsExecuted < maxSteps && this.timeline.hasEvents()) {
      const nextEvent = this.timeline.peek();
      if (!nextEvent) break;
      
      // If we have a max time and would exceed it, stop
      if (maxTime !== undefined && nextEvent.time > startTime + maxTime) {
        break;
      }
      
      // If using discrete time stepping, advance time in discrete increments
      if (discreteStep > 0 && nextEvent.time > this.timeline.getTime()) {
        const timeToEvent = nextEvent.time - this.timeline.getTime();
        const steps = Math.ceil(timeToEvent / discreteStep);
        // Advance to next discrete time step that includes the event
        this.timeline.setTime(this.timeline.getTime() + (steps * discreteStep));
      }
      
      this.step();
      stepsExecuted++;
      eventsProcessed++;
      
      // Check if we've exceeded max time
      if (maxTime !== undefined && this.timeline.getTime() >= startTime + maxTime) {
        break;
      }
    }
    
    const timeAdvanced = this.timeline.getTime() - startTime;
    
    return {
      stepsExecuted,
      timeAdvanced,
      eventsProcessed,
    };
  }

  /**
   * Create a new entity dynamically
   */
  createEntity(id?: EntityId): EntityId {
    return this.store.createEntity(id);
  }

  /**
   * Add a component to an entity
   */
  addComponent(entityId: EntityId, componentName: string, data: ComponentData): void {
    this.store.addComponent(entityId, componentName, data);
  }

  /**
   * Remove an entity
   */
  removeEntity(entityId: EntityId): void {
    this.store.deleteEntity(entityId);
  }

  /**
   * Update a component field
   */
  setComponentField(entityId: EntityId, componentName: string, field: string, value: any): void {
    const component = this.store.getComponent(entityId, componentName);
    if (component) {
      component[field] = value;
    }
  }

  // ===== Entity and Component Access (for UI) =====

  /**
   * Get all entity IDs currently in the store
   */
  getAllEntityIds(): EntityId[] {
    return this.store.getEntityIds();
  }

  /**
   * Get all entities with their component data
   * Returns a map of entity ID to component map
   */
  getAllEntities(): Map<EntityId, Map<string, ComponentData>> {
    return this.store.getSnapshot();
  }

  /**
   * Get entities that have a specific component
   */
  getEntitiesWithComponent(componentName: string): EntityId[] {
    return this.store.query(componentName);
  }

  /**
   * Get full entity data including all components
   */
  getEntityData(entityId: EntityId): { id: EntityId; components: Record<string, ComponentData> } | null {
    const snapshot = this.store.getSnapshot();
    const entityComponents = snapshot.get(entityId);
    if (!entityComponents) {
      return null;
    }
    const components: Record<string, ComponentData> = {};
    for (const [name, data] of entityComponents) {
      components[name] = data;
    }
    return { id: entityId, components };
  }

  // ===== Bound Choice Functions (BCL Resolution) =====

  /**
   * Get the bound functions for an entity
   * Returns a map of function name to function definition
   */
  getBoundFunctions(entityId: EntityId): IRBoundFunctions | null {
    // Check initial state for entity's bound functions
    if (this.ir?.initial_state?.entities) {
      const entityDef = this.ir.initial_state.entities.find(e => e.id === entityId);
      if (entityDef?.bound_functions) {
        return entityDef.bound_functions;
      }
    }
    
    return null;
  }

  /**
   * Get a specific bound function from an entity
   * @param entityId The entity ID
   * @param functionName The name of the bound function
   * @returns The bound function or null if not found
   */
  getBoundFunction(entityId: EntityId, functionName: string): IRBoundFunction | null {
    const boundFunctions = this.getBoundFunctions(entityId);
    if (boundFunctions && functionName in boundFunctions) {
      return boundFunctions[functionName];
    }
    return null;
  }

  /**
   * Get a bound function's source code for display in UI
   * @param entityId The entity ID
   * @param functionName The function name
   * @returns The source code string or null if not found
   */
  getBoundFunctionSource(entityId: EntityId, functionName: string): string | null {
    const func = this.getBoundFunction(entityId, functionName);
    return func?.source ?? null;
  }

  /**
   * Get all bound function names for an entity
   * @param entityId The entity ID
   * @returns Array of function names or empty array
   */
  getBoundFunctionNames(entityId: EntityId): string[] {
    const boundFunctions = this.getBoundFunctions(entityId);
    return boundFunctions ? Object.keys(boundFunctions) : [];
  }

  /**
   * Get the loaded IR module (for advanced access)
   */
  getIR(): IRModule | null {
    return this.ir;
  }

  // ===== BRL Compilation (stub for future implementation) =====

  /**
   * Compile and execute BRL code
   * NOTE: This is a stub for future implementation. Currently throws an error.
   * @param brlCode The BRL code to compile and execute
   */
  compileAndExecuteBRL(_brlCode: string): void {
    // This is a stub for future implementation
    // The actual implementation would:
    // 1. Parse the BRL code
    // 2. Compile to IR
    // 3. Load the IR into the engine
    throw new Error('BRL compilation not yet implemented. Use loadRulesFromObject with pre-compiled IR.');
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
    let targetTime = this.currentSimulationTime;
    
    // If using discrete time stepping, round target time to discrete intervals
    const discreteStep = this.options.discreteTimeStep;
    if (discreteStep > 0) {
      const currentDiscreteTime = Math.floor(this.timeline.getTime() / discreteStep) * discreteStep;
      const targetDiscreteTime = Math.floor(targetTime / discreteStep) * discreteStep;
      targetTime = targetDiscreteTime;
    }
    
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
      
      // If using discrete time stepping, advance timeline to next discrete step
      if (discreteStep > 0 && nextEvent.time > this.timeline.getTime()) {
        const timeToEvent = nextEvent.time - this.timeline.getTime();
        const steps = Math.ceil(timeToEvent / discreteStep);
        this.timeline.setTime(this.timeline.getTime() + (steps * discreteStep));
      }
      
      this.step();
      eventsProcessed++;
    }
    
    // If we hit the event limit and there are still events before targetTime,
    // sync currentSimulationTime to where we actually got to prevent "hanging"
    if (eventsProcessed >= this.options.maxEventsPerFrame && this.timeline.hasEvents()) {
      const nextEvent = this.timeline.peek();
      if (nextEvent && nextEvent.time <= targetTime) {
        this.currentSimulationTime = this.timeline.getTime();
      }
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



  private emitSimulationEvent(event: SimulationEvent): void {
    for (const callback of this.simulationCallbacks) {
      try {
        callback(event);
      } catch (error) {
        console.error('[BlinkGame] Error in simulation callback:', error);
      }
    }
  }

  private emitDebugEvent(event: DebugEvent): void {
    for (const callback of this.debugCallbacks) {
      try {
        callback(event);
      } catch (error) {
        console.error('[BlinkGame] Error in debug callback:', error);
      }
    }
  }
}
