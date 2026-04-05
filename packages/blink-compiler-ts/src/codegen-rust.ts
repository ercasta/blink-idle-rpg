/**
 * Rust Code Generator for Blink languages
 * Converts BRL AST to Rust source code for WASM compilation.
 *
 * This implements Approach D from the WASM engine plan:
 * BRL → Rust source → cargo build → WASM
 *
 * Generated files:
 *   components.rs  - Component structs (derived from BRL component definitions)
 *   entities.rs    - Entity initializer functions
 *   rules.rs       - Rule functions (one per BRL rule)
 *   functions.rs   - User-defined functions
 *   dispatch.rs    - Event dispatch table
 *   lib.rs         - Entry point with wasm-bindgen exports
 */

import * as AST from './ast';

export interface RustCodegenOptions {
  moduleName?: string;
  runtimeCratePath?: string;
}

export interface RustCodegenResult {
  files: Map<string, string>;
}

export class RustCodeGenerator {
  private options: RustCodegenOptions;
  private componentNames: string[] = [];
  private rulesByEvent: Map<string, { name: string; funcName: string }[]> = new Map();
  private functionNames: string[] = [];
  private entityDefs: AST.EntityDef[] = [];
  private componentDefs: AST.ComponentDef[] = [];
  private ruleDefs: AST.RuleDef[] = [];
  private functionDefs: AST.FunctionDef[] = [];
  private allStrings: Set<string> = new Set();
  private ruleCounter = 0;
  // Track the current event alias during rule generation
  private currentEventAlias: string | null = null;

  constructor(options: RustCodegenOptions = {}) {
    this.options = options;
  }

  generate(modules: AST.Module[]): RustCodegenResult {
    // Collect all items from all modules
    for (const module of modules) {
      this.collectItems(module.items);
    }

    // Collect string literals for the intern table
    this.collectStrings();

    const files = new Map<string, string>();

    files.set('components.rs', this.generateComponentsFile());
    files.set('entities.rs', this.generateEntitiesFile());
    files.set('rules.rs', this.generateRulesFile());
    files.set('functions.rs', this.generateFunctionsFile());
    files.set('dispatch.rs', this.generateDispatchFile());
    files.set('json_bridge.rs', this.generateJsonBridgeFile());
    files.set('lib.rs', this.generateLibFile());

    return { files };
  }

  private collectItems(items: AST.Item[]) {
    for (const item of items) {
      switch (item.type) {
        case 'component':
          this.componentDefs.push(item);
          this.componentNames.push(item.name);
          break;
        case 'rule':
          this.ruleDefs.push(item);
          break;
        case 'function':
          this.functionDefs.push(item);
          this.functionNames.push(item.name);
          break;
        case 'entity':
          this.entityDefs.push(item);
          break;
        case 'module':
          this.collectItems(item.items);
          break;
        case 'import':
          break;
      }
    }
  }

  private collectStrings() {
    // Collect event names from rules
    for (const rule of this.ruleDefs) {
      this.allStrings.add(rule.triggerEvent);
    }

    // Collect string literals from entities
    for (const entity of this.entityDefs) {
      for (const comp of entity.components) {
        for (const [, value] of comp.fields) {
          this.collectStringsFromExpr(value);
        }
      }
    }

    // Collect event names from schedule statements in rules
    for (const rule of this.ruleDefs) {
      this.collectStringsFromBlock(rule.body);
    }
  }

  private collectStringsFromBlock(block: AST.Block) {
    for (const stmt of block.statements) {
      this.collectStringsFromStatement(stmt);
    }
  }

  private collectStringsFromStatement(stmt: AST.Statement) {
    switch (stmt.type) {
      case 'schedule':
        this.allStrings.add(stmt.eventName);
        for (const [, value] of stmt.fields) {
          this.collectStringsFromExpr(value);
        }
        break;
      case 'if':
        this.collectStringsFromBlock(stmt.thenBlock);
        if (stmt.elseBlock) {
          if (stmt.elseBlock.type === 'else_if') {
            this.collectStringsFromStatement(stmt.elseBlock.statement);
          } else {
            this.collectStringsFromBlock(stmt.elseBlock.block);
          }
        }
        break;
      case 'for':
        this.collectStringsFromBlock(stmt.body);
        break;
      case 'while':
        this.collectStringsFromBlock(stmt.body);
        break;
      default:
        break;
    }
  }

  private collectStringsFromExpr(expr: AST.Expr) {
    if (expr.type === 'literal' && expr.value.type === 'string') {
      this.allStrings.add(expr.value.value);
    }
    if (expr.type === 'binary') {
      this.collectStringsFromExpr(expr.left);
      this.collectStringsFromExpr(expr.right);
    }
    if (expr.type === 'call') {
      for (const arg of expr.args) {
        this.collectStringsFromExpr(arg);
      }
    }
    if (expr.type === 'field_access') {
      this.collectStringsFromExpr(expr.base);
    }
    if (expr.type === 'unary') {
      this.collectStringsFromExpr(expr.expr);
    }
  }

