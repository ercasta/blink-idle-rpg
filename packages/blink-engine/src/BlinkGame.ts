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
  /** Discrete time step in seconds (e.g., 0.01 for 1/100th second steps) */
  discreteTimeStep?: number;
  /** Enable watchdog timer to prevent hangs (default: true) */
  watchdogEnabled?: boolean;
  /** Watchdog check interval in seconds (default: 5.0) */
  watchdogInterval?: number;
  /** Event type to generate for watchdog recovery (default: 'DoAttack') */
  watchdogRecoveryEvent?: string;
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

// Constants for watchdog system
const MAX_WATCHDOG_PER_STEP = 10; // Maximum watchdog events processed per step
const RECOVERY_EVENT_DELAY = 0.001; // Delay in seconds for recovery events (1ms)

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
  
  // Watchdog event tracking
  private watchdogEventId: number | null = null;
  private lastWatchdogTime: number = 0;

  private constructor(options: GameOptions = {}) {
    this.options = {
      debug: options.debug ?? false,
      timeScale: options.timeScale ?? 1.0,
      maxEventsPerFrame: options.maxEventsPerFrame ?? 100,
      discreteTimeStep: options.discreteTimeStep ?? 0,
      watchdogEnabled: options.watchdogEnabled ?? true,
      watchdogInterval: options.watchdogInterval ?? 5.0,
      watchdogRecoveryEvent: options.watchdogRecoveryEvent ?? 'DoAttack',
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
    
    // Schedule first watchdog event if enabled
    this.scheduleWatchdogEvent();
    
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
    
    // Reschedule watchdog if needed
    this.scheduleWatchdogEvent();
    
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
    
    // Cancel watchdog event
    this.cancelWatchdogEvent();
    
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
    // Process events in a loop to handle watchdog events transparently
    // Watchdog events are processed internally and don't count as "steps"
    // The loop continues until we find a non-watchdog event or run out of events
    let watchdogProcessed = 0;
    
    while (true) {
      const event = this.timeline.pop();
      if (!event) {
        return null;
      }
      
      // Check if this is a watchdog event
      if (event.eventType === '__WATCHDOG__') {
        watchdogProcessed++;
        if (watchdogProcessed >= MAX_WATCHDOG_PER_STEP) {
          if (this.options.debug) {
            console.warn(`[BlinkGame] Warning: Processed ${watchdogProcessed} watchdog events in one step, stopping to prevent infinite loop`);
          }
          return null;
        }
        
        this.handleWatchdogEvent();
        // Schedule next watchdog
        this.scheduleWatchdogEvent();
        
        // Continue to process any recovery events generated by the watchdog
        // (loop will pick up the next event)
        continue;
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
    } // End of while loop
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

  /**
   * Schedule a watchdog event
   */
  private scheduleWatchdogEvent(): void {
    if (!this.options.watchdogEnabled || this.options.watchdogInterval <= 0) {
      return;
    }

    // Cancel existing watchdog if any
    this.cancelWatchdogEvent();

    // Schedule new watchdog event
    this.watchdogEventId = this.timeline.schedule(
      '__WATCHDOG__',
      this.options.watchdogInterval,
      {}
    );
    this.lastWatchdogTime = this.timeline.getTime();

    if (this.options.debug) {
      console.log(`[BlinkGame] Scheduled watchdog event ${this.watchdogEventId} at ${this.lastWatchdogTime + this.options.watchdogInterval}`);
    }
  }

  /**
   * Cancel the current watchdog event
   */
  private cancelWatchdogEvent(): void {
    if (this.watchdogEventId !== null) {
      this.timeline.cancel(this.watchdogEventId);
      this.watchdogEventId = null;
    }
  }

  /**
   * Handle watchdog event - check game state and generate recovery events if needed
   */
  private handleWatchdogEvent(): void {
    const currentTime = this.timeline.getTime();
    
    if (this.options.debug) {
      console.log(`[BlinkGame] Watchdog check at time ${currentTime}`);
      console.log(`[BlinkGame] Timeline has ${this.timeline.getEventCount()} events`);
    }

    // Check if there are any non-watchdog events (more efficient than filtering)
    const hasNonWatchdogEvents = this.timeline.hasNonWatchdogEvents();

    if (this.options.debug) {
      console.log(`[BlinkGame] Has non-watchdog events: ${hasNonWatchdogEvents}`);
    }

    // If there are no non-watchdog events, check if we should generate recovery events
    if (!hasNonWatchdogEvents) {
      // Check if there are entities with Attack and Target components (active combatants)
      const combatants = this.store.query('Attack', 'Target', 'Health');
      
      if (this.options.debug) {
        console.log(`[BlinkGame] Found ${combatants.length} potential combatants`);
      }

      // Check if any combatants are alive and have valid targets
      for (const entityId of combatants) {
        const health = this.store.getComponent(entityId, 'Health');
        const target = this.store.getComponent(entityId, 'Target');
        
        // If entity is alive and has a target
        if (health && (health.current as number) > 0 && target && target.entity !== null) {
          const targetHealth = this.store.getComponent(target.entity as EntityId, 'Health');
          
          // If target is also alive, generate attack event
          if (targetHealth && (targetHealth.current as number) > 0) {
            if (this.options.debug) {
              console.log(`[BlinkGame] Watchdog: Generating recovery ${this.options.watchdogRecoveryEvent} event for entity ${entityId}`);
            }
            
            // Use a tiny delay to ensure proper event ordering
            // scheduleImmediate would put events at current time which might cause ordering issues
            this.timeline.schedule(this.options.watchdogRecoveryEvent, RECOVERY_EVENT_DELAY, { source: entityId });
          }
        }
      }
    }
  }
}
