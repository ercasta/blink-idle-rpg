//! IR Generator for Blink Compiler
//!
//! Generates the Intermediate Representation (IR) from typed AST.
//! The IR format follows the specification in doc/ir-specification.md.

use serde::{Deserialize, Serialize};
use indexmap::IndexMap;
use thiserror::Error;

use crate::analyzer::{
    TypedModule, TypedItem, TypedComponent, TypedField, TypedRule, TypedFunction,
    TypedTracker, TypedEntity, TypedBlock, TypedStatement, TypedExpr, TypedExprKind,
    TypedElseClause, TypedComponentInit, TypedBoundFunction, Type,
};
use crate::parser::{Literal, BinaryOp, UnaryOp, AssignOp};
use crate::CompilerOptions;

/// IR generation error type
#[derive(Error, Debug)]
pub enum IRError {
    #[error("IR generation error: {0}")]
    GenerationError(String),
}

/// Source file entry for source mapping
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SourceFile {
    /// File path relative to project root
    pub path: String,
    /// Full source content
    pub content: String,
    /// Language type (brl, bcl, or bdl)
    pub language: String,
}

/// Source map for the entire IR module
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SourceMap {
    /// List of source files included in compilation
    pub files: Vec<SourceFile>,
}

/// Blink IR Module - the central contract for all engines
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IRModule {
    /// IR format version
    pub version: String,
    
    /// Module name
    pub module: String,
    
    /// Compiler metadata
    #[serde(skip_serializing_if = "Option::is_none")]
    pub metadata: Option<IRMetadata>,
    
    /// Component definitions
    pub components: Vec<IRComponent>,
    
    /// Rule definitions
    pub rules: Vec<IRRule>,
    
    /// Function definitions
    pub functions: Vec<IRFunction>,
    
    /// Tracker definitions
    pub trackers: Vec<IRTracker>,
    
    /// Constants
    #[serde(skip_serializing_if = "IndexMap::is_empty")]
    #[serde(default)]
    pub constants: IndexMap<String, IRValue>,
    
    /// Initial state (optional)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub initial_state: Option<IRInitialState>,
    
    /// Source map for debugging (optional, included when --source-map flag is used)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub source_map: Option<SourceMap>,
}

/// Compiler metadata
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IRMetadata {
    pub compiled_at: String,
    pub compiler_version: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub source_hash: Option<String>,
}

/// Component definition in IR
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IRComponent {
    /// Unique component ID
    pub id: u32,
    
    /// Component name
    pub name: String,
    
    /// Field definitions
    pub fields: Vec<IRField>,
}

/// Field definition in IR
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IRField {
    /// Field name
    pub name: String,
    
    /// Field type
    #[serde(rename = "type")]
    pub field_type: IRType,
    
    /// Default value (optional)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub default: Option<IRValue>,
}

/// Type representation in IR
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type")]
pub enum IRType {
    #[serde(rename = "number")]
    Number,
    
    #[serde(rename = "string")]
    String,
    
    #[serde(rename = "boolean")]
    Boolean,
    
    #[serde(rename = "entity")]
    Entity,
    
    #[serde(rename = "list")]
    List { element: Box<IRType> },
    
    #[serde(rename = "map")]
    Map { key: Box<IRType>, value: Box<IRType> },
}

/// Value representation in IR
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(untagged)]
pub enum IRValue {
    Null,
    Boolean(bool),
    Number(f64),
    String(String),
    List(Vec<IRValue>),
    Object(IndexMap<String, IRValue>),
}

/// Rule definition in IR
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IRRule {
    /// Unique rule ID
    pub id: u32,
    
    /// Rule name (optional)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub name: Option<String>,
    
    /// Trigger configuration
    pub trigger: IRTrigger,
    
    /// Component filter (optional)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub filter: Option<IRFilter>,
    
    /// Condition expression (optional)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub condition: Option<IRExpression>,
    
    /// Actions to execute
    pub actions: Vec<IRAction>,
}

/// Trigger definition in IR
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IRTrigger {
    /// Trigger type
    #[serde(rename = "type")]
    pub trigger_type: String,
    
    /// Event name (for event triggers)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub event: Option<String>,
    
    /// Variable bindings
    #[serde(skip_serializing_if = "Option::is_none")]
    pub bindings: Option<IndexMap<String, String>>,
}

