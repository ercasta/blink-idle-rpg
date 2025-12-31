/**
 * IR Loader
 * Loads and validates IR modules from JSON
 */

import { IRModule } from './types';

const SUPPORTED_MAJOR_VERSION = 1;

/**
 * Load IR from a URL
 */
export async function loadIR(url: string): Promise<IRModule> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to load IR from ${url}: ${response.statusText}`);
  }
  const json = await response.text();
  return loadIRFromString(json);
}

/**
 * Load IR from a JSON string
 */
export function loadIRFromString(json: string): IRModule {
  const ir = JSON.parse(json) as IRModule;
  validateIR(ir);
  return ir;
}

/**
 * Load IR from a parsed object
 */
export function loadIRFromObject(obj: unknown): IRModule {
  const ir = obj as IRModule;
  validateIR(ir);
  return ir;
}

/**
 * Validate IR module structure
 */
function validateIR(ir: IRModule): void {
  if (!ir.version) {
    throw new Error('IR missing version');
  }
  
  // Check version compatibility
  const [major] = ir.version.split('.').map(Number);
  if (major > SUPPORTED_MAJOR_VERSION) {
    throw new Error(
      `IR version ${ir.version} not supported, max supported is ${SUPPORTED_MAJOR_VERSION}.x`
    );
  }
  
  if (!ir.module) {
    throw new Error('IR missing module name');
  }
  
  if (!Array.isArray(ir.components)) {
    throw new Error('IR missing components array');
  }
  
  if (!Array.isArray(ir.rules)) {
    throw new Error('IR missing rules array');
  }
  
  if (!Array.isArray(ir.functions)) {
    throw new Error('IR missing functions array');
  }
  
  if (!Array.isArray(ir.trackers)) {
    throw new Error('IR missing trackers array');
  }
  
  // Validate components
  for (const component of ir.components) {
    if (typeof component.name !== 'string') {
      throw new Error(`Component missing name`);
    }
    if (!Array.isArray(component.fields)) {
      throw new Error(`Component ${component.name} missing fields array`);
    }
  }
  
  // Validate rules
  for (const rule of ir.rules) {
    if (typeof rule.name !== 'string') {
      throw new Error(`Rule missing name`);
    }
    if (!rule.trigger) {
      throw new Error(`Rule ${rule.name} missing trigger`);
    }
    if (!Array.isArray(rule.actions)) {
      throw new Error(`Rule ${rule.name} missing actions array`);
    }
  }
}

export * from './types';
