//! Semantic Analyzer for Blink Rule Language (BRL)
//!
//! Performs semantic analysis on the AST:
//! - Type checking
//! - Symbol resolution
//! - Scope analysis
//! - BCL constraint validation (for choice functions)

use thiserror::Error;
use std::collections::HashMap;

use crate::parser::{
    Module, Item, ComponentDef, RuleDef, FunctionDef, TrackerDef, EntityDef,
    TypeExpr, Block, Statement, Expr, Literal, BinaryOp, UnaryOp,
};

/// Semantic analysis error type
#[derive(Error, Debug, Clone)]
pub enum SemanticError {
    #[error("Undefined component '{name}'")]
    UndefinedComponent { name: String },
    
    #[error("Undefined variable '{name}'")]
    UndefinedVariable { name: String },
    
    #[error("Undefined function '{name}'")]
    UndefinedFunction { name: String },
    
    #[error("Undefined event '{name}'")]
    UndefinedEvent { name: String },
    
    #[error("Type mismatch: expected {expected}, found {found}")]
    TypeMismatch { expected: String, found: String },
    
    #[error("Duplicate definition of '{name}'")]
    DuplicateDefinition { name: String },
    
    #[error("Invalid assignment target")]
    InvalidAssignmentTarget,
    
    #[error("Cannot modify state in BCL (choice function)")]
    BCLWriteViolation,
    
    #[error("Field '{field}' not found in component '{component}'")]
    FieldNotFound { component: String, field: String },
}

/// Type information for the type checker
#[derive(Debug, Clone, PartialEq)]
pub enum Type {
    String,
    Boolean,
    Integer,
    Float,
    Decimal,
    EntityId,
    Component(String),
    List(Box<Type>),
    Optional(Box<Type>),
    /// Composite type (A & B & C) - entity with multiple component requirements
    Composite(Vec<Type>),
    Void,
    Unknown,
}

impl Type {
    pub fn from_type_expr(expr: &TypeExpr) -> Self {
        match expr {
            TypeExpr::String => Type::String,
            TypeExpr::Boolean => Type::Boolean,
            TypeExpr::Integer => Type::Integer,
            TypeExpr::Float => Type::Float,
            TypeExpr::Decimal => Type::Decimal,
            TypeExpr::Id => Type::EntityId,
            TypeExpr::Component(name) => Type::Component(name.clone()),
            TypeExpr::List(inner) => Type::List(Box::new(Type::from_type_expr(inner))),
            TypeExpr::Optional(inner) => Type::Optional(Box::new(Type::from_type_expr(inner))),
            TypeExpr::Composite(types) => {
                Type::Composite(types.iter().map(Type::from_type_expr).collect())
            }
        }
    }
}

/// Symbol table for tracking definitions
#[derive(Debug, Clone)]
pub struct SymbolTable {
    components: HashMap<String, ComponentInfo>,
    functions: HashMap<String, FunctionInfo>,
    trackers: Vec<TrackerInfo>,
}

#[derive(Debug, Clone)]
pub struct ComponentInfo {
    pub name: String,
    pub fields: HashMap<String, Type>,
}

#[derive(Debug, Clone)]
pub struct FunctionInfo {
    pub name: String,
    pub params: Vec<(String, Type)>,
    pub return_type: Type,
}

#[derive(Debug, Clone)]
pub struct TrackerInfo {
    pub component: String,
    pub event: String,
}

impl SymbolTable {
    pub fn new() -> Self {
        Self {
            components: HashMap::new(),
            functions: HashMap::new(),
            trackers: Vec::new(),
        }
    }
    
    pub fn add_component(&mut self, name: String, fields: HashMap<String, Type>) {
        self.components.insert(name.clone(), ComponentInfo { name, fields });
    }
    
    pub fn get_component(&self, name: &str) -> Option<&ComponentInfo> {
        self.components.get(name)
    }
    