  // ── Component file generation ──

  private generateComponentsFile(): string {
    let code = '// Generated by blink-compiler-ts - do not edit\n';
    code += '#![allow(dead_code, unused_imports)]\n\n';
    code += 'use blink_runtime::interning::InternedString;\n';
    code += 'use blink_runtime::EntityId;\n\n';

    for (const comp of this.componentDefs) {
      code += this.generateComponentStruct(comp);
      code += '\n';
    }

    return code;
  }

  private generateComponentStruct(comp: AST.ComponentDef): string {
    let code = `#[derive(Clone, Debug, Default)]\n`;
    code += `pub struct ${comp.name} {\n`;

    for (const field of comp.fields) {
      const rustType = this.typeToRust(field.fieldType);
      code += `    pub ${this.toSnakeCase(field.name)}: ${rustType},\n`;
    }

    code += `}\n`;
    return code;
  }

  // ── Entities file generation ──

  private generateEntitiesFile(): string {
    let code = '// Generated by blink-compiler-ts - do not edit\n';
    code += '#![allow(dead_code, unused_imports, unused_variables)]\n\n';
    code += 'use blink_runtime::{Engine, World, InternedString, Value, EntityId};\n';
    code += 'use crate::components::*;\n';
    code += 'use crate::string_ids;\n\n';

    // Generate named entity variable storage
    const namedEntities = this.entityDefs.filter(e => e.variable);
    if (namedEntities.length > 0) {
      code += '/// Named entity IDs (populated during create_initial_entities)\n';
      code += 'pub struct NamedEntities {\n';
      for (const entity of namedEntities) {
        code += `    pub ${this.toSnakeCase(entity.variable!)}: EntityId,\n`;
      }
      code += '}\n\n';

      code += 'impl Default for NamedEntities {\n';
      code += '    fn default() -> Self {\n';
      code += '        NamedEntities {\n';
      for (const entity of namedEntities) {
        code += `            ${this.toSnakeCase(entity.variable!)}: 0,\n`;
      }
      code += '        }\n';
      code += '    }\n';
      code += '}\n\n';
    }

    code += '/// Create all initial entities defined in BRL source.\n';
    code += `pub fn create_initial_entities(engine: &mut Engine) -> ${namedEntities.length > 0 ? 'NamedEntities' : '()'} {\n`;

    if (namedEntities.length > 0) {
      code += '    let mut named = NamedEntities::default();\n';
    }

    for (const entity of this.entityDefs) {
      const varName = entity.variable ? this.toSnakeCase(entity.variable) : `_entity_${this.entityDefs.indexOf(entity)}`;

      if (entity.variable) {
        code += `    let ${varName} = engine.world.spawn_named("${entity.variable}");\n`;
      } else {
        code += `    let ${varName} = engine.world.spawn();\n`;
      }

      for (const comp of entity.components) {
        code += `    engine.world.insert(${varName}, ${comp.name} {\n`;
        for (const [fieldName, value] of comp.fields) {
          code += `        ${this.toSnakeCase(fieldName)}: ${this.exprToRust(value)},\n`;
        }
        code += `    });\n`;
      }

      if (entity.variable) {
        code += `    named.${this.toSnakeCase(entity.variable)} = ${varName};\n`;
      }
      code += '\n';
    }

    if (namedEntities.length > 0) {
      code += '    named\n';
    }
    code += '}\n';

    return code;
  }

  // ── Rules file generation ──

  private generateRulesFile(): string {
    let code = '// Generated by blink-compiler-ts - do not edit\n';
    code += '#![allow(dead_code, unused_imports, unused_variables, unused_mut)]\n\n';
    code += 'use blink_runtime::{Engine, World, Timeline, Event, InternedString, Value, EntityId, NO_ENTITY};\n';
    code += 'use blink_runtime::builtins::*;\n';
    code += 'use crate::components::*;\n';
    code += 'use crate::functions::*;\n';
    code += 'use crate::string_ids;\n\n';

    for (const rule of this.ruleDefs) {
      code += this.generateRuleFunction(rule);
      code += '\n';
    }

    return code;
  }

