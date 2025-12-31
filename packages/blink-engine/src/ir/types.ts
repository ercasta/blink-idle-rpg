/**
 * Blink IR Types
 * Based on the IR specification in doc/ir-specification.md
 */

// ===== Module Structure =====

export interface IRModule {
  version: string;
  module: string;
  metadata?: IRMetadata;
  components: IRComponent[];
  rules: IRRule[];
  functions: IRFunction[];
  trackers: IRTracker[];
  initial_state?: IRInitialState;
}

export interface IRMetadata {
  compiled_at?: string;
  compiler_version?: string;
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
  components: Record<string, Record<string, IRExpression>>;
}

export interface IRDespawnAction {
  type: 'despawn';
  entity: IRExpression;
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
  components: Record<string, Record<string, IRFieldValue>>;
}
