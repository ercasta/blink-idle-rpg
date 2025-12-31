//! Blink Compiler CLI
//!
//! Command-line interface for the Blink compiler.

use clap::{Parser, Subcommand};
use std::fs;
use std::path::PathBuf;

use blink_compiler::{compile, compile_to_json, CompilerOptions};

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
    /// Compile BRL source to IR
    Compile {
        /// Input BRL file
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
        Commands::Compile { input, output, pretty, source_map } => {
            run_compile(&input, output.as_deref(), pretty, source_map)
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
) -> Result<(), Box<dyn std::error::Error>> {
    let source = fs::read_to_string(input)?;
    
    let options = CompilerOptions {
        include_source_map: source_map,
        pretty_print: pretty,
        optimize: true,
    };
    
    let json = compile_to_json(&source, &options)?;
    
    match output {
        Some(path) => {
            fs::write(path, &json)?;
            eprintln!("Compiled {} -> {}", input.display(), path.display());
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