  private generateRuleFunction(rule: AST.RuleDef): string {
    const funcName = this.ruleFuncName(rule);
    this.currentEventAlias = rule.eventParam.name;

    // Track this rule for the dispatch table
    if (!this.rulesByEvent.has(rule.triggerEvent)) {
      this.rulesByEvent.set(rule.triggerEvent, []);
    }
    this.rulesByEvent.get(rule.triggerEvent)!.push({
      name: rule.name ?? `anonymous_${this.ruleCounter}`,
      funcName,
    });

    let code = `pub fn ${funcName}(event: &Event, engine: &mut Engine) {\n`;

    // Extract event source/target
    code += `    let ${this.toSnakeCase(rule.eventParam.name)}_source = event.source;\n`;

    // Analyze the rule body to determine the query pattern
    const queryComponent = this.analyzeRuleBody(rule.body);
    if (queryComponent) {
      code += `    let entity_ids = engine.world.query_component::<${queryComponent}>();\n`;
      code += `    for entity_id in entity_ids {\n`;
      code += this.generateBlockStatements(rule.body, 2);
      code += `    }\n`;
    } else {
      code += this.generateBlockStatements(rule.body, 1);
    }

    code += `}\n`;

    this.currentEventAlias = null;
    return code;
  }

  /**
   * Analyze a rule body to find the "if entity has X" pattern.
   * If found, we generate a query_component iteration instead of all-entity iteration.
   */
  private analyzeRuleBody(block: AST.Block): string | null {
    // Look for "if entity has X" pattern at the top level
    if (block.statements.length > 0) {
      const firstStmt = block.statements[0];
      if (firstStmt.type === 'if' && firstStmt.condition.type === 'has_component') {
        if (firstStmt.condition.entity.type === 'identifier' &&
            firstStmt.condition.entity.name === 'entity') {
          return firstStmt.condition.component;
        }
      }
    }
    // Also look for for-each loops over entities_having
    for (const stmt of block.statements) {
      if (stmt.type === 'for' && stmt.iterable.type === 'entities_having') {
        return null; // The for loop itself handles the query
      }
    }
    return null;
  }

  // ── Functions file generation ──

  private generateFunctionsFile(): string {
    let code = '// Generated by blink-compiler-ts - do not edit\n';
    code += '#![allow(dead_code, unused_imports, unused_variables)]\n\n';
    code += 'use blink_runtime::{Engine, World, InternedString, Value, EntityId, NO_ENTITY};\n';
    code += 'use blink_runtime::builtins::*;\n';
    code += 'use crate::components::*;\n';
    code += 'use crate::string_ids;\n\n';

    for (const func of this.functionDefs) {
      code += this.generateFunction(func);
      code += '\n';
    }

    return code;
  }

  private generateFunction(func: AST.FunctionDef): string {
    const funcName = this.toSnakeCase(func.name);
    const params = func.params.map(p =>
      `${this.toSnakeCase(p.name)}: ${this.typeToRust(p.paramType)}`
    ).join(', ');
    const returnType = func.returnType ? this.typeToRust(func.returnType) : 'f64';

    let code = `#[inline]\n`;
    code += `pub fn ${funcName}(${params}) -> ${returnType} {\n`;

    // Generate function body - find return statement
    for (const stmt of func.body.statements) {
      if (stmt.type === 'return' && stmt.value) {
        code += `    ${this.exprToRust(stmt.value)}\n`;
      } else {
        code += this.generateStatement(stmt, 1);
      }
    }

    code += `}\n`;
    return code;
  }

  // ── Dispatch file generation ──

  private generateDispatchFile(): string {
    let code = '// Generated by blink-compiler-ts - do not edit\n';
    code += '#![allow(dead_code, unused_imports)]\n\n';
    code += 'use blink_runtime::{Engine, Event, InternedString};\n';
    code += 'use crate::rules;\n';
    code += 'use crate::string_ids;\n\n';

    code += '/// Dispatch an event to all matching rules.\n';
    code += 'pub fn dispatch_event(event: &Event, engine: &mut Engine) {\n';

    if (this.rulesByEvent.size > 0) {
      code += '    let event_type = event.event_type;\n\n';

      let first = true;
      for (const [eventName, rules] of this.rulesByEvent) {
        const constName = this.stringConstName(eventName);
        code += `    ${first ? 'if' : '} else if'} event_type == string_ids::${constName} {\n`;
        for (const rule of rules) {
          code += `        rules::${rule.funcName}(event, engine);\n`;
        }
        first = false;
      }
      code += '    }\n';
    }

    code += '}\n';
    return code;
  }

  // ── JSON bridge file generation (for WASM/JS interop) ──

