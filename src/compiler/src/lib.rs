//! Blink Compiler
//!
//! This crate provides the compiler for Blink Rule Language (BRL).
//! It parses BRL source code and produces an Intermediate Representation (IR)
//! that can be executed by any Blink engine (Rust, JavaScript, Batch, etc.).
//!
//! # Architecture
//!
//! ```text
//! ┌──────────────┐     ┌─────────────┐     ┌──────────────┐     ┌──────────────┐
//! │  BRL Source  │ ──► │    Lexer    │ ──► │    Parser    │ ──► │   Analyzer   │
//! └──────────────┘     └─────────────┘     └──────────────┘     └──────────────┘
//!                                                                      │
//!                                                                      ▼
//!                                                              ┌──────────────┐
//!                                                              │ IR Generator │
//!                                                              └──────────────┘
//!                                                                      │
//!                                                                      ▼
//!                                                              ┌──────────────┐
//!                                                              │   Blink IR   │
//!                                                              │  (JSON/Bin)  │
//!                                                              └──────────────┘
//! ```
//!
//! # Usage
//!
//! ```rust,ignore
//! use blink_compiler::{compile, CompilerOptions};
//!
//! let source = r#"
//!     component Health {
//!         current: integer
//!         maximum: integer
//!     }
//! "#;
//!
//! let ir = compile(source, &CompilerOptions::default())?;
//! println!("{}", serde_json::to_string_pretty(&ir)?);
//! ```

pub mod lexer;
pub mod parser;
pub mod analyzer;
pub mod ir;

use thiserror::Error;

use crate::analyzer::TypedModule;

/// Main compilation error type
#[derive(Error, Debug)]
pub enum CompileError {
    #[error("Lexer error: {0}")]
    LexerError(String),
    
    #[error("Parser error: {0}")]
    ParserError(String),
    
    #[error("Semantic error: {0}")]
    SemanticError(String),
    
    #[error("IR generation error: {0}")]
    IRError(String),
}

/// Compiler configuration options
#[derive(Debug, Clone, Default)]
pub struct CompilerOptions {
    /// Include source location information in IR (for debugging)
    pub include_source_map: bool,
    
    /// Emit human-readable IR (pretty-printed JSON)
    pub pretty_print: bool,
    
    /// Enable optimization passes
    pub optimize: bool,
}

/// Internal helper to perform tokenize, parse, and analyze steps
fn compile_to_typed_ast(source: &str) -> Result<TypedModule, CompileError> {
    // Step 1: Tokenize
    let tokens = lexer::tokenize(source)
        .map_err(|e| CompileError::LexerError(e.to_string()))?;
    
    // Step 2: Parse
    let ast = parser::parse(tokens)
        .map_err(|e| CompileError::ParserError(e.to_string()))?;
    
    // Step 3: Semantic analysis
    let typed_ast = analyzer::analyze(ast)
        .map_err(|e| CompileError::SemanticError(e.to_string()))?;
    
    Ok(typed_ast)
}

/// Compile BRL source code to IR
///
/// This is the main entry point for the compiler.
///
/// # Arguments
///
/// * `source` - BRL source code
/// * `options` - Compiler configuration options
///
/// # Returns
///
/// Returns the compiled IR module or a compilation error.
///
/// # Example
///
/// ```rust,ignore
/// use blink_compiler::{compile, CompilerOptions};
///
/// let source = r#"
///     component Health {
///         current: integer
///         maximum: integer
///     }
/// "#;
///
/// let ir = compile(source, &CompilerOptions::default())?;
/// ```
pub fn compile(source: &str, options: &CompilerOptions) -> Result<ir::IRModule, CompileError> {
    compile_with_path(source, options, None)
}

/// Compile BRL source code to IR with source path for source maps
///
/// This version includes the source path when generating source maps.
///
/// # Arguments
///
/// * `source` - BRL source code
/// * `options` - Compiler configuration options
/// * `source_path` - Path to the source file (used for source map)
///
/// # Returns
///
/// Returns the compiled IR module or a compilation error.
pub fn compile_with_path(
    source: &str,
    options: &CompilerOptions,
    source_path: Option<&str>,
) -> Result<ir::IRModule, CompileError> {
    let typed_ast = compile_to_typed_ast(source)?;
    
    // Generate IR (with source map support if path provided)
    let ir = if let Some(path) = source_path {
        ir::generate_with_source(typed_ast, options, source, path)
    } else {
        ir::generate(typed_ast, options)
    }.map_err(|e| CompileError::IRError(e.to_string()))?;
    
    Ok(ir)
}

/// Compile BRL source and return JSON IR
///
/// Convenience function that compiles and serializes to JSON in one step.
pub fn compile_to_json(source: &str, options: &CompilerOptions) -> Result<String, CompileError> {
    compile_to_json_with_path(source, options, None)
}

/// Compile BRL source and return JSON IR with source path for source maps
///
/// This version includes the source path when generating source maps.
pub fn compile_to_json_with_path(
    source: &str,
    options: &CompilerOptions,
    source_path: Option<&str>,
) -> Result<String, CompileError> {
    compile_to_json_with_sources(source, options, source_path, &[])
}

/// Compile BRL source and return JSON IR with source path and additional source files
///
/// This version includes the source path and additional BCL/BDL files in the source map.
///
/// # Arguments
///
/// * `source` - BRL source code
/// * `options` - Compiler configuration options
/// * `source_path` - Path to the main BRL source file (used for source map)
/// * `additional_sources` - Additional source files to include in source map (path, content, language)
pub fn compile_to_json_with_sources(
    source: &str,
    options: &CompilerOptions,
    source_path: Option<&str>,
    additional_sources: &[(String, String, String)],
) -> Result<String, CompileError> {
    let typed_ast = compile_to_typed_ast(source)?;
    
    // Generate IR with source map support
    let ir = ir::generate_with_sources(typed_ast, options, source, source_path, additional_sources)
        .map_err(|e| CompileError::IRError(e.to_string()))?;
    
    let json = if options.pretty_print {
        serde_json::to_string_pretty(&ir)
    } else {
        serde_json::to_string(&ir)
    };
    
    json.map_err(|e| CompileError::IRError(format!("JSON serialization failed: {}", e)))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_compile_empty() {
        // Empty source should produce empty IR
        let result = compile("", &CompilerOptions::default());
        assert!(result.is_ok());
    }
}
