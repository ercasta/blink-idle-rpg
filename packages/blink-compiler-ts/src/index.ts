/**
 * Blink TypeScript Compiler
 *
 * A TypeScript-only compiler for BRL language.
 * Compiles source files directly in the browser to IR JSON format.
 */

import { tokenize, Token, TokenKind, Span, LexerError } from './lexer';
import { parse, Parser, ParseError } from './parser';
import { generate, CodeGenerator, GeneratorOptions } from './codegen';
import { generateRust, RustCodeGenerator, RustCodegenOptions, RustCodegenResult } from './codegen-rust';
import { analyze, SemanticAnalyzer, SemanticError } from './semantic';
import * as AST from './ast';
import * as IR from './ir';

export { tokenize, Token, TokenKind, Span, LexerError } from './lexer';
export { parse, Parser, ParseError } from './parser';
export { generate, CodeGenerator, GeneratorOptions } from './codegen';
export { generateRust, RustCodeGenerator, RustCodegenOptions, RustCodegenResult } from './codegen-rust';
export { analyze, SemanticAnalyzer, SemanticError } from './semantic';
export * as AST from './ast';
export * as IR from './ir';

export interface SourceFile {
  path: string;
  content: string;
  language: 'brl';
}

export interface CompileOptions {
  moduleName?: string;
  includeSourceMap?: boolean;
}

export interface CompileResult {
  ir: IR.IRModule;
  errors: CompileError[];
}

export interface CompileError {
  type: 'lexer' | 'parser' | 'semantic';
  message: string;
  file?: string;
  position?: number;
  line?: number;
  column?: number;
}

/**
 * Calculate line and column from position and source
 */
function positionToLineColumn(source: string, position: number): { line: number; column: number } {
  let line = 1;
  let column = 1;
  
  for (let i = 0; i < position && i < source.length; i++) {
    if (source[i] === '\n') {
      line++;
      column = 1;
    } else {
      column++;
    }
  }
  
  return { line, column };
}

/**
 * Compile multiple source files to IR
 */
export function compile(sources: SourceFile[], options: CompileOptions = {}): CompileResult {
  const errors: CompileError[] = [];
  const modules: AST.Module[] = [];
  const sourceContents: Map<number, { path: string; content: string }> = new Map();
  
  const generator = new CodeGenerator({
    moduleName: options.moduleName,
    includeSourceMap: options.includeSourceMap,
  });
  
  // Add source files to generator for source map
  for (const source of sources) {
    generator.addSourceFile(source.path, source.content, source.language);
  }
  
  // Parse each source file
  let moduleIndex = 0;
  for (const source of sources) {
    try {
      const tokens = tokenize(source.content);
      const ast = parse(tokens);
      modules.push(ast);
      sourceContents.set(moduleIndex, { path: source.path, content: source.content });
      moduleIndex++;
    } catch (e) {
      if (e instanceof LexerError) {
        const { line, column } = positionToLineColumn(source.content, e.position);
        errors.push({
          type: 'lexer',
          message: e.message,
          file: source.path,
          position: e.position,
          line,
          column,
        });
      } else if (e instanceof ParseError) {
        const { line, column } = positionToLineColumn(source.content, e.position);
        errors.push({
          type: 'parser',
          message: e.message,
          file: source.path,
          position: e.position,
          line,
          column,
        });
      } else {
        errors.push({
          type: 'semantic',
          message: String(e),
          file: source.path,
        });
      }
    }
  }
  
  // If there are parse errors, return empty IR
  if (errors.length > 0) {
    return {
      ir: {
        version: '1.0',
        module: options.moduleName ?? 'unnamed',
        components: [],
        rules: [],
        functions: [],
      },
      errors,
    };
  }
  
  // Perform semantic analysis
  const semanticErrors = analyze(modules);
  for (const semErr of semanticErrors) {
    // Find the source file for this error based on span position
    // For now, use the first source file as a fallback
    const sourceInfo = sources[0];
    const { line, column } = positionToLineColumn(sourceInfo.content, semErr.span.start);
    errors.push({
      type: 'semantic',
      message: semErr.message,
      file: sourceInfo.path,
      position: semErr.span.start,
      line,
      column,
    });
  }
  
  // If there are semantic errors, return empty IR
  if (errors.length > 0) {
    return {
      ir: {
        version: '1.0',
        module: options.moduleName ?? 'unnamed',
        components: [],
        rules: [],
        functions: [],
      },
      errors,
    };
  }
  
  // Generate IR
  const ir = generator.generate(modules);
  
  return { ir, errors };
}

/**
 * Compile a single source string to IR
 */
export function compileString(
  source: string,
  language: 'brl' = 'brl',
  options: CompileOptions = {}
): CompileResult {
  return compile([{
    path: `input.brl`,
    content: source,
    language,
  }], options);
}

/**
 * Parse source code to AST (for debugging/inspection)
 */
export function parseSource(source: string): AST.Module {
  const tokens = tokenize(source);
  return parse(tokens);
}

/**
 * Tokenize source code (for debugging/inspection)
 */
export function tokenizeSource(source: string): Token[] {
  return tokenize(source);
}

/**
 * Merge multiple IR modules into one
 */