    pub fn add_function(&mut self, name: String, params: Vec<(String, Type)>, return_type: Type) {
        self.functions.insert(name.clone(), FunctionInfo { name, params, return_type });
    }
    
    pub fn get_function(&self, name: &str) -> Option<&FunctionInfo> {
        self.functions.get(name)
    }
    
    pub fn add_tracker(&mut self, component: String, event: String) {
        self.trackers.push(TrackerInfo { component, event });
    }
}

impl Default for SymbolTable {
    fn default() -> Self {
        Self::new()
    }
}

/// Scope for variable tracking
#[derive(Debug, Clone)]
struct Scope {
    variables: HashMap<String, Type>,
    parent: Option<Box<Scope>>,
}

impl Scope {
    fn new() -> Self {
        Self {
            variables: HashMap::new(),
            parent: None,
        }
    }
    
    fn with_parent(parent: Scope) -> Self {
        Self {
            variables: HashMap::new(),
            parent: Some(Box::new(parent)),
        }
    }
    
    fn define(&mut self, name: String, typ: Type) {
        self.variables.insert(name, typ);
    }
    
    fn lookup(&self, name: &str) -> Option<&Type> {
        self.variables.get(name).or_else(|| {
            self.parent.as_ref().and_then(|p| p.lookup(name))
        })
    }
}

/// Analyzer context
struct Analyzer {
    symbols: SymbolTable,
    errors: Vec<SemanticError>,
}

impl Analyzer {
    fn new() -> Self {
        let mut symbols = SymbolTable::new();
        
        // Add built-in functions
        symbols.add_function("min".to_string(), vec![
            ("a".to_string(), Type::Float),
            ("b".to_string(), Type::Float),
        ], Type::Float);
        
        symbols.add_function("max".to_string(), vec![
            ("a".to_string(), Type::Float),
            ("b".to_string(), Type::Float),
        ], Type::Float);
        
        symbols.add_function("floor".to_string(), vec![
            ("x".to_string(), Type::Float),
        ], Type::Integer);
        
        symbols.add_function("ceil".to_string(), vec![
            ("x".to_string(), Type::Float),
        ], Type::Integer);
        
        symbols.add_function("round".to_string(), vec![
            ("x".to_string(), Type::Float),
        ], Type::Integer);
        
        symbols.add_function("abs".to_string(), vec![
            ("x".to_string(), Type::Float),
        ], Type::Float);
        
        symbols.add_function("random".to_string(), vec![], Type::Float);
        
        symbols.add_function("random_range".to_string(), vec![
            ("min".to_string(), Type::Float),
            ("max".to_string(), Type::Float),
        ], Type::Float);
        
        symbols.add_function("len".to_string(), vec![
            ("list".to_string(), Type::List(Box::new(Type::Unknown))),
        ], Type::Integer);
        
        Self {
            symbols,
            errors: Vec::new(),
        }
    }
    
    fn analyze(&mut self, module: &Module) -> Result<TypedModule, Vec<SemanticError>> {
        // First pass: collect all definitions
        self.collect_definitions(module);
        
        // Second pass: type check
        let typed_items = self.analyze_items(&module.items);
        
        if self.errors.is_empty() {
            Ok(TypedModule {
                items: typed_items,
                symbols: self.symbols.clone(),
            })
        } else {
            Err(self.errors.clone())
        }
    }
    
    fn collect_definitions(&mut self, module: &Module) {
        for item in &module.items {
            match item {
                Item::Component(comp) => {
                    let mut fields = HashMap::new();
                    for field in &comp.fields {
                        fields.insert(
                            field.name.clone(),
                            Type::from_type_expr(&field.field_type),
                        );
                    }
                    self.symbols.add_component(comp.name.clone(), fields);
                }
                Item::Function(func) => {
                    let params: Vec<_> = func.params.iter()
                        .map(|p| (p.name.clone(), Type::from_type_expr(&p.param_type)))
                        .collect();
                    let return_type = func.return_type.as_ref()
                        .map(Type::from_type_expr)
                        .unwrap_or(Type::Void);
                    self.symbols.add_function(func.name.clone(), params, return_type);
                }
                Item::Tracker(tracker) => {
                    self.symbols.add_tracker(tracker.component.clone(), tracker.event.clone());
                }
                _ => {}
            }
        }
    }
    
