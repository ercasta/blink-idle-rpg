/**
 * GameTest - Main test harness for BRL and BCL testing
 * 
 * Provides a fluent API for defining and running game tests.
 */

import { BlinkGame, StepResult, EntityId, GameOptions, ComponentData, IRFieldValue } from '@blink/engine';

export interface GameTestOptions extends GameOptions {
  /** Name of the test suite */
  name?: string;
  /** Enable verbose logging */
  verbose?: boolean;
  /** Maximum steps to run before timing out */
  maxSteps?: number;
  /** Maximum simulation time before timing out */
  maxTime?: number;
}

export interface TestScenario {
  name: string;
  description?: string;
  setup?: () => void | Promise<void>;
  steps: TestStep[];
  teardown?: () => void | Promise<void>;
}

export interface TestStep {
  name: string;
  description?: string;
  action: (game: BlinkGame) => void | Promise<void>;
  assertions?: TestAssertion[];
}

export interface TestAssertion {
  description: string;
  check: (game: BlinkGame, stepResults: StepResult[]) => boolean;
  expected?: string;
  actual?: () => string;
}

export interface AssertionResult {
  passed: boolean;
  description: string;
  expected?: string;
  actual?: string;
  error?: Error;
}

export interface TestResult {
  stepName: string;
  passed: boolean;
  assertions: AssertionResult[];
  stepResults: StepResult[];
  duration: number;
  error?: Error;
}

export interface ScenarioResult {
  scenarioName: string;
  passed: boolean;
  results: TestResult[];
  duration: number;
  error?: Error;
}

/**
 * Create a new game test instance
 */
export function createTest(options: GameTestOptions = {}): GameTest {
  return new GameTest(options);
}

/**
 * Internal options type with all properties required
 */
interface ResolvedGameTestOptions {
  name: string;
  verbose: boolean;
  maxSteps: number;
  maxTime: number;
  debug: boolean;
  timeScale: number;
  maxEventsPerFrame: number;
  discreteTimeStep: number;
  devMode: boolean;
}

/**
 * GameTest - Main test harness class
 */
export class GameTest {
  private game: BlinkGame;
  private options: ResolvedGameTestOptions;
  private scenarios: TestScenario[] = [];
  // trackerHistory removed
  private eventHistory: StepResult[] = [];
  private unsubscribeTracker: (() => void) | null = null;
  
  constructor(options: GameTestOptions = {}) {
    this.options = {
      name: options.name ?? 'GameTest',
      verbose: options.verbose ?? false,
      maxSteps: options.maxSteps ?? 10000,
      maxTime: options.maxTime ?? 3600,
      debug: options.debug ?? false,
      timeScale: options.timeScale ?? 1.0,
      maxEventsPerFrame: options.maxEventsPerFrame ?? 100,
      discreteTimeStep: options.discreteTimeStep ?? 0,
      devMode: options.devMode ?? false,
    };
    
    this.game = BlinkGame.createSync({
      debug: this.options.debug,
      timeScale: this.options.timeScale,
      maxEventsPerFrame: this.options.maxEventsPerFrame,
      discreteTimeStep: this.options.discreteTimeStep,
      devMode: this.options.devMode,
    });
    
    // Tracker runtime removed; no subscription
    this.unsubscribeTracker = null;
  }
  
  /**
   * Get the underlying game instance for direct access
   */
  getGame(): BlinkGame {
    return this.game;
  }
  
  /**
   * Load game rules from IR object
   */
  loadRules(ir: unknown): this {
    this.game.loadRulesFromObject(ir);
    return this;
  }
  
  /**
   * Load game rules from JSON string
   */
  loadRulesFromString(json: string): this {
    this.game.loadRulesFromString(json);
    return this;
  }
  
  /**
   * Set initial game state
   */
  setState(state: { entities: Array<{ id?: number | string; components: Record<string, ComponentData> }> }): this {
    this.game.setInitialState(state);
    return this;
  }
  
  /**
   * Create an entity with components
   */
  createEntity(id?: EntityId): EntityId {
    return this.game.createEntity(id);
  }
  
  /**
   * Add a component to an entity
   */
  addComponent(entityId: EntityId, componentName: string, data: ComponentData): this {
    this.game.addComponent(entityId, componentName, data);
    return this;
  }
  
  /**
   * Schedule an event to start the simulation
   */
  scheduleEvent(
    eventType: string,
    delay: number = 0,
    options: { source?: EntityId; target?: EntityId; fields?: Record<string, IRFieldValue> } = {}
  ): this {
    this.game.scheduleEvent(eventType, delay, options);
    return this;
  }
  
  /**
   * Execute a single step and return the result
   */
  step(): StepResult | null {
    const result = this.game.step();
    if (result) {
      this.eventHistory.push(result);
    }
    return result;
  }
  
  /**
   * Run until completion or max steps reached
   */
  runUntilComplete(maxSteps?: number): StepResult[] {
    const max = maxSteps ?? this.options.maxSteps;
    const results = this.game.runUntilComplete(max);
    this.eventHistory.push(...results);
    return results;
  }
  
  /**
   * Run a specific number of steps
   */
  runSteps(count: number): StepResult[] {
    const results: StepResult[] = [];
    for (let i = 0; i < count && this.game.hasEvents(); i++) {
      const result = this.step();
      if (result) {
        results.push(result);
      }
    }
    return results;
  }
  
