//! Parser for Blink Rule Language (BRL)
//!
//! Converts a stream of tokens into an Abstract Syntax Tree (AST).

use thiserror::Error;
use crate::lexer::{Token, TokenKind, Span};

/// Parser error type
#[derive(Error, Debug)]
pub enum ParseError {
    #[error("Unexpected token '{found}' at position {position}, expected {expected}")]
    UnexpectedToken {
        found: String,
        expected: String,
        position: usize,
    },
    
    #[error("Unexpected end of input, expected {expected}")]
    UnexpectedEof { expected: String },
    
    #[error("Invalid syntax: {message}")]
    InvalidSyntax { message: String },
}

/// AST node for a complete BRL module
#[derive(Debug, Clone)]
pub struct Module {
    pub items: Vec<Item>,
}

/// Top-level items in a BRL module
#[derive(Debug, Clone)]
pub enum Item {
    Component(ComponentDef),
    Rule(RuleDef),
    Function(FunctionDef),
    Tracker(TrackerDef),
    Import(ImportDef),
    ModuleDef(ModuleItemDef),
}

/// Component definition
#[derive(Debug, Clone)]
pub struct ComponentDef {
    pub name: String,
    pub fields: Vec<FieldDef>,
    pub span: Span,
}

/// Field definition within a component
#[derive(Debug, Clone)]
pub struct FieldDef {
    pub name: String,
    pub field_type: TypeExpr,
    pub optional: bool,
    pub span: Span,
}

/// Type expression
#[derive(Debug, Clone)]
pub enum TypeExpr {
    String,
    Boolean,
    Integer,
    Float,
    Decimal,
    Id,
    Component(String),
    List(Box<TypeExpr>),
    Optional(Box<TypeExpr>),
}

/// Rule definition
#[derive(Debug, Clone)]
pub struct RuleDef {
    pub name: Option<String>,
    pub trigger_event: String,
    pub condition: Option<Expr>,
    pub priority: Option<i32>,
    pub body: Block,
    pub span: Span,
}

/// Function definition
#[derive(Debug, Clone)]
pub struct FunctionDef {
    pub name: String,
    pub params: Vec<ParamDef>,
    pub return_type: Option<TypeExpr>,
    pub body: Block,
    pub span: Span,
}

/// Function parameter
#[derive(Debug, Clone)]
pub struct ParamDef {
    pub name: String,
    pub param_type: TypeExpr,
    pub span: Span,
}

/// Tracker definition
#[derive(Debug, Clone)]
pub struct TrackerDef {
    pub component: String,
    pub event: String,
    pub span: Span,
}

/// Import definition
#[derive(Debug, Clone)]
pub struct ImportDef {
    pub path: Vec<String>,
    pub items: Option<Vec<String>>,
    pub span: Span,
}

/// Module item definition
#[derive(Debug, Clone)]
pub struct ModuleItemDef {
    pub name: String,
    pub items: Vec<Item>,
    pub span: Span,
}

/// Block of statements
#[derive(Debug, Clone)]
pub struct Block {
    pub statements: Vec<Statement>,
    pub span: Span,
}

/// Statement types
#[derive(Debug, Clone)]
pub enum Statement {
    Let(LetStatement),
    Assignment(AssignmentStatement),
    If(IfStatement),
    For(ForStatement),
    While(WhileStatement),
    Return(ReturnStatement),
    Schedule(ScheduleStatement),
    Cancel(CancelStatement),
    Create(CreateStatement),
    Delete(DeleteStatement),
    Expr(Expr),
}

/// Variable declaration
#[derive(Debug, Clone)]
pub struct LetStatement {
    pub name: String,
    pub type_annotation: Option<TypeExpr>,
    pub value: Expr,
    pub span: Span,
}

/// Assignment statement
#[derive(Debug, Clone)]
pub struct AssignmentStatement {
    pub target: Expr,
    pub op: AssignOp,
    pub value: Expr,
    pub span: Span,
}

/// Assignment operators
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum AssignOp {
    Assign,    // =
    AddAssign, // +=
    SubAssign, // -=
    MulAssign, // *=
    DivAssign, // /=
}

/// If statement
#[derive(Debug, Clone)]
pub struct IfStatement {
    pub condition: Expr,
    pub then_block: Block,
    pub else_block: Option<Box<ElseClause>>,
    pub span: Span,
}

/// Else clause (can be else-if or else)
#[derive(Debug, Clone)]
pub enum ElseClause {
    ElseIf(IfStatement),
    Else(Block),
}

/// For-in loop
#[derive(Debug, Clone)]
pub struct ForStatement {
    pub variable: String,
    pub iterable: Expr,
    pub body: Block,
    pub span: Span,
}

/// While loop
#[derive(Debug, Clone)]
pub struct WhileStatement {
    pub condition: Expr,
    pub body: Block,
    pub span: Span,
}

/// Return statement
#[derive(Debug, Clone)]
pub struct ReturnStatement {
    pub value: Option<Expr>,
    pub span: Span,
}

/// Schedule statement
#[derive(Debug, Clone)]
pub struct ScheduleStatement {
    pub recurring: bool,
    pub delay: Option<Expr>,
    pub interval: Option<Expr>,
    pub event_name: String,
    pub fields: Vec<(String, Expr)>,
    pub span: Span,
}

