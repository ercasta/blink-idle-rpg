/**
 * Semantic Analyzer for Blink languages
 * Validates AST for semantic correctness:
 * - All referenced variables/entities are declared
 * - All field accesses refer to valid components and fields
 * - Event field access is properly handled
 */

import * as AST from './ast';
import { Span } from './lexer';

export interface SemanticError {
  message: string;
  span: Span;
}

interface ComponentInfo {
  name: string;
  fields: Map<string, string>; // field name -> type
}

interface Scope {
  variables: Set<string>;
  eventAliases?: Set<string>;  // Track event aliases for field access validation
  parent?: Scope;
}

/**
 * Semantic analyzer for BRL/BCL/BDL
 */
export class SemanticAnalyzer {
  private components: Map<string, ComponentInfo> = new Map();
  private functions: Set<string> = new Set();
  private errors: SemanticError[] = [];
  
  // Built-in functions
  private builtinFunctions = new Set([
    'min', 'max', 'floor', 'ceil', 'round', 'abs',
    'random', 'random_range', 'len', 'list', 'get',
    'entities_having',
  ]);
  
  // Built-in variables available in rules
  private builtinVariables = new Set([
    'entity', // Legacy: still valid for component field access patterns like 'entity.Component.field'
              // but no longer implicitly iterates over entities in rules
  ]);

  /**
   * Analyze multiple modules for semantic errors
   */
  analyze(modules: AST.Module[]): SemanticError[] {
    this.errors = [];
    this.components.clear();
    this.functions.clear();
    
    // First pass: collect all component and function definitions
    for (const module of modules) {
      this.collectDefinitions(module);
    }
    
    // Second pass: validate all references
    for (const module of modules) {
      this.validateModule(module);
    }
    
    return this.errors;
  }

  private collectDefinitions(module: AST.Module): void {
    for (const item of module.items) {
      switch (item.type) {
        case 'component':
          this.collectComponent(item);
          break;
        case 'function':
          this.functions.add(item.name);
          break;
      }
    }
  }

  private collectComponent(comp: AST.ComponentDef): void {
    const fields = new Map<string, string>();
    for (const field of comp.fields) {
      fields.set(field.name, this.typeToString(field.fieldType));
    }
    this.components.set(comp.name, { name: comp.name, fields });
  }

  private typeToString(type: AST.TypeExpr): string {
    switch (type.type) {
      case 'string':
      case 'boolean':
      case 'integer':
      case 'float':
      case 'decimal':
      case 'number':
      case 'id':
        return type.type;
      case 'component':
        return type.name;
      case 'list':
        return `${this.typeToString(type.element)}[]`;
      case 'optional':
        return `${this.typeToString(type.inner)}?`;
      case 'composite':
        return type.types.map(t => this.typeToString(t)).join(' | ');
      default:
        return 'unknown';
    }
  }

  private validateModule(module: AST.Module): void {
    for (const item of module.items) {
      switch (item.type) {
        case 'rule':
          this.validateRule(item);
          break;
        case 'function':
          this.validateFunction(item);
          break;
        case 'entity':
          this.validateEntity(item);
          break;
      }
    }
  }

  private validateRule(rule: AST.RuleDef): void {
    // Create scope with built-in variables and event fields
    const scope = this.createScope();
    
    // Add built-in variables
    for (const v of this.builtinVariables) {
      scope.variables.add(v);
    }
    
    // Add 'event' as a special variable for accessing event fields (legacy)
    // Note: We don't know what fields the event has, so we allow any access
    scope.variables.add('event');
    
    // Add the event alias to scope and mark it as an event alias
    scope.variables.add(rule.eventAlias);
    if (!scope.eventAliases) {
      scope.eventAliases = new Set();
    }
    scope.eventAliases.add(rule.eventAlias);
    scope.eventAliases.add('event'); // Also mark 'event' as an alias for legacy support
    
    // Validate condition if present
    if (rule.condition) {
      this.validateExpression(rule.condition, scope);
    }
    
    // Validate body
    this.validateBlock(rule.body, scope);
  }

  private validateFunction(func: AST.FunctionDef): void {
    const scope = this.createScope();
    
    // Add parameters to scope
    for (const param of func.params) {
      scope.variables.add(param.name);
    }
    
    // Validate body
    this.validateBlock(func.body, scope);
  }