  /**
   * Generate json_bridge.rs: functions for adding components from JSON
   * and reading component state as JSON.  Used by the WASM entry point
   * so JavaScript can create entities and read back component values
   * without knowing the concrete Rust types.
   */
  private generateJsonBridgeFile(): string {
    let code = '// Generated by blink-compiler-ts - do not edit\n';
    code += '// JSON bridge: component serialisation/deserialisation for WASM↔JS interop\n';
    code += '#![allow(dead_code, unused_imports)]\n\n';
    code += 'use blink_runtime::{Engine, EntityId};\n';
    code += 'use crate::components::*;\n\n';

    code += '/// Create a component from a JSON string and attach it to an entity.\n';
    code += '/// Returns true on success, false if the component name is unknown or the JSON is invalid.\n';
    code += 'pub fn add_component_from_json(\n';
    code += '    engine: &mut Engine,\n';
    code += '    entity_id: EntityId,\n';
    code += '    component_name: &str,\n';
    code += '    fields_json: &str,\n';
    code += ') -> bool {\n';
    code += '    let v: serde_json::Value = match serde_json::from_str(fields_json) {\n';
    code += '        Ok(v) => v,\n';
    code += '        Err(_) => return false,\n';
    code += '    };\n';
    code += '    match component_name {\n';

    for (const comp of this.componentDefs) {
      code += `        "${comp.name}" => {\n`;
      code += `            let comp = ${comp.name} {\n`;
      for (const field of comp.fields) {
        const rustField = this.toSnakeCase(field.name);
        const jsonKey = field.name;
        code += `                ${rustField}: ${this.jsonDeserField(field.fieldType, jsonKey)},\n`;
      }
      code += `            };\n`;
      code += `            engine.world.insert(entity_id, comp);\n`;
      code += `            true\n`;
      code += `        }\n`;
    }

    code += '        _ => false,\n';
    code += '    }\n';
    code += '}\n\n';

    code += '/// Serialise a component to a JSON string.\n';
    code += '/// Returns `"{}"` if the entity does not have the component.\n';
    code += 'pub fn get_component_json(\n';
    code += '    engine: &Engine,\n';
    code += '    entity_id: EntityId,\n';
    code += '    component_name: &str,\n';
    code += ') -> String {\n';
    code += '    match component_name {\n';

    for (const comp of this.componentDefs) {
      code += `        "${comp.name}" => {\n`;
      code += `            if let Some(c) = engine.world.try_get::<${comp.name}>(entity_id) {\n`;
      code += `                serde_json::json!({\n`;
      for (const field of comp.fields) {
        const rustField = this.toSnakeCase(field.name);
        const jsonKey = field.name;
        code += `                    "${jsonKey}": ${this.jsonSerField(field.fieldType, `c.${rustField}`)},\n`;
      }
      code += `                }).to_string()\n`;
      code += `            } else {\n`;
      code += `                "{}".to_string()\n`;
      code += `            }\n`;
      code += `        }\n`;
    }

    code += '        _ => "{}".to_string(),\n';
    code += '    }\n';
    code += '}\n';

    return code;
  }

  /**
   * Generate Rust expression that deserialises one JSON field into the target Rust type.
   * `jsonKey` is the key in the JSON object (original BRL camelCase name).
   */
  private jsonDeserField(type: AST.TypeExpr, jsonKey: string): string {
    switch (type.type) {
      case 'integer':
        // Accept both integer and float JSON numbers (JS doesn't distinguish).
        // Bind the field value once to avoid a double map lookup.
        return `{ let _v = &v["${jsonKey}"]; _v.as_i64().or_else(|| _v.as_f64().map(|f| f as i64)).unwrap_or(0) }`;
      case 'float':
      case 'decimal':
      case 'number':
        return `v["${jsonKey}"].as_f64().unwrap_or(0.0)`;
      case 'boolean':
        return `v["${jsonKey}"].as_bool().unwrap_or(false)`;
      case 'string':
        return `engine.interner.intern(v["${jsonKey}"].as_str().unwrap_or(""))`;
      case 'id':
      case 'component':
      case 'composite':
        return `v["${jsonKey}"].as_u64().unwrap_or(0) as EntityId`;
      case 'optional': {
        // Treat optional the same as its inner type; null maps to the zero value
        return this.jsonDeserField(type.inner, jsonKey);
      }
      case 'list':
        // Lists are not settable from JS via the bridge; initialise to empty
        return `vec![]`;
    }
  }

  /**
   * Generate a Rust expression that serialises one component field to a serde_json value.
   * `rustExpr` is the Rust expression for the field value.
   */
  private jsonSerField(type: AST.TypeExpr, rustExpr: string): string {
    switch (type.type) {
      case 'integer':
        return rustExpr;
      case 'float':
      case 'decimal':
      case 'number':
        return rustExpr;
      case 'boolean':
        return rustExpr;
      case 'string':
        // Resolve interned string back to its text
        return `engine.interner.resolve(${rustExpr})`;
      case 'id':
      case 'component':
      case 'composite':
        return rustExpr;
      case 'optional':
        return this.jsonSerField(type.inner, rustExpr);
      case 'list':
        return `serde_json::Value::Array(vec![])`;
    }
  }

  // ── Lib file generation ──