/// Filter definition in IR
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IRFilter {
    /// Required components
    #[serde(skip_serializing_if = "Vec::is_empty")]
    #[serde(default)]
    pub components: Vec<String>,
}

/// Expression representation in IR
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type")]
pub enum IRExpression {
    /// Literal value
    #[serde(rename = "literal")]
    Literal { value: IRValue },
    
    /// Variable reference
    #[serde(rename = "var")]
    Var { name: String },
    
    /// Parameter reference (in functions)
    #[serde(rename = "param")]
    Param { name: String },
    
    /// Field access
    #[serde(rename = "field")]
    Field {
        entity: String,
        component: String,
        field: String,
    },
    
    /// Binary operation
    #[serde(rename = "binary")]
    Binary {
        op: String,
        left: Box<IRExpression>,
        right: Box<IRExpression>,
    },
    
    /// Unary operation
    #[serde(rename = "unary")]
    Unary {
        op: String,
        expr: Box<IRExpression>,
    },
    
    /// Function call
    #[serde(rename = "call")]
    Call {
        function: String,
        args: Vec<IRExpression>,
    },
    
    /// Conditional expression
    #[serde(rename = "if")]
    If {
        condition: Box<IRExpression>,
        then: Box<IRExpression>,
        #[serde(rename = "else")]
        else_expr: Box<IRExpression>,
    },
}

/// Action representation in IR
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type")]
pub enum IRAction {
    /// Modify a component field
    #[serde(rename = "modify")]
    Modify {
        entity: IRExpression,
        component: String,
        field: String,
        op: String,
        value: IRExpression,
    },
    
    /// Schedule an event
    #[serde(rename = "schedule")]
    Schedule {
        event: String,
        #[serde(skip_serializing_if = "Option::is_none")]
        source: Option<IRExpression>,
        #[serde(skip_serializing_if = "Option::is_none")]
        delay: Option<IRExpression>,
        #[serde(skip_serializing_if = "Option::is_none")]
        fields: Option<IndexMap<String, IRExpression>>,
    },
    
    /// Emit immediate event
    #[serde(rename = "emit")]
    Emit {
        event: String,
        #[serde(skip_serializing_if = "Option::is_none")]
        fields: Option<IndexMap<String, IRExpression>>,
    },
    
    /// Spawn entity
    #[serde(rename = "spawn")]
    Spawn {
        components: Vec<IRComponentInit>,
    },
    
    /// Despawn entity
    #[serde(rename = "despawn")]
    Despawn {
        entity: IRExpression,
    },
    
    /// Add component to entity
    #[serde(rename = "add_component")]
    AddComponent {
        entity: IRExpression,
        component: IRComponentInit,
    },
    
    /// Remove component from entity
    #[serde(rename = "remove_component")]
    RemoveComponent {
        entity: IRExpression,
        component: String,
    },
    
    /// Conditional action
    #[serde(rename = "conditional")]
    Conditional {
        condition: IRExpression,
        then_actions: Vec<IRAction>,
        #[serde(skip_serializing_if = "Option::is_none")]
        else_actions: Option<Vec<IRAction>>,
    },
    
    /// Loop action
    #[serde(rename = "loop")]
    Loop {
        variable: String,
        iterable: IRExpression,
        body: Vec<IRAction>,
    },
}

/// Component initialization in IR
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IRComponentInit {
    pub name: String,
    pub fields: IndexMap<String, IRExpression>,
}

/// Function definition in IR
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IRFunction {
    /// Unique function ID
    pub id: u32,
    
    /// Function name
    pub name: String,
    
    /// Parameters
    pub params: Vec<IRParam>,
    
    /// Return type
    pub return_type: IRType,
    
    /// Function body (expression tree)
    pub body: IRExpression,
}

/// Function parameter in IR
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IRParam {
    pub name: String,
    #[serde(rename = "type")]
    pub param_type: IRType,
}

/// Tracker definition in IR
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IRTracker {
    /// Unique tracker ID
    pub id: u32,
    
    /// Component to track
    pub component: String,
    
    /// Event that triggers tracking
    pub event: String,
}

/// Initial state in IR
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IRInitialState {
    pub entities: Vec<IREntity>,
}

