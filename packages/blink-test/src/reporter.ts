/**
 * Test Reporter - Formats and displays test results
 * 
 * Provides different output formats for test results.
 */

import { ScenarioResult, TestResult, AssertionResult } from './GameTest.js';

export interface ReportOptions {
  /** Use colors in output */
  colors?: boolean;
  /** Show verbose output */
  verbose?: boolean;
  /** Show only failures */
  failuresOnly?: boolean;
  /** Show timing information */
  showTiming?: boolean;
}

/**
 * Abstract test reporter interface
 */
export abstract class TestReporter {
  protected options: Required<ReportOptions>;
  
  constructor(options: ReportOptions = {}) {
    this.options = {
      colors: options.colors ?? true,
      verbose: options.verbose ?? false,
      failuresOnly: options.failuresOnly ?? false,
      showTiming: options.showTiming ?? true,
    };
  }
  
  /**
   * Report results for multiple scenarios
   */
  abstract report(results: ScenarioResult[]): void;
  
  /**
   * Get summary statistics
   */
  getSummary(results: ScenarioResult[]): {
    totalScenarios: number;
    passedScenarios: number;
    failedScenarios: number;
    totalSteps: number;
    passedSteps: number;
    failedSteps: number;
    totalAssertions: number;
    passedAssertions: number;
    failedAssertions: number;
    totalDuration: number;
  } {
    let totalSteps = 0;
    let passedSteps = 0;
    let failedSteps = 0;
    let totalAssertions = 0;
    let passedAssertions = 0;
    let failedAssertions = 0;
    let totalDuration = 0;
    
    for (const scenario of results) {
      totalDuration += scenario.duration;
      
      for (const step of scenario.results) {
        totalSteps++;
        if (step.passed) {
          passedSteps++;
        } else {
          failedSteps++;
        }
        
        for (const assertion of step.assertions) {
          totalAssertions++;
          if (assertion.passed) {
            passedAssertions++;
          } else {
            failedAssertions++;
          }
        }
      }
    }
    
    return {
      totalScenarios: results.length,
      passedScenarios: results.filter(r => r.passed).length,
      failedScenarios: results.filter(r => !r.passed).length,
      totalSteps,
      passedSteps,
      failedSteps,
      totalAssertions,
      passedAssertions,
      failedAssertions,
      totalDuration,
    };
  }
}

/**
 * Console reporter - outputs to console
 */
export class ConsoleReporter extends TestReporter {
  // ANSI color codes
  private green: string;
  private red: string;
  private yellow: string;
  private dim: string;
  private reset: string;
  private bold: string;
  
  constructor(options: ReportOptions = {}) {
    super(options);
    // Initialize colors based on options
    this.green = this.options.colors ? '\x1b[32m' : '';
    this.red = this.options.colors ? '\x1b[31m' : '';
    this.yellow = this.options.colors ? '\x1b[33m' : '';
    this.dim = this.options.colors ? '\x1b[2m' : '';
    this.reset = this.options.colors ? '\x1b[0m' : '';
    this.bold = this.options.colors ? '\x1b[1m' : '';
  }
  
  report(results: ScenarioResult[]): void {
    console.log('');
    console.log(`${this.bold}Test Results${this.reset}`);
    console.log('═'.repeat(60));
    
    for (const scenario of results) {
      this.reportScenario(scenario);
    }
    
    this.reportSummary(results);
  }
  
  private reportScenario(scenario: ScenarioResult): void {
    const icon = scenario.passed 
      ? `${this.green}✓${this.reset}` 
      : `${this.red}✗${this.reset}`;
    
    const timing = this.options.showTiming 
      ? `${this.dim}(${scenario.duration.toFixed(2)}ms)${this.reset}` 
      : '';
    
    console.log('');
    console.log(`${icon} ${this.bold}${scenario.scenarioName}${this.reset} ${timing}`);
    
    if (scenario.error) {
      console.log(`  ${this.red}Error: ${scenario.error.message}${this.reset}`);
    }
    
    for (const step of scenario.results) {
      if (this.options.failuresOnly && step.passed) {
        continue;
      }
      
      this.reportStep(step);
    }
  }
  
  private reportStep(step: TestResult): void {
    const icon = step.passed 
      ? `${this.green}✓${this.reset}` 
      : `${this.red}✗${this.reset}`;
    
    const timing = this.options.showTiming 
      ? `${this.dim}(${step.duration.toFixed(2)}ms)${this.reset}` 
      : '';
    
    console.log(`  ${icon} ${step.stepName} ${timing}`);
    
    if (step.error) {
      console.log(`    ${this.red}Error: ${step.error.message}${this.reset}`);
    }
    
    if (this.options.verbose || !step.passed) {
      for (const assertion of step.assertions) {
        if (this.options.failuresOnly && assertion.passed) {
          continue;
        }
        
        this.reportAssertion(assertion);
      }
    }
    
    if (this.options.verbose && step.stepResults.length > 0) {
      console.log(`    ${this.dim}Events processed: ${step.stepResults.length}${this.reset}`);
      for (const result of step.stepResults) {
        console.log(`      ${this.dim}- ${result.event.eventType} at t=${result.time}${this.reset}`);
      }
    }
  }
  
