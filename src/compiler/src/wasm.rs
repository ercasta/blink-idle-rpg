//! WebAssembly bindings for the Blink Compiler
//!
//! This module provides JavaScript-accessible functions for compiling BRL/BCL source
//! code to IR in the browser.

use wasm_bindgen::prelude::*;
use serde::{Serialize, Deserialize};

use crate::{compile_to_json_with_sources, CompilerOptions};

// Set up panic hook for better error messages in the browser
#[cfg(feature = "wee_alloc")]
#[global_allocator]
static ALLOC: wee_alloc::WeeAlloc = wee_alloc::WeeAlloc::INIT;

/// Initialize the compiler (sets up panic hooks for debugging)
#[wasm_bindgen(start)]
pub fn init() {
    #[cfg(feature = "console_error_panic_hook")]
    console_error_panic_hook::set_once();
}

/// Result of compilation
#[derive(Serialize, Deserialize)]
#[wasm_bindgen]
pub struct CompileResult {
    /// Whether compilation succeeded
    success: bool,
    
    /// Compiled IR as JSON string (if successful)
    ir: Option<String>,
    
    /// Error message (if failed)
    error: Option<String>,
}

#[wasm_bindgen]
impl CompileResult {
    #[wasm_bindgen(getter)]
    pub fn success(&self) -> bool {
        self.success
    }
    
    #[wasm_bindgen(getter)]
    pub fn ir(&self) -> Option<String> {
        self.ir.clone()
    }
    
    #[wasm_bindgen(getter)]
    pub fn error(&self) -> Option<String> {
        self.error.clone()
    }
}

/// Compile BRL/BCL source code to IR
///
/// # Arguments
///
/// * `source` - BRL/BCL source code
/// * `pretty` - Whether to pretty-print the JSON output
/// * `source_map` - Whether to include source map information
///
/// # Returns
///
/// Returns a CompileResult with either the compiled IR or an error message
#[wasm_bindgen]
pub fn compile(
    source: &str,
    pretty: bool,
    source_map: bool,
) -> CompileResult {
    let options = CompilerOptions {
        include_source_map: source_map,
        pretty_print: pretty,
        optimize: false,
    };
    
    match compile_to_json_with_sources(source, &options, None, &[]) {
        Ok(ir) => CompileResult {
            success: true,
            ir: Some(ir),
            error: None,
        },
        Err(e) => CompileResult {
            success: false,
            ir: None,
            error: Some(e.to_string()),
        },
    }
}

/// Compile BRL source with additional include files (BDL/BCL)
///
/// # Arguments
///
/// * `source` - Main BRL source code
/// * `source_path` - Path to the main source file (for source maps)
/// * `includes` - JSON array of include files [{"path": "file.bdl", "content": "...", "language": "bdl"}, ...]
/// * `pretty` - Whether to pretty-print the JSON output
/// * `source_map` - Whether to include source map information
///
/// # Returns
///
/// Returns a CompileResult with either the compiled IR or an error message
#[wasm_bindgen]
pub fn compile_with_includes(
    source: &str,
    source_path: Option<String>,
    includes: &str,
    pretty: bool,
    source_map: bool,
) -> CompileResult {
    let options = CompilerOptions {
        include_source_map: source_map,
        pretty_print: pretty,
        optimize: false,
    };
    
    // Parse includes JSON
    let includes_vec: Result<Vec<(String, String, String)>, _> = 
        serde_json::from_str(includes)
        .map(|v: Vec<serde_json::Value>| {
            v.into_iter()
                .filter_map(|item| {
                    let path = item.get("path")?.as_str()?.to_string();
                    let content = item.get("content")?.as_str()?.to_string();
                    let language = item.get("language")?.as_str()?.to_string();
                    Some((path, content, language))
                })
                .collect()
        });
    
    let includes_vec = match includes_vec {
        Ok(v) => v,
        Err(e) => return CompileResult {
            success: false,
            ir: None,
            error: Some(format!("Failed to parse includes: {}", e)),
        },
    };
    
    match compile_to_json_with_sources(
        source,
        &options,
        source_path.as_deref(),
        &includes_vec,
    ) {
        Ok(ir) => CompileResult {
            success: true,
            ir: Some(ir),
            error: None,
        },
        Err(e) => CompileResult {
            success: false,
            ir: None,
            error: Some(e.to_string()),
        },
    }
}

/// Get compiler version
#[wasm_bindgen]
pub fn get_version() -> String {
    env!("CARGO_PKG_VERSION").to_string()
}