/// Cancel statement
#[derive(Debug, Clone)]
pub struct CancelStatement {
    pub target: Expr,
    pub span: Span,
}

/// Create entity statement
#[derive(Debug, Clone)]
pub struct CreateStatement {
    pub components: Vec<ComponentInit>,
    pub span: Span,
}

/// Component initialization
#[derive(Debug, Clone)]
pub struct ComponentInit {
    pub name: String,
    pub fields: Vec<(String, Expr)>,
    pub span: Span,
}

/// Delete entity statement
#[derive(Debug, Clone)]
pub struct DeleteStatement {
    pub entity: Expr,
    pub span: Span,
}

/// Expression types
#[derive(Debug, Clone)]
pub enum Expr {
    /// Literal values
    Literal(Literal),
    
    /// Variable or identifier reference
    Identifier(String, Span),
    
    /// Entity reference (@name)
    EntityRef(String, Span),
    
    /// Field access (a.b)
    FieldAccess(Box<Expr>, String, Span),
    
    /// Index access (a[i])
    IndexAccess(Box<Expr>, Box<Expr>, Span),
    
    /// Binary operation (a + b)
    Binary(Box<Expr>, BinaryOp, Box<Expr>, Span),
    
    /// Unary operation (!a, -a)
    Unary(UnaryOp, Box<Expr>, Span),
    
    /// Function call
    Call(String, Vec<Expr>, Span),
    
    /// Method call (entity.method(...))
    MethodCall(Box<Expr>, String, Vec<Expr>, Span),
    
    /// Has component check (entity.has(Component))
    HasComponent(Box<Expr>, String, Span),
    
    /// Type cast (value as type)
    Cast(Box<Expr>, TypeExpr, Span),
    
    /// List literal
    List(Vec<Expr>, Span),
    
    /// Parenthesized expression
    Paren(Box<Expr>, Span),
}

/// Literal values
#[derive(Debug, Clone)]
pub enum Literal {
    String(String),
    Integer(i64),
    Float(f64),
    Decimal(String), // Store as string to preserve precision
    Boolean(bool),
    Null,
}

/// Binary operators
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum BinaryOp {
    // Arithmetic
    Add,
    Sub,
    Mul,
    Div,
    Mod,
    
    // Comparison
    Eq,
    NotEq,
    Lt,
    LtEq,
    Gt,
    GtEq,
    
    // Logical
    And,
    Or,
}

/// Unary operators
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum UnaryOp {
    Neg,
    Not,
}

/// Parser state
struct Parser {
    tokens: Vec<Token>,
    pos: usize,
}

impl Parser {
    fn new(tokens: Vec<Token>) -> Self {
        Self { tokens, pos: 0 }
    }
    
    fn is_at_end(&self) -> bool {
        self.pos >= self.tokens.len()
    }
    
    fn peek(&self) -> Option<&Token> {
        self.tokens.get(self.pos)
    }
    
    fn advance(&mut self) -> Option<&Token> {
        if !self.is_at_end() {
            let token = &self.tokens[self.pos];
            self.pos += 1;
            Some(token)
        } else {
            None
        }
    }
    
    fn check(&self, kind: &TokenKind) -> bool {
        self.peek().map(|t| &t.kind == kind).unwrap_or(false)
    }
    
    fn consume(&mut self, kind: TokenKind, expected: &str) -> Result<Token, ParseError> {
        if self.check(&kind) {
            Ok(self.advance().unwrap().clone())
        } else if let Some(token) = self.peek() {
            Err(ParseError::UnexpectedToken {
                found: token.text.clone(),
                expected: expected.to_string(),
                position: token.span.start,
            })
        } else {
            Err(ParseError::UnexpectedEof {
                expected: expected.to_string(),
            })
        }
    }
    
    fn parse_module(&mut self) -> Result<Module, ParseError> {
        let mut items = Vec::new();
        
        while !self.is_at_end() {
            items.push(self.parse_item()?);
        }
        
        Ok(Module { items })
    }
    
    fn parse_item(&mut self) -> Result<Item, ParseError> {
        let token = self.peek().ok_or(ParseError::UnexpectedEof {
            expected: "item".to_string(),
        })?;
        
        match token.kind {
            TokenKind::Component => self.parse_component().map(Item::Component),
            TokenKind::Rule => self.parse_rule().map(Item::Rule),
            TokenKind::Fn => self.parse_function().map(Item::Function),
            TokenKind::Tracker => self.parse_tracker().map(Item::Tracker),
            TokenKind::Import => self.parse_import().map(Item::Import),
            TokenKind::Module => self.parse_module_def().map(Item::ModuleDef),
            _ => Err(ParseError::UnexpectedToken {
                found: token.text.clone(),
                expected: "component, rule, fn, tracker, import, or module".to_string(),
                position: token.span.start,
            }),
        }
    }
    
    fn parse_component(&mut self) -> Result<ComponentDef, ParseError> {
        let start = self.consume(TokenKind::Component, "component")?.span.start;
        let name_token = self.consume(TokenKind::Identifier, "component name")?;
        let name = name_token.text.clone();
        
        self.consume(TokenKind::LBrace, "{")?;
        
        let mut fields = Vec::new();
        while !self.check(&TokenKind::RBrace) && !self.is_at_end() {
            fields.push(self.parse_field()?);
        }
        
        let end_token = self.consume(TokenKind::RBrace, "}")?;
        
        Ok(ComponentDef {
            name,
            fields,
            span: Span::new(start, end_token.span.end),
        })
    }
    