  private reportAssertion(assertion: AssertionResult): void {
    const icon = assertion.passed 
      ? `${this.green}✓${this.reset}` 
      : `${this.red}✗${this.reset}`;
    
    console.log(`    ${icon} ${assertion.description}`);
    
    if (!assertion.passed) {
      if (assertion.expected !== undefined) {
        console.log(`      ${this.dim}Expected: ${assertion.expected}${this.reset}`);
      }
      if (assertion.actual !== undefined) {
        console.log(`      ${this.dim}Actual:   ${assertion.actual}${this.reset}`);
      }
      if (assertion.error) {
        console.log(`      ${this.red}Error: ${assertion.error.message}${this.reset}`);
      }
    }
  }
  
  private reportSummary(results: ScenarioResult[]): void {
    const summary = this.getSummary(results);
    
    console.log('');
    console.log('─'.repeat(60));
    console.log('');
    
    const scenarioStatus = summary.failedScenarios === 0
      ? `${this.green}${summary.passedScenarios} passed${this.reset}`
      : `${this.red}${summary.failedScenarios} failed${this.reset}, ${this.green}${summary.passedScenarios} passed${this.reset}`;
    
    const stepStatus = summary.failedSteps === 0
      ? `${this.green}${summary.passedSteps} passed${this.reset}`
      : `${this.red}${summary.failedSteps} failed${this.reset}, ${this.green}${summary.passedSteps} passed${this.reset}`;
    
    const assertionStatus = summary.failedAssertions === 0
      ? `${this.green}${summary.passedAssertions} passed${this.reset}`
      : `${this.red}${summary.failedAssertions} failed${this.reset}, ${this.green}${summary.passedAssertions} passed${this.reset}`;
    
    console.log(`Scenarios:  ${scenarioStatus} (${summary.totalScenarios} total)`);
    console.log(`Steps:      ${stepStatus} (${summary.totalSteps} total)`);
    console.log(`Assertions: ${assertionStatus} (${summary.totalAssertions} total)`);
    
    if (this.options.showTiming) {
      console.log(`Time:       ${summary.totalDuration.toFixed(2)}ms`);
    }
    
    console.log('');
    
    if (summary.failedScenarios === 0) {
      console.log(`${this.green}${this.bold}All tests passed!${this.reset}`);
    } else {
      console.log(`${this.red}${this.bold}Some tests failed.${this.reset}`);
    }
    
    console.log('');
  }
}

/**
 * JSON reporter - outputs JSON format
 */
export class JSONReporter extends TestReporter {
  private output: string = '';
  
  report(results: ScenarioResult[]): void {
    const summary = this.getSummary(results);
    
    const output = {
      summary,
      scenarios: results.map(scenario => ({
        name: scenario.scenarioName,
        passed: scenario.passed,
        duration: scenario.duration,
        error: scenario.error?.message,
        steps: scenario.results.map(step => ({
          name: step.stepName,
          passed: step.passed,
          duration: step.duration,
          error: step.error?.message,
          assertions: step.assertions.map(a => ({
            description: a.description,
            passed: a.passed,
            expected: a.expected,
            actual: a.actual,
            error: a.error?.message,
          })),
          eventsProcessed: step.stepResults.length,
        })),
      })),
    };
    
    this.output = JSON.stringify(output, null, 2);
    console.log(this.output);
  }
  
  getOutput(): string {
    return this.output;
  }
}

/**
 * TAP reporter - Test Anything Protocol format
 */
export class TAPReporter extends TestReporter {
  report(results: ScenarioResult[]): void {
    let testNumber = 0;
    const lines: string[] = [];
    
    // Count total tests
    let total = 0;
    for (const scenario of results) {
      total += scenario.results.length;
    }
    
    lines.push(`1..${total}`);
    
    for (const scenario of results) {
      lines.push(`# ${scenario.scenarioName}`);
      
      for (const step of scenario.results) {
        testNumber++;
        
        if (step.passed) {
          lines.push(`ok ${testNumber} - ${step.stepName}`);
        } else {
          lines.push(`not ok ${testNumber} - ${step.stepName}`);
          
          if (step.error) {
            lines.push(`  ---`);
            lines.push(`  message: ${step.error.message}`);
            lines.push(`  ...`);
          }
          
          for (const assertion of step.assertions) {
            if (!assertion.passed) {
              lines.push(`  # ${assertion.description}`);
              if (assertion.expected !== undefined) {
                lines.push(`  # Expected: ${assertion.expected}`);
              }
              if (assertion.actual !== undefined) {
                lines.push(`  # Actual: ${assertion.actual}`);
              }
            }
          }
        }
      }
    }
    
    console.log(lines.join('\n'));
  }
}