    fn analyze_items(&mut self, items: &[Item]) -> Vec<TypedItem> {
        items.iter().filter_map(|item| {
            match item {
                Item::Component(comp) => Some(TypedItem::Component(self.analyze_component(comp))),
                Item::Rule(rule) => Some(TypedItem::Rule(self.analyze_rule(rule))),
                Item::Function(func) => Some(TypedItem::Function(self.analyze_function(func))),
                Item::Tracker(tracker) => Some(TypedItem::Tracker(self.analyze_tracker(tracker))),
                Item::Entity(entity) => Some(TypedItem::Entity(self.analyze_entity(entity))),
                Item::Import(_) => None, // Imports handled separately
                Item::ModuleDef(_) => None, // Module defs handled separately
            }
        }).collect()
    }
    
    fn analyze_component(&mut self, comp: &ComponentDef) -> TypedComponent {
        let fields: Vec<_> = comp.fields.iter().map(|f| {
            TypedField {
                name: f.name.clone(),
                field_type: Type::from_type_expr(&f.field_type),
                optional: f.optional,
            }
        }).collect();
        
        TypedComponent {
            name: comp.name.clone(),
            fields,
        }
    }
    
    /// Analyze an entity definition (BDL support)
    fn analyze_entity(&mut self, entity: &EntityDef) -> TypedEntity {
        let scope = Scope::new();
        
        let components: Vec<_> = entity.components.iter().map(|comp| {
            // Validate component exists
            if self.symbols.get_component(&comp.name).is_none() {
                self.errors.push(SemanticError::UndefinedComponent {
                    name: comp.name.clone(),
                });
            }
            
            let fields: Vec<_> = comp.fields.iter()
                .map(|(name, expr)| (name.clone(), self.analyze_expr(expr, &scope)))
                .collect();
            
            TypedComponentInit {
                name: comp.name.clone(),
                fields,
            }
        }).collect();
        
        // Analyze bound functions
        let bound_functions: Vec<_> = entity.bound_functions.iter()
            .map(|func| self.analyze_bound_function(func))
            .collect();
        
        TypedEntity {
            variable: entity.variable.clone(),
            components,
            bound_functions,
        }
    }
    
    /// Analyze a bound function (choice function bound to an entity)
    fn analyze_bound_function(&mut self, func: &crate::parser::BoundFunctionDef) -> TypedBoundFunction {
        let mut scope = Scope::new();
        
        // Add parameters to scope
        for param in &func.params {
            scope.define(
                param.name.clone(),
                Type::from_type_expr(&param.param_type),
            );
        }
        
        // Analyze body
        let body = self.analyze_block(&func.body, scope);
        
        let return_type = func.return_type.as_ref()
            .map(Type::from_type_expr)
            .unwrap_or(Type::Void);
        
        TypedBoundFunction {
            name: func.name.clone(),
            params: func.params.iter().map(|p| {
                TypedParam {
                    name: p.name.clone(),
                    param_type: Type::from_type_expr(&p.param_type),
                }
            }).collect(),
            return_type,
            body,
        }
    }
    
    fn analyze_rule(&mut self, rule: &RuleDef) -> TypedRule {
        let mut scope = Scope::new();
        
        // Add 'event' and 'entity' to scope
        scope.define("event".to_string(), Type::EntityId);
        scope.define("entity".to_string(), Type::EntityId);
        
        // Analyze condition if present
        let condition = rule.condition.as_ref().map(|c| {
            self.analyze_expr(c, &scope)
        });
        
        // Analyze body
        let body = self.analyze_block(&rule.body, scope);
        
        TypedRule {
            name: rule.name.clone(),
            trigger_event: rule.trigger_event.clone(),
            condition,
            priority: rule.priority,
            body,
        }
    }
    
