/**
 * Assertion utilities for game testing
 * 
 * Provides a fluent API for asserting game state, entities, components, and events.
 */

import { BlinkGame, EntityId, StepResult, TrackerOutput } from '@blink/engine';

export interface EntityAssertion {
  exists: boolean;
  hasComponent?: { componentName: string; exists: boolean };
  componentValue?: { componentName: string; fieldName: string; expected: unknown };
}

export interface ComponentAssertion {
  exists: boolean;
  fields?: Record<string, unknown>;
}

export interface EventAssertion {
  eventType: string;
  occurred: boolean;
  count?: number;
  fields?: Record<string, unknown>;
}

/**
 * Main expect function - entry point for assertions
 */
export function expect(game: BlinkGame): GameExpect {
  return new GameExpect(game);
}

/**
 * GameExpect - Root expect object
 */
class GameExpect {
  constructor(private game: BlinkGame) {}
  
  /**
   * Start entity assertions
   */
  entity(id: EntityId): ExpectEntity {
    return new ExpectEntity(this.game, id);
  }
  
  /**
   * Start time assertions
   */
  time(): ExpectTime {
    return new ExpectTime(this.game);
  }
  
  /**
   * Start timeline assertions
   */
  timeline(): ExpectTimeline {
    return new ExpectTimeline(this.game);
  }
  
  /**
   * Start query assertions
   */
  query(...componentNames: string[]): ExpectQuery {
    return new ExpectQuery(this.game, componentNames);
  }
}

/**
 * ExpectEntity - Entity-specific assertions
 */
export class ExpectEntity {
  private entityId: EntityId;
  private game: BlinkGame;
  private negated = false;
  
  constructor(game: BlinkGame, entityId: EntityId) {
    this.game = game;
    this.entityId = entityId;
  }
  
  /**
   * Negate the next assertion
   */
  get not(): this {
    this.negated = !this.negated;
    return this;
  }
  
  /**
   * Assert entity exists
   */
  toExist(): this {
    const entities = this.game.query();
    const exists = entities.some(id => {
      // Check if the entity has any components
      const state = this.game.getState();
      return state.entities.has(this.entityId);
    });
    
    // Actually we need to check via component access
    const state = this.game.getState();
    const entityExists = state.entities.has(this.entityId);
    
    const result = this.negated ? !entityExists : entityExists;
    if (!result) {
      throw new Error(
        this.negated 
          ? `Expected entity ${this.entityId} NOT to exist, but it does`
          : `Expected entity ${this.entityId} to exist, but it does not`
      );
    }
    
    this.negated = false;
    return this;
  }
  
  /**
   * Assert entity has a specific component
   */
  toHaveComponent(componentName: string): this {
    const component = this.game.getComponent(this.entityId, componentName);
    const hasComponent = component !== undefined;
    
    const result = this.negated ? !hasComponent : hasComponent;
    if (!result) {
      throw new Error(
        this.negated
          ? `Expected entity ${this.entityId} NOT to have component '${componentName}'`
          : `Expected entity ${this.entityId} to have component '${componentName}'`
      );
    }
    
    this.negated = false;
    return this;
  }
  
  /**
   * Get component assertions for this entity
   */
  component(componentName: string): ExpectComponent {
    return new ExpectComponent(this.game, this.entityId, componentName);
  }
}

/**
 * ExpectComponent - Component-specific assertions
 */
export class ExpectComponent {
  private game: BlinkGame;
  private entityId: EntityId;
  private componentName: string;
  private negated = false;
  
  constructor(game: BlinkGame, entityId: EntityId, componentName: string) {
    this.game = game;
    this.entityId = entityId;
    this.componentName = componentName;
  }
  
  /**
   * Negate the next assertion
   */
  get not(): this {
    this.negated = !this.negated;
    return this;
  }
  
  /**
   * Assert component field equals a value
   */
  toHaveField(fieldName: string, expectedValue: unknown): this {
    const component = this.game.getComponent(this.entityId, this.componentName);
    if (!component) {
      throw new Error(
        `Entity ${this.entityId} does not have component '${this.componentName}'`
      );
    }
    
    const actualValue = component[fieldName];
    const isEqual = actualValue === expectedValue;
    
    const result = this.negated ? !isEqual : isEqual;
    if (!result) {
      throw new Error(
        this.negated
          ? `Expected entity ${this.entityId}.${this.componentName}.${fieldName} NOT to equal ${JSON.stringify(expectedValue)}, but it does`
          : `Expected entity ${this.entityId}.${this.componentName}.${fieldName} to equal ${JSON.stringify(expectedValue)}, but got ${JSON.stringify(actualValue)}`
      );
    }
    
    this.negated = false;
    return this;
  }
  