  private validateEntity(entity: AST.EntityDef): void {
    // Validate component initializations
    for (const init of entity.components) {
      if (!this.components.has(init.name)) {
        this.errors.push({
          message: `Unknown component '${init.name}'`,
          span: init.span,
        });
        continue;
      }
      
      const compInfo = this.components.get(init.name)!;
      
      // Validate field initializations
      for (const [fieldName, fieldValue] of init.fields) {
        if (!compInfo.fields.has(fieldName)) {
          this.errors.push({
            message: `Unknown field '${fieldName}' in component '${init.name}'. Available fields: ${Array.from(compInfo.fields.keys()).join(', ')}`,
            span: init.span,
          });
        }
        
        // Validate the field value expression
        const scope = this.createScope();
        this.validateExpression(fieldValue, scope);
      }
    }
    
    // Validate bound functions
    for (const boundFunc of entity.boundFunctions) {
      this.validateBoundFunction(boundFunc);
    }
  }

  private validateBoundFunction(func: AST.BoundFunctionDef): void {
    const scope = this.createScope();
    
    // Add parameters to scope
    for (const param of func.params) {
      scope.variables.add(param.name);
    }
    
    // Validate body
    this.validateBlock(func.body, scope);
  }

  private validateBlock(block: AST.Block, parentScope: Scope): void {
    const scope = this.createChildScope(parentScope);
    for (const stmt of block.statements) {
      this.validateStatement(stmt, scope);
    }
  }

  private validateStatement(stmt: AST.Statement, scope: Scope): void {
    switch (stmt.type) {
      case 'let':
        this.validateExpression(stmt.value, scope);
        // Add variable to scope after validation (so it can't reference itself)
        scope.variables.add(stmt.name);
        break;
        
      case 'assignment':
        this.validateExpression(stmt.target, scope);
        this.validateExpression(stmt.value, scope);
        break;
        
      case 'if':
        this.validateExpression(stmt.condition, scope);
        this.validateBlock(stmt.thenBlock, scope);
        if (stmt.elseBlock) {
          if (stmt.elseBlock.type === 'else_if') {
            this.validateStatement(stmt.elseBlock.statement, scope);
          } else {
            this.validateBlock(stmt.elseBlock.block, scope);
          }
        }
        break;
        
      case 'for':
        this.validateExpression(stmt.iterable, scope);
        const forScope = this.createChildScope(scope);
        forScope.variables.add(stmt.variable);
        this.validateBlock(stmt.body, forScope);
        break;
        
      case 'while':
        this.validateExpression(stmt.condition, scope);
        this.validateBlock(stmt.body, scope);
        break;
        
      case 'schedule':
        if (stmt.delay) {
          this.validateExpression(stmt.delay, scope);
        }
        if (stmt.interval) {
          this.validateExpression(stmt.interval, scope);
        }
        for (const [, value] of stmt.fields) {
          this.validateExpression(value, scope);
        }
        break;
        
      case 'cancel':
        this.validateExpression(stmt.target, scope);
        break;
        
      case 'create':
        for (const init of stmt.components) {
          if (!this.components.has(init.name)) {
            this.errors.push({
              message: `Unknown component '${init.name}'`,
              span: init.span,
            });
          }
          for (const [, value] of init.fields) {
            this.validateExpression(value, scope);
          }
        }
        break;
        
      case 'delete':
        this.validateExpression(stmt.entity, scope);
        break;
        
      case 'return':
        if (stmt.value) {
          this.validateExpression(stmt.value, scope);
        }
        break;
        
      case 'expr':
        this.validateExpression(stmt.expr, scope);
        break;
    }
  }