/// Entity definition in initial state
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IREntity {
    /// Numeric entity ID
    pub id: u32,
    /// Optional entity name (e.g., "warrior", "goblin_scout")
    #[serde(skip_serializing_if = "Option::is_none")]
    pub name: Option<String>,
    /// Component data for this entity
    pub components: IndexMap<String, IndexMap<String, IRValue>>,
    /// Bound choice functions for this entity (BCL)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub bound_functions: Option<IndexMap<String, IRBoundFunction>>,
}

/// Bound function definition in IR (choice function bound to an entity)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IRBoundFunction {
    /// Function parameters
    pub params: Vec<IRParam>,
    /// Return type
    pub return_type: IRType,
    /// Function body (expression tree)
    pub body: IRExpression,
    /// Original source code (for UI display)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub source: Option<String>,
}

/// IR Generator context
struct IRGenerator {
    component_id_counter: u32,
    rule_id_counter: u32,
    function_id_counter: u32,
    tracker_id_counter: u32,
    entity_id_counter: u32,
}

impl IRGenerator {
    fn new() -> Self {
        Self {
            component_id_counter: 0,
            rule_id_counter: 0,
            function_id_counter: 0,
            tracker_id_counter: 0,
            entity_id_counter: 0,
        }
    }
    
    fn next_component_id(&mut self) -> u32 {
        let id = self.component_id_counter;
        self.component_id_counter += 1;
        id
    }
    
    fn next_rule_id(&mut self) -> u32 {
        let id = self.rule_id_counter;
        self.rule_id_counter += 1;
        id
    }
    
    fn next_function_id(&mut self) -> u32 {
        let id = self.function_id_counter;
        self.function_id_counter += 1;
        id
    }
    
    fn next_tracker_id(&mut self) -> u32 {
        let id = self.tracker_id_counter;
        self.tracker_id_counter += 1;
        id
    }
    
    fn next_entity_id(&mut self) -> u32 {
        let id = self.entity_id_counter;
        self.entity_id_counter += 1;
        id
    }
    
    fn generate(&mut self, typed_module: TypedModule, options: &CompilerOptions, source: Option<&str>, source_path: Option<&str>, additional_sources: &[(String, String, String)]) -> Result<IRModule, IRError> {
        let mut components = Vec::new();
        let mut rules = Vec::new();
        let mut functions = Vec::new();
        let mut trackers = Vec::new();
        let mut entities = Vec::new();
        
        for item in &typed_module.items {
            match item {
                TypedItem::Component(comp) => {
                    components.push(self.generate_component(comp));
                }
                TypedItem::Rule(rule) => {
                    rules.push(self.generate_rule(rule));
                }
                TypedItem::Function(func) => {
                    functions.push(self.generate_function(func));
                }
                TypedItem::Tracker(tracker) => {
                    trackers.push(self.generate_tracker(tracker));
                }
                TypedItem::Entity(entity) => {
                    entities.push(self.generate_entity(entity));
                }
            }
        }
        
        // Build source map if requested and source is provided
        let source_map = if options.include_source_map {
            let mut files = Vec::new();
            
            // Add main BRL source file
            if let (Some(src), Some(path)) = (source, source_path) {
                // Determine language from file extension
                let language = if path.ends_with(".bcl") {
                    "bcl".to_string()
                } else if path.ends_with(".bdl") {
                    "bdl".to_string()
                } else {
                    "brl".to_string()
                };
                
                files.push(SourceFile {
                    path: path.to_string(),
                    content: src.to_string(),
                    language,
                });
            }
            
            // Add additional source files (BCL, BDL, etc.)
            for (path, content, language) in additional_sources {
                files.push(SourceFile {
                    path: path.clone(),
                    content: content.clone(),
                    language: language.clone(),
                });
            }
            
            if files.is_empty() {
                None
            } else {
                Some(SourceMap { files })
            }
        } else {
            None
        };
        
        // Build initial_state from entities (BDL support)
        let initial_state = if entities.is_empty() {
            None
        } else {
            Some(IRInitialState { entities })
        };
        
        Ok(IRModule {
            version: "1.0".to_string(),
            module: "unnamed".to_string(),
            metadata: Some(IRMetadata {
                compiled_at: generate_timestamp(),
                compiler_version: env!("CARGO_PKG_VERSION").to_string(),
                source_hash: None,
            }),
            components,
            rules,
            functions,
            trackers,
            constants: IndexMap::new(),
            initial_state,
            source_map,
        })
    }
    
