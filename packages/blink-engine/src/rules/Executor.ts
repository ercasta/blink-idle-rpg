/**
 * Rule Executor
 * Executes IR rules against the game state
 */

import { Store, EntityId, ComponentData } from '../ecs/Store';
import { Timeline, ScheduledEvent } from '../timeline/Timeline';
import {
  IRRule,
  IRAction,
  IRExpression,
  IRFunction,
  IRFieldValue,
  BinaryOp,
  IRModifyAction,
  IRScheduleAction,
  IREmitAction,
  IRDespawnAction,
} from '../ir/types';

export interface ExecutionContext {
  store: Store;
  timeline: Timeline;
  event: ScheduledEvent;
  bindings: Map<string, EntityId>;
  params: Map<string, IRFieldValue>;
  functions: Map<string, IRFunction>;
}

/**
 * Execute rules against an event
 */
export class RuleExecutor {
  private rules: IRRule[] = [];
  private functions: Map<string, IRFunction> = new Map();

  /**
   * Load rules from IR
   */
  loadRules(rules: IRRule[]): void {
    this.rules = rules;
  }

  /**
   * Load functions from IR
   */
  loadFunctions(functions: IRFunction[]): void {
    this.functions.clear();
    for (const fn of functions) {
      this.functions.set(fn.name, fn);
    }
  }

  /**
   * Get rules that match an event
   */
  getMatchingRules(eventType: string): IRRule[] {
    return this.rules.filter(rule => {
      if (rule.trigger.type === 'event') {
        return rule.trigger.event === eventType;
      }
      return false;
    });
  }

  /**
   * Execute a rule against an event and entity
   */
  executeRule(
    rule: IRRule,
    event: ScheduledEvent,
    store: Store,
    timeline: Timeline
  ): void {
    // Get entities that match the filter
    const entities = this.getFilteredEntities(rule, store, event);

    for (const entityId of entities) {
      // Create context with bindings
      const bindings = this.createBindings(rule, event, entityId);
      
      const context: ExecutionContext = {
        store,
        timeline,
        event,
        bindings,
        params: new Map(),
        functions: this.functions,
      };

      // Check condition
      if (rule.condition) {
        const conditionResult = this.evaluateExpression(rule.condition, context);
        if (!conditionResult) {
          continue;
        }
      }

      // Execute actions
      for (const action of rule.actions) {
        this.executeAction(action, context);
      }
    }
  }

  private getFilteredEntities(
    rule: IRRule,
    store: Store,
    event: ScheduledEvent
  ): EntityId[] {
    // Check if this rule binds the source entity explicitly
    // If it does, we should only process the source entity
    const bindsSource = rule.trigger.bindings && 
      Object.values(rule.trigger.bindings).includes('source');
    
    // If we have a source entity and the rule binds from source, use that
    if (bindsSource && event.source !== undefined && store.hasEntity(event.source)) {
      const components = rule.filter?.components || [];
      let hasAll = true;
      for (const comp of components) {
        if (!store.hasComponent(event.source, comp)) {
          hasAll = false;
          break;
        }
      }
      if (hasAll) {
        return [event.source];
      }
      return [];
    }

    // Check if the rule binds from event.fields
    // If it does, we should only process the bound entity
    if (rule.trigger.bindings && event.fields) {
      for (const source of Object.values(rule.trigger.bindings)) {
        // Skip standard bindings
        if (source === 'source' || source === 'target') continue;
        
        // Check if this binding source exists in event.fields
        if (source in event.fields) {
          const boundEntityId = event.fields[source];
          if (typeof boundEntityId === 'number' && store.hasEntity(boundEntityId)) {
            const components = rule.filter?.components || [];
            let hasAll = true;
            for (const comp of components) {
              if (!store.hasComponent(boundEntityId, comp)) {
                hasAll = false;
                break;
              }
            }
            if (hasAll) {
              return [boundEntityId];
            }
            return [];
          }
        }
      }
    }

    // Otherwise query for entities with required components
    if (rule.filter?.components && rule.filter.components.length > 0) {
      return store.query(...rule.filter.components);
    }

    // No filter - return all entities
    return store.getEntityIds();
  }