  /**
   * Assert component field is greater than a value
   */
  toHaveFieldGreaterThan(fieldName: string, value: number): this {
    const component = this.game.getComponent(this.entityId, this.componentName);
    if (!component) {
      throw new Error(
        `Entity ${this.entityId} does not have component '${this.componentName}'`
      );
    }
    
    const actualValue = component[fieldName] as number;
    const isGreater = actualValue > value;
    
    const result = this.negated ? !isGreater : isGreater;
    if (!result) {
      throw new Error(
        this.negated
          ? `Expected entity ${this.entityId}.${this.componentName}.${fieldName} NOT to be greater than ${value}, but it is (${actualValue})`
          : `Expected entity ${this.entityId}.${this.componentName}.${fieldName} to be greater than ${value}, but got ${actualValue}`
      );
    }
    
    this.negated = false;
    return this;
  }
  
  /**
   * Assert component field is less than a value
   */
  toHaveFieldLessThan(fieldName: string, value: number): this {
    const component = this.game.getComponent(this.entityId, this.componentName);
    if (!component) {
      throw new Error(
        `Entity ${this.entityId} does not have component '${this.componentName}'`
      );
    }
    
    const actualValue = component[fieldName] as number;
    const isLess = actualValue < value;
    
    const result = this.negated ? !isLess : isLess;
    if (!result) {
      throw new Error(
        this.negated
          ? `Expected entity ${this.entityId}.${this.componentName}.${fieldName} NOT to be less than ${value}, but it is (${actualValue})`
          : `Expected entity ${this.entityId}.${this.componentName}.${fieldName} to be less than ${value}, but got ${actualValue}`
      );
    }
    
    this.negated = false;
    return this;
  }
  
  /**
   * Assert component field is between two values (inclusive)
   */
  toHaveFieldBetween(fieldName: string, min: number, max: number): this {
    const component = this.game.getComponent(this.entityId, this.componentName);
    if (!component) {
      throw new Error(
        `Entity ${this.entityId} does not have component '${this.componentName}'`
      );
    }
    
    const actualValue = component[fieldName] as number;
    const isBetween = actualValue >= min && actualValue <= max;
    
    const result = this.negated ? !isBetween : isBetween;
    if (!result) {
      throw new Error(
        this.negated
          ? `Expected entity ${this.entityId}.${this.componentName}.${fieldName} NOT to be between ${min} and ${max}, but it is (${actualValue})`
          : `Expected entity ${this.entityId}.${this.componentName}.${fieldName} to be between ${min} and ${max}, but got ${actualValue}`
      );
    }
    
    this.negated = false;
    return this;
  }
  
  /**
   * Assert multiple field values at once
   */
  toMatchFields(expected: Record<string, unknown>): this {
    const component = this.game.getComponent(this.entityId, this.componentName);
    if (!component) {
      throw new Error(
        `Entity ${this.entityId} does not have component '${this.componentName}'`
      );
    }
    
    const mismatches: string[] = [];
    for (const [field, expectedValue] of Object.entries(expected)) {
      const actualValue = component[field];
      if (actualValue !== expectedValue) {
        mismatches.push(`${field}: expected ${JSON.stringify(expectedValue)}, got ${JSON.stringify(actualValue)}`);
      }
    }
    
    const allMatch = mismatches.length === 0;
    const result = this.negated ? !allMatch : allMatch;
    
    if (!result) {
      throw new Error(
        this.negated
          ? `Expected entity ${this.entityId}.${this.componentName} NOT to match fields, but it does`
          : `Field mismatches for entity ${this.entityId}.${this.componentName}: ${mismatches.join(', ')}`
      );
    }
    
    this.negated = false;
    return this;
  }
  
  /**
   * Get current field value (for chaining or inspection)
   */
  getField(fieldName: string): unknown {
    const component = this.game.getComponent(this.entityId, this.componentName);
    return component?.[fieldName];
  }
}

/**
 * ExpectTime - Time-related assertions
 */
class ExpectTime {
  private game: BlinkGame;
  private negated = false;
  
  constructor(game: BlinkGame) {
    this.game = game;
  }
  
  /**
   * Negate the next assertion
   */
  get not(): this {
    this.negated = !this.negated;
    return this;
  }
  
  /**
   * Assert game time equals a value
   */
  toBe(expected: number): this {
    const actual = this.game.getTime();
    const isEqual = Math.abs(actual - expected) < 0.001; // Allow small floating point difference
    
    const result = this.negated ? !isEqual : isEqual;
    if (!result) {
      throw new Error(
        this.negated
          ? `Expected time NOT to be ${expected}, but it is`
          : `Expected time to be ${expected}, but got ${actual}`
      );
    }
    
    this.negated = false;
    return this;
  }
  
  /**
   * Assert game time is greater than a value
   */
  toBeGreaterThan(value: number): this {
    const actual = this.game.getTime();
    const isGreater = actual > value;
    
    const result = this.negated ? !isGreater : isGreater;
    if (!result) {
      throw new Error(
        this.negated
          ? `Expected time NOT to be greater than ${value}, but it is (${actual})`
          : `Expected time to be greater than ${value}, but got ${actual}`
      );
    }
    
    this.negated = false;
    return this;
  }
  
  /**
   * Assert game time is less than a value
   */
  toBeLessThan(value: number): this {
    const actual = this.game.getTime();
    const isLess = actual < value;
    
    const result = this.negated ? !isLess : isLess;
    if (!result) {
      throw new Error(
        this.negated
          ? `Expected time NOT to be less than ${value}, but it is (${actual})`
          : `Expected time to be less than ${value}, but got ${actual}`
      );
    }
    
    this.negated = false;
    return this;
  }
}