    fn generate_component(&mut self, comp: &TypedComponent) -> IRComponent {
        IRComponent {
            id: self.next_component_id(),
            name: comp.name.clone(),
            fields: comp.fields.iter().map(|f| self.generate_field(f)).collect(),
        }
    }
    
    fn generate_field(&self, field: &TypedField) -> IRField {
        IRField {
            name: field.name.clone(),
            field_type: self.convert_type(&field.field_type),
            default: None,
        }
    }
    
    fn convert_type(&self, typ: &Type) -> IRType {
        match typ {
            Type::String => IRType::String,
            Type::Boolean => IRType::Boolean,
            Type::Integer | Type::Float | Type::Decimal => IRType::Number,
            Type::EntityId => IRType::Entity,
            Type::Component(_) => IRType::Entity, // Components are accessed via entity
            Type::Composite(_) => IRType::Entity, // Composite types represent entity constraints
            Type::List(inner) => IRType::List {
                element: Box::new(self.convert_type(inner)),
            },
            Type::Optional(inner) => self.convert_type(inner), // Optional handled separately
            Type::Void | Type::Unknown => IRType::Number, // Default
        }
    }
    
    fn generate_rule(&mut self, rule: &TypedRule) -> IRRule {
        let actions = self.generate_block_actions(&rule.body);
        
        IRRule {
            id: self.next_rule_id(),
            name: rule.name.clone(),
            trigger: IRTrigger {
                trigger_type: "event".to_string(),
                event: Some(rule.trigger_event.clone()),
                bindings: None,
            },
            filter: None,
            condition: rule.condition.as_ref().map(|c| self.generate_expression(c)),
            actions,
        }
    }
    
    fn generate_block_actions(&self, block: &TypedBlock) -> Vec<IRAction> {
        let mut actions = Vec::new();
        
        for stmt in &block.statements {
            if let Some(action) = self.generate_statement_action(stmt) {
                actions.push(action);
            }
        }
        
        actions
    }
    
    fn generate_statement_action(&self, stmt: &TypedStatement) -> Option<IRAction> {
        match stmt {
            TypedStatement::Assignment { target, op, value } => {
                // Convert assignment to modify action
                if let TypedExprKind::FieldAccess(base, field) = &target.kind {
                    let (entity, component) = self.extract_entity_component(base);
                    Some(IRAction::Modify {
                        entity: self.generate_expression_from_kind(&entity.kind),
                        component,
                        field: field.clone(),
                        op: self.convert_assign_op(op),
                        value: self.generate_expression(value),
                    })
                } else {
                    None
                }
            }
            TypedStatement::If { condition, then_block, else_block } => {
                let then_actions = self.generate_block_actions(then_block);
                let else_actions = else_block.as_ref().map(|clause| {
                    self.generate_else_clause_actions(clause)
                });
                
                Some(IRAction::Conditional {
                    condition: self.generate_expression(condition),
                    then_actions,
                    else_actions,
                })
            }
            TypedStatement::For { variable, iterable, body } => {
                let body_actions = self.generate_block_actions(body);
                
                Some(IRAction::Loop {
                    variable: variable.clone(),
                    iterable: self.generate_expression(iterable),
                    body: body_actions,
                })
            }
            TypedStatement::Schedule { recurring: _, delay, event_name, fields, .. } => {
                let mut field_map = IndexMap::new();
                for (name, expr) in fields {
                    field_map.insert(name.clone(), self.generate_expression(expr));
                }
                
                Some(IRAction::Schedule {
                    event: event_name.clone(),
                    source: None,
                    delay: delay.as_ref().map(|d| self.generate_expression(d)),
                    fields: if field_map.is_empty() { None } else { Some(field_map) },
                })
            }
            TypedStatement::Create { components } => {
                let ir_components: Vec<_> = components.iter().map(|c| {
                    self.generate_component_init(c)
                }).collect();
                
                Some(IRAction::Spawn {
                    components: ir_components,
                })
            }
            TypedStatement::Delete { entity } => {
                Some(IRAction::Despawn {
                    entity: self.generate_expression(entity),
                })
            }
            _ => None,
        }
    }
    