  private createBindings(
    rule: IRRule,
    event: ScheduledEvent,
    entityId: EntityId
  ): Map<string, EntityId> {
    const bindings = new Map<string, EntityId>();

    // Bind 'entity' to the current entity being processed
    bindings.set('entity', entityId);

    // Handle trigger bindings
    if (rule.trigger.bindings) {
      for (const [varName, source] of Object.entries(rule.trigger.bindings)) {
        if (source === 'source' && event.source !== undefined) {
          bindings.set(varName, event.source);
        } else if (source === 'target' && event.target !== undefined) {
          bindings.set(varName, event.target);
        } else if (event.fields && source in event.fields) {
          // Also check event.fields for the binding source
          // This allows emit actions with fields to work with trigger bindings
          const fieldValue = event.fields[source];
          if (typeof fieldValue === 'number') {
            bindings.set(varName, fieldValue);
          }
        }
      }
    }

    return bindings;
  }

  /**
   * Execute a single action
   */
  private executeAction(action: IRAction, context: ExecutionContext): void {
    switch (action.type) {
      case 'modify':
        this.executeModify(action, context);
        break;
      case 'schedule':
        this.executeSchedule(action, context);
        break;
      case 'emit':
        this.executeEmit(action, context);
        break;
      case 'despawn':
        this.executeDespawn(action, context);
        break;
      default:
        console.warn(`Unknown action type: ${(action as IRAction).type}`);
    }
  }

  private executeModify(action: IRModifyAction, context: ExecutionContext): void {
    const entityId = this.evaluateEntityExpression(action.entity, context);
    if (entityId === null) {
      return;
    }

    const currentValue = context.store.getField(entityId, action.component, action.field);
    const modifyValue = this.evaluateExpression(action.value, context);

    let newValue: IRFieldValue;

    switch (action.op) {
      case 'set':
        newValue = modifyValue;
        break;
      case 'add':
        newValue = (currentValue as number || 0) + (modifyValue as number);
        break;
      case 'subtract':
        newValue = (currentValue as number || 0) - (modifyValue as number);
        break;
      case 'multiply':
        newValue = (currentValue as number || 0) * (modifyValue as number);
        break;
      case 'divide':
        newValue = (currentValue as number || 0) / (modifyValue as number);
        break;
      default:
        throw new Error(`Unknown modify op: ${action.op}`);
    }

    context.store.setField(entityId, action.component, action.field, newValue);
  }

  private executeSchedule(action: IRScheduleAction, context: ExecutionContext): void {
    const delay = action.delay
      ? (this.evaluateExpression(action.delay, context) as number)
      : 0;

    const source = action.source
      ? this.evaluateEntityExpression(action.source, context)
      : undefined;

    const target = action.target
      ? this.evaluateEntityExpression(action.target, context)
      : undefined;

    // Evaluate any additional fields
    const fields: Record<string, IRFieldValue> = {};
    if (action.fields) {
      for (const [key, expr] of Object.entries(action.fields)) {
        fields[key] = this.evaluateExpression(expr, context);
      }
    }

    context.timeline.schedule(action.event, delay, {
      source: source ?? undefined,
      target: target ?? undefined,
      fields: Object.keys(fields).length > 0 ? fields : undefined,
    });
  }

  private executeEmit(action: IREmitAction, context: ExecutionContext): void {
    // Evaluate any additional fields
    const fields: Record<string, IRFieldValue> = {};
    if (action.fields) {
      for (const [key, expr] of Object.entries(action.fields)) {
        fields[key] = this.evaluateExpression(expr, context);
      }
    }

    context.timeline.scheduleImmediate(action.event, {
      fields: Object.keys(fields).length > 0 ? fields : undefined,
    });
  }

  private executeDespawn(action: IRDespawnAction, context: ExecutionContext): void {
    const entityId = this.evaluateEntityExpression(action.entity, context);
    if (entityId !== null) {
      context.store.deleteEntity(entityId);
    }
  }

  /**
   * Evaluate an expression and return entity ID
   */
  private evaluateEntityExpression(expr: IRExpression, context: ExecutionContext): EntityId | null {
    if (expr.type === 'var') {
      const entityId = context.bindings.get(expr.name);
      return entityId !== undefined ? entityId : null;
    }
    
    if (expr.type === 'field') {
      // Field access that returns an entity ID
      const entityRef = typeof expr.entity === 'string'
        ? context.bindings.get(expr.entity)
        : this.evaluateEntityExpression(expr.entity, context);
      
      if (entityRef === null || entityRef === undefined) {
        return null;
      }
      
      const value = context.store.getField(entityRef, expr.component, expr.field);
      if (typeof value === 'number') {
        return value;
      }
      return null;
    }

    if (expr.type === 'literal') {
      if (typeof expr.value === 'number') {
        return expr.value;
      }
      return null;
    }

    return null;
  }

