// IDE Types for the Blink Development IDE

/**
 * Represents a source file in the editor
 */
export interface SourceFile {
  id: string;
  name: string;
  content: string;
  language: 'brl' | 'bcl' | 'bdl';
  isDirty: boolean;
}

/**
 * Compilation error from the compiler
 */
export interface CompileError {
  type: 'lexer' | 'parser' | 'semantic';
  message: string;
  file?: string;
  position?: number;
  line?: number;
  column?: number;
}

/**
 * Result from compilation
 */
export interface CompileResult {
  success: boolean;
  errors: CompileError[];
  ir?: IRModule;
}

/**
 * Entity data for inspector
 */
export interface EntityData {
  id: number | string;
  components: Record<string, Record<string, unknown>>;
}

/**
 * Component definition from IR
 */
export interface ComponentDefinition {
  name: string;
  fields: Array<{
    name: string;
    type: string | { type: string };
    default?: unknown;
  }>;
}

/**
 * Rule definition from IR
 */
export interface RuleDefinition {
  id?: number;
  name: string;
  trigger: {
    event: string;
    entity_var?: string;
    source_var?: string;
    target_var?: string;
  };
  source_location?: {
    file: string;
    line: number;
    column: number;
  };
}

/**
 * Trace event for debugging
 */
export interface TraceEvent {
  type: 'event_fired' | 'event_scheduled' | 'rule_matched' | 'rule_triggered';
  time: number;
  eventType?: string;
  ruleName?: string;
  entityId?: number | string;
  details?: string;
}

/**
 * IR Module structure (simplified)
 */
export interface IRModule {
  version: string;
  module: string;
  components: ComponentDefinition[];
  rules: RuleDefinition[];
  functions: Array<{
    id?: number;
    name: string;
    params: Array<{ name: string; type: unknown }>;
    return_type: unknown;
  }>;
  initial_state?: {
    entities: Array<{
      id: number | string;
      components: Record<string, Record<string, unknown>>;
    }>;
  };
  choice_points?: Array<{
    id: string;
    name: string;
    signature: string;
    docstring: string;
    category: string;
    applicableClasses?: string[];
    defaultBehavior?: string;
  }>;
  source_map?: {
    files: Array<{
      path: string;
      content: string;
      language: string;
    }>;
  };
}

/**
 * Editor tab configuration
 */
export type EditorTab = 'brl' | 'bcl' | 'bdl' | 'snippet';

/**
 * Inspector tab configuration
 */
export type InspectorTab = 'entities' | 'components' | 'rules' | 'trace';