    fn analyze_function(&mut self, func: &FunctionDef) -> TypedFunction {
        let mut scope = Scope::new();
        
        // Add parameters to scope
        for param in &func.params {
            scope.define(
                param.name.clone(),
                Type::from_type_expr(&param.param_type),
            );
        }
        
        // Analyze body
        let body = self.analyze_block(&func.body, scope);
        
        let return_type = func.return_type.as_ref()
            .map(Type::from_type_expr)
            .unwrap_or(Type::Void);
        
        TypedFunction {
            name: func.name.clone(),
            params: func.params.iter().map(|p| {
                TypedParam {
                    name: p.name.clone(),
                    param_type: Type::from_type_expr(&p.param_type),
                }
            }).collect(),
            return_type,
            body,
        }
    }
    
    fn analyze_tracker(&mut self, tracker: &TrackerDef) -> TypedTracker {
        // Validate that component exists
        if self.symbols.get_component(&tracker.component).is_none() {
            self.errors.push(SemanticError::UndefinedComponent {
                name: tracker.component.clone(),
            });
        }
        
        TypedTracker {
            component: tracker.component.clone(),
            event: tracker.event.clone(),
        }
    }
    
    fn analyze_block(&mut self, block: &Block, mut scope: Scope) -> TypedBlock {
        let statements: Vec<_> = block.statements.iter().map(|stmt| {
            self.analyze_statement(stmt, &mut scope)
        }).collect();
        
        TypedBlock { statements }
    }
    
    fn analyze_statement(&mut self, stmt: &Statement, scope: &mut Scope) -> TypedStatement {
        match stmt {
            Statement::Let(let_stmt) => {
                let value = self.analyze_expr(&let_stmt.value, scope);
                let var_type = let_stmt.type_annotation.as_ref()
                    .map(Type::from_type_expr)
                    .unwrap_or_else(|| value.typ.clone());
                
                scope.define(let_stmt.name.clone(), var_type.clone());
                
                TypedStatement::Let {
                    name: let_stmt.name.clone(),
                    var_type,
                    value,
                }
            }
            Statement::Assignment(assign) => {
                let target = self.analyze_expr(&assign.target, scope);
                let value = self.analyze_expr(&assign.value, scope);
                
                TypedStatement::Assignment {
                    target,
                    op: assign.op,
                    value,
                }
            }
            Statement::If(if_stmt) => {
                let condition = self.analyze_expr(&if_stmt.condition, scope);
                let then_block = self.analyze_block(&if_stmt.then_block, Scope::with_parent(scope.clone()));
                let else_block = if_stmt.else_block.as_ref().map(|clause| {
                    self.analyze_else_clause(clause, scope)
                });
                
                TypedStatement::If {
                    condition,
                    then_block,
                    else_block,
                }
            }
            Statement::For(for_stmt) => {
                let iterable = self.analyze_expr(&for_stmt.iterable, scope);
                
                // Determine element type
                let elem_type = match &iterable.typ {
                    Type::List(inner) => (**inner).clone(),
                    Type::Component(_) => Type::Unknown, // Multiple components
                    _ => Type::Unknown,
                };
                
                let mut body_scope = Scope::with_parent(scope.clone());
                body_scope.define(for_stmt.variable.clone(), elem_type);
                
                let body = self.analyze_block(&for_stmt.body, body_scope);
                
                TypedStatement::For {
                    variable: for_stmt.variable.clone(),
                    iterable,
                    body,
                }
            }
            Statement::While(while_stmt) => {
                let condition = self.analyze_expr(&while_stmt.condition, scope);
                let body = self.analyze_block(&while_stmt.body, Scope::with_parent(scope.clone()));
                
                TypedStatement::While {
                    condition,
                    body,
                }
            }
            Statement::Return(ret) => {
                let value = ret.value.as_ref().map(|v| self.analyze_expr(v, scope));
                TypedStatement::Return { value }
            }
            Statement::Schedule(sched) => {
                let delay = sched.delay.as_ref().map(|d| self.analyze_expr(d, scope));
                let interval = sched.interval.as_ref().map(|i| self.analyze_expr(i, scope));
                let fields: Vec<_> = sched.fields.iter()
                    .map(|(name, expr)| (name.clone(), self.analyze_expr(expr, scope)))
                    .collect();
                
                TypedStatement::Schedule {
                    recurring: sched.recurring,
                    delay,
                    interval,
                    event_name: sched.event_name.clone(),
                    fields,
                }
            }
            Statement::Cancel(cancel) => {
                let target = self.analyze_expr(&cancel.target, scope);
                TypedStatement::Cancel { target }
            }
            Statement::Create(create) => {
                let components: Vec<_> = create.components.iter().map(|comp| {
                    // Validate component exists
                    if self.symbols.get_component(&comp.name).is_none() {
                        self.errors.push(SemanticError::UndefinedComponent {
                            name: comp.name.clone(),
                        });
                    }
                    
                    let fields: Vec<_> = comp.fields.iter()
                        .map(|(name, expr)| (name.clone(), self.analyze_expr(expr, scope)))
                        .collect();
                    
                    TypedComponentInit {
                        name: comp.name.clone(),
                        fields,
                    }
                }).collect();
                
                TypedStatement::Create { components }
            }
            Statement::Delete(delete) => {
                let entity = self.analyze_expr(&delete.entity, scope);
                TypedStatement::Delete { entity }
            }
            Statement::Expr(expr) => {
                let typed_expr = self.analyze_expr(expr, scope);
                TypedStatement::Expr(typed_expr)
            }
        }
    }
    
