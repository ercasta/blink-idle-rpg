//! Lexer for Blink Rule Language (BRL)
//!
//! Converts BRL source code into a stream of tokens.

use logos::Logos;
use thiserror::Error;

/// Lexer error type
#[derive(Error, Debug)]
pub enum LexerError {
    #[error("Unexpected character at position {position}: '{character}'")]
    UnexpectedCharacter { position: usize, character: char },
    
    #[error("Unterminated string literal starting at position {position}")]
    UnterminatedString { position: usize },
}

/// Token types for BRL
#[derive(Logos, Debug, PartialEq, Clone)]
#[logos(skip r"[ \t\n\r]+")]  // Skip whitespace
#[logos(skip r"//[^\n]*")]    // Skip single-line comments
#[logos(skip r"/\*[^*]*\*+(?:[^/*][^*]*\*+)*/")] // Skip multi-line comments
pub enum TokenKind {
    // Keywords
    #[token("component")]
    Component,
    #[token("rule")]
    Rule,
    #[token("on")]
    On,
    #[token("trigger")]
    Trigger,
    #[token("event")]
    Event,
    #[token("entity")]
    Entity,
    #[token("if")]
    If,
    #[token("else")]
    Else,
    #[token("for")]
    For,
    #[token("while")]
    While,
    #[token("fn")]
    Fn,
    #[token("return")]
    Return,
    #[token("true")]
    True,
    #[token("false")]
    False,
    #[token("null")]
    Null,
    #[token("schedule")]
    Schedule,
    #[token("cancel")]
    Cancel,
    #[token("recurring")]
    Recurring,
    #[token("module")]
    Module,
    #[token("import")]
    Import,
    #[token("when")]
    When,
    #[token("create")]
    Create,
    #[token("delete")]
    Delete,
    #[token("has")]
    Has,
    #[token("let")]
    Let,
    #[token("in")]
    In,
    #[token("choice")]
    Choice,
    #[token("new")]
    New,
    #[token("clone")]
    Clone,
    #[token("having")]
    Having,
    #[token("entities")]
    Entities,
    
    // Types
    #[token("string")]
    TypeString,
    #[token("boolean")]
    TypeBoolean,
    #[token("integer")]
    TypeInteger,
    #[token("float")]
    TypeFloat,
    #[token("decimal")]
    TypeDecimal,
    #[token("id")]
    TypeId,
    #[token("list")]
    TypeList,
    
    // Identifiers
    #[regex(r"[a-zA-Z_][a-zA-Z0-9_]*")]
    Identifier,
    
    // Entity references
    #[regex(r"@[a-zA-Z_][a-zA-Z0-9_]*")]
    EntityRef,
    
    // Literals
    #[regex(r#""([^"\\]|\\.)*""#)]
    StringLiteral,
    #[regex(r"'([^'\\]|\\.)*'")]
    StringLiteralSingle,
    #[regex(r"[0-9]+\.[0-9]+d")]
    DecimalLiteral,
    #[regex(r"[0-9]+\.[0-9]+")]
    FloatLiteral,
    #[regex(r"[0-9]+")]
    IntegerLiteral,
    
    // Delimiters
    #[token("{")]
    LBrace,
    #[token("}")]
    RBrace,
    #[token("(")]
    LParen,
    #[token(")")]
    RParen,
    #[token("[")]
    LBracket,
    #[token("]")]
    RBracket,
    #[token(",")]
    Comma,
    #[token(":")]
    Colon,
    #[token(";")]
    Semicolon,
    #[token(".")]
    Dot,
    #[token("?")]
    Question,
    
    // Operators
    #[token("+")]
    Plus,
    #[token("-")]
    Minus,
    #[token("*")]
    Star,
    #[token("/")]
    Slash,
    #[token("%")]
    Percent,
    #[token("=")]
    Eq,
    #[token("==")]
    EqEq,
    #[token("!=")]
    NotEq,
    #[token("<")]
    Lt,
    #[token("<=")]
    LtEq,
    #[token(">")]
    Gt,
    #[token(">=")]
    GtEq,
    #[token("&&")]
    AndAnd,
    #[token("||")]
    OrOr,
    #[token("!")]
    Not,
    #[token("&")]
    And,
    #[token("+=")]
    PlusEq,
    #[token("-=")]
    MinusEq,
    #[token("*=")]
    StarEq,
    #[token("/=")]
    SlashEq,
    #[token("->")]
    Arrow,
}

/// A token with its span information
#[derive(Debug, Clone, PartialEq)]
pub struct Token {
    pub kind: TokenKind,
    pub text: String,
    pub span: Span,
}

/// Source location span
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct Span {
    pub start: usize,
    pub end: usize,
}

impl Span {
    pub fn new(start: usize, end: usize) -> Self {
        Self { start, end }
    }
}

/// Tokenize BRL source code
///
/// # Arguments
///
/// * `source` - The BRL source code
///
/// # Returns
///
/// A vector of tokens or a lexer error
pub fn tokenize(source: &str) -> Result<Vec<Token>, LexerError> {
    let mut lexer = TokenKind::lexer(source);
    let mut tokens = Vec::new();
    
    while let Some(result) = lexer.next() {
        match result {
            Ok(kind) => {
                let span = lexer.span();
                let text = lexer.slice().to_string();
                tokens.push(Token {
                    kind,
                    text,
                    span: Span::new(span.start, span.end),
                });
            }
            Err(_) => {
                let span = lexer.span();
                let char = source[span.start..].chars().next().unwrap_or('?');
                return Err(LexerError::UnexpectedCharacter {
                    position: span.start,
                    character: char,
                });
            }
        }
    }
    
    Ok(tokens)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_empty_source() {
        let tokens = tokenize("").unwrap();
        assert!(tokens.is_empty());
    }

    #[test]
    fn test_component_keyword() {
        let tokens = tokenize("component").unwrap();
        assert_eq!(tokens.len(), 1);
        assert_eq!(tokens[0].kind, TokenKind::Component);
    }

    #[test]
    fn test_simple_component() {
        let source = r#"
            component Health {
                current: integer
                maximum: integer
            }
        "#;
        let tokens = tokenize(source).unwrap();
        
        // Should have: component, Health, {, current, :, integer, maximum, :, integer, }
        assert!(tokens.len() >= 10);
        assert_eq!(tokens[0].kind, TokenKind::Component);
        assert_eq!(tokens[1].kind, TokenKind::Identifier);
        assert_eq!(tokens[2].kind, TokenKind::LBrace);
    }

    #[test]
    fn test_comments() {
        let source = r#"
            // This is a comment
            component /* inline */ Test { }
        "#;
        let tokens = tokenize(source).unwrap();
        
        // Comments should be skipped
        assert_eq!(tokens[0].kind, TokenKind::Component);
    }

    #[test]
    fn test_literals() {
        let source = r#"42 3.14 10.50d "hello" 'world'"#;
        let tokens = tokenize(source).unwrap();
        
        assert_eq!(tokens[0].kind, TokenKind::IntegerLiteral);
        assert_eq!(tokens[1].kind, TokenKind::FloatLiteral);
        assert_eq!(tokens[2].kind, TokenKind::DecimalLiteral);
        assert_eq!(tokens[3].kind, TokenKind::StringLiteral);
        assert_eq!(tokens[4].kind, TokenKind::StringLiteralSingle);
    }
}