  private generateLibFile(): string {
    let code = '// Generated by blink-compiler-ts - do not edit\n';
    code += '#![allow(dead_code, unused_imports)]\n\n';
    code += 'pub mod components;\n';
    code += 'pub mod entities;\n';
    code += 'pub mod rules;\n';
    code += 'pub mod functions;\n';
    code += 'pub mod dispatch;\n';
    code += 'pub mod json_bridge;\n\n';

    // Generate string ID constants module
    code += '/// Interned string IDs - initialized at engine startup.\n';
    code += 'pub mod string_ids {\n';
    code += '    use blink_runtime::interning::InternedString;\n\n';

    // Generate a constant for each known string
    const sortedStrings = Array.from(this.allStrings).sort();
    for (const s of sortedStrings) {
      const constName = this.stringConstName(s);
      code += `    pub static ${constName}: InternedString = InternedString(${sortedStrings.indexOf(s) + 1});\n`;
    }
    code += '}\n\n';

    // Generate the component registration function
    code += 'use blink_runtime::{Engine, Event, InternedString, Value};\n';
    code += 'use crate::components::*;\n\n';

    code += '/// Register all component types with the engine.\n';
    code += 'pub fn register_components(engine: &mut Engine) {\n';
    for (const comp of this.componentDefs) {
      code += `    engine.world.register_component::<${comp.name}>();\n`;
    }
    code += '}\n\n';

    // Generate the init_string_table function
    code += '/// Initialize the string intern table with all known string literals.\n';
    code += 'pub fn init_string_table(engine: &mut Engine) {\n';
    for (const s of sortedStrings) {
      code += `    engine.interner.intern("${this.escapeRustString(s)}");\n`;
    }
    code += '}\n\n';

    // Generate the main init function
    code += '/// Initialize the game: register components, intern strings, create entities.\n';
    const hasNamedEntities = this.entityDefs.some(e => e.variable);
    if (hasNamedEntities) {
      code += 'pub fn init_game(engine: &mut Engine) -> entities::NamedEntities {\n';
    } else {
      code += 'pub fn init_game(engine: &mut Engine) {\n';
    }
    code += '    register_components(engine);\n';
    code += '    init_string_table(engine);\n';
    if (hasNamedEntities) {
      code += '    entities::create_initial_entities(engine)\n';
    } else {
      code += '    entities::create_initial_entities(engine);\n';
    }
    code += '}\n\n';

    // Generate step function
    code += '/// Process one event from the timeline.\n';
    code += '/// Returns true if an event was processed, false if timeline is empty.\n';
    code += 'pub fn step(engine: &mut Engine) -> bool {\n';
    code += '    if let Some(event) = engine.timeline.pop() {\n';
    code += '        dispatch::dispatch_event(&event, engine);\n';
    code += '        true\n';
    code += '    } else {\n';
    code += '        false\n';
    code += '    }\n';
    code += '}\n\n';

    // Generate run_steps function
    code += '/// Process up to max_steps events. Returns the number of events processed.\n';
    code += 'pub fn run_steps(engine: &mut Engine, max_steps: u32) -> u32 {\n';
    code += '    let mut count = 0;\n';
    code += '    for _ in 0..max_steps {\n';
    code += '        if !step(engine) {\n';
    code += '            break;\n';
    code += '        }\n';
    code += '        count += 1;\n';
    code += '    }\n';
    code += '    count\n';
    code += '}\n';

    return code;
  }

  // ── Statement generation ──

  private generateBlockStatements(block: AST.Block, indent: number): string {
    let code = '';
    for (const stmt of block.statements) {
      code += this.generateStatement(stmt, indent);
    }
    return code;
  }

  private generateStatement(stmt: AST.Statement, indent: number): string {
    const pad = '    '.repeat(indent);

    switch (stmt.type) {
      case 'let':
        return `${pad}let mut ${this.toSnakeCase(stmt.name)} = ${this.exprToRust(stmt.value)};\n`;

      case 'assignment':
        return this.generateAssignment(stmt, indent);

      case 'if':
        return this.generateIfStatement(stmt, indent);

      case 'for':
        return this.generateForStatement(stmt, indent);

      case 'while':
        return this.generateWhileStatement(stmt, indent);

      case 'schedule':
        return this.generateScheduleStatement(stmt, indent);

      case 'create':
        return this.generateCreateStatement(stmt, indent);

      case 'delete':
        return `${pad}engine.world.despawn(${this.exprToRust(stmt.entity)});\n`;

      case 'return':
        if (stmt.value) {
          return `${pad}return ${this.exprToRust(stmt.value)};\n`;
        }
        return `${pad}return;\n`;

      case 'cancel':
        return `${pad}engine.timeline.cancel(${this.exprToRust(stmt.target)} as u32);\n`;

      case 'expr':
        return `${pad}${this.exprToRust(stmt.expr)};\n`;
    }
  }