    fn analyze_else_clause(&mut self, clause: &crate::parser::ElseClause, scope: &Scope) -> TypedElseClause {
        match clause {
            crate::parser::ElseClause::ElseIf(if_stmt) => {
                let condition = self.analyze_expr(&if_stmt.condition, scope);
                let then_block = self.analyze_block(&if_stmt.then_block, Scope::with_parent(scope.clone()));
                let else_block = if_stmt.else_block.as_ref().map(|c| {
                    Box::new(self.analyze_else_clause(c, scope))
                });
                
                TypedElseClause::ElseIf {
                    condition,
                    then_block,
                    else_block,
                }
            }
            crate::parser::ElseClause::Else(block) => {
                let typed_block = self.analyze_block(block, Scope::with_parent(scope.clone()));
                TypedElseClause::Else(typed_block)
            }
        }
    }
    
    fn analyze_expr(&mut self, expr: &Expr, scope: &Scope) -> TypedExpr {
        match expr {
            Expr::Literal(lit) => {
                let typ = match lit {
                    Literal::String(_) => Type::String,
                    Literal::Integer(_) => Type::Integer,
                    Literal::Float(_) => Type::Float,
                    Literal::Decimal(_) => Type::Decimal,
                    Literal::Boolean(_) => Type::Boolean,
                    Literal::Null => Type::Optional(Box::new(Type::Unknown)),
                };
                TypedExpr {
                    kind: TypedExprKind::Literal(lit.clone()),
                    typ,
                }
            }
            Expr::Identifier(name, _) => {
                let typ = scope.lookup(name)
                    .cloned()
                    .unwrap_or_else(|| {
                        // Check if it's a component name
                        if self.symbols.get_component(name).is_some() {
                            Type::Component(name.clone())
                        } else {
                            self.errors.push(SemanticError::UndefinedVariable {
                                name: name.clone(),
                            });
                            Type::Unknown
                        }
                    });
                
                TypedExpr {
                    kind: TypedExprKind::Identifier(name.clone()),
                    typ,
                }
            }
            Expr::EntityRef(name, _) => {
                TypedExpr {
                    kind: TypedExprKind::EntityRef(name.clone()),
                    typ: Type::EntityId,
                }
            }
            Expr::FieldAccess(base, field, _) => {
                let base_typed = self.analyze_expr(base, scope);
                
                // Try to determine field type
                let field_type = if let Type::Component(comp_name) = &base_typed.typ {
                    self.symbols.get_component(comp_name)
                        .and_then(|c| c.fields.get(field).cloned())
                        .unwrap_or(Type::Unknown)
                } else {
                    Type::Unknown
                };
                
                TypedExpr {
                    kind: TypedExprKind::FieldAccess(Box::new(base_typed), field.clone()),
                    typ: field_type,
                }
            }
            Expr::IndexAccess(base, index, _) => {
                let base_typed = self.analyze_expr(base, scope);
                let index_typed = self.analyze_expr(index, scope);
                
                let elem_type = match &base_typed.typ {
                    Type::List(inner) => (**inner).clone(),
                    _ => Type::Unknown,
                };
                
                TypedExpr {
                    kind: TypedExprKind::IndexAccess(Box::new(base_typed), Box::new(index_typed)),
                    typ: elem_type,
                }
            }
            Expr::Binary(left, op, right, _) => {
                let left_typed = self.analyze_expr(left, scope);
                let right_typed = self.analyze_expr(right, scope);
                
                let result_type = match op {
                    BinaryOp::Eq | BinaryOp::NotEq |
                    BinaryOp::Lt | BinaryOp::LtEq |
                    BinaryOp::Gt | BinaryOp::GtEq |
                    BinaryOp::And | BinaryOp::Or => Type::Boolean,
                    
                    BinaryOp::Add | BinaryOp::Sub |
                    BinaryOp::Mul | BinaryOp::Div |
                    BinaryOp::Mod => {
                        // Numeric result, prefer more precise type
                        match (&left_typed.typ, &right_typed.typ) {
                            (Type::Float, _) | (_, Type::Float) => Type::Float,
                            (Type::Decimal, _) | (_, Type::Decimal) => Type::Decimal,
                            _ => Type::Integer,
                        }
                    }
                };
                
                TypedExpr {
                    kind: TypedExprKind::Binary(
                        Box::new(left_typed),
                        *op,
                        Box::new(right_typed),
                    ),
                    typ: result_type,
                }
            }
            Expr::Unary(op, inner, _) => {
                let inner_typed = self.analyze_expr(inner, scope);
                
                let result_type = match op {
                    UnaryOp::Not => Type::Boolean,
                    UnaryOp::Neg => inner_typed.typ.clone(),
                };
                
                TypedExpr {
                    kind: TypedExprKind::Unary(*op, Box::new(inner_typed)),
                    typ: result_type,
                }
            }
            Expr::Call(name, args, _) => {
                let args_typed: Vec<_> = args.iter()
                    .map(|a| self.analyze_expr(a, scope))
                    .collect();
                
                let return_type = self.symbols.get_function(name)
                    .map(|f| f.return_type.clone())
                    .unwrap_or_else(|| {
                        self.errors.push(SemanticError::UndefinedFunction {
                            name: name.clone(),
                        });
                        Type::Unknown
                    });
                
                TypedExpr {
                    kind: TypedExprKind::Call(name.clone(), args_typed),
                    typ: return_type,
                }
            }
            Expr::MethodCall(base, method, args, _) => {
                let base_typed = self.analyze_expr(base, scope);
                let args_typed: Vec<_> = args.iter()
                    .map(|a| self.analyze_expr(a, scope))
                    .collect();
                
                TypedExpr {
                    kind: TypedExprKind::MethodCall(Box::new(base_typed), method.clone(), args_typed),
                    typ: Type::Unknown, // Method return type depends on method
                }
            }
            Expr::HasComponent(base, comp, _) => {
                let base_typed = self.analyze_expr(base, scope);
                
                if self.symbols.get_component(comp).is_none() {
                    self.errors.push(SemanticError::UndefinedComponent {
                        name: comp.clone(),
                    });
                }
                
                TypedExpr {
                    kind: TypedExprKind::HasComponent(Box::new(base_typed), comp.clone()),
                    typ: Type::Boolean,
                }
            }
            Expr::Cast(inner, to_type, _) => {
                let inner_typed = self.analyze_expr(inner, scope);
                let target_type = Type::from_type_expr(to_type);
                
                TypedExpr {
                    kind: TypedExprKind::Cast(Box::new(inner_typed), target_type.clone()),
                    typ: target_type,
                }
            }
            Expr::List(elements, _) => {
                let elements_typed: Vec<_> = elements.iter()
                    .map(|e| self.analyze_expr(e, scope))
                    .collect();
                
                let elem_type = elements_typed.first()
                    .map(|e| e.typ.clone())
                    .unwrap_or(Type::Unknown);
                
                TypedExpr {
                    kind: TypedExprKind::List(elements_typed),
                    typ: Type::List(Box::new(elem_type)),
                }
            }
            Expr::Paren(inner, _) => {
                self.analyze_expr(inner, scope)
            }
            Expr::EntitiesHaving(component, _) => {
                // Validate that component exists
                if self.symbols.get_component(component).is_none() {
                    self.errors.push(SemanticError::UndefinedComponent {
                        name: component.clone(),
                    });
                }
                
                TypedExpr {
                    kind: TypedExprKind::EntitiesHaving(component.clone()),
                    typ: Type::List(Box::new(Type::EntityId)),
                }
            }
        }
    }
}

