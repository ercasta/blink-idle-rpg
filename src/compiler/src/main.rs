//! Blink Compiler CLI
//!
//! Command-line interface for the Blink compiler.

use clap::{Parser, Subcommand};
use std::fs;
use std::path::PathBuf;

use blink_compiler::{compile, CompilerOptions};

#[derive(Parser)]
#[command(name = "blink-compiler")]
#[command(author = "Blink Team")]
#[command(version = "0.1.0")]
#[command(about = "Compiler for Blink Rule Language (BRL)", long_about = None)]
struct Cli {
    #[command(subcommand)]
    command: Commands,
}

#[derive(Subcommand)]
enum Commands {
    /// Compile BRL/BCL/BDL source to IR
    Compile {
        /// Input BRL file (primary source)
        #[arg(short, long)]
        input: PathBuf,
        
        /// Output IR file (default: stdout)
        #[arg(short, long)]
        output: Option<PathBuf>,
        
        /// Pretty-print the output JSON
        #[arg(long, default_value = "false")]
        pretty: bool,
        
        /// Include source map information
        #[arg(long, default_value = "false")]
        source_map: bool,
        
        /// Additional source files to include (BCL, BDL files)
        /// These files will be combined with the main input for compilation
        /// Can be specified multiple times
        #[arg(long = "include", value_name = "FILE")]
        include_files: Vec<PathBuf>,
    },
    
    /// Check BRL source for errors without generating IR
    Check {
        /// Input BRL file
        #[arg(short, long)]
        input: PathBuf,
    },
    
    /// Print tokens from lexer (for debugging)
    Tokens {
        /// Input BRL file
        #[arg(short, long)]
        input: PathBuf,
    },
    
    /// Print AST from parser (for debugging)
    Ast {
        /// Input BRL file
        #[arg(short, long)]
        input: PathBuf,
    },
}

fn main() {
    let cli = Cli::parse();
    
    let result = match cli.command {
        Commands::Compile { input, output, pretty, source_map, include_files } => {
            run_compile(&input, output.as_deref(), pretty, source_map, &include_files)
        }
        Commands::Check { input } => {
            run_check(&input)
        }
        Commands::Tokens { input } => {
            run_tokens(&input)
        }
        Commands::Ast { input } => {
            run_ast(&input)
        }
    };
    
    if let Err(e) = result {
        eprintln!("Error: {}", e);
        std::process::exit(1);
    }
}

fn run_compile(
    input: &PathBuf,
    output: Option<&std::path::Path>,
    pretty: bool,
    source_map: bool,
    include_files: &[PathBuf],
) -> Result<(), Box<dyn std::error::Error>> {
    // Read main source file
    let source = fs::read_to_string(input)?;
    
    // Collect additional source files for source map only
    // BCL (choice functions) and BDL (entity definitions) files are NOT concatenated with the BRL (game rules) 
    // source because they have different syntax and language constructs that the BRL parser cannot understand.
    // They are only included in the source map for debugging/dev tools support.
    let mut additional_files: Vec<(String, String, String)> = Vec::new();
    
    for path in include_files {
        let content = fs::read_to_string(path)?;
        let path_str = path.to_string_lossy().to_string();
        
        // Determine language from file extension
        let language = if path_str.ends_with(".bcl") {
            "bcl".to_string()
        } else if path_str.ends_with(".bdl") {
            "bdl".to_string()
        } else if path_str.ends_with(".brl") {
            "brl".to_string()
        } else {
            "unknown".to_string()
        };
        
        // Track for source map only - do not append to source
        additional_files.push((path_str, content, language));
    }
    
    let options = CompilerOptions {
        include_source_map: source_map,
        pretty_print: pretty,
        optimize: true,
    };
    
    // Pass source path when source map is requested
    let source_path = if source_map {
        Some(input.to_string_lossy().to_string())
    } else {
        None
    };
    
    // Filter additional_files for source map (only when requested)
    let source_map_files: Vec<(String, String, String)> = if source_map {
        additional_files
    } else {
        Vec::new()
    };
    
    let json = blink_compiler::compile_to_json_with_sources(
        &source,
        &options,
        source_path.as_deref(),
        &source_map_files,
    )?;
    
    match output {
        Some(path) => {
            fs::write(path, &json)?;
            eprintln!("Compiled {} -> {}", input.display(), path.display());
            if !include_files.is_empty() {
                eprintln!("  Included: {}", include_files.iter()
                    .map(|p| p.display().to_string())
                    .collect::<Vec<_>>()
                    .join(", "));
            }
        }
        None => {
            println!("{}", json);
        }
    }
    
    Ok(())
}

fn run_check(input: &PathBuf) -> Result<(), Box<dyn std::error::Error>> {
    let source = fs::read_to_string(input)?;
    
    let options = CompilerOptions::default();
    
    match compile(&source, &options) {
        Ok(_) => {
            eprintln!("✓ {} is valid", input.display());
            Ok(())
        }
        Err(e) => {
            Err(e.into())
        }
    }
}

fn run_tokens(input: &PathBuf) -> Result<(), Box<dyn std::error::Error>> {
    let source = fs::read_to_string(input)?;
    
    let tokens = blink_compiler::lexer::tokenize(&source)?;
    
    for token in tokens {
        println!("{:?}", token);
    }
    
    Ok(())
}

fn run_ast(input: &PathBuf) -> Result<(), Box<dyn std::error::Error>> {
    let source = fs::read_to_string(input)?;
    
    let tokens = blink_compiler::lexer::tokenize(&source)?;
    let ast = blink_compiler::parser::parse(tokens)?;
    
    println!("{:#?}", ast);
    
    Ok(())
}
