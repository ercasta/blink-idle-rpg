/**
 * IR Code Generator for Blink languages
 * Converts AST to IR (Intermediate Representation)
 */

import * as AST from './ast';
import * as IR from './ir';

export interface GeneratorOptions {
  moduleName?: string;
  includeSourceMap?: boolean;
}

export class CodeGenerator {
  private componentId = 0;
  private ruleId = 0;
  private functionId = 0;
  private entityId = 0;
  
  private options: GeneratorOptions;
  private sourceFiles: IR.SourceFile[] = [];

  constructor(options: GeneratorOptions = {}) {
    this.options = options;
  }

  addSourceFile(path: string, content: string, language: 'brl' | 'bcl' | 'bdl'): void {
    this.sourceFiles.push({ path, content, language });
  }

  generate(modules: AST.Module[]): IR.IRModule {
    const components: IR.IRComponent[] = [];
    const rules: IR.IRRule[] = [];
    const functions: IR.IRFunction[] = [];
    const entities: IR.IREntityDefinition[] = [];
    const choicePoints: IR.IRChoicePoint[] = [];
    
    for (const module of modules) {
      for (const item of module.items) {
        switch (item.type) {
          case 'component':
            components.push(this.generateComponent(item));
            break;
          case 'rule':
            rules.push(this.generateRule(item));
            break;
          case 'function':
            const func = this.generateFunction(item);
            functions.push(func);
            if (item.isChoice) {
              choicePoints.push(this.generateChoicePoint(item, func));
            }
            break;
          case 'entity':
            const entity = this.generateEntity(item);
            entities.push(entity);
            // Extract choice points from bound functions
            if (item.boundFunctions.length > 0 && entity.bound_functions) {
              for (const boundFunc of item.boundFunctions) {
                const boundIRFunc = entity.bound_functions[boundFunc.name];
                if (boundIRFunc) {
                  choicePoints.push(this.generateBoundChoicePoint(boundFunc, boundIRFunc, item));
                }
              }
            }
            break;
          case 'module':
            // Recursively process nested modules
            const nestedResult = this.generate([{ items: item.items }]);
            components.push(...nestedResult.components);
            rules.push(...nestedResult.rules);
            functions.push(...nestedResult.functions);
            if (nestedResult.initial_state) {
              entities.push(...nestedResult.initial_state.entities);
            }
            if (nestedResult.choice_points) {
              choicePoints.push(...nestedResult.choice_points);
            }
            break;
          case 'import':
            // Imports are resolved at a higher level
            break;
        }
      }
    }
    
    const result: IR.IRModule = {
      version: '1.0',
      module: this.options.moduleName ?? 'unnamed',
      metadata: {
        compiled_at: new Date().toISOString(),
        compiler_version: '1.0.0-ts',
      },
      components,
      rules,
      functions,
    };
    
    if (entities.length > 0) {
      result.initial_state = { entities };
    }
    
    if (choicePoints.length > 0) {
      result.choice_points = this.deduplicateChoicePoints(choicePoints);
    }
    
    if (this.options.includeSourceMap && this.sourceFiles.length > 0) {
      result.source_map = { files: this.sourceFiles };
    }
    
    return result;
  }

  private generateComponent(comp: AST.ComponentDef): IR.IRComponent {
    return {
      id: this.componentId++,
      name: comp.name,
      fields: comp.fields.map(f => this.generateField(f)),
    };
  }

  private generateField(field: AST.FieldDef): IR.IRField {
    return {
      name: field.name,
      type: this.convertType(field.fieldType),
    };
  }

  private convertType(type: AST.TypeExpr): IR.IRType {
    switch (type.type) {
      case 'string':
        return { type: 'string' };
      case 'boolean':
        return { type: 'boolean' };
      case 'integer':
      case 'float':
      case 'decimal':
      case 'number':
        return { type: 'number' };
      case 'id':
        return { type: 'entity' };
      case 'component':
        return { type: 'entity' };
      case 'list':
        return { type: 'list', element: this.convertType(type.element) };
      case 'optional':
        return this.convertType(type.inner);
      case 'composite':
        // Composite types represent entity constraints
        return { type: 'entity' };
    }
  }

  private generateRule(rule: AST.RuleDef): IR.IRRule {
    const actions = this.generateBlockActions(rule.body);
    
    return {
      id: this.ruleId++,
      name: rule.name ?? undefined,
      trigger: {
        type: 'event',
        event: rule.triggerEvent,
      },
      condition: rule.condition ? this.generateExpression(rule.condition) : undefined,
      actions,
    };
  }

