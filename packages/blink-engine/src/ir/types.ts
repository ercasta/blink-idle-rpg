/**
 * Blink IR Types
 * Based on the IR specification in doc/ir-specification.md
 */

// ===== Source Mapping =====

/**
 * Source location for debugging and error reporting
 */
export interface SourceLocation {
  file: string;
  line: number;
  column: number;
  endLine?: number;
  endColumn?: number;
}

/**
 * Source file entry for source mapping
 */
export interface SourceFile {
  path: string;
  content: string;
  language: 'brl' | 'bcl' | 'bdl';
}

/**
 * Source map for the entire IR module
 */
export interface SourceMap {
  files: SourceFile[];
}

// ===== Module Structure =====

export interface IRModule {
  version: string;
  module: string;
  metadata?: IRMetadata;
  components: IRComponent[];
  rules: IRRule[];
  functions: IRFunction[];
  trackers?: IRTracker[];
  initial_state?: IRInitialState;
  source_map?: SourceMap;
}

export interface IRMetadata {
  compiled_at?: string;
  compiler_version?: string;
  source_hash?: string;
  include_source_map?: boolean;
}

// ===== Components =====

export interface IRComponent {
  id: number;
  name: string;
  fields: IRField[];
  source_location?: SourceLocation;
}

export interface IRField {
  name: string;
  type: IRFieldType;
  default?: IRFieldValue;
}

export type IRFieldType = 'number' | 'string' | 'boolean' | 'entity' | IRListType | IRMapType;

export interface IRListType {
  type: 'list';
  element: IRFieldType;
}

export interface IRMapType {
  type: 'map';
  key: IRFieldType;
  value: IRFieldType;
}

// Using a simpler type to avoid circular reference
export type IRFieldValue = number | string | boolean | null | unknown[] | Record<string, unknown>;

// ===== Rules =====

export interface IRRule {
  id: number;
  name: string;
  trigger: IRTrigger;
  filter?: IRFilter;
  condition?: IRExpression;
  actions: IRAction[];
  source_location?: SourceLocation;
}

export interface IRTrigger {
  type: 'event' | 'spawn' | 'tick';
  event?: string;
  interval?: number;
  bindings?: Record<string, string>;
}

export interface IRFilter {
  components?: string[];
}

// ===== Actions =====

export type IRAction = IRModifyAction | IRScheduleAction | IREmitAction | IRSpawnAction | IRDespawnAction;

export interface IRModifyAction {
  type: 'modify';
  entity: IRExpression;
  component: string;
  field: string;
  op: 'set' | 'add' | 'subtract' | 'multiply' | 'divide';
  value: IRExpression;
  source_location?: SourceLocation;
}

export interface IRScheduleAction {
  type: 'schedule';
  event: string;
  source?: IRExpression;
  target?: IRExpression;
  delay?: IRExpression;
  fields?: Record<string, IRExpression>;
  source_location?: SourceLocation;
}

export interface IREmitAction {
  type: 'emit';
  event: string;
  fields?: Record<string, IRExpression>;
  source_location?: SourceLocation;
}

export interface IRSpawnAction {
  type: 'spawn';
  components: Record<string, Record<string, IRExpression>>;
  source_location?: SourceLocation;
}

export interface IRDespawnAction {
  type: 'despawn';
  entity: IRExpression;
  source_location?: SourceLocation;
}

// ===== Expressions =====

export type IRExpression =
  | IRLiteralExpr
  | IRFieldExpr
  | IRVarExpr
  | IRParamExpr
  | IRBinaryExpr
  | IRUnaryExpr
  | IRCallExpr
  | IRIfExpr;

export interface IRLiteralExpr {
  type: 'literal';
  value: IRFieldValue;
}

export interface IRFieldExpr {
  type: 'field';
  entity: string | IRExpression;
  component: string;
  field: string;
}

export interface IRVarExpr {
  type: 'var';
  name: string;
}

export interface IRParamExpr {
  type: 'param';
  name: string;
}

export interface IRBinaryExpr {
  type: 'binary';
  op: BinaryOp;
  left: IRExpression;
  right: IRExpression;
}

export type BinaryOp =
  | 'add' | 'subtract' | 'multiply' | 'divide' | 'modulo'
  | 'eq' | 'neq' | 'lt' | 'lte' | 'gt' | 'gte'
  | 'and' | 'or';

export interface IRUnaryExpr {
  type: 'unary';
  op: 'not' | 'neg';
  expr: IRExpression;
}

export interface IRCallExpr {
  type: 'call';
  function: string;
  args: IRExpression[];
}

export interface IRIfExpr {
  type: 'if';
  condition: IRExpression;
  then: IRExpression;
  else: IRExpression;
}

// ===== Functions =====

export interface IRFunction {
  id: number;
  name: string;
  params: IRParam[];
  return_type: IRReturnType;
  body: IRExpression;
  source_location?: SourceLocation;
}

export interface IRParam {
  name: string;
  type: IRFieldType;
}

export interface IRReturnType {
  type: IRFieldType;
}

// ===== Trackers =====

export interface IRTracker {
  id: number;
  component: string;
  event: string;
}

// ===== Initial State =====

export interface IRInitialState {
  entities: IREntityDefinition[];
}

export interface IREntityDefinition {
  id: number | string;
  /** Variable name for the entity (e.g., "warrior" from `warrior = new entity`)
   * This replaces the old @name syntax. Entities are nameless; variables reference them.
   */
  variable?: string;
  components: Record<string, Record<string, IRFieldValue>>;
  /** Bound choice functions stored directly on the entity */
  bound_functions?: IRBoundFunctions;
}

// ===== Bound Functions =====

/**
 * Maps function names to their definitions, stored directly on entities
 */
export interface IRBoundFunctions {
  [functionName: string]: IRBoundFunction;
}

/**
 * A choice function bound directly to an entity (from BDL)
 */
export interface IRBoundFunction {
  params: IRParam[];
  return_type: IRReturnType;
  body: IRExpression;
  source?: string; // Original BCL/BDL source for UI display
}
