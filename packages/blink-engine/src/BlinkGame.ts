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
  /** Simulation milliseconds to advance per frame before UI update (controls game speed) */
  msPerFrame?: number;
  /** Maximum events per frame */
  maxEventsPerFrame?: number;
  /** Enable dev mode for step-by-step debugging */
  devMode?: boolean;
  /** Enable event firing and rule triggering trace (disabled by default) */
  enableTrace?: boolean;
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

/**
 * Trace event emitted during event firing and rule triggering
 */
export interface TraceEvent {
  type: 'event_fired' | 'event_scheduled' | 'rule_matched' | 'rule_triggered';
  time: number;
  event?: ScheduledEvent;
  rule?: IRRule;
  action?: IRAction;
  entityId?: EntityId;
  details?: string;
}

type Unsubscribe = () => void;
type SimulationCallback = (event: SimulationEvent) => void;
type DebugCallback = (event: DebugEvent) => void;
type TraceCallback = (event: TraceEvent) => void;

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
  
  // trackerCallbacks removed
  private simulationCallbacks: Set<SimulationCallback> = new Set();
  private debugCallbacks: Set<DebugCallback> = new Set();
  private traceCallbacks: Set<TraceCallback> = new Set();
  
  private ir: IRModule | null = null;
  private devMode: boolean = false;
  private enableTrace: boolean = false;

  private constructor(options: GameOptions = {}) {
    this.options = {
      debug: options.debug ?? false,
      msPerFrame: options.msPerFrame ?? 16, // Default: 16ms per frame (simulates ~60fps at 1x speed)
      maxEventsPerFrame: options.maxEventsPerFrame ?? 100,
      devMode: options.devMode ?? false,
      enableTrace: options.enableTrace ?? false,
    };
    this.enableTrace = this.options.enableTrace;
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
    
    // Emit trace event for event firing
    this.emitTraceEvent({
      type: 'event_fired',
      time: this.timeline.getTime(),
      event,
      details: `Event: ${event.eventType}${event.source !== undefined ? ` from entity ${event.source}` : ''}${event.target !== undefined ? ` to entity ${event.target}` : ''}`,
    });
    
    // Execute matching rules
    const matchingRules = this.executor.getMatchingRules(event.eventType);
    
    // Emit trace event for rule matching
    if (this.enableTrace && matchingRules.length > 0) {
      this.emitTraceEvent({
        type: 'rule_matched',
        time: this.timeline.getTime(),
        event,
        details: `Matched ${matchingRules.length} rule(s) for event ${event.eventType}`,
      });
    }
    
    for (const rule of matchingRules) {
      // Emit trace event for rule triggering
      this.emitTraceEvent({
        type: 'rule_triggered',
        time: this.timeline.getTime(),
        event,
        rule,
        details: `Rule: ${rule.name || 'unnamed'}`,
      });
      
      // Create trace callback if tracing is enabled
      const traceCallback = this.enableTrace ? (type: string, details: string, action?: IRAction) => {
        this.emitTraceEvent({
          type: type as TraceEvent['type'],
          time: this.timeline.getTime(),
          event,
          rule,
          action,
          details,
        });
      } : undefined;
      
      // In dev mode, emit debug events for each rule and action
      if (this.devMode) {
        this.executeRuleWithDebug(rule, event, traceCallback);
      } else {
        this.executor.executeRule(rule, event, this.store, this.timeline, traceCallback);
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
  private executeRuleWithDebug(rule: IRRule, event: ScheduledEvent, traceCallback?: (type: string, details: string, action?: IRAction) => void): void {
    // Emit rule_start event
    this.emitDebugEvent({
      type: 'rule_start',
      rule,
      sourceLocation: rule.source_location,
      time: this.timeline.getTime(),
    });

    // Execute the rule (this will also emit action events if executor supports it)
    this.executor.executeRule(rule, event, this.store, this.timeline, traceCallback);

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
   * Subscribe to trace events (for event firing and rule triggering trace)
   */
  onTrace(callback: TraceCallback): Unsubscribe {
    this.traceCallbacks.add(callback);
    return () => this.traceCallbacks.delete(callback);
  }

  /**
   * Enable or disable dev mode (step-by-step debugging)
   */
  setDevMode(enabled: boolean): void {
    this.devMode = enabled;
    this.options.devMode = enabled;
  }

  /**
   * Enable or disable trace mode (event firing and rule triggering trace)
   */
  setTraceEnabled(enabled: boolean): void {
    this.enableTrace = enabled;
    this.options.enableTrace = enabled;
  }

  /**
   * Check if trace mode is enabled
   */
  getTraceEnabled(): boolean {
    return this.enableTrace;
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
   * Set how many simulation milliseconds to advance per frame (controls game speed)
   */
  setMsPerFrame(ms: number): void {
    this.options.msPerFrame = ms;
  }

  /**
   * Get current ms per frame setting
   */
  getMsPerFrame(): number {
    return this.options.msPerFrame;
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
    this.simulationCallbacks.clear();
    this.store.clear();
    this.timeline.clear();
  }

  /**
   * Run multiple steps efficiently
   * Advances simulation time by the specified milliseconds (or msPerFrame amount if not specified)
   * Returns summary of what happened
   */
  runSteps(maxSteps: number = 100, millisecondsToAdvance?: number): {
    stepsExecuted: number;
    timeAdvanced: number;
    eventsProcessed: number;
  } {
    const startTime = this.timeline.getTime();
    const targetTime = startTime + (millisecondsToAdvance ?? this.options.msPerFrame);
    let stepsExecuted = 0;
    let eventsProcessed = 0;
    
    while (stepsExecuted < maxSteps && this.timeline.hasEvents()) {
      const nextEvent = this.timeline.peek();
      if (!nextEvent) break;
      
      // Stop if next event is beyond our target time
      if (nextEvent.time > targetTime) {
        break;
      }
      
      this.step();
      stepsExecuted++;
      eventsProcessed++;
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
   * Clone an existing entity (deep copy of all components)
   */
  cloneEntity(sourceId: EntityId, targetId?: EntityId): EntityId {
    return this.store.cloneEntity(sourceId, targetId);
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
    console.log('[ScheduleNextFrame] Scheduling next frame');
    if (typeof requestAnimationFrame !== 'undefined') {
      this.animationFrameId = requestAnimationFrame(this.gameLoop.bind(this));
      console.log('[ScheduleNextFrame] Used requestAnimationFrame');
    } else {
      // Fallback for non-browser environments
      setTimeout(() => this.gameLoop(), 16);
      console.log('[ScheduleNextFrame] Used setTimeout fallback');
    }
  }

  private async gameLoop(): Promise<void> {
    console.log('[GameLoop] ENTERED gameLoop', { isRunning: this.isRunning, isPaused: this.isPaused });
    
    if (!this.isRunning || this.isPaused) {
      console.log('[GameLoop] Exiting early - not running or paused');
      return;
    }
    
    // Advance simulation by msPerFrame milliseconds before updating UI
    const millisecondsToAdvance = this.options.msPerFrame;
    const targetTime = this.timeline.getTime() + millisecondsToAdvance;
    
    if (this.options.debug && this.timeline.getTime() < 1000) {
      console.log(`[GameLoop] Advancing ${millisecondsToAdvance}ms, from ${this.timeline.getTime()}ms to target ${targetTime}ms`);
    }
    
    // Process events in smaller batches to keep UI responsive
    const BATCH_SIZE = 10; // Process 10 events at a time before yielding
    let totalEventsProcessed = 0;
    
    while (
      totalEventsProcessed < this.options.maxEventsPerFrame &&
      this.timeline.hasEvents()
    ) {
      const nextEvent = this.timeline.peek();
      if (!nextEvent || nextEvent.time > targetTime) {
        if (this.options.debug && totalEventsProcessed === 0 && this.timeline.getTime() < 1000) {
          console.log(`[GameLoop] No events to process: nextEvent=${nextEvent ? nextEvent.eventType + '@' + nextEvent.time + 'ms' : 'null'}, targetTime=${targetTime}ms`);
        }
        break;
      }
      
      // Process a batch of events
      let batchCount = 0;
      while (
        batchCount < BATCH_SIZE &&
        totalEventsProcessed < this.options.maxEventsPerFrame &&
        this.timeline.hasEvents()
      ) {
        const event = this.timeline.peek();
        if (!event || event.time > targetTime) {
          break;
        }
        
        if (this.options.debug && totalEventsProcessed < 5 && this.timeline.getTime() < 1000) {
          console.log(`[GameLoop] Processing event: ${event.eventType} at time ${event.time}ms`);
        }
        
        this.step();
        batchCount++;
        totalEventsProcessed++;
      }
      
      // Yield control back to the browser every batch to keep UI responsive
      if (this.timeline.hasEvents() && this.timeline.peek()!.time <= targetTime && totalEventsProcessed < this.options.maxEventsPerFrame) {
        await this.yieldToUI();
      }
    }
    
    if (this.options.debug && this.timeline.getTime() < 1000) {
      console.log(`[GameLoop] Processed ${totalEventsProcessed} events, timeline now at ${this.timeline.getTime()}ms`);
    }
    
    // Check if simulation is complete
    if (!this.timeline.hasEvents()) {
      this.isRunning = false;
      this.emitSimulationEvent({ type: 'completed', time: this.timeline.getTime() });
      return;
    }
    
    // Schedule next frame (wall-clock time only affects UI update rate, not simulation)
    this.scheduleNextFrame();
  }

  /**
   * Yield control back to the browser's event loop to keep UI responsive
   */
  private yieldToUI(): Promise<void> {
    return new Promise(resolve => {
      // Use setTimeout(0) to yield to the browser
      // This allows the browser to process user input and render updates
      setTimeout(resolve, 0);
    });
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

  private emitTraceEvent(event: TraceEvent): void {
    if (!this.enableTrace) {
      return;
    }
    for (const callback of this.traceCallbacks) {
      try {
        callback(event);
      } catch (error) {
        console.error('[BlinkGame] Error in trace callback:', error);
      }
    }
  }
}