  private generateBlockActions(block: AST.Block): IR.IRAction[] {
    const actions: IR.IRAction[] = [];
    
    for (const stmt of block.statements) {
      const action = this.generateStatement(stmt);
      if (action) {
        actions.push(action);
      }
    }
    
    return actions;
  }

  private generateStatement(stmt: AST.Statement): IR.IRAction | null {
    switch (stmt.type) {
      case 'let':
        return {
          type: 'let',
          name: stmt.name,
          value: this.generateExpression(stmt.value),
        };
      
      case 'assignment':
        return this.generateAssignment(stmt);
      
      case 'if':
        return this.generateIfAction(stmt);
      
      case 'for':
        return {
          type: 'loop',
          variable: stmt.variable,
          iterable: this.generateExpression(stmt.iterable),
          body: this.generateBlockActions(stmt.body),
        };
      
      case 'while':
        return {
          type: 'while',
          condition: this.generateExpression(stmt.condition),
          body: this.generateBlockActions(stmt.body),
        };
      
      case 'schedule':
        return this.generateSchedule(stmt);
      
      case 'create':
        return {
          type: 'spawn',
          components: stmt.components.map(c => this.generateComponentInit(c)),
        };
      
      case 'delete':
        return {
          type: 'despawn',
          entity: this.generateExpression(stmt.entity),
        };
      
      case 'return':
      case 'cancel':
      case 'expr':
        // These don't directly translate to IR actions
        return null;
    }
  }

  private generateAssignment(stmt: AST.AssignmentStatement): IR.IRAction | null {
    // Extract entity, component, and field from the target
    if (stmt.target.type === 'field_access') {
      const { entity, component, field } = this.extractFieldAccess(stmt.target);
      
      const op = this.convertAssignOp(stmt.op);
      
      return {
        type: 'modify',
        entity: entity,
        component,
        field,
        op,
        value: this.generateExpression(stmt.value),
      };
    }
    
    return null;
  }

  private extractFieldAccess(expr: AST.FieldAccessExpr): {
    entity: IR.IRExpression;
    component: string;
    field: string;
  } {
    const field = expr.field;
    
    if (expr.base.type === 'field_access') {
      const baseAccess = expr.base as AST.FieldAccessExpr;
      const component = baseAccess.field;
      const entity = this.generateExpression(baseAccess.base);
      return { entity, component, field };
    }
    
    // Fallback: assume entity.field format
    return {
      entity: this.generateExpression(expr.base),
      component: 'Unknown',
      field,
    };
  }

  private convertAssignOp(op: AST.AssignOp): 'set' | 'add' | 'subtract' | 'multiply' | 'divide' {
    switch (op) {
      case 'assign': return 'set';
      case 'add_assign': return 'add';
      case 'sub_assign': return 'subtract';
      case 'mul_assign': return 'multiply';
      case 'div_assign': return 'divide';
    }
  }

  private generateIfAction(stmt: AST.IfStatement): IR.IRConditionalAction {
    const thenActions = this.generateBlockActions(stmt.thenBlock);
    let elseActions: IR.IRAction[] | undefined;
    
    if (stmt.elseBlock) {
      if (stmt.elseBlock.type === 'else_if') {
        elseActions = [this.generateIfAction(stmt.elseBlock.statement)];
      } else {
        elseActions = this.generateBlockActions(stmt.elseBlock.block);
      }
    }
    
    return {
      type: 'conditional',
      condition: this.generateExpression(stmt.condition),
      then_actions: thenActions,
      else_actions: elseActions,
    };
  }

  private generateSchedule(stmt: AST.ScheduleStatement): IR.IRScheduleAction {
    const fields: Record<string, IR.IRExpression> = {};
    for (const [name, value] of stmt.fields) {
      fields[name] = this.generateExpression(value);
    }
    
    return {
      type: 'schedule',
      event: stmt.eventName,
      delay: stmt.delay ? this.generateExpression(stmt.delay) : undefined,
      fields: Object.keys(fields).length > 0 ? fields : undefined,
    };
  }

  private generateComponentInit(init: AST.ComponentInit): IR.IRComponentInit {
    const fields: Record<string, IR.IRExpression> = {};
    for (const [name, value] of init.fields) {
      fields[name] = this.generateExpression(value);
    }
    
    return {
      name: init.name,
      fields,
    };
  }

  private generateFunction(func: AST.FunctionDef): IR.IRFunction {
    const params: IR.IRParam[] = func.params.map(p => ({
      name: p.name,
      type: this.convertType(p.paramType),
    }));
    
    // Extract return expression from body
    const body = this.generateFunctionBody(func.body);
    
    return {
      id: this.functionId++,
      name: func.name,
      params,
      return_type: func.returnType ? this.convertType(func.returnType) : { type: 'number' },
      body,
    };
  }

