/**
 * Abstract Syntax Tree (AST) types for Blink languages
 */

import { Span } from './lexer';

// ===== Module Structure =====

export interface Module {
  items: Item[];
}

export type Item =
  | ComponentDef
  | RuleDef
  | FunctionDef
  | ImportDef
  | ModuleDef
  | EntityDef;

// ===== Component Definition =====

export interface ComponentDef {
  type: 'component';
  name: string;
  fields: FieldDef[];
  span: Span;
}

export interface FieldDef {
  name: string;
  fieldType: TypeExpr;
  optional: boolean;
  span: Span;
}

// ===== Type Expressions =====

export type TypeExpr =
  | { type: 'string' }
  | { type: 'boolean' }
  | { type: 'integer' }
  | { type: 'float' }
  | { type: 'decimal' }
  | { type: 'number' }
  | { type: 'id' }
  | { type: 'component'; name: string }
  | { type: 'list'; element: TypeExpr }
  | { type: 'optional'; inner: TypeExpr }
  | { type: 'composite'; types: TypeExpr[] };

// ===== Rule Definition =====

export interface RuleDef {
  type: 'rule';
  name: string | null;
  triggerEvent: string;
  eventParam: ParamDef;  // The typed parameter for the event (e.g., 'gs: id' in 'rule on GameStart(gs: id)')
  condition: Expr | null;
  priority: number | null;
  body: Block;
  span: Span;
}

// ===== Function Definition =====

export interface FunctionDef {
  type: 'function';
  name: string;
  params: ParamDef[];
  returnType: TypeExpr | null;
  body: Block;
  isChoice: boolean;
  span: Span;
}

export interface ParamDef {
  name: string;
  paramType: TypeExpr;
  span: Span;
}

// ===== Import Definition =====

export interface ImportDef {
  type: 'import';
  path: string[];
  items: string[] | null;
  span: Span;
}

// ===== Module Definition =====

export interface ModuleDef {
  type: 'module';
  name: string;
  items: Item[];
  span: Span;
}

// ===== Entity Definition =====

export interface EntityDef {
  type: 'entity';
  variable: string | null;
  components: ComponentInit[];
  boundFunctions: BoundFunctionDef[];
  span: Span;
}

export interface ComponentInit {
  name: string;
  fields: [string, Expr][];
  span: Span;
}

export interface BoundFunctionDef {
  name: string;
  params: ParamDef[];
  returnType: TypeExpr | null;
  body: Block;
  span: Span;
}

// ===== Block =====

export interface Block {
  statements: Statement[];
  span: Span;
}

// ===== Statements =====

export type Statement =
  | LetStatement
  | AssignmentStatement
  | IfStatement
  | ForStatement
  | WhileStatement
  | ReturnStatement
  | ScheduleStatement
  | CancelStatement
  | CreateStatement
  | DeleteStatement
  | ExprStatement;

export interface LetStatement {
  type: 'let';
  name: string;
  typeAnnotation: TypeExpr | null;
  value: Expr;
  span: Span;
}

export interface AssignmentStatement {
  type: 'assignment';
  target: Expr;
  op: AssignOp;
  value: Expr;
  span: Span;
}

export type AssignOp = 'assign' | 'add_assign' | 'sub_assign' | 'mul_assign' | 'div_assign';

export interface IfStatement {
  type: 'if';
  condition: Expr;
  thenBlock: Block;
  elseBlock: ElseClause | null;
  span: Span;
}

export type ElseClause =
  | { type: 'else_if'; statement: IfStatement }
  | { type: 'else'; block: Block };

export interface ForStatement {
  type: 'for';
  variable: string;
  iterable: Expr;
  body: Block;
  span: Span;
}

export interface WhileStatement {
  type: 'while';
  condition: Expr;
  body: Block;
  span: Span;
}

export interface ReturnStatement {
  type: 'return';
  value: Expr | null;
  span: Span;
}

export interface ScheduleStatement {
  type: 'schedule';
  recurring: boolean;
  delay: Expr | null;
  interval: Expr | null;
  eventName: string;
  fields: [string, Expr][];
  span: Span;
}

export interface CancelStatement {
  type: 'cancel';
  target: Expr;
  span: Span;
}

export interface CreateStatement {
  type: 'create';
  components: ComponentInit[];
  span: Span;
}

export interface DeleteStatement {
  type: 'delete';
  entity: Expr;
  span: Span;
}

export interface ExprStatement {
  type: 'expr';
  expr: Expr;
  span: Span;
}

// ===== Expressions =====

export type Expr =
  | LiteralExpr
  | IdentifierExpr
  | EntityRefExpr
  | FieldAccessExpr
  | IndexAccessExpr
  | BinaryExpr
  | UnaryExpr
  | CallExpr
  | MethodCallExpr
  | HasComponentExpr
  | CastExpr
  | ListExpr
  | ParenExpr
  | EntitiesHavingExpr
  | CloneEntityExpr;

export interface LiteralExpr {
  type: 'literal';
  value: LiteralValue;
  span: Span;
}

export type LiteralValue =
  | { type: 'string'; value: string }
  | { type: 'integer'; value: number }
  | { type: 'float'; value: number }
  | { type: 'decimal'; value: string }
  | { type: 'boolean'; value: boolean }
  | { type: 'null' };

export interface IdentifierExpr {
  type: 'identifier';
  name: string;
  span: Span;
}

export interface EntityRefExpr {
  type: 'entity_ref';
  name: string;
  span: Span;
}

export interface FieldAccessExpr {
  type: 'field_access';
  base: Expr;
  field: string;
  span: Span;
}

export interface IndexAccessExpr {
  type: 'index_access';
  base: Expr;
  index: Expr;
  span: Span;
}

export interface BinaryExpr {
  type: 'binary';
  left: Expr;
  op: BinaryOp;
  right: Expr;
  span: Span;
}

export type BinaryOp =
  | 'add' | 'sub' | 'mul' | 'div' | 'mod'
  | 'eq' | 'neq' | 'lt' | 'lte' | 'gt' | 'gte'
  | 'and' | 'or';

export interface UnaryExpr {
  type: 'unary';
  op: UnaryOp;
  expr: Expr;
  span: Span;
}

export type UnaryOp = 'neg' | 'not';

export interface CallExpr {
  type: 'call';
  name: string;
  args: Expr[];
  span: Span;
}

export interface MethodCallExpr {
  type: 'method_call';
  base: Expr;
  method: string;
  args: Expr[];
  span: Span;
}

export interface HasComponentExpr {
  type: 'has_component';
  entity: Expr;
  component: string;
  span: Span;
}

export interface CastExpr {
  type: 'cast';
  expr: Expr;
  targetType: TypeExpr;
  span: Span;
}

export interface ListExpr {
  type: 'list';
  elements: Expr[];
  span: Span;
}

export interface ParenExpr {
  type: 'paren';
  inner: Expr;
  span: Span;
}

export interface EntitiesHavingExpr {
  type: 'entities_having';
  component: string;
  span: Span;
}

export interface CloneEntityExpr {
  type: 'clone_entity';
  source: Expr;
  overrides: ComponentInit[];
  span: Span;
}