/**
 * ExpectTimeline - Timeline-related assertions
 */
export class ExpectTimeline {
  private game: BlinkGame;
  private negated = false;
  
  constructor(game: BlinkGame) {
    this.game = game;
  }
  
  /**
   * Negate the next assertion
   */
  get not(): this {
    this.negated = !this.negated;
    return this;
  }
  
  /**
   * Assert timeline has events
   */
  toHaveEvents(): this {
    const hasEvents = this.game.hasEvents();
    
    const result = this.negated ? !hasEvents : hasEvents;
    if (!result) {
      throw new Error(
        this.negated
          ? `Expected timeline NOT to have events, but it does`
          : `Expected timeline to have events, but it is empty`
      );
    }
    
    this.negated = false;
    return this;
  }
  
  /**
   * Assert timeline is empty
   */
  toBeEmpty(): this {
    const isEmpty = !this.game.hasEvents();
    
    const result = this.negated ? !isEmpty : isEmpty;
    if (!result) {
      throw new Error(
        this.negated
          ? `Expected timeline NOT to be empty, but it is`
          : `Expected timeline to be empty, but it has events`
      );
    }
    
    this.negated = false;
    return this;
  }
}

/**
 * ExpectQuery - Query-related assertions
 */
class ExpectQuery {
  private game: BlinkGame;
  private componentNames: string[];
  private negated = false;
  
  constructor(game: BlinkGame, componentNames: string[]) {
    this.game = game;
    this.componentNames = componentNames;
  }
  
  /**
   * Negate the next assertion
   */
  get not(): this {
    this.negated = !this.negated;
    return this;
  }
  
  /**
   * Assert query returns specific count
   */
  toHaveCount(expected: number): this {
    const entities = this.game.query(...this.componentNames);
    const isEqual = entities.length === expected;
    
    const result = this.negated ? !isEqual : isEqual;
    if (!result) {
      throw new Error(
        this.negated
          ? `Expected query NOT to return ${expected} entities, but it does`
          : `Expected query to return ${expected} entities, but got ${entities.length}`
      );
    }
    
    this.negated = false;
    return this;
  }
  
  /**
   * Assert query returns at least N entities
   */
  toHaveAtLeast(min: number): this {
    const entities = this.game.query(...this.componentNames);
    const hasAtLeast = entities.length >= min;
    
    const result = this.negated ? !hasAtLeast : hasAtLeast;
    if (!result) {
      throw new Error(
        this.negated
          ? `Expected query NOT to return at least ${min} entities, but it does (${entities.length})`
          : `Expected query to return at least ${min} entities, but got ${entities.length}`
      );
    }
    
    this.negated = false;
    return this;
  }
  
  /**
   * Assert query includes a specific entity
   */
  toInclude(entityId: EntityId): this {
    const entities = this.game.query(...this.componentNames);
    const includes = entities.includes(entityId);
    
    const result = this.negated ? !includes : includes;
    if (!result) {
      throw new Error(
        this.negated
          ? `Expected query NOT to include entity ${entityId}, but it does`
          : `Expected query to include entity ${entityId}, but it does not`
      );
    }
    
    this.negated = false;
    return this;
  }
}

/**
 * ExpectEvents - Event history assertions
 */
export class ExpectEvents {
  private events: StepResult[];
  private negated = false;
  
  constructor(events: StepResult[]) {
    this.events = events;
  }
  
  /**
   * Negate the next assertion
   */
  get not(): this {
    this.negated = !this.negated;
    return this;
  }
  
  /**
   * Assert an event type occurred
   */
  toContainEvent(eventType: string): this {
    const found = this.events.some(e => e.event.eventType === eventType);
    
    const result = this.negated ? !found : found;
    if (!result) {
      throw new Error(
        this.negated
          ? `Expected events NOT to contain '${eventType}', but it does`
          : `Expected events to contain '${eventType}', but it does not`
      );
    }
    
    this.negated = false;
    return this;
  }
  
  /**
   * Assert event count for a type
   */
  toHaveEventCount(eventType: string, count: number): this {
    const actualCount = this.events.filter(e => e.event.eventType === eventType).length;
    const isEqual = actualCount === count;
    
    const result = this.negated ? !isEqual : isEqual;
    if (!result) {
      throw new Error(
        this.negated
          ? `Expected event '${eventType}' NOT to occur ${count} times, but it does`
          : `Expected event '${eventType}' to occur ${count} times, but got ${actualCount}`
      );
    }
    
    this.negated = false;
    return this;
  }
  
  /**
   * Assert total event count
   */
  toHaveCount(count: number): this {
    const isEqual = this.events.length === count;
    
    const result = this.negated ? !isEqual : isEqual;
    if (!result) {
      throw new Error(
        this.negated
          ? `Expected events NOT to have ${count} total events, but it does`
          : `Expected ${count} total events, but got ${this.events.length}`
      );
    }
    
    this.negated = false;
    return this;
  }
}
