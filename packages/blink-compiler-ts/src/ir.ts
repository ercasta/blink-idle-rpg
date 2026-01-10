/**
 * Intermediate Representation (IR) types for Blink compiler
 * These types match the format expected by the blink-engine
 */

// ===== Source Mapping =====

export interface SourceFile {
  path: string;
  content: string;
  language: 'brl' | 'bcl' | 'bdl';
}

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
  constants?: Record<string, IRValue>;
  initial_state?: IRInitialState;
  choice_points?: IRChoicePoint[];
  source_map?: SourceMap;
}

export interface IRMetadata {
  compiled_at: string;
  compiler_version: string;
  source_hash?: string;
}

// ===== Components =====

export interface IRComponent {
  id: number;
  name: string;
  fields: IRField[];
}

export interface IRField {
  name: string;
  type: IRType;
  default?: IRValue;
}

export type IRType =
  | { type: 'number' }
  | { type: 'integer' }
  | { type: 'string' }
  | { type: 'boolean' }
  | { type: 'entity' }
  | { type: 'list'; element: IRType }
  | { type: 'map'; key: IRType; value: IRType };

export type IRValue =
  | null
  | boolean
  | number
  | string
  | IRValue[]
  | { [key: string]: IRValue };

// ===== Rules =====

export interface IRRule {
  id: number;
  name?: string;
  trigger: IRTrigger;
  filter?: IRFilter;
  condition?: IRExpression;
  actions: IRAction[];
}

export interface IRTrigger {
  type: 'event' | 'spawn' | 'tick';
  event?: string;
  bindings?: Record<string, string>;
}

export interface IRFilter {
  components?: string[];
}

// ===== Actions =====

export type IRAction =
  | IRModifyAction
  | IRScheduleAction
  | IREmitAction
  | IRSpawnAction
  | IRDespawnAction
  | IRConditionalAction
  | IRLoopAction
  | IRLetAction
  | IRWhileAction;

export interface IRModifyAction {
  type: 'modify';
  entity: IRExpression;
  component: string;
  field: string;
  op: 'set' | 'add' | 'subtract' | 'multiply' | 'divide';
  value: IRExpression;
}

export interface IRScheduleAction {
  type: 'schedule';
  event: string;
  source?: IRExpression;
  target?: IRExpression;
  delay?: IRExpression;
  fields?: Record<string, IRExpression>;
}

export interface IREmitAction {
  type: 'emit';
  event: string;
  fields?: Record<string, IRExpression>;
}

export interface IRSpawnAction {
  type: 'spawn';
  components: IRComponentInit[];
}

export interface IRDespawnAction {
  type: 'despawn';
  entity: IRExpression;
}

export interface IRConditionalAction {
  type: 'conditional';
  condition: IRExpression;
  then_actions: IRAction[];
  else_actions?: IRAction[];
}

export interface IRLoopAction {
  type: 'loop';
  variable: string;
  iterable: IRExpression;
  body: IRAction[];
}

export interface IRLetAction {
  type: 'let';
  name: string;
  value: IRExpression;
}

export interface IRWhileAction {
  type: 'while';
  condition: IRExpression;
  body: IRAction[];
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
  | IRIfExpr
  | IRCloneExpr
  | IRHasComponentExpr;

export interface IRLiteralExpr {
  type: 'literal';
  value: IRValue;
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
  op: 'not' | 'negate';
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

export interface IRCloneExpr {
  type: 'clone';
  source: IRExpression;
  overrides?: IRComponentInit[];
}

export interface IRHasComponentExpr {
  type: 'has_component';
  entity: IRExpression;
  component: string;
}

export interface IRComponentInit {
  name: string;
  fields: Record<string, IRExpression>;
}

// ===== Functions =====

export interface IRFunction {
  id: number;
  name: string;
  params: IRParam[];
  return_type: IRType;
  body: IRExpression;
}

export interface IRParam {
  name: string;
  type: IRType;
}

// Trackers removed from IR types

// ===== Initial State =====

export interface IRInitialState {
  entities: IREntityDefinition[];
}

export interface IREntityDefinition {
  id: number | string;
  variable?: string;
  components: Record<string, Record<string, IRValue>>;
  bound_functions?: IRBoundFunctions;
}

// ===== Bound Functions =====

export interface IRBoundFunctions {
  [functionName: string]: IRBoundFunction;
}

export interface IRBoundFunction {
  params: IRParam[];
  return_type: IRType;
  body: IRExpression;
  source?: string;
}

// ===== Choice Points =====

export interface IRChoicePoint {
  id: string;
  name: string;
  signature: string;
  params: IRParam[];
  return_type: IRType;
  docstring?: string;
  category?: string;
  applicable_classes?: string[];
  default_behavior?: string;
}