  private generateAssignment(stmt: AST.AssignmentStatement, indent: number): string {
    const pad = '    '.repeat(indent);

    // Simple identifier assignment (local variable)
    if (stmt.target.type === 'identifier') {
      const op = this.assignOpToRust(stmt.op);
      return `${pad}${this.toSnakeCase(stmt.target.name)} ${op} ${this.exprToRust(stmt.value)};\n`;
    }

    // Component field assignment: entity.Component.field = value
    if (stmt.target.type === 'field_access' && stmt.target.base.type === 'field_access') {
      const field = stmt.target.field;
      const baseAccess = stmt.target.base;
      const component = baseAccess.field;
      const entity = this.exprToRust(baseAccess.base);
      const rustField = this.toSnakeCase(field);
      const value = this.exprToRust(stmt.value);
      const op = this.assignOpToRust(stmt.op);

      return `${pad}engine.world.get_mut::<${component}>(${entity}).${rustField} ${op} ${value};\n`;
    }

    return `${pad}// TODO: unhandled assignment\n`;
  }

  private generateIfStatement(stmt: AST.IfStatement, indent: number): string {
    const pad = '    '.repeat(indent);
    let code = '';

    // Special case: "if entity has X" inside a query loop - becomes a runtime check
    if (stmt.condition.type === 'has_component') {
      const entityExpr = this.exprToRust(stmt.condition.entity);
      const comp = stmt.condition.component;
      code += `${pad}if engine.world.has::<${comp}>(${entityExpr}) {\n`;
    } else {
      code += `${pad}if ${this.exprToRust(stmt.condition)} {\n`;
    }

    code += this.generateBlockStatements(stmt.thenBlock, indent + 1);
    code += `${pad}}`;

    if (stmt.elseBlock) {
      if (stmt.elseBlock.type === 'else_if') {
        code += ` else `;
        code += this.generateIfStatement(stmt.elseBlock.statement, indent);
      } else {
        code += ` else {\n`;
        code += this.generateBlockStatements(stmt.elseBlock.block, indent + 1);
        code += `${pad}}`;
      }
    }

    code += '\n';
    return code;
  }

  private generateForStatement(stmt: AST.ForStatement, indent: number): string {
    const pad = '    '.repeat(indent);
    let code = '';

    if (stmt.iterable.type === 'entities_having') {
      code += `${pad}let ${this.toSnakeCase(stmt.variable)}_ids = engine.world.query_component::<${stmt.iterable.component}>();\n`;
      code += `${pad}for ${this.toSnakeCase(stmt.variable)} in ${this.toSnakeCase(stmt.variable)}_ids {\n`;
    } else {
      code += `${pad}for ${this.toSnakeCase(stmt.variable)} in ${this.exprToRust(stmt.iterable)} {\n`;
    }

    code += this.generateBlockStatements(stmt.body, indent + 1);
    code += `${pad}}\n`;
    return code;
  }

  private generateWhileStatement(stmt: AST.WhileStatement, indent: number): string {
    const pad = '    '.repeat(indent);
    let code = '';

    code += `${pad}let mut _while_iter = 0u32;\n`;
    code += `${pad}while ${this.exprToRust(stmt.condition)} {\n`;
    code += `${pad}    _while_iter += 1;\n`;
    code += `${pad}    if _while_iter > engine.max_while_iterations() {\n`;
    code += `${pad}        break;\n`;
    code += `${pad}    }\n`;
    code += this.generateBlockStatements(stmt.body, indent + 1);
    code += `${pad}}\n`;
    return code;
  }

  private generateScheduleStatement(stmt: AST.ScheduleStatement, indent: number): string {
    const pad = '    '.repeat(indent);
    let code = '';

    const eventConstName = this.stringConstName(stmt.eventName);

    code += `${pad}{\n`;
    code += `${pad}    let mut sched_event = blink_runtime::Event::new(string_ids::${eventConstName});\n`;

    // Set fields
    for (const [fieldName, value] of stmt.fields) {
      const fieldConst = this.stringConstName(fieldName);
      // For known field names, check if we have an interned constant
      if (this.allStrings.has(fieldName)) {
        code += `${pad}    sched_event.fields.insert(string_ids::${fieldConst}, ${this.exprToValueRust(value)});\n`;
      } else {
        // If the field name isn't in our string table, we need to add it
        this.allStrings.add(fieldName);
        code += `${pad}    sched_event.fields.insert(string_ids::${fieldConst}, ${this.exprToValueRust(value)});\n`;
      }
    }

    if (stmt.delay) {
      code += `${pad}    engine.timeline.schedule_delay(${this.exprToRust(stmt.delay)} as f64, sched_event);\n`;
    } else {
      code += `${pad}    engine.timeline.schedule_immediate(sched_event);\n`;
    }
    code += `${pad}}\n`;
    return code;
  }