    fn parse_field(&mut self) -> Result<FieldDef, ParseError> {
        // Allow certain keywords to be used as field names (entity, event, id)
        let name_token = if let Some(token) = self.peek() {
            match token.kind {
                TokenKind::Identifier 
                | TokenKind::Entity 
                | TokenKind::Event 
                | TokenKind::TypeId => {
                    // Safe to unwrap here since we just verified token exists via peek()
                    self.advance().ok_or_else(|| ParseError::UnexpectedEof { 
                        expected: "field name".to_string() 
                    })?.clone()
                }
                _ => self.consume(TokenKind::Identifier, "field name")?
            }
        } else {
            return Err(ParseError::UnexpectedEof { expected: "field name".to_string() });
        };
        let name = name_token.text.clone();
        let start = name_token.span.start;
        
        self.consume(TokenKind::Colon, ":")?;
        
        let field_type = self.parse_type()?;
        
        let optional = if self.check(&TokenKind::Question) {
            self.advance();
            true
        } else {
            false
        };
        
        let end = self.tokens.get(self.pos.saturating_sub(1))
            .map(|t| t.span.end)
            .unwrap_or(start);
        
        Ok(FieldDef {
            name,
            field_type: if optional {
                TypeExpr::Optional(Box::new(field_type))
            } else {
                field_type
            },
            optional,
            span: Span::new(start, end),
        })
    }
    
    fn parse_type(&mut self) -> Result<TypeExpr, ParseError> {
        let token = self.advance().ok_or(ParseError::UnexpectedEof {
            expected: "type".to_string(),
        })?;
        
        match token.kind {
            TokenKind::TypeString => Ok(TypeExpr::String),
            TokenKind::TypeBoolean => Ok(TypeExpr::Boolean),
            TokenKind::TypeInteger => Ok(TypeExpr::Integer),
            TokenKind::TypeFloat => Ok(TypeExpr::Float),
            TokenKind::TypeDecimal => Ok(TypeExpr::Decimal),
            TokenKind::TypeId => Ok(TypeExpr::Id),
            TokenKind::TypeList => {
                // list<T>
                self.consume(TokenKind::Lt, "<")?;
                let inner = self.parse_type()?;
                self.consume(TokenKind::Gt, ">")?;
                Ok(TypeExpr::List(Box::new(inner)))
            }
            TokenKind::Identifier => Ok(TypeExpr::Component(token.text.clone())),
            _ => Err(ParseError::UnexpectedToken {
                found: token.text.clone(),
                expected: "type".to_string(),
                position: token.span.start,
            }),
        }
    }
    
    fn parse_rule(&mut self) -> Result<RuleDef, ParseError> {
        let start = self.consume(TokenKind::Rule, "rule")?.span.start;
        
        // Optional rule name
        let name = if self.check(&TokenKind::Identifier) {
            Some(self.advance().unwrap().text.clone())
        } else {
            None
        };
        
        self.consume(TokenKind::On, "on")?;
        
        let trigger_token = self.consume(TokenKind::Identifier, "event name")?;
        let trigger_event = trigger_token.text.clone();
        
        // Optional condition with 'when'
        let condition = if self.check(&TokenKind::When) {
            self.advance();
            Some(self.parse_expression()?)
        } else {
            None
        };
        
        // Optional priority
        let priority = if self.check(&TokenKind::LBracket) {
            self.advance();
            // Parse [priority: N]
            self.consume(TokenKind::Identifier, "priority")?; // Assume "priority"
            self.consume(TokenKind::Colon, ":")?;
            let value_token = self.consume(TokenKind::IntegerLiteral, "priority value")?;
            let priority: i32 = value_token.text.parse().map_err(|_| {
                ParseError::InvalidSyntax {
                    message: format!("Invalid priority value: '{}' is not a valid integer", value_token.text),
                }
            })?;
            self.consume(TokenKind::RBracket, "]")?;
            Some(priority)
        } else {
            None
        };
        
        let body = self.parse_block()?;
        
        Ok(RuleDef {
            name,
            trigger_event,
            condition,
            priority,
            body,
            span: Span::new(start, self.pos),
        })
    }
    
    fn parse_function(&mut self) -> Result<FunctionDef, ParseError> {
        let start = self.consume(TokenKind::Fn, "fn")?.span.start;
        
        let name_token = self.consume(TokenKind::Identifier, "function name")?;
        let name = name_token.text.clone();
        
        self.consume(TokenKind::LParen, "(")?;
        
        let mut params = Vec::new();
        while !self.check(&TokenKind::RParen) && !self.is_at_end() {
            let param_name_token = self.consume(TokenKind::Identifier, "parameter name")?;
            let param_name = param_name_token.text.clone();
            let param_start = param_name_token.span.start;
            
            self.consume(TokenKind::Colon, ":")?;
            let param_type = self.parse_type()?;
            
            let param_end = self.tokens.get(self.pos.saturating_sub(1))
                .map(|t| t.span.end)
                .unwrap_or(param_start);
            
            params.push(ParamDef {
                name: param_name,
                param_type,
                span: Span::new(param_start, param_end),
            });
            
            if self.check(&TokenKind::Comma) {
                self.advance();
            }
        }
        
        self.consume(TokenKind::RParen, ")")?;
        
        // Optional return type
        let return_type = if self.check(&TokenKind::Colon) {
            self.advance();
            Some(self.parse_type()?)
        } else {
            None
        };
        
        let body = self.parse_block()?;
        
        Ok(FunctionDef {
            name,
            params,
            return_type,
            body,
            span: Span::new(start, self.pos),
        })
    }
    