// Typed AST nodes (output of semantic analysis)

/// Typed module
#[derive(Debug, Clone)]
pub struct TypedModule {
    pub items: Vec<TypedItem>,
    pub symbols: SymbolTable,
}

/// Typed top-level items
#[derive(Debug, Clone)]
pub enum TypedItem {
    Component(TypedComponent),
    Rule(TypedRule),
    Function(TypedFunction),
    Tracker(TypedTracker),
    /// Entity definition (BDL support)
    Entity(TypedEntity),
}

/// Typed entity (for BDL - entity data files)
#[derive(Debug, Clone)]
pub struct TypedEntity {
    /// Variable name for the entity (e.g., "warrior" from `warrior = new entity`)
    /// This replaces the old @name syntax. Entities are nameless; variables reference them.
    pub variable: Option<String>,
    /// Components initialized for this entity
    pub components: Vec<TypedComponentInit>,
    /// Bound choice functions for this entity
    pub bound_functions: Vec<TypedBoundFunction>,
}

/// Typed bound function (choice function bound to an entity)
#[derive(Debug, Clone)]
pub struct TypedBoundFunction {
    /// Function name (e.g., "selectAttackTarget")
    pub name: String,
    /// Function parameters
    pub params: Vec<TypedParam>,
    /// Return type
    pub return_type: Type,
    /// Function body
    pub body: TypedBlock,
}