export function mergeIRModules(modules: IR.IRModule[], moduleName?: string): IR.IRModule {
  const components: IR.IRComponent[] = [];
  const rules: IR.IRRule[] = [];
  const functions: IR.IRFunction[] = [];
  const entities: IR.IREntityDefinition[] = [];
  const choicePoints: IR.IRChoicePoint[] = [];
  const sourceFiles: IR.SourceFile[] = [];
  
  let componentId = 0;
  let ruleId = 0;
  let functionId = 0;
  let entityId = 0;
  
  for (const module of modules) {
    // Merge components with new IDs
    for (const comp of module.components) {
      components.push({ ...comp, id: componentId++ });
    }
    
    // Merge rules with new IDs
    for (const rule of module.rules) {
      rules.push({ ...rule, id: ruleId++ });
    }
    
    // Merge functions with new IDs
    for (const func of module.functions) {
      functions.push({ ...func, id: functionId++ });
    }
    
    // Merge entities
    if (module.initial_state) {
      for (const entity of module.initial_state.entities) {
        entities.push({
          ...entity,
          id: entityId++,
        });
      }
    }
    
    // Merge choice points
    if (module.choice_points) {
      choicePoints.push(...module.choice_points);
    }
    
    // Merge source maps
    if (module.source_map) {
      sourceFiles.push(...module.source_map.files);
    }
  }
  
  // Deduplicate choice points
  const seenChoicePoints = new Set<string>();
  const uniqueChoicePoints = choicePoints.filter(cp => {
    if (seenChoicePoints.has(cp.id)) return false;
    seenChoicePoints.add(cp.id);
    return true;
  });
  
  const result: IR.IRModule = {
    version: '1.0',
    module: moduleName ?? 'merged',
    metadata: {
      compiled_at: new Date().toISOString(),
      compiler_version: '1.0.0-ts',
    },
    components,
    rules,
    functions,
  };
  
  if (entities.length > 0) {
    result.initial_state = { entities };
  }
  
  if (uniqueChoicePoints.length > 0) {
    result.choice_points = uniqueChoicePoints;
  }
  
  if (sourceFiles.length > 0) {
    result.source_map = { files: sourceFiles };
  }
  
  return result;
}

/**
 * Compile multiple source files to Rust source code.
 * Returns a map of filename → Rust source content.
 */
export function compileToRust(
  sources: SourceFile[],
  options: RustCodegenOptions = {}
): { files: Map<string, string>; errors: CompileError[] } {
  const errors: CompileError[] = [];
  const modules: AST.Module[] = [];

  // Parse each source file
  for (const source of sources) {
    try {
      const tokens = tokenize(source.content);
      const ast = parse(tokens);
      modules.push(ast);
    } catch (e) {
      if (e instanceof LexerError) {
        const { line, column } = positionToLineColumn(source.content, e.position);
        errors.push({
          type: 'lexer',
          message: e.message,
          file: source.path,
          position: e.position,
          line,
          column,
        });
      } else if (e instanceof ParseError) {
        const { line, column } = positionToLineColumn(source.content, e.position);
        errors.push({
          type: 'parser',
          message: e.message,
          file: source.path,
          position: e.position,
          line,
          column,
        });
      } else {
        errors.push({
          type: 'semantic',
          message: String(e),
          file: source.path,
        });
      }
    }
  }

  if (errors.length > 0) {
    return { files: new Map(), errors };
  }

  // Generate Rust source code
  const result = generateRust(modules, options);
  return { files: result.files, errors };
}

/**
 * Resolve all `import "filename.brl"` directives from an entry-point file,
 * returning the full ordered list of `SourceFile`s ready for compilation.
 *
 * Imports are resolved depth-first so that every dependency appears before
 * the file that imports it.  Circular or duplicate imports are silently
 * de-duplicated.
 *
 * @param entryPath  Path key for the entry-point file (e.g. `"game.brl"`).
 *                   This exact string is passed to `readFile`.
 * @param readFile   Synchronous loader.  Receives the path from the `import`
 *                   directive (relative to the BRL source directory) and must
 *                   return the file's content as a string.
 */
export function resolveImports(
  entryPath: string,
  readFile: (path: string) => string,
): SourceFile[] {
  const resolved: SourceFile[] = [];
  const seen = new Set<string>();

  function visit(filePath: string): void {
    if (seen.has(filePath)) return;
    seen.add(filePath);

    const content = readFile(filePath);
    const source: SourceFile = { path: filePath, content, language: 'brl' };

    // Parse to find file-import directives; ignore parse errors here —
    // they will surface during compilation with accurate diagnostics.
    try {
      const tokens = tokenize(content);
      const ast = parse(tokens);
      for (const item of ast.items) {
        if (item.type === 'import' && item.filePath) {
          visit(item.filePath);
        }
      }
    } catch (_e) {
      // Intentionally swallowed; compilation step will surface the error.
    }

    resolved.push(source);
  }

  visit(entryPath);
  return resolved;
}

// Browser-friendly global export for script tags
if (typeof window !== 'undefined') {
  (window as any).BlinkCompiler = {
    compile,
    compileString,
    compileToRust,
    parseSource,
    tokenizeSource,
    mergeIRModules,
    resolveImports,
    tokenize,
    parse,
    generate,
    generateRust,
  };
}