  /**
   * Run until a condition is met or timeout
   */
  runUntil(
    condition: (game: BlinkGame) => boolean,
    options: { maxSteps?: number; maxTime?: number } = {}
  ): StepResult[] {
    const maxSteps = options.maxSteps ?? this.options.maxSteps;
    const maxTime = options.maxTime ?? this.options.maxTime;
    const startTime = this.game.getTime();
    const results: StepResult[] = [];
    let steps = 0;
    
    while (
      this.game.hasEvents() &&
      steps < maxSteps &&
      (this.game.getTime() - startTime) < maxTime &&
      !condition(this.game)
    ) {
      const result = this.step();
      if (result) {
        results.push(result);
      }
      steps++;
    }
    
    return results;
  }
  
  /**
   * Run until a specific event type is processed
   */
  runUntilEvent(eventType: string, options?: { maxSteps?: number }): StepResult[] {
    const results: StepResult[] = [];
    const maxSteps = options?.maxSteps ?? this.options.maxSteps;
    
    for (let i = 0; i < maxSteps && this.game.hasEvents(); i++) {
      const result = this.step();
      if (result) {
        results.push(result);
        if (result.event.eventType === eventType) {
          break;
        }
      }
    }
    
    return results;
  }
  
  /**
   * Get an entity's component
   */
  getComponent(entityId: EntityId, componentName: string): Record<string, unknown> | undefined {
    return this.game.getComponent(entityId, componentName);
  }
  
  /**
   * Get a component field value
   */
  getField(entityId: EntityId, componentName: string, fieldName: string): unknown {
    const component = this.game.getComponent(entityId, componentName);
    return component?.[fieldName];
  }
  
  /**
   * Query entities by component
   */
  query(...componentNames: string[]): EntityId[] {
    return this.game.query(...componentNames);
  }
  
  /**
   * Get current game time
   */
  getTime(): number {
    return this.game.getTime();
  }
  
  // Tracker history API removed
  
  /**
   * Get event history
   */
  getEventHistory(): StepResult[] {
    return [...this.eventHistory];
  }
  
  /**
   * Clear history
   */
  clearHistory(): this {
    this.eventHistory = [];
    return this;
  }
  
  /**
   * Check if there are pending events
   */
  hasEvents(): boolean {
    return this.game.hasEvents();
  }
  
  /**
   * Reset the game to initial state
   */
  reset(): this {
    this.game.reset();
    this.clearHistory();
    return this;
  }
  
  /**
   * Get current game state snapshot
   */
  getState(): {
    time: number;
    entities: Map<EntityId, Map<string, Record<string, unknown>>>;
  } {
    return this.game.getState();
  }
  
  /**
   * Add a test scenario
   */
  scenario(scenario: TestScenario): this {
    this.scenarios.push(scenario);
    return this;
  }
  
  /**
   * Run all scenarios and return results
   */
  async runScenarios(): Promise<ScenarioResult[]> {
    const results: ScenarioResult[] = [];
    
    for (const scenario of this.scenarios) {
      const scenarioResult = await this.runScenario(scenario);
      results.push(scenarioResult);
    }
    
    return results;
  }
  
  /**
   * Run a single scenario
   */
  async runScenario(scenario: TestScenario): Promise<ScenarioResult> {
    const startTime = performance.now();
    const stepResults: TestResult[] = [];
    let scenarioError: Error | undefined;
    
    try {
      // Setup
      if (scenario.setup) {
        await scenario.setup();
      }
      
      // Run each step
      for (const step of scenario.steps) {
        const stepResult = await this.runStep(step);
        stepResults.push(stepResult);
        
        // Stop on first failure if not in verbose mode
        if (!stepResult.passed && !this.options.verbose) {
          break;
        }
      }
      
      // Teardown
      if (scenario.teardown) {
        await scenario.teardown();
      }
    } catch (error) {
      scenarioError = error instanceof Error ? error : new Error(String(error));
    }
    
    const passed = !scenarioError && stepResults.every(r => r.passed);
    
    return {
      scenarioName: scenario.name,
      passed,
      results: stepResults,
      duration: performance.now() - startTime,
      error: scenarioError,
    };
  }
  
  /**
   * Run a single test step
   */
  private async runStep(step: TestStep): Promise<TestResult> {
    const startTime = performance.now();
    const stepHistory: StepResult[] = [];
    const assertionResults: AssertionResult[] = [];
    let stepError: Error | undefined;
    
    // Clear step-specific history
    const historyStartIndex = this.eventHistory.length;
    
    try {
      // Execute the action
      await step.action(this.game);
      
      // Collect step results
      for (let i = historyStartIndex; i < this.eventHistory.length; i++) {
        stepHistory.push(this.eventHistory[i]);
      }
      
      // Run assertions
      if (step.assertions) {
        for (const assertion of step.assertions) {
          try {
            const passed = assertion.check(this.game, stepHistory);
            assertionResults.push({
              passed,
              description: assertion.description,
              expected: assertion.expected,
              actual: assertion.actual?.(),
            });
          } catch (error) {
            assertionResults.push({
              passed: false,
              description: assertion.description,
              expected: assertion.expected,
              error: error instanceof Error ? error : new Error(String(error)),
            });
          }
        }
      }
    } catch (error) {
      stepError = error instanceof Error ? error : new Error(String(error));
    }
    
    const passed = !stepError && assertionResults.every(r => r.passed);
    
    return {
      stepName: step.name,
      passed,
      assertions: assertionResults,
      stepResults: stepHistory,
      duration: performance.now() - startTime,
      error: stepError,
    };
  }
  
  /**
   * Destroy the test harness and free resources
   */
  destroy(): void {
    if (this.unsubscribeTracker) {
      this.unsubscribeTracker();
      this.unsubscribeTracker = null;
    }
    this.game.destroy();
    this.scenarios = [];
    this.trackerHistory = [];
    this.eventHistory = [];
  }
}