/// Typed component
#[derive(Debug, Clone)]
pub struct TypedComponent {
    pub name: String,
    pub fields: Vec<TypedField>,
}

/// Typed field
#[derive(Debug, Clone)]
pub struct TypedField {
    pub name: String,
    pub field_type: Type,
    pub optional: bool,
}

/// Typed rule
#[derive(Debug, Clone)]
pub struct TypedRule {
    pub name: Option<String>,
    pub trigger_event: String,
    pub condition: Option<TypedExpr>,
    pub priority: Option<i32>,
    pub body: TypedBlock,
}

/// Typed function
#[derive(Debug, Clone)]
pub struct TypedFunction {
    pub name: String,
    pub params: Vec<TypedParam>,
    pub return_type: Type,
    pub body: TypedBlock,
}

/// Typed parameter
#[derive(Debug, Clone)]
pub struct TypedParam {
    pub name: String,
    pub param_type: Type,
}

/// Typed tracker
#[derive(Debug, Clone)]
pub struct TypedTracker {
    pub component: String,
    pub event: String,
}

/// Typed block
#[derive(Debug, Clone)]
pub struct TypedBlock {
    pub statements: Vec<TypedStatement>,
}

/// Typed statement
#[derive(Debug, Clone)]
pub enum TypedStatement {
    Let {
        name: String,
        var_type: Type,
        value: TypedExpr,
    },
    Assignment {
        target: TypedExpr,
        op: crate::parser::AssignOp,
        value: TypedExpr,
    },
    If {
        condition: TypedExpr,
        then_block: TypedBlock,
        else_block: Option<TypedElseClause>,
    },
    For {
        variable: String,
        iterable: TypedExpr,
        body: TypedBlock,
    },
    While {
        condition: TypedExpr,
        body: TypedBlock,
    },
    Return {
        value: Option<TypedExpr>,
    },
    Schedule {
        recurring: bool,
        delay: Option<TypedExpr>,
        interval: Option<TypedExpr>,
        event_name: String,
        fields: Vec<(String, TypedExpr)>,
    },
    Cancel {
        target: TypedExpr,
    },
    Create {
        components: Vec<TypedComponentInit>,
    },
    Delete {
        entity: TypedExpr,
    },
    Expr(TypedExpr),
}

