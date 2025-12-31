/**
 * Blink Engine Browser Bundle
 * A standalone bundle for browser usage without a build system
 */

(function(global) {
  'use strict';

  // ===== IR Types =====
  
  // Field value type (simplified for browser)
  // IRFieldValue = number | string | boolean | null | unknown[] | Record<string, unknown>

  // ===== Store =====
  
  class Store {
    constructor() {
      this.entities = new Map();
      this.nextId = 0;
      this.componentDefaults = new Map();
    }

    setComponentDefaults(componentName, defaults) {
      this.componentDefaults.set(componentName, { ...defaults });
    }

    createEntity(id) {
      const entityId = id !== undefined ? id : this.nextId++;
      
      if (entityId >= this.nextId) {
        this.nextId = entityId + 1;
      }
      
      this.entities.set(entityId, {
        id: entityId,
        components: new Map(),
      });
      
      return entityId;
    }

    deleteEntity(id) {
      return this.entities.delete(id);
    }

    hasEntity(id) {
      return this.entities.has(id);
    }

    getEntityIds() {
      return Array.from(this.entities.keys());
    }

    addComponent(entityId, componentName, data) {
      const entity = this.entities.get(entityId);
      if (!entity) {
        throw new Error(`Entity ${entityId} not found`);
      }
      
      const defaults = this.componentDefaults.get(componentName) || {};
      entity.components.set(componentName, { ...defaults, ...data });
    }

    removeComponent(entityId, componentName) {
      const entity = this.entities.get(entityId);
      if (!entity) {
        return false;
      }
      return entity.components.delete(componentName);
    }

    hasComponent(entityId, componentName) {
      const entity = this.entities.get(entityId);
      if (!entity) {
        return false;
      }
      return entity.components.has(componentName);
    }

    getComponent(entityId, componentName) {
      const entity = this.entities.get(entityId);
      if (!entity) {
        return undefined;
      }
      return entity.components.get(componentName);
    }

    getField(entityId, componentName, fieldName) {
      const component = this.getComponent(entityId, componentName);
      if (!component) {
        return undefined;
      }
      return component[fieldName];
    }

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

    getEntityComponents(entityId) {
      const entity = this.entities.get(entityId);
      return entity ? entity.components : undefined;
    }

    getSnapshot() {
      const snapshot = new Map();
      
      for (const [id, entity] of this.entities) {
        const componentsCopy = new Map();
        for (const [name, data] of entity.components) {
          componentsCopy.set(name, { ...data });
        }
        snapshot.set(id, componentsCopy);
      }
      
      return snapshot;
    }

    clear() {
      this.entities.clear();
      this.nextId = 0;
    }
  }

  // ===== Timeline =====
  
  class Timeline {
    constructor() {
      this.events = [];
      this.currentTime = 0;
      this.nextEventId = 0;
      this.nextSequence = 0;
    }

    getTime() {
      return this.currentTime;
    }

    setTime(time) {
      this.currentTime = time;
    }

    schedule(eventType, delay = 0, options = {}) {
      return this.scheduleAt(eventType, this.currentTime + delay, options);
    }

    scheduleAt(eventType, time, options = {}) {
      const event = {
        id: this.nextEventId++,
        eventType,
        time: Math.max(time, this.currentTime),
        source: options.source,
        target: options.target,
        fields: options.fields,
        sequence: this.nextSequence++,
      };

      this.insert(event);
      return event.id;
    }

    scheduleImmediate(eventType, options = {}) {
      return this.scheduleAt(eventType, this.currentTime, options);
    }

    peek() {
      return this.events[0];
    }

    pop() {
      if (this.events.length === 0) {
        return undefined;
      }

      const result = this.events[0];
      const last = this.events.pop();

      if (this.events.length > 0) {
        this.events[0] = last;
        this.siftDown(0);
      }

      this.currentTime = result.time;

      return result;
    }

    hasEvents() {
      return this.events.length > 0;
    }

    getEventCount() {
      return this.events.length;
    }

    cancel(eventId) {
      const index = this.events.findIndex(e => e.id === eventId);
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

    clear() {
      this.events = [];
      this.currentTime = 0;
      this.nextSequence = 0;
    }

    getAllEvents() {
      return [...this.events].sort((a, b) => {
        if (a.time !== b.time) return a.time - b.time;
        return a.sequence - b.sequence;
      });
    }

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
  }

  // ===== Rule Executor =====
  
  class RuleExecutor {
    constructor() {
      this.rules = [];
      this.functions = new Map();
    }

    loadRules(rules) {
      this.rules = rules;
    }

    loadFunctions(functions) {
      this.functions.clear();
      for (const fn of functions) {
        this.functions.set(fn.name, fn);
      }
    }

    getMatchingRules(eventType) {
      return this.rules.filter(rule => {
        if (rule.trigger.type === 'event') {
          return rule.trigger.event === eventType;
        }
        return false;
      });
    }

    executeRule(rule, event, store, timeline) {
      const entities = this.getFilteredEntities(rule, store, event);

      for (const entityId of entities) {
        const bindings = this.createBindings(rule, event, entityId);
        
        const context = {
          store,
          timeline,
          event,
          bindings,
          params: new Map(),
          functions: this.functions,
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

    getFilteredEntities(rule, store, event) {
      if (event.source !== undefined && store.hasEntity(event.source)) {
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

      if (rule.filter?.components && rule.filter.components.length > 0) {
        return store.query(...rule.filter.components);
      }

      return store.getEntityIds();
    }

    createBindings(rule, event, entityId) {
      const bindings = new Map();

      bindings.set('entity', entityId);

      if (rule.trigger.bindings) {
        for (const [varName, source] of Object.entries(rule.trigger.bindings)) {
          if (source === 'source' && event.source !== undefined) {
            bindings.set(varName, event.source);
          } else if (source === 'target' && event.target !== undefined) {
            bindings.set(varName, event.target);
          }
        }
      }

      return bindings;
    }

    executeAction(action, context) {
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
          console.warn(`Unknown action type: ${action.type}`);
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
        case 'set':
          newValue = modifyValue;
          break;
        case 'add':
          newValue = (currentValue || 0) + modifyValue;
          break;
        case 'subtract':
          newValue = (currentValue || 0) - modifyValue;
          break;
        case 'multiply':
          newValue = (currentValue || 0) * modifyValue;
          break;
        case 'divide':
          newValue = (currentValue || 0) / modifyValue;
          break;
        default:
          throw new Error(`Unknown modify op: ${action.op}`);
      }

      context.store.setField(entityId, action.component, action.field, newValue);
    }

    executeSchedule(action, context) {
      const delay = action.delay
        ? this.evaluateExpression(action.delay, context)
        : 0;

      const source = action.source
        ? this.evaluateEntityExpression(action.source, context)
        : undefined;

      const target = action.target
        ? this.evaluateEntityExpression(action.target, context)
        : undefined;

      const fields = {};
      if (action.fields) {
        for (const [key, expr] of Object.entries(action.fields)) {
          fields[key] = this.evaluateExpression(expr, context);
        }
      }

      context.timeline.schedule(action.event, delay, {
        source: source !== null ? source : undefined,
        target: target !== null ? target : undefined,
        fields: Object.keys(fields).length > 0 ? fields : undefined,
      });
    }

    executeEmit(action, context) {
      const fields = {};
      if (action.fields) {
        for (const [key, expr] of Object.entries(action.fields)) {
          fields[key] = this.evaluateExpression(expr, context);
        }
      }

      context.timeline.scheduleImmediate(action.event, {
        fields: Object.keys(fields).length > 0 ? fields : undefined,
      });
    }

    executeDespawn(action, context) {
      const entityId = this.evaluateEntityExpression(action.entity, context);
      if (entityId !== null) {
        context.store.deleteEntity(entityId);
      }
    }

    evaluateEntityExpression(expr, context) {
      if (expr.type === 'var') {
        const entityId = context.bindings.get(expr.name);
        return entityId !== undefined ? entityId : null;
      }
      
      if (expr.type === 'field') {
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

    evaluateExpression(expr, context) {
      switch (expr.type) {
        case 'literal':
          return expr.value;

        case 'var': {
          const entityId = context.bindings.get(expr.name);
          return entityId !== undefined ? entityId : null;
        }

        case 'param': {
          return context.params.get(expr.name) || null;
        }

        case 'field': {
          const entityRef = typeof expr.entity === 'string'
            ? context.bindings.get(expr.entity)
            : this.evaluateEntityExpression(expr.entity, context);
          
          if (entityRef === null || entityRef === undefined) {
            return null;
          }
          
          return context.store.getField(entityRef, expr.component, expr.field) || null;
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
          throw new Error(`Unknown expression type: ${expr.type}`);
      }
    }

    evaluateBinaryOp(op, left, right) {
      switch (op) {
        case 'add':
          return left + right;
        case 'subtract':
          return left - right;
        case 'multiply':
          return left * right;
        case 'divide':
          return left / right;
        case 'modulo':
          return left % right;
        case 'eq':
          return left === right;
        case 'neq':
          return left !== right;
        case 'lt':
          return left < right;
        case 'lte':
          return left <= right;
        case 'gt':
          return left > right;
        case 'gte':
          return left >= right;
        case 'and':
          return Boolean(left) && Boolean(right);
        case 'or':
          return Boolean(left) || Boolean(right);
        default:
          throw new Error(`Unknown binary op: ${op}`);
      }
    }

    evaluateUnaryOp(op, value) {
      switch (op) {
        case 'not':
          return !value;
        case 'neg':
          return -value;
        default:
          throw new Error(`Unknown unary op: ${op}`);
      }
    }

    evaluateCall(functionName, args, context) {
      const evaluatedArgs = args.map(arg => this.evaluateExpression(arg, context));

      switch (functionName) {
        case 'min':
          return Math.min(evaluatedArgs[0], evaluatedArgs[1]);
        case 'max':
          return Math.max(evaluatedArgs[0], evaluatedArgs[1]);
        case 'floor':
          return Math.floor(evaluatedArgs[0]);
        case 'ceil':
          return Math.ceil(evaluatedArgs[0]);
        case 'round':
          return Math.round(evaluatedArgs[0]);
        case 'abs':
          return Math.abs(evaluatedArgs[0]);
        case 'random':
          return Math.random();
        case 'random_range': {
          const min = evaluatedArgs[0];
          const max = evaluatedArgs[1];
          return min + Math.random() * (max - min);
        }
        case 'len':
          return Array.isArray(evaluatedArgs[0]) ? evaluatedArgs[0].length : 0;
      }

      const fn = context.functions.get(functionName);
      if (fn) {
        const params = new Map();
        for (let i = 0; i < fn.params.length; i++) {
          params.set(fn.params[i].name, evaluatedArgs[i] || null);
        }

        const fnContext = {
          ...context,
          params,
        };

        return this.evaluateExpression(fn.body, fnContext);
      }

      throw new Error(`Unknown function: ${functionName}`);
    }
  }

  // ===== Tracker System =====
  
  class TrackerSystem {
    constructor() {
      this.trackers = [];
      this.trackersByEvent = new Map();
    }

    loadTrackers(trackers) {
      this.trackers = trackers;
      this.trackersByEvent.clear();

      for (const tracker of trackers) {
        const existing = this.trackersByEvent.get(tracker.event) || [];
        existing.push(tracker);
        this.trackersByEvent.set(tracker.event, existing);
      }
    }

    getTrackersForEvent(eventType) {
      return this.trackersByEvent.get(eventType) || [];
    }

    capture(event, store, time) {
      const outputs = [];
      const trackers = this.getTrackersForEvent(event.eventType);

      for (const tracker of trackers) {
        const entityData = [];

        const entityIds = store.query(tracker.component);

        for (const entityId of entityIds) {
          const component = store.getComponent(entityId, tracker.component);
          if (component) {
            entityData.push({
              entityId,
              fields: { ...component },
            });
          }
        }

        outputs.push({
          trackerId: tracker.id,
          eventType: event.eventType,
          time,
          component: tracker.component,
          entities: entityData,
        });
      }

      return outputs;
    }

    clear() {
      this.trackers = [];
      this.trackersByEvent.clear();
    }
  }

  // ===== IR Loader =====
  
  const SUPPORTED_MAJOR_VERSION = 1;

  function loadIRFromString(json) {
    const ir = JSON.parse(json);
    validateIR(ir);
    return ir;
  }

  function loadIRFromObject(obj) {
    validateIR(obj);
    return obj;
  }

  function validateIR(ir) {
    if (!ir.version) {
      throw new Error('IR missing version');
    }
    
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
  }

  // ===== BlinkGame =====
  
  class BlinkGame {
    constructor(options = {}) {
      this.options = {
        debug: options.debug || false,
        timeScale: options.timeScale || 1.0,
        maxEventsPerFrame: options.maxEventsPerFrame || 100,
      };
      
      this.store = new Store();
      this.timeline = new Timeline();
      this.executor = new RuleExecutor();
      this.trackerSystem = new TrackerSystem();
      
      this.isRunning = false;
      this.isPaused = false;
      this.animationFrameId = null;
      this.lastFrameTime = 0;
      
      this.trackerCallbacks = new Set();
      this.simulationCallbacks = new Set();
      
      this.ir = null;
    }

    static async create(options = {}) {
      return new BlinkGame(options);
    }

    static createSync(options = {}) {
      return new BlinkGame(options);
    }

    async loadRules(url) {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Failed to load rules from ${url}: ${response.statusText}`);
      }
      const json = await response.text();
      this.loadRulesFromString(json);
    }

    loadRulesFromString(json) {
      const ir = loadIRFromString(json);
      this.loadRulesFromIR(ir);
    }

    loadRulesFromObject(obj) {
      const ir = loadIRFromObject(obj);
      this.loadRulesFromIR(ir);
    }

    loadRulesFromIR(ir) {
      this.ir = ir;
      
      for (const component of ir.components) {
        const defaults = {};
        for (const field of component.fields) {
          if (field.default !== undefined) {
            defaults[field.name] = field.default;
          }
        }
        this.store.setComponentDefaults(component.name, defaults);
      }
      
      this.executor.loadRules(ir.rules);
      this.executor.loadFunctions(ir.functions);
      this.trackerSystem.loadTrackers(ir.trackers);
      
      if (ir.initial_state) {
        this.loadState(ir.initial_state.entities);
      }
      
      if (this.options.debug) {
        console.log(`[BlinkGame] Loaded IR module: ${ir.module}`);
        console.log(`[BlinkGame] Components: ${ir.components.length}`);
        console.log(`[BlinkGame] Rules: ${ir.rules.length}`);
        console.log(`[BlinkGame] Trackers: ${ir.trackers.length}`);
      }
    }

    setInitialState(state) {
      this.loadState(state.entities);
    }

    loadState(entities) {
      for (const entityDef of entities) {
        const entityId = typeof entityDef.id === 'number'
          ? this.store.createEntity(entityDef.id)
          : this.store.createEntity();
        
        for (const [componentName, componentData] of Object.entries(entityDef.components)) {
          this.store.addComponent(entityId, componentName, componentData);
        }
      }
    }

    start() {
      if (this.isRunning) {
        return;
      }
      
      this.isRunning = true;
      this.isPaused = false;
      this.lastFrameTime = performance.now();
      
      this.emitSimulationEvent({ type: 'started', time: this.timeline.getTime() });
      
      this.scheduleNextFrame();
    }

    pause() {
      if (!this.isRunning || this.isPaused) {
        return;
      }
      
      this.isPaused = true;
      
      if (this.animationFrameId !== null) {
        cancelAnimationFrame(this.animationFrameId);
        this.animationFrameId = null;
      }
      
      this.emitSimulationEvent({ type: 'paused', time: this.timeline.getTime() });
    }

    resume() {
      if (!this.isRunning || !this.isPaused) {
        return;
      }
      
      this.isPaused = false;
      this.lastFrameTime = performance.now();
      
      this.emitSimulationEvent({ type: 'resumed', time: this.timeline.getTime() });
      
      this.scheduleNextFrame();
    }

    stop() {
      this.isRunning = false;
      this.isPaused = false;
      
      if (this.animationFrameId !== null) {
        cancelAnimationFrame(this.animationFrameId);
        this.animationFrameId = null;
      }
      
      this.emitSimulationEvent({ type: 'stopped', time: this.timeline.getTime() });
    }

    reset() {
      this.stop();
      this.store.clear();
      this.timeline.clear();
      
      if (this.ir && this.ir.initial_state) {
        this.loadState(this.ir.initial_state.entities);
      }
    }

    step() {
      const event = this.timeline.pop();
      if (!event) {
        return null;
      }
      
      const matchingRules = this.executor.getMatchingRules(event.eventType);
      for (const rule of matchingRules) {
        this.executor.executeRule(rule, event, this.store, this.timeline);
      }
      
      const trackerOutput = this.trackerSystem.capture(event, this.store, this.timeline.getTime());
      
      for (const output of trackerOutput) {
        this.emitTrackerEvent(output);
      }
      
      const result = {
        time: this.timeline.getTime(),
        event,
        trackerOutput,
      };
      
      this.emitSimulationEvent({ type: 'step', time: result.time, event });
      
      return result;
    }

    runUntilComplete(maxSteps = 10000) {
      const results = [];
      let steps = 0;
      
      while (this.timeline.hasEvents() && steps < maxSteps) {
        const result = this.step();
        if (result) {
          results.push(result);
        }
        steps++;
      }
      
      this.emitSimulationEvent({ type: 'completed', time: this.timeline.getTime() });
      
      return results;
    }

    getTime() {
      return this.timeline.getTime();
    }

    getState() {
      return {
        time: this.timeline.getTime(),
        entities: this.store.getSnapshot(),
      };
    }

    query(...componentNames) {
      return this.store.query(...componentNames);
    }

    getComponent(entityId, componentName) {
      return this.store.getComponent(entityId, componentName);
    }

    scheduleEvent(eventType, delay = 0, options = {}) {
      return this.timeline.schedule(eventType, delay, options);
    }

    onTracker(callback) {
      this.trackerCallbacks.add(callback);
      return () => this.trackerCallbacks.delete(callback);
    }

    onSimulation(callback) {
      this.simulationCallbacks.add(callback);
      return () => this.simulationCallbacks.delete(callback);
    }

    setTimeScale(scale) {
      this.options.timeScale = scale;
    }

    getIsRunning() {
      return this.isRunning;
    }

    getIsPaused() {
      return this.isPaused;
    }

    hasEvents() {
      return this.timeline.hasEvents();
    }

    destroy() {
      this.stop();
      this.trackerCallbacks.clear();
      this.simulationCallbacks.clear();
      this.store.clear();
      this.timeline.clear();
    }

    scheduleNextFrame() {
      if (typeof requestAnimationFrame !== 'undefined') {
        this.animationFrameId = requestAnimationFrame(this.gameLoop.bind(this));
      } else {
        setTimeout(() => this.gameLoop(performance.now()), 16);
      }
    }

    gameLoop(currentTime) {
      if (!this.isRunning || this.isPaused) {
        return;
      }
      
      const deltaTime = (currentTime - this.lastFrameTime) / 1000;
      this.lastFrameTime = currentTime;
      
      const simulationDelta = deltaTime * this.options.timeScale;
      const targetTime = this.timeline.getTime() + simulationDelta;
      
      let eventsProcessed = 0;
      
      while (
        eventsProcessed < this.options.maxEventsPerFrame &&
        this.timeline.hasEvents()
      ) {
        const nextEvent = this.timeline.peek();
        if (!nextEvent || nextEvent.time > targetTime) {
          break;
        }
        
        this.step();
        eventsProcessed++;
      }
      
      if (!this.timeline.hasEvents()) {
        this.isRunning = false;
        this.emitSimulationEvent({ type: 'completed', time: this.timeline.getTime() });
        return;
      }
      
      this.scheduleNextFrame();
    }

    emitTrackerEvent(event) {
      for (const callback of this.trackerCallbacks) {
        try {
          callback(event);
        } catch (error) {
          console.error('[BlinkGame] Error in tracker callback:', error);
        }
      }
    }

    emitSimulationEvent(event) {
      for (const callback of this.simulationCallbacks) {
        try {
          callback(event);
        } catch (error) {
          console.error('[BlinkGame] Error in simulation callback:', error);
        }
      }
    }
  }

  // ===== Export =====
  
  const BlinkEngine = {
    BlinkGame,
    Store,
    Timeline,
    RuleExecutor,
    TrackerSystem,
    loadIRFromString,
    loadIRFromObject,
  };

  // Export for different module systems
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = BlinkEngine;
  } else if (typeof define === 'function' && define.amd) {
    define(function() { return BlinkEngine; });
  } else {
    global.BlinkEngine = BlinkEngine;
  }

})(typeof window !== 'undefined' ? window : global);
