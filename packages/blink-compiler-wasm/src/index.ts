/**
 * Blink Compiler - WebAssembly bindings for browser use
 * 
 * This package provides a browser-compatible compiler for BRL/BCL source code.
 */

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

let wasmModule: any = null;
let initPromise: Promise<any> | null = null;

/**
 * Initialize the WASM compiler
 * 
 * This must be called before using the compiler. The WASM module is loaded
 * and cached for subsequent use.
 * 
 * @param wasmUrl - URL to the WASM file (default: './blink_compiler_bg.wasm')
 * @returns Promise that resolves to the initialized compiler
 */
export async function initCompiler(wasmUrl?: string): Promise<Compiler> {
  // If already initialized, return cached module
  if (wasmModule) {
    return createCompilerAPI(wasmModule);
  }
  
  // If initialization is in progress, wait for it
  if (initPromise) {
    await initPromise;
    return createCompilerAPI(wasmModule);
  }
  
  // Start initialization
  initPromise = (async () => {
    try {
      // Dynamic import of the WASM module
      // This assumes wasm-pack has generated the bindings
      const url = wasmUrl || new URL('./wasm/blink_compiler_bg.wasm', import.meta.url);
      
      // Load the WASM module
      const response = await fetch(url);
      const buffer = await response.arrayBuffer();
      
      // We need to import the wasm-bindgen generated JS
      // For now, we'll use a simplified approach that assumes the WASM exports
      // are available directly after instantiation
      const { instance } = await WebAssembly.instantiate(buffer, {});
      
      wasmModule = instance.exports;
      
      // Call init function if it exists
      if (wasmModule.init) {
        wasmModule.init();
      }
      
      return wasmModule;
    } catch (error) {
      initPromise = null;
      throw new Error(`Failed to initialize WASM compiler: ${error}`);
    }
  })();
  
  await initPromise;
  return createCompilerAPI(wasmModule);
}

/**
 * Create the compiler API from the WASM module
 */
function createCompilerAPI(wasm: any): Compiler {
  return {
    compile(source: string, pretty = false, sourceMap = false): CompileResult {
      try {
        const result = wasm.compile(source, pretty, sourceMap);
        return {
          success: result.success(),
          ir: result.ir() || undefined,
          error: result.error() || undefined,
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
          success: result.success(),
          ir: result.ir() || undefined,
          error: result.error() || undefined,
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
  return wasmModule !== null;
}
