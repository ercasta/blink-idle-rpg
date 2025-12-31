/**
 * ScenarioBuilder - Fluent API for building test scenarios
 * 
 * Provides a readable DSL for defining test scenarios with
 * setup, actions, and assertions.
 */

import { BlinkGame, EntityId, StepResult } from '@blink/engine';
import { GameTest, TestScenario, TestStep, TestAssertion } from './GameTest.js';
import { EntityFixture } from './fixtures.js';

export interface ScenarioBuilder {
  /** Set scenario description */
  describe(description: string): ScenarioBuilder;
  
  /** Add setup step */
  setup(fn: () => void | Promise<void>): ScenarioBuilder;
  
  /** Create entities */
  withEntities(entities: EntityFixture[]): ScenarioBuilder;
  
  /** Define a test step */
  step(name: string): StepBuilder;
  
  /** Add teardown */
  teardown(fn: () => void | Promise<void>): ScenarioBuilder;
  
  /** Build the scenario */
  build(): TestScenario;
}

interface StepBuilder {
  /** Add action for this step */
  do(action: (game: BlinkGame) => void | Promise<void>): StepBuilder;
  
  /** Add assertion */
  expect(description: string, check: (game: BlinkGame, results: StepResult[]) => boolean): StepBuilder;
  
  /** Add entity state assertion */
  expectEntity(entityId: EntityId): EntityExpectBuilder;
  
  /** Finish step and return to scenario */
  and(): ScenarioBuilder;
  
  /** Add another step */
  step(name: string): StepBuilder;
  
  /** Build the scenario */
  build(): TestScenario;
}

interface EntityExpectBuilder {
  /** Expect component to have field value */
  toHaveField(component: string, field: string, value: unknown): StepBuilder;
  
  /** Expect component field to be greater than */
  toHaveFieldGreaterThan(component: string, field: string, value: number): StepBuilder;
  
  /** Expect component field to be less than */
  toHaveFieldLessThan(component: string, field: string, value: number): StepBuilder;
  
  /** Expect entity to have component */
  toHaveComponent(component: string): StepBuilder;
}

/**
 * Create a new scenario builder
 */
export function Scenario(name: string): ScenarioBuilder {
  return new ScenarioBuilderImpl(name);
}

/**
 * Internal scenario builder implementation
 */
class ScenarioBuilderImpl implements ScenarioBuilder {
  private name: string;
  private description?: string;
  private setupFn?: () => void | Promise<void>;
  private teardownFn?: () => void | Promise<void>;
  private steps: TestStep[] = [];
  private entities: EntityFixture[] = [];
  
  constructor(name: string) {
    this.name = name;
  }
  
  describe(description: string): ScenarioBuilder {
    this.description = description;
    return this;
  }
  
  setup(fn: () => void | Promise<void>): ScenarioBuilder {
    this.setupFn = fn;
    return this;
  }
  
  withEntities(entities: EntityFixture[]): ScenarioBuilder {
    this.entities = entities;
    return this;
  }
  
  step(name: string): StepBuilder {
    return new StepBuilderImpl(this, name);
  }
  
  teardown(fn: () => void | Promise<void>): ScenarioBuilder {
    this.teardownFn = fn;
    return this;
  }
  
  addStep(step: TestStep): void {
    this.steps.push(step);
  }
  
  build(): TestScenario {
    return {
      name: this.name,
      description: this.description,
      setup: this.setupFn,
      steps: this.steps,
      teardown: this.teardownFn,
    };
  }
}

/**
 * Internal step builder implementation
 */
class StepBuilderImpl implements StepBuilder {
  private scenario: ScenarioBuilderImpl;
  private name: string;
  private action?: (game: BlinkGame) => void | Promise<void>;
  private assertions: TestAssertion[] = [];
  
  constructor(scenario: ScenarioBuilderImpl, name: string) {
    this.scenario = scenario;
    this.name = name;
  }
  
  do(action: (game: BlinkGame) => void | Promise<void>): StepBuilder {
    this.action = action;
    return this;
  }
  
  expect(description: string, check: (game: BlinkGame, results: StepResult[]) => boolean): StepBuilder {
    this.assertions.push({ description, check });
    return this;
  }
  
  expectEntity(entityId: EntityId): EntityExpectBuilder {
    return new EntityExpectBuilderImpl(this, entityId);
  }
  
  and(): ScenarioBuilder {
    this.finishStep();
    return this.scenario;
  }
  
  step(name: string): StepBuilder {
    this.finishStep();
    return new StepBuilderImpl(this.scenario, name);
  }
  
  build(): TestScenario {
    this.finishStep();
    return this.scenario.build();
  }
  
  addAssertion(assertion: TestAssertion): void {
    this.assertions.push(assertion);
  }
  
  private finishStep(): void {
    if (!this.action) {
      this.action = () => {}; // No-op if no action defined
    }
    
    this.scenario.addStep({
      name: this.name,
      action: this.action,
      assertions: this.assertions,
    });
  }
}

/**
 * Internal entity expect builder implementation
 */
class EntityExpectBuilderImpl implements EntityExpectBuilder {
  private step: StepBuilderImpl;
  private entityId: EntityId;
  
  constructor(step: StepBuilderImpl, entityId: EntityId) {
    this.step = step;
    this.entityId = entityId;
  }
  
  toHaveField(component: string, field: string, value: unknown): StepBuilder {
    const entityId = this.entityId;
    this.step.addAssertion({
      description: `Entity ${entityId}.${component}.${field} should equal ${JSON.stringify(value)}`,
      check: (game: BlinkGame) => {
        const comp = game.getComponent(entityId, component);
        return comp?.[field] === value;
      },
      expected: JSON.stringify(value),
      actual: () => {
        // This will be filled in during test execution
        return 'runtime';
      },
    });
    return this.step;
  }
  
  toHaveFieldGreaterThan(component: string, field: string, value: number): StepBuilder {
    const entityId = this.entityId;
    this.step.addAssertion({
      description: `Entity ${entityId}.${component}.${field} should be greater than ${value}`,
      check: (game: BlinkGame) => {
        const comp = game.getComponent(entityId, component);
        const actual = comp?.[field] as number;
        return actual > value;
      },
    });
    return this.step;
  }
  
  toHaveFieldLessThan(component: string, field: string, value: number): StepBuilder {
    const entityId = this.entityId;
    this.step.addAssertion({
      description: `Entity ${entityId}.${component}.${field} should be less than ${value}`,
      check: (game: BlinkGame) => {
        const comp = game.getComponent(entityId, component);
        const actual = comp?.[field] as number;
        return actual < value;
      },
    });
    return this.step;
  }
  
  toHaveComponent(component: string): StepBuilder {
    const entityId = this.entityId;
    this.step.addAssertion({
      description: `Entity ${entityId} should have component ${component}`,
      check: (game: BlinkGame) => {
        const comp = game.getComponent(entityId, component);
        return comp !== undefined;
      },
    });
    return this.step;
  }
}