    fn generate_else_clause_actions(&self, clause: &TypedElseClause) -> Vec<IRAction> {
        match clause {
            TypedElseClause::ElseIf { condition, then_block, else_block } => {
                let then_actions = self.generate_block_actions(then_block);
                let else_actions = else_block.as_ref().map(|c| {
                    self.generate_else_clause_actions(c)
                });
                
                vec![IRAction::Conditional {
                    condition: self.generate_expression(condition),
                    then_actions,
                    else_actions,
                }]
            }
            TypedElseClause::Else(block) => {
                self.generate_block_actions(block)
            }
        }
    }
    
    fn extract_entity_component(&self, expr: &TypedExpr) -> (TypedExpr, String) {
        match &expr.kind {
            TypedExprKind::FieldAccess(base, component) => {
                ((**base).clone(), component.clone())
            }
            _ => (expr.clone(), "Unknown".to_string()),
        }
    }
    
    fn convert_assign_op(&self, op: &AssignOp) -> String {
        match op {
            AssignOp::Assign => "set".to_string(),
            AssignOp::AddAssign => "add".to_string(),
            AssignOp::SubAssign => "subtract".to_string(),
            AssignOp::MulAssign => "multiply".to_string(),
            AssignOp::DivAssign => "divide".to_string(),
        }
    }
    
    fn generate_component_init(&self, init: &TypedComponentInit) -> IRComponentInit {
        let mut fields = IndexMap::new();
        for (name, expr) in &init.fields {
            fields.insert(name.clone(), self.generate_expression(expr));
        }
        
        IRComponentInit {
            name: init.name.clone(),
            fields,
        }
    }
    
    fn generate_function(&mut self, func: &TypedFunction) -> IRFunction {
        let params: Vec<_> = func.params.iter().map(|p| {
            IRParam {
                name: p.name.clone(),
                param_type: self.convert_type(&p.param_type),
            }
        }).collect();
        
        // For now, generate a placeholder body
        // A proper implementation would generate the expression tree from the function body
        let body = self.generate_function_body(&func.body);
        
        IRFunction {
            id: self.next_function_id(),
            name: func.name.clone(),
            params,
            return_type: self.convert_type(&func.return_type),
            body,
        }
    }
    
    fn generate_function_body(&self, block: &TypedBlock) -> IRExpression {
        // Find return statement and use its value
        for stmt in &block.statements {
            if let TypedStatement::Return { value: Some(expr) } = stmt {
                return self.generate_expression(expr);
            }
        }
        
        // Default to literal 0
        IRExpression::Literal { value: IRValue::Number(0.0) }
    }
    
    fn generate_tracker(&mut self, tracker: &TypedTracker) -> IRTracker {
        IRTracker {
            id: self.next_tracker_id(),
            component: tracker.component.clone(),
            event: tracker.event.clone(),
        }
    }
    
    /// Generate an IR entity from a typed entity (BDL support)
    fn generate_entity(&mut self, entity: &TypedEntity) -> IREntity {
        let id = self.next_entity_id();
        
        // Build component data - each component is a map of field names to values
        let mut components = IndexMap::new();
        for comp in &entity.components {
            let mut fields = IndexMap::new();
            for (field_name, expr) in &comp.fields {
                // Convert expression to IRValue (for entity definitions, we only support literals)
                let value = self.expression_to_value(expr);
                fields.insert(field_name.clone(), value);
            }
            components.insert(comp.name.clone(), fields);
        }
        
        // Build bound functions if any
        let bound_functions = if entity.bound_functions.is_empty() {
            None
        } else {
            let mut funcs = IndexMap::new();
            for func in &entity.bound_functions {
                funcs.insert(func.name.clone(), self.generate_bound_function(func));
            }
            Some(funcs)
        };
        
        IREntity {
            id,
            name: entity.name.clone(),
            components,
            bound_functions,
        }
    }
    
    /// Generate an IR bound function from a typed bound function
    fn generate_bound_function(&self, func: &TypedBoundFunction) -> IRBoundFunction {
        let params: Vec<_> = func.params.iter().map(|p| {
            IRParam {
                name: p.name.clone(),
                param_type: self.convert_type(&p.param_type),
            }
        }).collect();
        
        let body = self.generate_function_body(&func.body);
        
        IRBoundFunction {
            params,
            return_type: self.convert_type(&func.return_type),
            body,
            source: None, // TODO: Include source text when source map is enabled
        }
    }
    