    fn parse_tracker(&mut self) -> Result<TrackerDef, ParseError> {
        let start = self.consume(TokenKind::Tracker, "tracker")?.span.start;
        
        let component_token = self.consume(TokenKind::Identifier, "component name")?;
        let component = component_token.text.clone();
        
        self.consume(TokenKind::On, "on")?;
        
        let event_token = self.consume(TokenKind::Identifier, "event name")?;
        let event = event_token.text.clone();
        
        Ok(TrackerDef {
            component,
            event,
            span: Span::new(start, event_token.span.end),
        })
    }
    
    fn parse_import(&mut self) -> Result<ImportDef, ParseError> {
        let start = self.consume(TokenKind::Import, "import")?.span.start;
        
        let mut path = Vec::new();
        let first = self.consume(TokenKind::Identifier, "module path")?;
        path.push(first.text.clone());
        
        while self.check(&TokenKind::Dot) {
            self.advance();
            let next = self.consume(TokenKind::Identifier, "module path segment")?;
            path.push(next.text.clone());
        }
        
        // Optional specific imports
        let items = if self.check(&TokenKind::LBrace) {
            self.advance();
            let mut items = Vec::new();
            while !self.check(&TokenKind::RBrace) && !self.is_at_end() {
                let item = self.consume(TokenKind::Identifier, "import item")?;
                items.push(item.text.clone());
                if self.check(&TokenKind::Comma) {
                    self.advance();
                }
            }
            self.consume(TokenKind::RBrace, "}")?;
            Some(items)
        } else {
            None
        };
        
        let end = self.tokens.get(self.pos.saturating_sub(1))
            .map(|t| t.span.end)
            .unwrap_or(start);
        
        Ok(ImportDef {
            path,
            items,
            span: Span::new(start, end),
        })
    }
    
    fn parse_module_def(&mut self) -> Result<ModuleItemDef, ParseError> {
        let start = self.consume(TokenKind::Module, "module")?.span.start;
        
        let name_token = self.consume(TokenKind::Identifier, "module name")?;
        let name = name_token.text.clone();
        
        self.consume(TokenKind::LBrace, "{")?;
        
        let mut items = Vec::new();
        while !self.check(&TokenKind::RBrace) && !self.is_at_end() {
            items.push(self.parse_item()?);
        }
        
        let end_token = self.consume(TokenKind::RBrace, "}")?;
        
        Ok(ModuleItemDef {
            name,
            items,
            span: Span::new(start, end_token.span.end),
        })
    }
    
    fn parse_block(&mut self) -> Result<Block, ParseError> {
        let start_token = self.consume(TokenKind::LBrace, "{")?;
        let start = start_token.span.start;
        
        let mut statements = Vec::new();
        while !self.check(&TokenKind::RBrace) && !self.is_at_end() {
            statements.push(self.parse_statement()?);
        }
        
        let end_token = self.consume(TokenKind::RBrace, "}")?;
        
        Ok(Block {
            statements,
            span: Span::new(start, end_token.span.end),
        })
    }
    
    fn parse_statement(&mut self) -> Result<Statement, ParseError> {
        let token = self.peek().ok_or(ParseError::UnexpectedEof {
            expected: "statement".to_string(),
        })?;
        
        match token.kind {
            TokenKind::Let => self.parse_let_statement(),
            TokenKind::If => self.parse_if_statement(),
            TokenKind::For => self.parse_for_statement(),
            TokenKind::While => self.parse_while_statement(),
            TokenKind::Return => self.parse_return_statement(),
            TokenKind::Schedule => self.parse_schedule_statement(),
            TokenKind::Cancel => self.parse_cancel_statement(),
            TokenKind::Create => self.parse_create_statement(),
            TokenKind::Delete => self.parse_delete_statement(),
            _ => {
                // Try to parse as expression statement or assignment
                let expr = self.parse_expression()?;
                
                // Check for assignment
                if let Some(token) = self.peek() {
                    if matches!(token.kind, TokenKind::Eq | TokenKind::PlusEq | TokenKind::MinusEq | TokenKind::StarEq | TokenKind::SlashEq) {
                        let op = match token.kind {
                            TokenKind::Eq => AssignOp::Assign,
                            TokenKind::PlusEq => AssignOp::AddAssign,
                            TokenKind::MinusEq => AssignOp::SubAssign,
                            TokenKind::StarEq => AssignOp::MulAssign,
                            TokenKind::SlashEq => AssignOp::DivAssign,
                            _ => unreachable!(),
                        };
                        self.advance();
                        let value = self.parse_expression()?;
                        let span = match &expr {
                            Expr::Identifier(_, s) => s.clone(),
                            Expr::FieldAccess(_, _, s) => s.clone(),
                            Expr::IndexAccess(_, _, s) => s.clone(),
                            _ => Span::new(0, 0),
                        };
                        return Ok(Statement::Assignment(AssignmentStatement {
                            target: expr,
                            op,
                            value,
                            span,
                        }));
                    }
                }
                
                Ok(Statement::Expr(expr))
            }
        }
    }
    