  private generateFunctionBody(block: AST.Block): IR.IRExpression {
    // Find return statement and use its value
    for (const stmt of block.statements) {
      if (stmt.type === 'return' && stmt.value) {
        return this.generateExpression(stmt.value);
      }
    }
    
    // Default to literal 0
    return { type: 'literal', value: 0 };
  }

  private generateEntity(entity: AST.EntityDef): IR.IREntityDefinition {
    const components: Record<string, Record<string, IR.IRValue>> = {};
    
    for (const comp of entity.components) {
      const fields: Record<string, IR.IRValue> = {};
      for (const [name, value] of comp.fields) {
        fields[name] = this.expressionToValue(value);
      }
      components[comp.name] = fields;
    }
    
    const result: IR.IREntityDefinition = {
      id: this.entityId++,
      components,
    };
    
    if (entity.variable) {
      result.variable = entity.variable;
    }
    
    if (entity.boundFunctions.length > 0) {
      result.bound_functions = {};
      for (const func of entity.boundFunctions) {
        result.bound_functions[func.name] = this.generateBoundFunction(func);
      }
    }
    
    return result;
  }

  private generateBoundFunction(func: AST.BoundFunctionDef): IR.IRBoundFunction {
    const params: IR.IRParam[] = func.params.map(p => ({
      name: p.name,
      type: this.convertType(p.paramType),
    }));
    
    const body = this.generateFunctionBody(func.body);
    
    return {
      params,
      return_type: func.returnType ? this.convertType(func.returnType) : { type: 'number' },
      body,
    };
  }

  private expressionToValue(expr: AST.Expr): IR.IRValue {
    if (expr.type === 'literal') {
      switch (expr.value.type) {
        case 'string': return expr.value.value;
        case 'integer': return expr.value.value;
        case 'float': return expr.value.value;
        case 'decimal': return parseFloat(expr.value.value);
        case 'boolean': return expr.value.value;
        case 'null': return null;
      }
    }
    
    if (expr.type === 'list') {
      return expr.elements.map(e => this.expressionToValue(e));
    }
    
    // For non-literal expressions in entity fields, return null
    return null;
  }

  private generateExpression(expr: AST.Expr): IR.IRExpression {
    switch (expr.type) {
      case 'literal':
        return this.generateLiteral(expr);
      
      case 'identifier':
        return { type: 'var', name: expr.name };
      
      case 'entity_ref':
        return { type: 'var', name: `@${expr.name}` };
      
      case 'field_access':
        return this.generateFieldAccessExpr(expr);
      
      case 'index_access':
        return {
          type: 'call',
          function: 'get',
          args: [
            this.generateExpression(expr.base),
            this.generateExpression(expr.index),
          ],
        };
      
      case 'binary':
        return {
          type: 'binary',
          op: this.convertBinaryOp(expr.op),
          left: this.generateExpression(expr.left),
          right: this.generateExpression(expr.right),
        };
      
      case 'unary':
        return {
          type: 'unary',
          op: expr.op === 'neg' ? 'negate' : 'not',
          expr: this.generateExpression(expr.expr),
        };
      
      case 'call':
        return {
          type: 'call',
          function: expr.name,
          args: expr.args.map(a => this.generateExpression(a)),
        };
      
      case 'method_call':
        // Convert method calls to function calls
        return {
          type: 'call',
          function: expr.method,
          args: [
            this.generateExpression(expr.base),
            ...expr.args.map(a => this.generateExpression(a)),
          ],
        };
      
      case 'has_component':
        return {
          type: 'has_component',
          entity: this.generateExpression(expr.entity),
          component: expr.component,
        };
      
      case 'list':
        return {
          type: 'call',
          function: 'list',
          args: expr.elements.map(e => this.generateExpression(e)),
        };
      
      case 'paren':
        return this.generateExpression(expr.inner);
      
      case 'entities_having':
        return {
          type: 'call',
          function: 'entities_having',
          args: [{ type: 'literal', value: expr.component }],
        };
      
      case 'clone_entity':
        return {
          type: 'clone',
          source: this.generateExpression(expr.source),
          overrides: expr.overrides.map(o => this.generateComponentInit(o)),
        };
      
      case 'cast':
        // Casts are type hints, pass through the expression
        return this.generateExpression(expr.expr);
    }
  }