  private validateExpression(expr: AST.Expr, scope: Scope): void {
    switch (expr.type) {
      case 'identifier':
        if (!this.isVariableInScope(expr.name, scope)) {
          this.errors.push({
            message: `Undeclared variable '${expr.name}'`,
            span: expr.span,
          });
        }
        break;
        
      case 'literal':
        // Literals are always valid
        break;
        
      case 'entity_ref':
        // Entity references are valid if the referenced variable exists
        if (!this.isVariableInScope(expr.name, scope)) {
          this.errors.push({
            message: `Undeclared entity '${expr.name}'`,
            span: expr.span,
          });
        }
        break;
        
      case 'field_access':
        this.validateFieldAccess(expr, scope);
        break;
        
      case 'index_access':
        this.validateExpression(expr.base, scope);
        this.validateExpression(expr.index, scope);
        break;
        
      case 'binary':
        this.validateExpression(expr.left, scope);
        this.validateExpression(expr.right, scope);
        break;
        
      case 'unary':
        this.validateExpression(expr.expr, scope);
        break;
        
      case 'call':
        this.validateCall(expr, scope);
        break;
        
      case 'method_call':
        this.validateExpression(expr.base, scope);
        for (const arg of expr.args) {
          this.validateExpression(arg, scope);
        }
        break;
        
      case 'has_component':
        this.validateExpression(expr.entity, scope);
        if (!this.components.has(expr.component)) {
          this.errors.push({
            message: `Unknown component '${expr.component}'`,
            span: expr.span,
          });
        }
        break;
        
      case 'entities_having':
        if (!this.components.has(expr.component)) {
          this.errors.push({
            message: `Unknown component '${expr.component}'`,
            span: expr.span,
          });
        }
        break;
        
      case 'clone_entity':
        this.validateExpression(expr.source, scope);
        for (const override of expr.overrides) {
          if (!this.components.has(override.name)) {
            this.errors.push({
              message: `Unknown component '${override.name}'`,
              span: override.span,
            });
          }
          for (const [, value] of override.fields) {
            this.validateExpression(value, scope);
          }
        }
        break;
        
      case 'list':
        for (const element of expr.elements) {
          this.validateExpression(element, scope);
        }
        break;
        
      case 'paren':
        this.validateExpression(expr.inner, scope);
        break;
        
      case 'cast':
        this.validateExpression(expr.expr, scope);
        break;
    }
  }

  private validateFieldAccess(expr: AST.FieldAccessExpr, scope: Scope): void {
    // Handle entity.Component.field pattern
    if (expr.base.type === 'field_access') {
      const baseAccess = expr.base as AST.FieldAccessExpr;
      
      // Validate the entity reference
      this.validateExpression(baseAccess.base, scope);
      
      // Check if the component exists
      const componentName = baseAccess.field;
      if (!this.components.has(componentName)) {
        this.errors.push({
          message: `Unknown component '${componentName}'`,
          span: baseAccess.span,
        });
        return;
      }
      
      // Check if the field exists in the component
      const compInfo = this.components.get(componentName)!;
      if (!compInfo.fields.has(expr.field)) {
        this.errors.push({
          message: `Unknown field '${expr.field}' in component '${componentName}'. Available fields: ${Array.from(compInfo.fields.keys()).join(', ')}`,
          span: expr.span,
        });
      }
      return;
    }
    
    // Handle simple entity.field or event.field pattern
    if (expr.base.type === 'identifier') {
      const baseName = expr.base.name;
      
      // Check if base is an event alias (including 'event' itself)
      // Event aliases allow any field access since event fields are dynamic
      if (scope.eventAliases && scope.eventAliases.has(baseName)) {
        // Event field access is allowed (dynamic)
        return;
      }
      
      // Check if base is a valid variable
      if (!this.isVariableInScope(baseName, scope)) {
        this.errors.push({
          message: `Undeclared variable '${baseName}'`,
          span: expr.base.span,
        });
        return;
      }
      
      // If it's not an event alias, it should be entity.Component pattern
      // Check if the accessed field is a component name
      if (!this.components.has(expr.field)) {
        // It's not a component, so this could be an invalid field access like entity.id
        this.errors.push({
          message: `Invalid field access '${baseName}.${expr.field}'. Use '${baseName}.Component.field' to access component fields, or '${baseName}' directly for entity references`,
          span: expr.span,
        });
      }
      return;
    }
    
    // For other cases, validate the base expression
    this.validateExpression(expr.base, scope);
  }

  private validateCall(expr: AST.CallExpr, scope: Scope): void {
    // Check if function exists
    if (!this.builtinFunctions.has(expr.name) && !this.functions.has(expr.name)) {
      this.errors.push({
        message: `Unknown function '${expr.name}'`,
        span: expr.span,
      });
    }
    
    // Validate arguments
    for (const arg of expr.args) {
      this.validateExpression(arg, scope);
    }
  }

  private createScope(): Scope {
    return { variables: new Set() };
  }

  private createChildScope(parent: Scope): Scope {
    return {
      variables: new Set(),
      // Create new Set with parent's event aliases to avoid shared reference mutations
      eventAliases: parent.eventAliases ? new Set(parent.eventAliases) : undefined,
      parent
    };
  }

  private isVariableInScope(name: string, scope: Scope): boolean {
    if (scope.variables.has(name)) {
      return true;
    }
    if (scope.parent) {
      return this.isVariableInScope(name, scope.parent);
    }
    return false;
  }
}

/**
 * Analyze modules for semantic errors
 */
export function analyze(modules: AST.Module[]): SemanticError[] {
  const analyzer = new SemanticAnalyzer();
  return analyzer.analyze(modules);
}
