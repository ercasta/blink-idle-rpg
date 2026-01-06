/**
 * Blink Compiler - WebAssembly bindings for browser use
 * 
 * This package provides a browser-compatible compiler for BRL/BCL source code.
 */

// Import the generated WASM bindings
import init, * as wasm from '../wasm/blink_compiler.js';

export interface CompileResult {
  success: boolean;
  ir?: string;
  error?: string;
}

export interface IncludeFile {
  path: string;
  content: string;
  language: 'bdl' | 'bcl' | 'brl';
}

export interface Compiler {
  /**
   * Compile BRL/BCL source code to IR
   * 
   * @param source - Source code to compile
   * @param pretty - Whether to pretty-print the JSON output
   * @param sourceMap - Whether to include source map information
   * @returns Compilation result with IR or error
   */
  compile(source: string, pretty?: boolean, sourceMap?: boolean): CompileResult;
  
  /**
   * Compile BRL source with additional include files
   * 
   * @param source - Main BRL source code
   * @param sourcePath - Path to the main source file (for source maps)
   * @param includes - Array of include files (BDL/BCL)
   * @param pretty - Whether to pretty-print the JSON output
   * @param sourceMap - Whether to include source map information
   * @returns Compilation result with IR or error
   */
  compileWithIncludes(
    source: string,
    sourcePath: string | null,
    includes: IncludeFile[],
    pretty?: boolean,
    sourceMap?: boolean
  ): CompileResult;
  
  /**
   * Get the compiler version
   */
  getVersion(): string;
}

let isInitialized = false;
let initPromise: Promise<void> | null = null;

/**
 * Initialize the WASM compiler
 * 
 * This must be called before using the compiler. The WASM module is loaded
 * and cached for subsequent use.
 * 
 * @param wasmUrl - URL to the WASM file (default: auto-detected)
 * @returns Promise that resolves to the initialized compiler
 */
export async function initCompiler(wasmUrl?: string): Promise<Compiler> {
  // If already initialized, return immediately
  if (isInitialized) {
    return createCompilerAPI();
  }
  
  // If initialization is in progress, wait for it
  if (initPromise) {
    await initPromise;
    return createCompilerAPI();
  }
  
  // Start initialization
  initPromise = (async () => {
    try {
      // Initialize the WASM module
      if (wasmUrl) {
        await init(wasmUrl);
      } else {
        // Auto-detect WASM path
        await init();
      }
      
      // Call the module's init function to set up panic hooks
      wasm.init();
      
      isInitialized = true;
    } catch (error) {
      initPromise = null;
      throw new Error(`Failed to initialize WASM compiler: ${error}`);
    }
  })();
  
  await initPromise;
  return createCompilerAPI();
}

/**
 * Create the compiler API
 */
function createCompilerAPI(): Compiler {
  if (!isInitialized) {
    throw new Error('Compiler not initialized. Call initCompiler() first.');
  }
  
  return {
    compile(source: string, pretty = false, sourceMap = false): CompileResult {
      try {
        const result = wasm.compile(source, pretty, sourceMap);
        return {
          success: result.success,
          ir: result.ir,
          error: result.error,
        };
      } catch (error) {
        return {
          success: false,
          error: `Compilation failed: ${error}`,
        };
      }
    },
    
    compileWithIncludes(
      source: string,
      sourcePath: string | null,
      includes: IncludeFile[],
      pretty = false,
      sourceMap = false
    ): CompileResult {
      try {
        const includesJson = JSON.stringify(includes);
        const result = wasm.compile_with_includes(
          source,
          sourcePath,
          includesJson,
          pretty,
          sourceMap
        );
        return {
          success: result.success,
          ir: result.ir,
          error: result.error,
        };
      } catch (error) {
        return {
          success: false,
          error: `Compilation failed: ${error}`,
        };
      }
    },
    
    getVersion(): string {
      try {
        return wasm.get_version();
      } catch (error) {
        return 'unknown';
      }
    },
  };
}

/**
 * Check if the compiler is initialized
 */
export function isCompilerReady(): boolean {
  return isInitialized;
}