    fn parse_let_statement(&mut self) -> Result<Statement, ParseError> {
        let start = self.consume(TokenKind::Let, "let")?.span.start;
        
        let name_token = self.consume(TokenKind::Identifier, "variable name")?;
        let name = name_token.text.clone();
        
        // Optional type annotation
        let type_annotation = if self.check(&TokenKind::Colon) {
            self.advance();
            Some(self.parse_type()?)
        } else {
            None
        };
        
        self.consume(TokenKind::Eq, "=")?;
        
        let value = self.parse_expression()?;
        
        let end = self.tokens.get(self.pos.saturating_sub(1))
            .map(|t| t.span.end)
            .unwrap_or(start);
        
        Ok(Statement::Let(LetStatement {
            name,
            type_annotation,
            value,
            span: Span::new(start, end),
        }))
    }
    
    fn parse_if_statement(&mut self) -> Result<Statement, ParseError> {
        let if_stmt = self.parse_if_inner()?;
        Ok(Statement::If(if_stmt))
    }
    
    fn parse_if_inner(&mut self) -> Result<IfStatement, ParseError> {
        let start = self.consume(TokenKind::If, "if")?.span.start;
        
        let condition = self.parse_expression()?;
        let then_block = self.parse_block()?;
        
        let else_block = if self.check(&TokenKind::Else) {
            self.advance();
            if self.check(&TokenKind::If) {
                Some(Box::new(ElseClause::ElseIf(self.parse_if_inner()?)))
            } else {
                Some(Box::new(ElseClause::Else(self.parse_block()?)))
            }
        } else {
            None
        };
        
        let end = self.tokens.get(self.pos.saturating_sub(1))
            .map(|t| t.span.end)
            .unwrap_or(start);
        
        Ok(IfStatement {
            condition,
            then_block,
            else_block,
            span: Span::new(start, end),
        })
    }
    
    fn parse_for_statement(&mut self) -> Result<Statement, ParseError> {
        let start = self.consume(TokenKind::For, "for")?.span.start;
        
        let var_token = self.consume(TokenKind::Identifier, "loop variable")?;
        let variable = var_token.text.clone();
        
        self.consume(TokenKind::In, "in")?;
        
        let iterable = self.parse_expression()?;
        let body = self.parse_block()?;
        
        let end = self.tokens.get(self.pos.saturating_sub(1))
            .map(|t| t.span.end)
            .unwrap_or(start);
        
        Ok(Statement::For(ForStatement {
            variable,
            iterable,
            body,
            span: Span::new(start, end),
        }))
    }
    
    fn parse_while_statement(&mut self) -> Result<Statement, ParseError> {
        let start = self.consume(TokenKind::While, "while")?.span.start;
        
        let condition = self.parse_expression()?;
        let body = self.parse_block()?;
        
        let end = self.tokens.get(self.pos.saturating_sub(1))
            .map(|t| t.span.end)
            .unwrap_or(start);
        
        Ok(Statement::While(WhileStatement {
            condition,
            body,
            span: Span::new(start, end),
        }))
    }
    
    fn parse_return_statement(&mut self) -> Result<Statement, ParseError> {
        let start = self.consume(TokenKind::Return, "return")?.span.start;
        
        // Check if there's a value to return
        let value = if !self.check(&TokenKind::RBrace) && !self.is_at_end() {
            // Peek to see if next is a statement-starting keyword
            if let Some(token) = self.peek() {
                if !matches!(token.kind, 
                    TokenKind::Let | TokenKind::If | TokenKind::For | 
                    TokenKind::While | TokenKind::Return | TokenKind::Schedule |
                    TokenKind::Cancel | TokenKind::Create | TokenKind::Delete
                ) {
                    Some(self.parse_expression()?)
                } else {
                    None
                }
            } else {
                None
            }
        } else {
            None
        };
        
        let end = self.tokens.get(self.pos.saturating_sub(1))
            .map(|t| t.span.end)
            .unwrap_or(start);
        
        Ok(Statement::Return(ReturnStatement {
            value,
            span: Span::new(start, end),
        }))
    }
    
    fn parse_schedule_statement(&mut self) -> Result<Statement, ParseError> {
        let start = self.consume(TokenKind::Schedule, "schedule")?.span.start;
        
        // Check for recurring
        let recurring = if self.check(&TokenKind::Recurring) {
            self.advance();
            true
        } else {
            false
        };
        
        // Check for [delay: N] or [interval: N]
        let mut delay = None;
        let mut interval = None;
        if self.check(&TokenKind::LBracket) {
            self.advance();
            let param_name = self.consume(TokenKind::Identifier, "delay or interval")?;
            self.consume(TokenKind::Colon, ":")?;
            let value = self.parse_expression()?;
            
            if param_name.text == "delay" {
                delay = Some(value);
            } else if param_name.text == "interval" {
                interval = Some(value);
            }
            
            self.consume(TokenKind::RBracket, "]")?;
        }
        
        let event_token = self.consume(TokenKind::Identifier, "event name")?;
        let event_name = event_token.text.clone();
        
        self.consume(TokenKind::LBrace, "{")?;
        
        let mut fields = Vec::new();
        while !self.check(&TokenKind::RBrace) && !self.is_at_end() {
            let field_name = self.consume(TokenKind::Identifier, "field name")?;
            self.consume(TokenKind::Colon, ":")?;
            let field_value = self.parse_expression()?;
            fields.push((field_name.text.clone(), field_value));
        }
        
        let end_token = self.consume(TokenKind::RBrace, "}")?;
        
        Ok(Statement::Schedule(ScheduleStatement {
            recurring,
            delay,
            interval,
            event_name,
            fields,
            span: Span::new(start, end_token.span.end),
        }))
    }
    