    /// Convert a typed expression to an IRValue (for entity field initialization)
    /// 
    /// Note: BDL only allows literal values in entity field initialization.
    /// If a non-literal expression is encountered, this indicates invalid BDL syntax
    /// that wasn't caught by the parser. The analyzer should reject such cases.
    fn expression_to_value(&self, expr: &TypedExpr) -> IRValue {
        match &expr.kind {
            TypedExprKind::Literal(lit) => self.convert_literal(lit),
            _ => {
                // BDL specification prohibits expressions in entity fields.
                // This should be caught earlier in validation, but as a safety measure,
                // we log a warning and return null rather than panicking.
                // A stricter implementation could return an error here.
                eprintln!("Warning: Non-literal expression in entity field (BDL violation). Using null.");
                IRValue::Null
            }
        }
    }
    
    fn generate_expression(&self, expr: &TypedExpr) -> IRExpression {
        self.generate_expression_from_kind(&expr.kind)
    }
    
    fn generate_expression_from_kind(&self, kind: &TypedExprKind) -> IRExpression {
        match kind {
            TypedExprKind::Literal(lit) => {
                IRExpression::Literal { value: self.convert_literal(lit) }
            }
            TypedExprKind::Identifier(name) => {
                IRExpression::Var { name: name.clone() }
            }
            TypedExprKind::EntityRef(name) => {
                IRExpression::Var { name: format!("@{}", name) }
            }
            TypedExprKind::FieldAccess(base, field) => {
                // Try to extract entity and component
                if let TypedExprKind::FieldAccess(entity_expr, component) = &base.kind {
                    if let TypedExprKind::Identifier(entity) = &entity_expr.kind {
                        return IRExpression::Field {
                            entity: entity.clone(),
                            component: component.clone(),
                            field: field.clone(),
                        };
                    }
                }
                
                // Fallback
                IRExpression::Var { name: field.clone() }
            }
            TypedExprKind::Binary(left, op, right) => {
                IRExpression::Binary {
                    op: self.convert_binary_op(op),
                    left: Box::new(self.generate_expression(left)),
                    right: Box::new(self.generate_expression(right)),
                }
            }
            TypedExprKind::Unary(op, inner) => {
                IRExpression::Unary {
                    op: self.convert_unary_op(op),
                    expr: Box::new(self.generate_expression(inner)),
                }
            }
            TypedExprKind::Call(name, args) => {
                IRExpression::Call {
                    function: name.clone(),
                    args: args.iter().map(|a| self.generate_expression(a)).collect(),
                }
            }
            TypedExprKind::IndexAccess(base, index) => {
                // For simplicity, represent as call to 'get' function
                IRExpression::Call {
                    function: "get".to_string(),
                    args: vec![
                        self.generate_expression(base),
                        self.generate_expression(index),
                    ],
                }
            }
            TypedExprKind::List(elements) => {
                // List literal as a special call
                IRExpression::Call {
                    function: "list".to_string(),
                    args: elements.iter().map(|e| self.generate_expression(e)).collect(),
                }
            }
            _ => IRExpression::Literal { value: IRValue::Null },
        }
    }
    
    fn convert_literal(&self, lit: &Literal) -> IRValue {
        match lit {
            Literal::String(s) => IRValue::String(s.clone()),
            Literal::Integer(n) => IRValue::Number(*n as f64),
            Literal::Float(n) => IRValue::Number(*n),
            Literal::Decimal(s) => {
                // Parse decimal string to f64
                s.parse::<f64>().map(IRValue::Number).unwrap_or(IRValue::Null)
            }
            Literal::Boolean(b) => IRValue::Boolean(*b),
            Literal::Null => IRValue::Null,
        }
    }
    
    fn convert_binary_op(&self, op: &BinaryOp) -> String {
        match op {
            BinaryOp::Add => "add".to_string(),
            BinaryOp::Sub => "subtract".to_string(),
            BinaryOp::Mul => "multiply".to_string(),
            BinaryOp::Div => "divide".to_string(),
            BinaryOp::Mod => "modulo".to_string(),
            BinaryOp::Eq => "eq".to_string(),
            BinaryOp::NotEq => "neq".to_string(),
            BinaryOp::Lt => "lt".to_string(),
            BinaryOp::LtEq => "lte".to_string(),
            BinaryOp::Gt => "gt".to_string(),
            BinaryOp::GtEq => "gte".to_string(),
            BinaryOp::And => "and".to_string(),
            BinaryOp::Or => "or".to_string(),
        }
    }
    