  private generateLiteral(expr: AST.LiteralExpr): IR.IRLiteralExpr {
    switch (expr.value.type) {
      case 'string':
        return { type: 'literal', value: expr.value.value };
      case 'integer':
        return { type: 'literal', value: expr.value.value };
      case 'float':
        return { type: 'literal', value: expr.value.value };
      case 'decimal':
        return { type: 'literal', value: parseFloat(expr.value.value) };
      case 'boolean':
        return { type: 'literal', value: expr.value.value };
      case 'null':
        return { type: 'literal', value: null };
    }
  }

  private generateFieldAccessExpr(expr: AST.FieldAccessExpr): IR.IRExpression {
    // Try to extract entity.component.field pattern
    if (expr.base.type === 'field_access') {
      const baseAccess = expr.base as AST.FieldAccessExpr;
      if (baseAccess.base.type === 'identifier') {
        return {
          type: 'field',
          entity: baseAccess.base.name,
          component: baseAccess.field,
          field: expr.field,
        };
      }
    }
    
    // Fallback to var reference
    return { type: 'var', name: expr.field };
  }

  private convertBinaryOp(op: AST.BinaryOp): IR.BinaryOp {
    switch (op) {
      case 'add': return 'add';
      case 'sub': return 'subtract';
      case 'mul': return 'multiply';
      case 'div': return 'divide';
      case 'mod': return 'modulo';
      case 'eq': return 'eq';
      case 'neq': return 'neq';
      case 'lt': return 'lt';
      case 'lte': return 'lte';
      case 'gt': return 'gt';
      case 'gte': return 'gte';
      case 'and': return 'and';
      case 'or': return 'or';
    }
  }

  private generateChoicePoint(func: AST.FunctionDef, irFunc: IR.IRFunction): IR.IRChoicePoint {
    const paramStrs = irFunc.params.map(p => `${p.name}: ${this.typeToString(p.type)}`);
    
    return {
      id: func.name,
      name: this.humanizeName(func.name),
      signature: `choice fn ${func.name}(${paramStrs.join(', ')}): ${this.typeToString(irFunc.return_type)}`,
      params: irFunc.params,
      return_type: irFunc.return_type,
      category: this.categorizeFunction(func.name),
    };
  }

  private generateBoundChoicePoint(
    func: AST.BoundFunctionDef,
    irFunc: IR.IRBoundFunction,
    entity: AST.EntityDef
  ): IR.IRChoicePoint {
    const paramStrs = irFunc.params.map(p => `${p.name}: ${this.typeToString(p.type)}`);
    
    // Try to extract class from Character component
    let applicableClasses: string[] | undefined;
    const charComp = entity.components.find(c => c.name === 'Character');
    if (charComp) {
      const classField = charComp.fields.find(([name]) => name === 'class');
      if (classField && classField[1].type === 'literal' && classField[1].value.type === 'string') {
        applicableClasses = [classField[1].value.value];
      }
    }
    
    return {
      id: func.name,
      name: this.humanizeName(func.name),
      signature: `choice fn ${func.name}(${paramStrs.join(', ')}): ${this.typeToString(irFunc.return_type)}`,
      params: irFunc.params,
      return_type: irFunc.return_type,
      category: this.categorizeFunction(func.name),
      applicable_classes: applicableClasses,
    };
  }

  private deduplicateChoicePoints(choicePoints: IR.IRChoicePoint[]): IR.IRChoicePoint[] {
    const seen = new Map<string, IR.IRChoicePoint>();
    
    for (const cp of choicePoints) {
      if (!seen.has(cp.id)) {
        seen.set(cp.id, cp);
      }
    }
    
    return Array.from(seen.values()).sort((a, b) => a.id.localeCompare(b.id));
  }

  private humanizeName(name: string): string {
    return name
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }

  private categorizeFunction(name: string): string | undefined {
    if (name.includes('target')) return 'targeting';
    if (name.includes('skill')) return 'skills';
    if (name.includes('flee') || name.includes('retreat')) return 'strategy';
    return undefined;
  }

  private typeToString(type: IR.IRType): string {
    switch (type.type) {
      case 'string': return 'string';
      case 'boolean': return 'boolean';
      case 'number': return 'number';
      case 'entity': return 'id';
      case 'list': return `list<${this.typeToString(type.element)}>`;
      case 'map': return `map<${this.typeToString(type.key)}, ${this.typeToString(type.value)}>`;
    }
  }
}

/**
 * Generate IR from AST modules
 */
export function generate(modules: AST.Module[], options: GeneratorOptions = {}): IR.IRModule {
  const generator = new CodeGenerator(options);
  return generator.generate(modules);
}