    fn parse_cancel_statement(&mut self) -> Result<Statement, ParseError> {
        let start = self.consume(TokenKind::Cancel, "cancel")?.span.start;
        let target = self.parse_expression()?;
        
        let end = self.tokens.get(self.pos.saturating_sub(1))
            .map(|t| t.span.end)
            .unwrap_or(start);
        
        Ok(Statement::Cancel(CancelStatement {
            target,
            span: Span::new(start, end),
        }))
    }
    
    fn parse_create_statement(&mut self) -> Result<Statement, ParseError> {
        let start = self.consume(TokenKind::Create, "create")?.span.start;
        self.consume(TokenKind::Entity, "entity")?;
        self.consume(TokenKind::LBrace, "{")?;
        
        let mut components = Vec::new();
        while !self.check(&TokenKind::RBrace) && !self.is_at_end() {
            components.push(self.parse_component_init()?);
        }
        
        let end_token = self.consume(TokenKind::RBrace, "}")?;
        
        Ok(Statement::Create(CreateStatement {
            components,
            span: Span::new(start, end_token.span.end),
        }))
    }
    
    fn parse_component_init(&mut self) -> Result<ComponentInit, ParseError> {
        let name_token = self.consume(TokenKind::Identifier, "component name")?;
        let name = name_token.text.clone();
        let start = name_token.span.start;
        
        self.consume(TokenKind::LBrace, "{")?;
        
        let mut fields = Vec::new();
        while !self.check(&TokenKind::RBrace) && !self.is_at_end() {
            let field_name = self.consume(TokenKind::Identifier, "field name")?;
            self.consume(TokenKind::Colon, ":")?;
            let field_value = self.parse_expression()?;
            fields.push((field_name.text.clone(), field_value));
        }
        
        let end_token = self.consume(TokenKind::RBrace, "}")?;
        
        Ok(ComponentInit {
            name,
            fields,
            span: Span::new(start, end_token.span.end),
        })
    }
    
    fn parse_delete_statement(&mut self) -> Result<Statement, ParseError> {
        let start = self.consume(TokenKind::Delete, "delete")?.span.start;
        let entity = self.parse_expression()?;
        
        let end = self.tokens.get(self.pos.saturating_sub(1))
            .map(|t| t.span.end)
            .unwrap_or(start);
        
        Ok(Statement::Delete(DeleteStatement {
            entity,
            span: Span::new(start, end),
        }))
    }
    
    fn parse_expression(&mut self) -> Result<Expr, ParseError> {
        self.parse_or_expr()
    }
    
    fn parse_or_expr(&mut self) -> Result<Expr, ParseError> {
        let mut left = self.parse_and_expr()?;
        
        while self.check(&TokenKind::OrOr) {
            let span_start = left.span().start;
            self.advance();
            let right = self.parse_and_expr()?;
            let span_end = right.span().end;
            left = Expr::Binary(
                Box::new(left),
                BinaryOp::Or,
                Box::new(right),
                Span::new(span_start, span_end),
            );
        }
        
        Ok(left)
    }
    
    fn parse_and_expr(&mut self) -> Result<Expr, ParseError> {
        let mut left = self.parse_equality_expr()?;
        
        while self.check(&TokenKind::AndAnd) {
            let span_start = left.span().start;
            self.advance();
            let right = self.parse_equality_expr()?;
            let span_end = right.span().end;
            left = Expr::Binary(
                Box::new(left),
                BinaryOp::And,
                Box::new(right),
                Span::new(span_start, span_end),
            );
        }
        
        Ok(left)
    }
    
    fn parse_equality_expr(&mut self) -> Result<Expr, ParseError> {
        let mut left = self.parse_comparison_expr()?;
        
        while let Some(token) = self.peek() {
            let op = match token.kind {
                TokenKind::EqEq => BinaryOp::Eq,
                TokenKind::NotEq => BinaryOp::NotEq,
                _ => break,
            };
            let span_start = left.span().start;
            self.advance();
            let right = self.parse_comparison_expr()?;
            let span_end = right.span().end;
            left = Expr::Binary(
                Box::new(left),
                op,
                Box::new(right),
                Span::new(span_start, span_end),
            );
        }
        
        Ok(left)
    }
    
