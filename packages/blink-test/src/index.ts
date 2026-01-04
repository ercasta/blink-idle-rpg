/**
 * @blink/test - Testing Framework for BRL and BCL
 * 
 * This package provides an integrated testing framework that allows
 * developers and players to test game rules (BRL) and player choices (BCL).
 * 
 * Features:
 * - Scenario-based testing with readable DSL
 * - Step-by-step execution with state assertions
 * - Entity and component state verification
 * - Event tracking and verification
 * - Tracker output inspection
 * - Snapshot testing support
 */

// Main test harness
export { GameTest, createTest } from './GameTest.js';
export type { 
  GameTestOptions,
  TestScenario,
  TestStep,
  TestAssertion,
  AssertionResult,
  TestResult,
  ScenarioResult,
} from './GameTest.js';

// Assertion utilities
export {
  expect,
  ExpectEntity,
  ExpectComponent,
  ExpectTimeline,
  ExpectEvents,
} from './assertions.js';
export type {
  EntityAssertion,
  ComponentAssertion,
  EventAssertion,
} from './assertions.js';

// Test utilities
export {
  createTestEntity,
  createTestEntities,
  createCombatScenario,
  createProgressionScenario,
  createWarriorFixture,
  createMageFixture,
  createEnemyFixture,
  createGameStateFixture,
} from './fixtures.js';
export type {
  EntityFixture,
  CombatScenarioOptions,
  ProgressionScenarioOptions,
} from './fixtures.js';

// Scenario builder (fluent API)
export { Scenario } from './ScenarioBuilder.js';
export type { ScenarioBuilder } from './ScenarioBuilder.js';

// Test reporter
export { TestReporter, ConsoleReporter } from './reporter.js';
export type { ReportOptions } from './reporter.js';

// Re-export useful types from engine
export type {
  BlinkGame,
  GameOptions,
  StepResult,
  EntityId,
} from '@blink/engine';