  private generateCreateStatement(stmt: AST.CreateStatement, indent: number): string {
    const pad = '    '.repeat(indent);
    let code = '';

    code += `${pad}{\n`;
    code += `${pad}    let new_entity = engine.world.spawn();\n`;
    for (const comp of stmt.components) {
      code += `${pad}    engine.world.insert(new_entity, ${comp.name} {\n`;
      for (const [fieldName, value] of comp.fields) {
        code += `${pad}        ${this.toSnakeCase(fieldName)}: ${this.exprToRust(value)},\n`;
      }
      code += `${pad}    });\n`;
    }
    code += `${pad}}\n`;
    return code;
  }

  // ── Expression generation ──

  private exprToRust(expr: AST.Expr): string {
    switch (expr.type) {
      case 'literal':
        return this.literalToRust(expr);

      case 'identifier':
        // Check if this is the event alias
        if (this.currentEventAlias && expr.name === this.currentEventAlias) {
          return `${this.toSnakeCase(expr.name)}_source`;
        }
        if (expr.name === 'entity') {
          return 'entity_id';
        }
        return this.toSnakeCase(expr.name);

      case 'entity_ref':
        return `named.${this.toSnakeCase(expr.name)}`;

      case 'field_access':
        return this.fieldAccessToRust(expr);

      case 'index_access':
        return `${this.exprToRust(expr.base)}[${this.exprToRust(expr.index)} as usize]`;

      case 'binary':
        return this.binaryToRust(expr);

      case 'unary':
        if (expr.op === 'neg') {
          return `-(${this.exprToRust(expr.expr)})`;
        }
        return `!(${this.exprToRust(expr.expr)})`;

      case 'call':
        return this.callToRust(expr);

      case 'method_call':
        return this.callToRust({
          type: 'call',
          name: expr.method,
          args: [expr.base, ...expr.args],
          span: expr.span,
        });

      case 'has_component':
        return `engine.world.has::<${expr.component}>(${this.exprToRust(expr.entity)})`;

      case 'list':
        const elements = expr.elements.map(e => this.exprToRust(e)).join(', ');
        return `vec![${elements}]`;

      case 'paren':
        return `(${this.exprToRust(expr.inner)})`;

      case 'entities_having':
        return `engine.world.query_component::<${expr.component}>()`;

      case 'clone_entity':
        return `clone_entity(engine, ${this.exprToRust(expr.source)})`;

      case 'cast':
        return this.exprToRust(expr.expr);
    }
  }

  private literalToRust(expr: AST.LiteralExpr): string {
    switch (expr.value.type) {
      case 'string':
        return `string_ids::${this.stringConstName(expr.value.value)}`;
      case 'integer':
        return `${expr.value.value}`;
      case 'float':
        return `${expr.value.value}${expr.value.value.toString().includes('.') ? '' : '.0'}`;
      case 'decimal':
        return `${expr.value.value}`;
      case 'boolean':
        return `${expr.value.value}`;
      case 'null':
        return `blink_runtime::NO_ENTITY`;
    }
  }

  private fieldAccessToRust(expr: AST.FieldAccessExpr): string {
    // entity.Component.field → engine.world.get::<Component>(entity).field
    if (expr.base.type === 'field_access') {
      const baseAccess = expr.base;
      const component = baseAccess.field;
      const entity = this.exprToRust(baseAccess.base);
      const field = this.toSnakeCase(expr.field);
      return `engine.world.get::<${component}>(${entity}).${field}`;
    }

    // event alias field access → event.get_field() or event.source/target
    if (expr.base.type === 'identifier') {
      const baseName = expr.base.name;
      if (baseName === 'event' ||
        (this.currentEventAlias && baseName === this.currentEventAlias)) {
        const field = expr.field;
        if (field === 'source') {
          return 'event.source';
        }
        if (field === 'target') {
          return 'event.target';
        }
        // Event field access
        const fieldConst = this.stringConstName(field);
        this.allStrings.add(field);
        return `event.get_field(string_ids::${fieldConst}).as_entity()`;
      }
    }

    // Fallback: direct field access
    return `${this.exprToRust(expr.base)}.${this.toSnakeCase(expr.field)}`;
  }