    fn parse_comparison_expr(&mut self) -> Result<Expr, ParseError> {
        let mut left = self.parse_additive_expr()?;
        
        while let Some(token) = self.peek() {
            let op = match token.kind {
                TokenKind::Lt => BinaryOp::Lt,
                TokenKind::LtEq => BinaryOp::LtEq,
                TokenKind::Gt => BinaryOp::Gt,
                TokenKind::GtEq => BinaryOp::GtEq,
                _ => break,
            };
            let span_start = left.span().start;
            self.advance();
            let right = self.parse_additive_expr()?;
            let span_end = right.span().end;
            left = Expr::Binary(
                Box::new(left),
                op,
                Box::new(right),
                Span::new(span_start, span_end),
            );
        }
        
        Ok(left)
    }
    
    fn parse_additive_expr(&mut self) -> Result<Expr, ParseError> {
        let mut left = self.parse_multiplicative_expr()?;
        
        while let Some(token) = self.peek() {
            let op = match token.kind {
                TokenKind::Plus => BinaryOp::Add,
                TokenKind::Minus => BinaryOp::Sub,
                _ => break,
            };
            let span_start = left.span().start;
            self.advance();
            let right = self.parse_multiplicative_expr()?;
            let span_end = right.span().end;
            left = Expr::Binary(
                Box::new(left),
                op,
                Box::new(right),
                Span::new(span_start, span_end),
            );
        }
        
        Ok(left)
    }
    
    fn parse_multiplicative_expr(&mut self) -> Result<Expr, ParseError> {
        let mut left = self.parse_unary_expr()?;
        
        while let Some(token) = self.peek() {
            let op = match token.kind {
                TokenKind::Star => BinaryOp::Mul,
                TokenKind::Slash => BinaryOp::Div,
                TokenKind::Percent => BinaryOp::Mod,
                _ => break,
            };
            let span_start = left.span().start;
            self.advance();
            let right = self.parse_unary_expr()?;
            let span_end = right.span().end;
            left = Expr::Binary(
                Box::new(left),
                op,
                Box::new(right),
                Span::new(span_start, span_end),
            );
        }
        
        Ok(left)
    }
    
    fn parse_unary_expr(&mut self) -> Result<Expr, ParseError> {
        if let Some(token) = self.peek() {
            let (op, start) = match token.kind {
                TokenKind::Not => (Some(UnaryOp::Not), token.span.start),
                TokenKind::Minus => (Some(UnaryOp::Neg), token.span.start),
                _ => (None, 0),
            };
            
            if let Some(op) = op {
                self.advance();
                let expr = self.parse_unary_expr()?;
                let span_end = expr.span().end;
                return Ok(Expr::Unary(op, Box::new(expr), Span::new(start, span_end)));
            }
        }
        
        self.parse_postfix_expr()
    }
    
    fn parse_postfix_expr(&mut self) -> Result<Expr, ParseError> {
        let mut expr = self.parse_primary_expr()?;
        
        loop {
            if self.check(&TokenKind::Dot) {
                let span_start = expr.span().start;
                self.advance();
                // Allow 'entity', 'event', and 'id' type keyword as field names in addition to identifiers
                let field_token = if let Some(token) = self.peek() {
                    match token.kind {
                        TokenKind::Identifier 
                        | TokenKind::Entity 
                        | TokenKind::Event
                        | TokenKind::TypeId => {
                            // Safe to use ok_or since we just verified token exists via peek()
                            self.advance().ok_or_else(|| ParseError::UnexpectedEof { 
                                expected: "field name".to_string() 
                            })?.clone()
                        }
                        _ => self.consume(TokenKind::Identifier, "field name")?
                    }
                } else {
                    return Err(ParseError::UnexpectedEof { expected: "field name".to_string() });
                };
                let field_name = field_token.text.clone();
                
                // Check if it's a method call
                if self.check(&TokenKind::LParen) {
                    self.advance();
                    let mut args = Vec::new();
                    while !self.check(&TokenKind::RParen) && !self.is_at_end() {
                        args.push(self.parse_expression()?);
                        if self.check(&TokenKind::Comma) {
                            self.advance();
                        }
                    }
                    let end_token = self.consume(TokenKind::RParen, ")")?;
                    expr = Expr::MethodCall(
                        Box::new(expr),
                        field_name,
                        args,
                        Span::new(span_start, end_token.span.end),
                    );
                } else {
                    expr = Expr::FieldAccess(
                        Box::new(expr),
                        field_name.clone(),
                        Span::new(span_start, field_token.span.end),
                    );
                }
            } else if self.check(&TokenKind::LBracket) {
                let span_start = expr.span().start;
                self.advance();
                let index = self.parse_expression()?;
                let end_token = self.consume(TokenKind::RBracket, "]")?;
                expr = Expr::IndexAccess(
                    Box::new(expr),
                    Box::new(index),
                    Span::new(span_start, end_token.span.end),
                );
            } else {
                break;
            }
        }
        
        Ok(expr)
    }
    