  /**
   * Evaluate an expression
   */
  evaluateExpression(expr: IRExpression, context: ExecutionContext): IRFieldValue {
    switch (expr.type) {
      case 'literal':
        return expr.value;

      case 'var': {
        const entityId = context.bindings.get(expr.name);
        return entityId !== undefined ? entityId : null;
      }

      case 'param': {
        return context.params.get(expr.name) ?? null;
      }

      case 'field': {
        const entityRef = typeof expr.entity === 'string'
          ? context.bindings.get(expr.entity)
          : this.evaluateEntityExpression(expr.entity as IRExpression, context);
        
        if (entityRef === null || entityRef === undefined) {
          return null;
        }
        
        return context.store.getField(entityRef, expr.component, expr.field) ?? null;
      }

      case 'binary':
        return this.evaluateBinaryOp(
          expr.op,
          this.evaluateExpression(expr.left, context),
          this.evaluateExpression(expr.right, context)
        );

      case 'unary':
        return this.evaluateUnaryOp(expr.op, this.evaluateExpression(expr.expr, context));

      case 'call':
        return this.evaluateCall(expr.function, expr.args, context);

      case 'if': {
        const condition = this.evaluateExpression(expr.condition, context);
        if (condition) {
          return this.evaluateExpression(expr.then, context);
        }
        return this.evaluateExpression(expr.else, context);
      }

      default:
        throw new Error(`Unknown expression type: ${(expr as IRExpression).type}`);
    }
  }

  private evaluateBinaryOp(op: BinaryOp, left: IRFieldValue, right: IRFieldValue): IRFieldValue {
    switch (op) {
      // Arithmetic
      case 'add':
        return (left as number) + (right as number);
      case 'subtract':
        return (left as number) - (right as number);
      case 'multiply':
        return (left as number) * (right as number);
      case 'divide':
        return (left as number) / (right as number);
      case 'modulo':
        return (left as number) % (right as number);

      // Comparison
      case 'eq':
        return left === right;
      case 'neq':
        return left !== right;
      case 'lt':
        return (left as number) < (right as number);
      case 'lte':
        return (left as number) <= (right as number);
      case 'gt':
        return (left as number) > (right as number);
      case 'gte':
        return (left as number) >= (right as number);

      // Logical
      case 'and':
        return Boolean(left) && Boolean(right);
      case 'or':
        return Boolean(left) || Boolean(right);

      default:
        throw new Error(`Unknown binary op: ${op}`);
    }
  }

  private evaluateUnaryOp(op: 'not' | 'neg', value: IRFieldValue): IRFieldValue {
    switch (op) {
      case 'not':
        return !value;
      case 'neg':
        return -(value as number);
      default:
        throw new Error(`Unknown unary op: ${op}`);
    }
  }

  private evaluateCall(
    functionName: string,
    args: IRExpression[],
    context: ExecutionContext
  ): IRFieldValue {
    // Built-in functions
    const evaluatedArgs = args.map(arg => this.evaluateExpression(arg, context));

    switch (functionName) {
      case 'min':
        return Math.min(evaluatedArgs[0] as number, evaluatedArgs[1] as number);
      case 'max':
        return Math.max(evaluatedArgs[0] as number, evaluatedArgs[1] as number);
      case 'floor':
        return Math.floor(evaluatedArgs[0] as number);
      case 'ceil':
        return Math.ceil(evaluatedArgs[0] as number);
      case 'round':
        return Math.round(evaluatedArgs[0] as number);
      case 'abs':
        return Math.abs(evaluatedArgs[0] as number);
      case 'random':
        return Math.random();
      case 'random_range': {
        const min = evaluatedArgs[0] as number;
        const max = evaluatedArgs[1] as number;
        return min + Math.random() * (max - min);
      }
      case 'len':
        return Array.isArray(evaluatedArgs[0]) ? evaluatedArgs[0].length : 0;
    }

    // User-defined functions
    const fn = context.functions.get(functionName);
    if (fn) {
      // Create new params map with function arguments
      const params = new Map<string, IRFieldValue>();
      for (let i = 0; i < fn.params.length; i++) {
        params.set(fn.params[i].name, evaluatedArgs[i] ?? null);
      }

      const fnContext: ExecutionContext = {
        ...context,
        params,
      };

      return this.evaluateExpression(fn.body, fnContext);
    }

    throw new Error(`Unknown function: ${functionName}`);
  }
}
