/**
 * Blink Engine Browser Bundle
 * Auto-generated from TypeScript source - DO NOT EDIT MANUALLY
 * Build date: 2026-01-06T12:36:12.241Z
 */

"use strict";
var BlinkEngine = (() => {
  var __defProp = Object.defineProperty;
  var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  var __export = (target, all) => {
    for (var name in all)
      __defProp(target, name, { get: all[name], enumerable: true });
  };
  var __copyProps = (to, from, except, desc) => {
    if (from && typeof from === "object" || typeof from === "function") {
      for (let key of __getOwnPropNames(from))
        if (!__hasOwnProp.call(to, key) && key !== except)
          __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
    }
    return to;
  };
  var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

  // src/index.ts
  var src_exports = {};
  __export(src_exports, {
    BlinkGame: () => BlinkGame,
    RuleExecutor: () => RuleExecutor,
    Store: () => Store,
    Timeline: () => Timeline,
    loadIR: () => loadIR,
    loadIRFromObject: () => loadIRFromObject,
    loadIRFromString: () => loadIRFromString
  });

  // src/ecs/Store.ts
  var Store = class {
    constructor() {
      this.entities = /* @__PURE__ */ new Map();
      this.nextId = 0;
      this.componentDefaults = /* @__PURE__ */ new Map();
    }
    /**
     * Set default values for a component type
     */
    setComponentDefaults(componentName, defaults) {
      this.componentDefaults.set(componentName, { ...defaults });
    }
    /**
     * Create a new entity
     */
    createEntity(id) {
      const entityId = id !== void 0 ? id : this.nextId++;
      if (entityId >= this.nextId) {
        this.nextId = entityId + 1;
      }
      this.entities.set(entityId, {
        id: entityId,
        components: /* @__PURE__ */ new Map()
      });
      return entityId;
    }
    /**
     * Clone an entity (deep copy of all components)
     * @param sourceId - The entity to clone
     * @param targetId - Optional ID for the new entity
     * @returns The ID of the cloned entity
     */
    cloneEntity(sourceId, targetId) {
      const sourceEntity = this.entities.get(sourceId);
      if (!sourceEntity) {
        throw new Error(`Source entity ${sourceId} not found`);
      }
      const newId = this.createEntity(targetId);
      for (const [componentName, componentData] of sourceEntity.components) {
        const clonedData = this.deepClone(componentData);
        this.addComponent(newId, componentName, clonedData);
      }
      return newId;
    }
    /**
     * Deep clone a value (handles nested objects and arrays)
     */
    deepClone(value) {
      if (value === null || typeof value !== "object") {
        return value;
      }
      if (Array.isArray(value)) {
        return value.map((item) => this.deepClone(item));
      }
      const cloned = {};
      for (const key in value) {
        if (value.hasOwnProperty(key)) {
          cloned[key] = this.deepClone(value[key]);
        }
      }
      return cloned;
    }
    /**
     * Delete an entity and all its components
     */
    deleteEntity(id) {
      return this.entities.delete(id);
    }
    /**
     * Check if entity exists
     */
    hasEntity(id) {
      return this.entities.has(id);
    }
    /**
     * Get all entity IDs
     */
    getEntityIds() {
      return Array.from(this.entities.keys());
    }
    /**
     * Add a component to an entity
     */
    addComponent(entityId, componentName, data) {
      const entity = this.entities.get(entityId);
      if (!entity) {
        throw new Error(`Entity ${entityId} not found`);
      }
      const defaults = this.componentDefaults.get(componentName) || {};
      entity.components.set(componentName, { ...defaults, ...data });
    }
    /**
     * Remove a component from an entity
     */
    removeComponent(entityId, componentName) {
      const entity = this.entities.get(entityId);
      if (!entity) {
        return false;
      }
      return entity.components.delete(componentName);
    }
    /**
     * Check if entity has a component
     */
    hasComponent(entityId, componentName) {
      const entity = this.entities.get(entityId);
      if (!entity) {
        return false;
      }
      return entity.components.has(componentName);
    }
    /**
     * Get a component from an entity
     */
    getComponent(entityId, componentName) {
      const entity = this.entities.get(entityId);
      if (!entity) {
        return void 0;
      }
      return entity.components.get(componentName);
    }
    /**
     * Get a field value from an entity's component
     */
    getField(entityId, componentName, fieldName) {
      const component = this.getComponent(entityId, componentName);
      if (!component) {
        return void 0;
      }
      return component[fieldName];
    }
    /**
     * Set a field value in an entity's component
     */
    setField(entityId, componentName, fieldName, value) {
      const entity = this.entities.get(entityId);
      if (!entity) {
        throw new Error(`Entity ${entityId} not found`);
      }
      let component = entity.components.get(componentName);
      if (!component) {
        const defaults = this.componentDefaults.get(componentName) || {};
        component = { ...defaults };
        entity.components.set(componentName, component);
      }
      component[fieldName] = value;
    }
    /**
     * Query entities that have all specified components
     */
    query(...componentNames) {
      const results = [];
      for (const [id, entity] of this.entities) {
        let hasAll = true;
        for (const name of componentNames) {
          if (!entity.components.has(name)) {
            hasAll = false;
            break;
          }
        }
        if (hasAll) {
          results.push(id);
        }
      }
      return results;
    }
    /**
     * Get all components for an entity
     */
    getEntityComponents(entityId) {
      const entity = this.entities.get(entityId);
      return entity?.components;
    }
    /**
     * Create a snapshot of the current state
     */
    getSnapshot() {
      const snapshot = /* @__PURE__ */ new Map();
      for (const [id, entity] of this.entities) {
        const componentsCopy = /* @__PURE__ */ new Map();
        for (const [name, data] of entity.components) {
          componentsCopy.set(name, { ...data });
        }
        snapshot.set(id, componentsCopy);
      }
      return snapshot;
    }
    /**
     * Clear all entities
     */
    clear() {
      this.entities.clear();
      this.nextId = 0;
    }
  };

  // src/timeline/Timeline.ts
  var Timeline = class {
    constructor() {
      this.events = [];
      this.currentTime = 0;
      this.nextEventId = 0;
      this.nextSequence = 0;
    }
    /**
     * Get the current simulation time
     */
    getTime() {
      return this.currentTime;
    }
    /**
     * Set the current simulation time
     */
    setTime(time) {
      this.currentTime = time;
    }
    /**
     * Schedule an event at current time + delay
     */
    schedule(eventType, delay = 0, options = {}) {
      return this.scheduleAt(eventType, this.currentTime + delay, options);
    }
    /**
     * Schedule an event at an absolute time
     */
    scheduleAt(eventType, time, options = {}) {
      const event = {
        id: this.nextEventId++,
        eventType,
        time: Math.max(time, this.currentTime),
        // Can't schedule in the past
        source: options.source,
        target: options.target,
        fields: options.fields,
        sequence: this.nextSequence++,
        recurring: options.recurring,
        interval: options.interval
      };
      this.insert(event);
      return event.id;
    }
    /**
     * Schedule an immediate event (processed this tick)
     */
    scheduleImmediate(eventType, options = {}) {
      return this.scheduleAt(eventType, this.currentTime, options);
    }
    /**
     * Schedule a recurring event
     * The event will automatically reschedule itself after each execution
     * Returns the event ID which can be used to cancel the recurring event
     */
    scheduleRecurring(eventType, interval, options = {}) {
      const startTime = this.currentTime + (options.delay ?? 0);
      return this.scheduleAt(eventType, startTime, {
        source: options.source,
        target: options.target,
        fields: options.fields,
        recurring: true,
        interval
      });
    }
    /**
     * Get the next event without removing it
     */
    peek() {
      return this.events[0];
    }
    /**
     * Remove and return the next event
     */
    pop() {
      if (this.events.length === 0) {
        return void 0;
      }
      const result = this.events[0];
      const last = this.events.pop();
      if (this.events.length > 0) {
        this.events[0] = last;
        this.siftDown(0);
      }
      this.currentTime = result.time;
      if (result.recurring && result.interval && result.interval > 0) {
        const nextEvent = {
          id: result.id,
          // Reuse the same ID
          eventType: result.eventType,
          time: result.time + result.interval,
          source: result.source,
          target: result.target,
          fields: result.fields,
          sequence: this.nextSequence++,
          recurring: true,
          interval: result.interval
        };
        this.insert(nextEvent);
      }
      return result;
    }
    /**
     * Check if there are any events scheduled
     */
    hasEvents() {
      return this.events.length > 0;
    }
    /**
     * Get the number of scheduled events
     */
    getEventCount() {
      return this.events.length;
    }
    /**
     * Cancel an event by ID
     * Returns true if the event was found and removed
     */
    cancel(eventId) {
      const index = this.events.findIndex((e) => e.id === eventId);
      if (index === -1) {
        return false;
      }
      const last = this.events.pop();
      if (index < this.events.length) {
        this.events[index] = last;
        this.siftDown(index);
        this.siftUp(index);
      }
      return true;
    }
    /**
     * Clear all scheduled events
     */
    clear() {
      this.events = [];
      this.currentTime = 0;
      this.nextSequence = 0;
    }
    /**
     * Get all events (for debugging)
     */
    getAllEvents() {
      return [...this.events].sort((a, b) => {
        if (a.time !== b.time)
          return a.time - b.time;
        return a.sequence - b.sequence;
      });
    }
    // ===== Heap operations =====
    insert(event) {
      this.events.push(event);
      this.siftUp(this.events.length - 1);
    }
    siftUp(index) {
      while (index > 0) {
        const parentIndex = Math.floor((index - 1) / 2);
        if (this.compare(this.events[index], this.events[parentIndex]) >= 0) {
          break;
        }
        this.swap(index, parentIndex);
        index = parentIndex;
      }
    }
    siftDown(index) {
      const length = this.events.length;
      while (true) {
        const leftChild = 2 * index + 1;
        const rightChild = 2 * index + 2;
        let smallest = index;
        if (leftChild < length && this.compare(this.events[leftChild], this.events[smallest]) < 0) {
          smallest = leftChild;
        }
        if (rightChild < length && this.compare(this.events[rightChild], this.events[smallest]) < 0) {
          smallest = rightChild;
        }
        if (smallest === index) {
          break;
        }
        this.swap(index, smallest);
        index = smallest;
      }
    }
    compare(a, b) {
      if (a.time !== b.time) {
        return a.time - b.time;
      }
      return a.sequence - b.sequence;
    }
    swap(i, j) {
      [this.events[i], this.events[j]] = [this.events[j], this.events[i]];
    }
  };

  // src/rules/Executor.ts
  var MAX_WHILE_ITERATIONS = 1e4;
  var RuleExecutor = class {
    constructor() {
      this.rules = [];
      this.functions = /* @__PURE__ */ new Map();
    }
    /**
     * Load rules from IR
     */
    loadRules(rules) {
      this.rules = rules;
    }
    /**
     * Load functions from IR
     */
    loadFunctions(functions) {
      this.functions.clear();
      for (const fn of functions) {
        this.functions.set(fn.name, fn);
      }
    }
    /**
     * Get rules that match an event
     */
    getMatchingRules(eventType) {
      return this.rules.filter((rule) => {
        if (rule.trigger.type === "event") {
          return rule.trigger.event === eventType;
        }
        return false;
      });
    }
    /**
     * Execute a rule against an event and entity
     */
    executeRule(rule, event, store, timeline, traceCallback) {
      const entities = this.getFilteredEntities(rule, store, event);
      for (const entityId of entities) {
        const bindings = this.createBindings(rule, event, entityId);
        const context = {
          store,
          timeline,
          event,
          bindings,
          params: /* @__PURE__ */ new Map(),
          functions: this.functions,
          locals: /* @__PURE__ */ new Map(),
          // Initialize empty locals map
          traceCallback
          // Pass trace callback through context
        };
        if (rule.condition) {
          const conditionResult = this.evaluateExpression(rule.condition, context);
          if (!conditionResult) {
            continue;
          }
        }
        for (const action of rule.actions) {
          this.executeAction(action, context);
        }
      }
    }
    /**
     * Check if an entity has all required filter components
     */
    hasFilterComponents(entityId, store, filter) {
      const components = filter?.components || [];
      for (const comp of components) {
        if (!store.hasComponent(entityId, comp)) {
          return false;
        }
      }
      return true;
    }
    getFilteredEntities(rule, store, event) {
      const bindsSource = rule.trigger.bindings && Object.values(rule.trigger.bindings).includes("source");
      if (bindsSource && event.source !== void 0 && store.hasEntity(event.source)) {
        if (this.hasFilterComponents(event.source, store, rule.filter)) {
          return [event.source];
        }
        return [];
      }
      if (rule.trigger.bindings && event.fields) {
        for (const source of Object.values(rule.trigger.bindings)) {
          if (source === "source" || source === "target")
            continue;
          if (source in event.fields) {
            const boundEntityId = event.fields[source];
            if (typeof boundEntityId === "number" && store.hasEntity(boundEntityId)) {
              if (this.hasFilterComponents(boundEntityId, store, rule.filter)) {
                return [boundEntityId];
              }
              return [];
            }
          }
        }
      }
      if (rule.filter?.components && rule.filter.components.length > 0) {
        return store.query(...rule.filter.components);
      }
      return store.getEntityIds();
    }
    createBindings(rule, event, entityId) {
      const bindings = /* @__PURE__ */ new Map();
      bindings.set("entity", entityId);
      if (rule.trigger.bindings) {
        for (const [varName, source] of Object.entries(rule.trigger.bindings)) {
          if (source === "source" && event.source !== void 0) {
            bindings.set(varName, event.source);
          } else if (source === "target" && event.target !== void 0) {
            bindings.set(varName, event.target);
          } else if (event.fields && source in event.fields) {
            const fieldValue = event.fields[source];
            if (typeof fieldValue === "number") {
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
    executeAction(action, context) {
      switch (action.type) {
        case "modify":
          this.executeModify(action, context);
          break;
        case "schedule":
          this.executeSchedule(action, context);
          break;
        case "emit":
          this.executeEmit(action, context);
          break;
        case "despawn":
          this.executeDespawn(action, context);
          break;
        case "conditional":
          this.executeConditional(action, context);
          break;
        case "loop":
          this.executeLoop(action, context);
          break;
        case "let":
          this.executeLet(action, context);
          break;
        case "while":
          this.executeWhile(action, context);
          break;
        default:
          console.warn(`Unknown action type: ${action.type}`);
      }
    }
    executeLet(action, context) {
      const value = this.evaluateExpression(action.value, context);
      context.locals.set(action.name, value);
    }
    executeConditional(action, context) {
      const condition = this.evaluateExpression(action.condition, context);
      if (condition) {
        for (const thenAction of action.then_actions) {
          this.executeAction(thenAction, context);
        }
      } else if (action.else_actions) {
        for (const elseAction of action.else_actions) {
          this.executeAction(elseAction, context);
        }
      }
    }
    executeLoop(action, context) {
      const iterable = this.evaluateExpression(action.iterable, context);
      if (!Array.isArray(iterable)) {
        console.warn(`Loop iterable is not an array: ${typeof iterable}`);
        return;
      }
      for (const item of iterable) {
        const fieldValue = this.toFieldValue(item);
        context.locals.set(action.variable, fieldValue);
        for (const bodyAction of action.body) {
          this.executeAction(bodyAction, context);
        }
      }
    }
    /**
     * Convert an unknown value to IRFieldValue, returning null for invalid values
     */
    toFieldValue(value) {
      if (value === null)
        return null;
      if (typeof value === "number")
        return value;
      if (typeof value === "string")
        return value;
      if (typeof value === "boolean")
        return value;
      if (Array.isArray(value))
        return value;
      if (typeof value === "object")
        return value;
      return null;
    }
    executeWhile(action, context) {
      let iterations = 0;
      while (this.evaluateExpression(action.condition, context) && iterations < MAX_WHILE_ITERATIONS) {
        for (const bodyAction of action.body) {
          this.executeAction(bodyAction, context);
        }
        iterations++;
      }
      if (iterations >= MAX_WHILE_ITERATIONS) {
        console.warn(`While loop exceeded maximum iterations (${MAX_WHILE_ITERATIONS}), stopping`);
      }
    }
    executeModify(action, context) {
      const entityId = this.evaluateEntityExpression(action.entity, context);
      if (entityId === null) {
        return;
      }
      const currentValue = context.store.getField(entityId, action.component, action.field);
      const modifyValue = this.evaluateExpression(action.value, context);
      let newValue;
      switch (action.op) {
        case "set":
          newValue = modifyValue;
          break;
        case "add":
          newValue = (currentValue || 0) + modifyValue;
          break;
        case "subtract":
          newValue = (currentValue || 0) - modifyValue;
          break;
        case "multiply":
          newValue = (currentValue || 0) * modifyValue;
          break;
        case "divide":
          newValue = (currentValue || 0) / modifyValue;
          break;
        default:
          throw new Error(`Unknown modify op: ${action.op}`);
      }
      context.store.setField(entityId, action.component, action.field, newValue);
    }
    executeSchedule(action, context) {
      const delay = action.delay ? this.evaluateExpression(action.delay, context) : 0;
      const source = action.source ? this.evaluateEntityExpression(action.source, context) : void 0;
      const target = action.target ? this.evaluateEntityExpression(action.target, context) : void 0;
      const fields = {};
      if (action.fields) {
        for (const [key, expr] of Object.entries(action.fields)) {
          fields[key] = this.evaluateExpression(expr, context);
        }
      }
      context.timeline.schedule(action.event, delay, {
        source: source ?? void 0,
        target: target ?? void 0,
        fields: Object.keys(fields).length > 0 ? fields : void 0
      });
      if (context.traceCallback) {
        const targetTime = context.timeline.getTime() + delay;
        context.traceCallback(
          "event_scheduled",
          `Scheduled ${action.event} at time ${targetTime.toFixed(2)}s (delay: ${delay}s)${source !== void 0 ? ` from entity ${source}` : ""}${target !== void 0 ? ` to entity ${target}` : ""}`,
          action
        );
      }
    }
    executeEmit(action, context) {
      const fields = {};
      if (action.fields) {
        for (const [key, expr] of Object.entries(action.fields)) {
          fields[key] = this.evaluateExpression(expr, context);
        }
      }
      context.timeline.scheduleImmediate(action.event, {
        fields: Object.keys(fields).length > 0 ? fields : void 0
      });
      if (context.traceCallback) {
        context.traceCallback(
          "event_scheduled",
          `Emitted ${action.event} immediately (at current time)`,
          action
        );
      }
    }
    executeDespawn(action, context) {
      const entityId = this.evaluateEntityExpression(action.entity, context);
      if (entityId !== null) {
        context.store.deleteEntity(entityId);
      }
    }
    /**
     * Evaluate an expression and return entity ID
     */
    evaluateEntityExpression(expr, context) {
      if (expr.type === "var") {
        if (context.locals.has(expr.name)) {
          const value = context.locals.get(expr.name);
          if (typeof value === "number") {
            return value;
          }
          return null;
        }
        const entityId = context.bindings.get(expr.name);
        return entityId !== void 0 ? entityId : null;
      }
      if (expr.type === "field") {
        const entityRef = typeof expr.entity === "string" ? context.bindings.get(expr.entity) : this.evaluateEntityExpression(expr.entity, context);
        if (entityRef === null || entityRef === void 0) {
          return null;
        }
        const value = context.store.getField(entityRef, expr.component, expr.field);
        if (typeof value === "number") {
          return value;
        }
        return null;
      }
      if (expr.type === "literal") {
        if (typeof expr.value === "number") {
          return expr.value;
        }
        return null;
      }
      if (expr.type === "clone") {
        const result = this.evaluateExpression(expr, context);
        if (typeof result === "number") {
          return result;
        }
        return null;
      }
      return null;
    }
    /**
     * Evaluate an expression
     */
    evaluateExpression(expr, context) {
      switch (expr.type) {
        case "literal":
          return expr.value;
        case "var": {
          if (context.locals.has(expr.name)) {
            return context.locals.get(expr.name);
          }
          const entityId = context.bindings.get(expr.name);
          return entityId !== void 0 ? entityId : null;
        }
        case "param": {
          return context.params.get(expr.name) ?? null;
        }
        case "field": {
          const entityRef = typeof expr.entity === "string" ? context.bindings.get(expr.entity) : this.evaluateEntityExpression(expr.entity, context);
          if (entityRef === null || entityRef === void 0) {
            return null;
          }
          return context.store.getField(entityRef, expr.component, expr.field) ?? null;
        }
        case "binary":
          return this.evaluateBinaryOp(
            expr.op,
            this.evaluateExpression(expr.left, context),
            this.evaluateExpression(expr.right, context)
          );
        case "unary":
          return this.evaluateUnaryOp(expr.op, this.evaluateExpression(expr.expr, context));
        case "call":
          return this.evaluateCall(expr.function, expr.args, context);
        case "if": {
          const condition = this.evaluateExpression(expr.condition, context);
          if (condition) {
            return this.evaluateExpression(expr.then, context);
          }
          return this.evaluateExpression(expr.else, context);
        }
        case "clone": {
          const sourceId = this.evaluateEntityExpression(expr.source, context);
          if (sourceId === null) {
            throw new Error("Clone source entity is null");
          }
          const newId = context.store.cloneEntity(sourceId);
          if (expr.overrides && expr.overrides.length > 0) {
            for (const componentInit of expr.overrides) {
              const componentData = {};
              for (const [fieldName, fieldExpr] of Object.entries(componentInit.fields)) {
                componentData[fieldName] = this.evaluateExpression(fieldExpr, context);
              }
              context.store.addComponent(newId, componentInit.name, componentData);
            }
          }
          return newId;
        }
        default:
          throw new Error(`Unknown expression type: ${expr.type}`);
      }
    }
    evaluateBinaryOp(op, left, right) {
      switch (op) {
        case "add":
          return left + right;
        case "subtract":
          return left - right;
        case "multiply":
          return left * right;
        case "divide":
          return left / right;
        case "modulo":
          return left % right;
        case "eq":
          return left === right;
        case "neq":
          return left !== right;
        case "lt":
          return left < right;
        case "lte":
          return left <= right;
        case "gt":
          return left > right;
        case "gte":
          return left >= right;
        case "and":
          return Boolean(left) && Boolean(right);
        case "or":
          return Boolean(left) || Boolean(right);
        default:
          throw new Error(`Unknown binary op: ${op}`);
      }
    }
    evaluateUnaryOp(op, value) {
      switch (op) {
        case "not":
          return !value;
        case "neg":
          return -value;
        default:
          throw new Error(`Unknown unary op: ${op}`);
      }
    }
    evaluateCall(functionName, args, context) {
      const evaluatedArgs = args.map((arg) => this.evaluateExpression(arg, context));
      switch (functionName) {
        case "min":
          return Math.min(evaluatedArgs[0], evaluatedArgs[1]);
        case "max":
          return Math.max(evaluatedArgs[0], evaluatedArgs[1]);
        case "floor":
          return Math.floor(evaluatedArgs[0]);
        case "ceil":
          return Math.ceil(evaluatedArgs[0]);
        case "round":
          return Math.round(evaluatedArgs[0]);
        case "abs":
          return Math.abs(evaluatedArgs[0]);
        case "random":
          return Math.random();
        case "random_range": {
          const min = evaluatedArgs[0];
          const max = evaluatedArgs[1];
          return min + Math.random() * (max - min);
        }
        case "len":
          if (Array.isArray(evaluatedArgs[0])) {
            return evaluatedArgs[0].length;
          }
          return evaluatedArgs[0] != null ? 1 : 0;
      }
      const fn = context.functions.get(functionName);
      if (fn) {
        const params = /* @__PURE__ */ new Map();
        for (let i = 0; i < fn.params.length; i++) {
          params.set(fn.params[i].name, evaluatedArgs[i] ?? null);
        }
        const fnContext = {
          ...context,
          params
        };
        return this.evaluateExpression(fn.body, fnContext);
      }
      throw new Error(`Unknown function: ${functionName}`);
    }
  };

  // src/ir/loader.ts
  var SUPPORTED_MAJOR_VERSION = 1;
  async function loadIR(url) {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to load IR from ${url}: ${response.statusText}`);
    }
    const json = await response.text();
    return loadIRFromString(json);
  }
  function loadIRFromString(json) {
    const ir = JSON.parse(json);
    validateIR(ir);
    return ir;
  }
  function loadIRFromObject(obj) {
    const ir = obj;
    validateIR(ir);
    return ir;
  }
  function validateIR(ir) {
    if (!ir.version) {
      throw new Error("IR missing version");
    }
    const [major] = ir.version.split(".").map(Number);
    if (major > SUPPORTED_MAJOR_VERSION) {
      throw new Error(
        `IR version ${ir.version} not supported, max supported is ${SUPPORTED_MAJOR_VERSION}.x`
      );
    }
    if (!ir.module) {
      throw new Error("IR missing module name");
    }
    if (!Array.isArray(ir.components)) {
      throw new Error("IR missing components array");
    }
    if (!Array.isArray(ir.rules)) {
      throw new Error("IR missing rules array");
    }
    if (!Array.isArray(ir.functions)) {
      throw new Error("IR missing functions array");
    }
    if (ir.trackers !== void 0 && !Array.isArray(ir.trackers)) {
      throw new Error("IR trackers field must be an array when present");
    }
    for (const component of ir.components) {
      if (typeof component.name !== "string") {
        throw new Error(`Component missing name`);
      }
      if (!Array.isArray(component.fields)) {
        throw new Error(`Component ${component.name} missing fields array`);
      }
    }
    for (const rule of ir.rules) {
      if (typeof rule.name !== "string") {
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

  // src/BlinkGame.ts
  var BlinkGame = class _BlinkGame {
    constructor(options = {}) {
      this.isRunning = false;
      this.isPaused = false;
      this.animationFrameId = null;
      // trackerCallbacks removed
      this.simulationCallbacks = /* @__PURE__ */ new Set();
      this.debugCallbacks = /* @__PURE__ */ new Set();
      this.traceCallbacks = /* @__PURE__ */ new Set();
      this.ir = null;
      this.devMode = false;
      this.enableTrace = false;
      this.options = {
        debug: options.debug ?? false,
        msPerFrame: options.msPerFrame ?? 16,
        // Default: 16ms per frame (simulates ~60fps at 1x speed)
        maxEventsPerFrame: options.maxEventsPerFrame ?? 100,
        devMode: options.devMode ?? false,
        enableTrace: options.enableTrace ?? false
      };
      this.enableTrace = this.options.enableTrace;
      this.devMode = this.options.devMode;
      this.store = new Store();
      this.timeline = new Timeline();
      this.executor = new RuleExecutor();
    }
    /**
     * Create a new game instance
     */
    static async create(options = {}) {
      return new _BlinkGame(options);
    }
    /**
     * Create a new game instance (synchronous)
     */
    static createSync(options = {}) {
      return new _BlinkGame(options);
    }
    /**
     * Load compiled game rules from a URL
     */
    async loadRules(url) {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Failed to load rules from ${url}: ${response.statusText}`);
      }
      const json = await response.text();
      this.loadRulesFromString(json);
    }
    /**
     * Load compiled game rules from a JSON string
     */
    loadRulesFromString(json) {
      const ir = loadIRFromString(json);
      this.loadRulesFromIR(ir);
    }
    /**
     * Load compiled game rules from a parsed object
     */
    loadRulesFromObject(obj) {
      const ir = loadIRFromObject(obj);
      this.loadRulesFromIR(ir);
    }
    /**
     * Load compiled game rules from IR module
     */
    loadRulesFromIR(ir) {
      this.ir = ir;
      for (const component of ir.components) {
        const defaults = {};
        for (const field of component.fields) {
          if (field.default !== void 0) {
            defaults[field.name] = field.default;
          }
        }
        this.store.setComponentDefaults(component.name, defaults);
      }
      this.executor.loadRules(ir.rules);
      this.executor.loadFunctions(ir.functions);
      if (ir.initial_state) {
        this.loadState(ir.initial_state.entities);
      }
      if (this.options.debug) {
        console.log(`[BlinkGame] Loaded IR module: ${ir.module}`);
        console.log(`[BlinkGame] Components: ${ir.components.length}`);
        console.log(`[BlinkGame] Rules: ${ir.rules.length}`);
        console.log(`[BlinkGame] Trackers: ${(ir.trackers ?? []).length}`);
      }
    }
    /**
     * Load initial game state
     */
    setInitialState(state) {
      this.loadState(state.entities);
    }
    loadState(entities) {
      for (const entityDef of entities) {
        const entityId = typeof entityDef.id === "number" ? this.store.createEntity(entityDef.id) : this.store.createEntity();
        for (const [componentName, componentData] of Object.entries(entityDef.components)) {
          this.store.addComponent(entityId, componentName, componentData);
        }
      }
    }
    /**
     * Start the simulation
     */
    start() {
      if (this.isRunning) {
        return;
      }
      this.isRunning = true;
      this.isPaused = false;
      this.emitSimulationEvent({ type: "started", time: this.timeline.getTime() });
      this.scheduleNextFrame();
    }
    /**
     * Pause the simulation
     */
    pause() {
      if (!this.isRunning || this.isPaused) {
        return;
      }
      this.isPaused = true;
      if (this.animationFrameId !== null) {
        cancelAnimationFrame(this.animationFrameId);
        this.animationFrameId = null;
      }
      this.emitSimulationEvent({ type: "paused", time: this.timeline.getTime() });
    }
    /**
     * Resume paused simulation
     */
    resume() {
      if (!this.isRunning || !this.isPaused) {
        return;
      }
      this.isPaused = false;
      this.emitSimulationEvent({ type: "resumed", time: this.timeline.getTime() });
      this.scheduleNextFrame();
    }
    /**
     * Stop the simulation
     */
    stop() {
      this.isRunning = false;
      this.isPaused = false;
      if (this.animationFrameId !== null) {
        cancelAnimationFrame(this.animationFrameId);
        this.animationFrameId = null;
      }
      this.emitSimulationEvent({ type: "stopped", time: this.timeline.getTime() });
    }
    /**
     * Reset the simulation to initial state
     */
    reset() {
      this.stop();
      this.store.clear();
      this.timeline.clear();
      if (this.ir?.initial_state) {
        this.loadState(this.ir.initial_state.entities);
      }
    }
    /**
     * Step forward by one event
     */
    step() {
      const event = this.timeline.pop();
      if (!event) {
        return null;
      }
      this.emitTraceEvent({
        type: "event_fired",
        time: this.timeline.getTime(),
        event,
        details: `Event: ${event.eventType}${event.source !== void 0 ? ` from entity ${event.source}` : ""}${event.target !== void 0 ? ` to entity ${event.target}` : ""}`
      });
      const matchingRules = this.executor.getMatchingRules(event.eventType);
      if (this.enableTrace && matchingRules.length > 0) {
        this.emitTraceEvent({
          type: "rule_matched",
          time: this.timeline.getTime(),
          event,
          details: `Matched ${matchingRules.length} rule(s) for event ${event.eventType}`
        });
      }
      for (const rule of matchingRules) {
        this.emitTraceEvent({
          type: "rule_triggered",
          time: this.timeline.getTime(),
          event,
          rule,
          details: `Rule: ${rule.name || "unnamed"}`
        });
        const traceCallback = this.enableTrace ? (type, details, action) => {
          this.emitTraceEvent({
            type,
            time: this.timeline.getTime(),
            event,
            rule,
            action,
            details
          });
        } : void 0;
        if (this.devMode) {
          this.executeRuleWithDebug(rule, event, traceCallback);
        } else {
          this.executor.executeRule(rule, event, this.store, this.timeline, traceCallback);
        }
      }
      const result = {
        time: this.timeline.getTime(),
        event
      };
      this.emitSimulationEvent({ type: "step", time: result.time, event });
      return result;
    }
    /**
     * Execute a rule with debug events emitted
     */
    executeRuleWithDebug(rule, event, traceCallback) {
      this.emitDebugEvent({
        type: "rule_start",
        rule,
        sourceLocation: rule.source_location,
        time: this.timeline.getTime()
      });
      this.executor.executeRule(rule, event, this.store, this.timeline, traceCallback);
      this.emitDebugEvent({
        type: "rule_end",
        rule,
        sourceLocation: rule.source_location,
        time: this.timeline.getTime()
      });
    }
    /**
     * Run until no more events or max steps reached
     */
    runUntilComplete(maxSteps = 1e4) {
      const results = [];
      let steps = 0;
      while (this.timeline.hasEvents() && steps < maxSteps) {
        const result = this.step();
        if (result) {
          results.push(result);
        }
        steps++;
      }
      this.emitSimulationEvent({ type: "completed", time: this.timeline.getTime() });
      return results;
    }
    /**
     * Get current simulation time
     */
    getTime() {
      return this.timeline.getTime();
    }
    /**
     * Get current game state snapshot
     */
    getState() {
      return {
        time: this.timeline.getTime(),
        entities: this.store.getSnapshot()
      };
    }
    /**
     * Query entities with specific components
     */
    query(...componentNames) {
      return this.store.query(...componentNames);
    }
    /**
     * Get an entity's component data
     */
    getComponent(entityId, componentName) {
      return this.store.getComponent(entityId, componentName);
    }
    /**
     * Schedule an event
     */
    scheduleEvent(eventType, delay = 0, options = {}) {
      return this.timeline.schedule(eventType, delay, options);
    }
    /**
     * Schedule a recurring event
     * The event will automatically reschedule itself after each execution
     * Returns the event ID which can be used with cancelEvent() to stop the recurring event
     */
    scheduleRecurringEvent(eventType, interval, options = {}) {
      return this.timeline.scheduleRecurring(eventType, interval, options);
    }
    /**
     * Cancel a scheduled event (including recurring events)
     */
    cancelEvent(eventId) {
      return this.timeline.cancel(eventId);
    }
    /**
     * Subscribe to simulation events
     */
    onSimulation(callback) {
      this.simulationCallbacks.add(callback);
      return () => this.simulationCallbacks.delete(callback);
    }
    /**
     * Subscribe to debug events (for dev mode)
     */
    onDebug(callback) {
      this.debugCallbacks.add(callback);
      return () => this.debugCallbacks.delete(callback);
    }
    /**
     * Subscribe to trace events (for event firing and rule triggering trace)
     */
    onTrace(callback) {
      this.traceCallbacks.add(callback);
      return () => this.traceCallbacks.delete(callback);
    }
    /**
     * Enable or disable dev mode (step-by-step debugging)
     */
    setDevMode(enabled) {
      this.devMode = enabled;
      this.options.devMode = enabled;
    }
    /**
     * Enable or disable trace mode (event firing and rule triggering trace)
     */
    setTraceEnabled(enabled) {
      this.enableTrace = enabled;
      this.options.enableTrace = enabled;
    }
    /**
     * Check if trace mode is enabled
     */
    getTraceEnabled() {
      return this.enableTrace;
    }
    /**
     * Check if dev mode is enabled
     */
    getDevMode() {
      return this.devMode;
    }
    /**
     * Get the source map from the loaded IR (if available)
     */
    getSourceMap() {
      return this.ir?.source_map ?? null;
    }
    /**
     * Get all loaded rules (for debugging/display)
     */
    getRules() {
      return this.ir?.rules ?? [];
    }
    /**
     * Set how many simulation milliseconds to advance per frame (controls game speed)
     */
    setMsPerFrame(ms) {
      this.options.msPerFrame = ms;
    }
    /**
     * Get current ms per frame setting
     */
    getMsPerFrame() {
      return this.options.msPerFrame;
    }
    /**
     * Check if simulation is running
     */
    getIsRunning() {
      return this.isRunning;
    }
    /**
     * Check if simulation is paused
     */
    getIsPaused() {
      return this.isPaused;
    }
    /**
     * Check if there are pending events
     */
    hasEvents() {
      return this.timeline.hasEvents();
    }
    /**
     * Destroy the game instance and free resources
     */
    destroy() {
      this.stop();
      this.simulationCallbacks.clear();
      this.store.clear();
      this.timeline.clear();
    }
    /**
     * Run multiple steps efficiently
     * Advances simulation time by the specified milliseconds (or msPerFrame amount if not specified)
     * Returns summary of what happened
     */
    runSteps(maxSteps = 100, millisecondsToAdvance) {
      const startTime = this.timeline.getTime();
      const targetTime = startTime + (millisecondsToAdvance ?? this.options.msPerFrame);
      let stepsExecuted = 0;
      let eventsProcessed = 0;
      while (stepsExecuted < maxSteps && this.timeline.hasEvents()) {
        const nextEvent = this.timeline.peek();
        if (!nextEvent)
          break;
        if (nextEvent.time > targetTime) {
          break;
        }
        this.step();
        stepsExecuted++;
        eventsProcessed++;
      }
      const timeAdvanced = this.timeline.getTime() - startTime;
      return {
        stepsExecuted,
        timeAdvanced,
        eventsProcessed
      };
    }
    /**
     * Create a new entity dynamically
     */
    createEntity(id) {
      return this.store.createEntity(id);
    }
    /**
     * Clone an existing entity (deep copy of all components)
     */
    cloneEntity(sourceId, targetId) {
      return this.store.cloneEntity(sourceId, targetId);
    }
    /**
     * Add a component to an entity
     */
    addComponent(entityId, componentName, data) {
      this.store.addComponent(entityId, componentName, data);
    }
    /**
     * Remove an entity
     */
    removeEntity(entityId) {
      this.store.deleteEntity(entityId);
    }
    /**
     * Update a component field
     */
    setComponentField(entityId, componentName, field, value) {
      const component = this.store.getComponent(entityId, componentName);
      if (component) {
        component[field] = value;
      }
    }
    // ===== Entity and Component Access (for UI) =====
    /**
     * Get all entity IDs currently in the store
     */
    getAllEntityIds() {
      return this.store.getEntityIds();
    }
    /**
     * Get all entities with their component data
     * Returns a map of entity ID to component map
     */
    getAllEntities() {
      return this.store.getSnapshot();
    }
    /**
     * Get entities that have a specific component
     */
    getEntitiesWithComponent(componentName) {
      return this.store.query(componentName);
    }
    /**
     * Get full entity data including all components
     */
    getEntityData(entityId) {
      const snapshot = this.store.getSnapshot();
      const entityComponents = snapshot.get(entityId);
      if (!entityComponents) {
        return null;
      }
      const components = {};
      for (const [name, data] of entityComponents) {
        components[name] = data;
      }
      return { id: entityId, components };
    }
    // ===== Bound Choice Functions (BCL Resolution) =====
    /**
     * Get the bound functions for an entity
     * Returns a map of function name to function definition
     */
    getBoundFunctions(entityId) {
      if (this.ir?.initial_state?.entities) {
        const entityDef = this.ir.initial_state.entities.find((e) => e.id === entityId);
        if (entityDef?.bound_functions) {
          return entityDef.bound_functions;
        }
      }
      return null;
    }
    /**
     * Get a specific bound function from an entity
     * @param entityId The entity ID
     * @param functionName The name of the bound function
     * @returns The bound function or null if not found
     */
    getBoundFunction(entityId, functionName) {
      const boundFunctions = this.getBoundFunctions(entityId);
      if (boundFunctions && functionName in boundFunctions) {
        return boundFunctions[functionName];
      }
      return null;
    }
    /**
     * Get a bound function's source code for display in UI
     * @param entityId The entity ID
     * @param functionName The function name
     * @returns The source code string or null if not found
     */
    getBoundFunctionSource(entityId, functionName) {
      const func = this.getBoundFunction(entityId, functionName);
      return func?.source ?? null;
    }
    /**
     * Get all bound function names for an entity
     * @param entityId The entity ID
     * @returns Array of function names or empty array
     */
    getBoundFunctionNames(entityId) {
      const boundFunctions = this.getBoundFunctions(entityId);
      return boundFunctions ? Object.keys(boundFunctions) : [];
    }
    /**
     * Get the loaded IR module (for advanced access)
     */
    getIR() {
      return this.ir;
    }
    // ===== BRL Compilation (stub for future implementation) =====
    /**
     * Compile and execute BRL code
     * NOTE: This is a stub for future implementation. Currently throws an error.
     * @param brlCode The BRL code to compile and execute
     */
    compileAndExecuteBRL(_brlCode) {
      throw new Error("BRL compilation not yet implemented. Use loadRulesFromObject with pre-compiled IR.");
    }
    // ===== Private methods =====
    scheduleNextFrame() {
      console.log("[ScheduleNextFrame] Scheduling next frame");
      if (typeof requestAnimationFrame !== "undefined") {
        this.animationFrameId = requestAnimationFrame(this.gameLoop.bind(this));
        console.log("[ScheduleNextFrame] Used requestAnimationFrame");
      } else {
        setTimeout(() => this.gameLoop(), 16);
        console.log("[ScheduleNextFrame] Used setTimeout fallback");
      }
    }
    gameLoop() {
      console.log("[GameLoop] ENTERED gameLoop", { isRunning: this.isRunning, isPaused: this.isPaused });
      if (!this.isRunning || this.isPaused) {
        console.log("[GameLoop] Exiting early - not running or paused");
        return;
      }
      const millisecondsToAdvance = this.options.msPerFrame;
      const targetTime = this.timeline.getTime() + millisecondsToAdvance;
      if (this.options.debug && this.timeline.getTime() < 1e3) {
        console.log(`[GameLoop] Advancing ${millisecondsToAdvance}ms, from ${this.timeline.getTime()}ms to target ${targetTime}ms`);
      }
      let eventsProcessed = 0;
      while (eventsProcessed < this.options.maxEventsPerFrame && this.timeline.hasEvents()) {
        const nextEvent = this.timeline.peek();
        if (!nextEvent || nextEvent.time > targetTime) {
          if (this.options.debug && eventsProcessed === 0 && this.timeline.getTime() < 1e3) {
            console.log(`[GameLoop] No events to process: nextEvent=${nextEvent ? nextEvent.eventType + "@" + nextEvent.time + "ms" : "null"}, targetTime=${targetTime}ms`);
          }
          break;
        }
        if (this.options.debug && eventsProcessed < 5 && this.timeline.getTime() < 1e3) {
          console.log(`[GameLoop] Processing event: ${nextEvent.eventType} at time ${nextEvent.time}ms`);
        }
        this.step();
        eventsProcessed++;
      }
      if (this.options.debug && this.timeline.getTime() < 1e3) {
        console.log(`[GameLoop] Processed ${eventsProcessed} events, timeline now at ${this.timeline.getTime()}ms`);
      }
      if (!this.timeline.hasEvents()) {
        this.isRunning = false;
        this.emitSimulationEvent({ type: "completed", time: this.timeline.getTime() });
        return;
      }
      this.scheduleNextFrame();
    }
    emitSimulationEvent(event) {
      for (const callback of this.simulationCallbacks) {
        try {
          callback(event);
        } catch (error) {
          console.error("[BlinkGame] Error in simulation callback:", error);
        }
      }
    }
    emitDebugEvent(event) {
      for (const callback of this.debugCallbacks) {
        try {
          callback(event);
        } catch (error) {
          console.error("[BlinkGame] Error in debug callback:", error);
        }
      }
    }
    emitTraceEvent(event) {
      if (!this.enableTrace) {
        return;
      }
      for (const callback of this.traceCallbacks) {
        try {
          callback(event);
        } catch (error) {
          console.error("[BlinkGame] Error in trace callback:", error);
        }
      }
    }
  };
  return __toCommonJS(src_exports);
})();