    fn convert_unary_op(&self, op: &UnaryOp) -> String {
        match op {
            UnaryOp::Neg => "negate".to_string(),
            UnaryOp::Not => "not".to_string(),
        }
    }
}

/// Generate timestamp using std::time
fn generate_timestamp() -> String {
    use std::time::{SystemTime, UNIX_EPOCH};
    
    let duration = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default();
    
    // Simple ISO 8601 format approximation
    let secs = duration.as_secs();
    let days_since_epoch = secs / 86400;
    let remaining_secs = secs % 86400;
    let hours = remaining_secs / 3600;
    let minutes = (remaining_secs % 3600) / 60;
    let seconds = remaining_secs % 60;
    
    // Calculate approximate date (not accounting for leap years perfectly)
    let years_since_1970 = days_since_epoch / 365;
    let year = 1970 + years_since_1970;
    let days_in_year = days_since_epoch % 365;
    
    // Simple month/day approximation
    let month = (days_in_year / 30) + 1;
    let day = (days_in_year % 30) + 1;
    
    format!(
        "{:04}-{:02}-{:02}T{:02}:{:02}:{:02}Z",
        year, month.min(12), day.min(31), hours, minutes, seconds
    )
}

/// Generate IR from typed AST
pub fn generate(typed_module: TypedModule, options: &CompilerOptions) -> Result<IRModule, String> {
    let mut generator = IRGenerator::new();
    generator.generate(typed_module, options, None, None, &[])
        .map_err(|e| e.to_string())
}

/// Generate IR from typed AST with source content for source maps
pub fn generate_with_source(
    typed_module: TypedModule,
    options: &CompilerOptions,
    source: &str,
    source_path: &str,
) -> Result<IRModule, String> {
    let mut generator = IRGenerator::new();
    generator.generate(typed_module, options, Some(source), Some(source_path), &[])
        .map_err(|e| e.to_string())
}

/// Generate IR from typed AST with source content and additional source files for source maps
pub fn generate_with_sources(
    typed_module: TypedModule,
    options: &CompilerOptions,
    source: &str,
    source_path: Option<&str>,
    additional_sources: &[(String, String, String)],
) -> Result<IRModule, String> {
    let mut generator = IRGenerator::new();
    generator.generate(typed_module, options, Some(source), source_path, additional_sources)
        .map_err(|e| e.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::lexer::tokenize;
    use crate::parser::parse;
    use crate::analyzer::analyze;

    #[test]
    fn test_generate_empty() {
        let tokens = tokenize("").unwrap();
        let ast = parse(tokens).unwrap();
        let typed = analyze(ast).unwrap();
        let ir = generate(typed, &CompilerOptions::default()).unwrap();
        
        assert_eq!(ir.version, "1.0");
        assert!(ir.components.is_empty());
        assert!(ir.rules.is_empty());
    }

    #[test]
    fn test_generate_component() {
        let source = r#"
            component Health {
                current: integer
                maximum: integer
            }
        "#;
        let tokens = tokenize(source).unwrap();
        let ast = parse(tokens).unwrap();
        let typed = analyze(ast).unwrap();
        let ir = generate(typed, &CompilerOptions::default()).unwrap();
        
        assert_eq!(ir.components.len(), 1);
        assert_eq!(ir.components[0].name, "Health");
        assert_eq!(ir.components[0].fields.len(), 2);
    }

    #[test]
    fn test_generate_tracker() {
        let source = r#"
            component Health {
                current: integer
                maximum: integer
            }
            tracker Health on DamageEvent
        "#;
        let tokens = tokenize(source).unwrap();
        let ast = parse(tokens).unwrap();
        let typed = analyze(ast).unwrap();
        let ir = generate(typed, &CompilerOptions::default()).unwrap();
        
        assert_eq!(ir.trackers.len(), 1);
        assert_eq!(ir.trackers[0].component, "Health");
        assert_eq!(ir.trackers[0].event, "DamageEvent");
    }
}