/// Typed else clause
#[derive(Debug, Clone)]
pub enum TypedElseClause {
    ElseIf {
        condition: TypedExpr,
        then_block: TypedBlock,
        else_block: Option<Box<TypedElseClause>>,
    },
    Else(TypedBlock),
}

/// Typed component initialization
#[derive(Debug, Clone)]
pub struct TypedComponentInit {
    pub name: String,
    pub fields: Vec<(String, TypedExpr)>,
}

/// Typed expression
#[derive(Debug, Clone)]
pub struct TypedExpr {
    pub kind: TypedExprKind,
    pub typ: Type,
}

/// Typed expression kind
#[derive(Debug, Clone)]
pub enum TypedExprKind {
    Literal(Literal),
    Identifier(String),
    EntityRef(String),
    FieldAccess(Box<TypedExpr>, String),
    IndexAccess(Box<TypedExpr>, Box<TypedExpr>),
    Binary(Box<TypedExpr>, BinaryOp, Box<TypedExpr>),
    Unary(UnaryOp, Box<TypedExpr>),
    Call(String, Vec<TypedExpr>),
    MethodCall(Box<TypedExpr>, String, Vec<TypedExpr>),
    HasComponent(Box<TypedExpr>, String),
    Cast(Box<TypedExpr>, Type),
    List(Vec<TypedExpr>),
    /// Entity query: `entities having ComponentType`
    /// Returns a list of entities that have the specified component
    EntitiesHaving(String),
}

/// Perform semantic analysis on a parsed module
pub fn analyze(module: crate::parser::Module) -> Result<TypedModule, String> {
    let mut analyzer = Analyzer::new();
    analyzer.analyze(&module).map_err(|errors| {
        errors.iter()
            .map(|e| e.to_string())
            .collect::<Vec<_>>()
            .join("\n")
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::lexer::tokenize;
    use crate::parser::parse;

    #[test]
    fn test_analyze_empty() {
        let tokens = tokenize("").unwrap();
        let ast = parse(tokens).unwrap();
        let result = analyze(ast);
        assert!(result.is_ok());
    }

    #[test]
    fn test_analyze_component() {
        let source = r#"
            component Health {
                current: integer
                maximum: integer
            }
        "#;
        let tokens = tokenize(source).unwrap();
        let ast = parse(tokens).unwrap();
        let result = analyze(ast).unwrap();
        
        assert_eq!(result.items.len(), 1);
        assert!(result.symbols.get_component("Health").is_some());
    }
}