    fn parse_primary_expr(&mut self) -> Result<Expr, ParseError> {
        let token = self.advance().ok_or(ParseError::UnexpectedEof {
            expected: "expression".to_string(),
        })?.clone();
        
        match token.kind {
            TokenKind::IntegerLiteral => {
                let value: i64 = token.text.parse().map_err(|_| {
                    ParseError::InvalidSyntax {
                        message: format!("Invalid integer literal: '{}'", token.text),
                    }
                })?;
                Ok(Expr::Literal(Literal::Integer(value)))
            }
            TokenKind::FloatLiteral => {
                let value: f64 = token.text.parse().map_err(|_| {
                    ParseError::InvalidSyntax {
                        message: format!("Invalid float literal: '{}'", token.text),
                    }
                })?;
                Ok(Expr::Literal(Literal::Float(value)))
            }
            TokenKind::DecimalLiteral => {
                // Remove trailing 'd'
                let text = token.text.trim_end_matches('d').to_string();
                Ok(Expr::Literal(Literal::Decimal(text)))
            }
            TokenKind::StringLiteral | TokenKind::StringLiteralSingle => {
                // Remove quotes
                let text = &token.text[1..token.text.len()-1];
                Ok(Expr::Literal(Literal::String(text.to_string())))
            }
            TokenKind::True => Ok(Expr::Literal(Literal::Boolean(true))),
            TokenKind::False => Ok(Expr::Literal(Literal::Boolean(false))),
            TokenKind::Null => Ok(Expr::Literal(Literal::Null)),
            // Handle 'entity' and 'event' keywords as identifiers in expression context
            // Note: 'id' (TypeId) is only allowed as field names, not as standalone identifiers
            TokenKind::Entity | TokenKind::Event => {
                Ok(Expr::Identifier(token.text.clone(), token.span))
            }
            TokenKind::Identifier => {
                // Check if it's a function call
                if self.check(&TokenKind::LParen) {
                    let span_start = token.span.start;
                    self.advance();
                    let mut args = Vec::new();
                    while !self.check(&TokenKind::RParen) && !self.is_at_end() {
                        args.push(self.parse_expression()?);
                        if self.check(&TokenKind::Comma) {
                            self.advance();
                        }
                    }
                    let end_token = self.consume(TokenKind::RParen, ")")?;
                    Ok(Expr::Call(
                        token.text.clone(),
                        args,
                        Span::new(span_start, end_token.span.end),
                    ))
                } else {
                    Ok(Expr::Identifier(token.text.clone(), token.span))
                }
            }
            TokenKind::EntityRef => {
                // Remove @ prefix
                let name = token.text[1..].to_string();
                Ok(Expr::EntityRef(name, token.span))
            }
            TokenKind::LParen => {
                let span_start = token.span.start;
                let inner = self.parse_expression()?;
                let end_token = self.consume(TokenKind::RParen, ")")?;
                Ok(Expr::Paren(Box::new(inner), Span::new(span_start, end_token.span.end)))
            }
            TokenKind::LBracket => {
                // List literal
                let span_start = token.span.start;
                let mut elements = Vec::new();
                while !self.check(&TokenKind::RBracket) && !self.is_at_end() {
                    elements.push(self.parse_expression()?);
                    if self.check(&TokenKind::Comma) {
                        self.advance();
                    }
                }
                let end_token = self.consume(TokenKind::RBracket, "]")?;
                Ok(Expr::List(elements, Span::new(span_start, end_token.span.end)))
            }
            _ => Err(ParseError::UnexpectedToken {
                found: token.text.clone(),
                expected: "expression".to_string(),
                position: token.span.start,
            }),
        }
    }
}

impl Expr {
    fn span(&self) -> Span {
        match self {
            Expr::Literal(_) => Span::new(0, 0), // Literals don't track span yet
            Expr::Identifier(_, s) => *s,
            Expr::EntityRef(_, s) => *s,
            Expr::FieldAccess(_, _, s) => *s,
            Expr::IndexAccess(_, _, s) => *s,
            Expr::Binary(_, _, _, s) => *s,
            Expr::Unary(_, _, s) => *s,
            Expr::Call(_, _, s) => *s,
            Expr::MethodCall(_, _, _, s) => *s,
            Expr::HasComponent(_, _, s) => *s,
            Expr::Cast(_, _, s) => *s,
            Expr::List(_, s) => *s,
            Expr::Paren(_, s) => *s,
        }
    }
}

/// Parse a stream of tokens into an AST
pub fn parse(tokens: Vec<Token>) -> Result<Module, ParseError> {
    let mut parser = Parser::new(tokens);
    parser.parse_module()
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::lexer::tokenize;

    #[test]
    fn test_parse_empty() {
        let tokens = tokenize("").unwrap();
        let module = parse(tokens).unwrap();
        assert!(module.items.is_empty());
    }

    #[test]
    fn test_parse_component() {
        let source = r#"
            component Health {
                current: integer
                maximum: integer
            }
        "#;
        let tokens = tokenize(source).unwrap();
        let module = parse(tokens).unwrap();
        
        assert_eq!(module.items.len(), 1);
        if let Item::Component(comp) = &module.items[0] {
            assert_eq!(comp.name, "Health");
            assert_eq!(comp.fields.len(), 2);
            assert_eq!(comp.fields[0].name, "current");
            assert_eq!(comp.fields[1].name, "maximum");
        } else {
            panic!("Expected Component item");
        }
    }

    #[test]
    fn test_parse_tracker() {
        let source = "tracker Health on DamageEvent";
        let tokens = tokenize(source).unwrap();
        let module = parse(tokens).unwrap();
        
        assert_eq!(module.items.len(), 1);
        if let Item::Tracker(tracker) = &module.items[0] {
            assert_eq!(tracker.component, "Health");
            assert_eq!(tracker.event, "DamageEvent");
        } else {
            panic!("Expected Tracker item");
        }
    }
}