  private binaryToRust(expr: AST.BinaryExpr): string {
    const left = this.exprToRust(expr.left);
    const right = this.exprToRust(expr.right);

    switch (expr.op) {
      case 'add': return `${left} + ${right}`;
      case 'sub': return `${left} - ${right}`;
      case 'mul': return `${left} * ${right}`;
      case 'div': return `${left} / ${right}`;
      case 'mod': return `${left} % ${right}`;
      case 'eq': return `${left} == ${right}`;
      case 'neq': return `${left} != ${right}`;
      case 'lt': return `${left} < ${right}`;
      case 'lte': return `${left} <= ${right}`;
      case 'gt': return `${left} > ${right}`;
      case 'gte': return `${left} >= ${right}`;
      case 'and': return `${left} && ${right}`;
      case 'or': return `${left} || ${right}`;
    }
  }

  private callToRust(expr: AST.CallExpr): string {
    const args = expr.args.map(a => this.exprToRust(a));

    // Built-in functions
    switch (expr.name) {
      case 'min': return `brl_min(${args[0]} as f64, ${args[1]} as f64)`;
      case 'max': return `brl_max(${args[0]} as f64, ${args[1]} as f64)`;
      case 'floor': return `brl_floor(${args[0]} as f64)`;
      case 'ceil': return `brl_ceil(${args[0]} as f64)`;
      case 'round': return `brl_round(${args[0]} as f64)`;
      case 'abs': return `brl_abs(${args[0]} as f64)`;
      case 'random': return `engine.rng.random()`;
      case 'random_range': return `engine.rng.random_range(${args[0]} as f64, ${args[1]} as f64)`;
      case 'len': return `(${args[0]}).len() as i64`;
      case 'entities_having': return `engine.world.query_component::<${this.extractComponentName(expr.args[0])}>()`;
      default:
        // User-defined function
        return `${this.toSnakeCase(expr.name)}(${args.join(', ')})`;
    }
  }

  /**
   * Convert an expression to a Value enum variant (for event fields).
   */
  private exprToValueRust(expr: AST.Expr): string {
    if (expr.type === 'literal') {
      switch (expr.value.type) {
        case 'integer': return `Value::Integer(${expr.value.value})`;
        case 'float': return `Value::Number(${expr.value.value}${expr.value.value.toString().includes('.') ? '' : '.0'})`;
        case 'string': return `Value::String(string_ids::${this.stringConstName(expr.value.value)})`;
        case 'boolean': return `Value::Boolean(${expr.value.value})`;
        case 'null': return `Value::None`;
      }
    }
    // For expressions that evaluate to entities, wrap in Value::Entity
    return `Value::Entity(${this.exprToRust(expr)})`;
  }

  // ── Utility methods ──

  private extractComponentName(expr: AST.Expr): string {
    if (expr.type === 'literal' && expr.value.type === 'string') {
      return expr.value.value;
    }
    if (expr.type === 'identifier') {
      return expr.name;
    }
    return 'Unknown';
  }

  private typeToRust(type: AST.TypeExpr): string {
    switch (type.type) {
      case 'string': return 'InternedString';
      case 'boolean': return 'bool';
      case 'integer': return 'i64';
      case 'float':
      case 'decimal':
      case 'number': return 'f64';
      case 'id': return 'EntityId';
      case 'component': return 'EntityId';
      case 'list': return `Vec<${this.typeToRust(type.element)}>`;
      case 'optional': return `${this.typeToRust(type.inner)}`;
      case 'composite': return 'EntityId';
    }
  }

  private assignOpToRust(op: AST.AssignOp): string {
    switch (op) {
      case 'assign': return '=';
      case 'add_assign': return '+=';
      case 'sub_assign': return '-=';
      case 'mul_assign': return '*=';
      case 'div_assign': return '/=';
    }
  }

  private toSnakeCase(name: string): string {
    // Handle already-snake_case names
    if (name.includes('_') && name === name.toLowerCase()) return name;
    // Convert camelCase to snake_case
    return name
      .replace(/([A-Z])/g, '_$1')
      .toLowerCase()
      .replace(/^_/, '');
  }

  private stringConstName(s: string): string {
    const upper = s
      .replace(/([A-Z])/g, '_$1')
      .toUpperCase()
      .replace(/^_/, '')
      .replace(/[^A-Z0-9]/g, '_');
    return `STR_${upper}`;
  }

  private escapeRustString(s: string): string {
    return s
      .replace(/\\/g, '\\\\')
      .replace(/"/g, '\\"')
      .replace(/\n/g, '\\n')
      .replace(/\r/g, '\\r')
      .replace(/\t/g, '\\t');
  }

  private ruleFuncName(rule: AST.RuleDef): string {
    const idx = this.ruleCounter++;
    if (rule.name) {
      return `rule_${this.toSnakeCase(rule.name)}`;
    }
    return `rule_anonymous_${idx}`;
  }
}

/**
 * Generate Rust source code from BRL AST modules.
 */
export function generateRust(
  modules: AST.Module[],
  options: RustCodegenOptions = {}
): RustCodegenResult {
  const generator = new RustCodeGenerator(options);
  return generator.generate(modules);
}
