import { useState, useCallback, useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';
import { Editor } from './Editor';
import { Inspector } from './Inspector';
import { Toolbar } from './Toolbar';
import { Console } from './Console';
import { StepControls } from './StepControls';
import { useGame } from '../GameContext';
import type { 
  SourceFile, 
  CompileError, 
  EditorTab, 
  IRModule,
  EntityData,
  TraceEvent
} from '@/types/ide';

// Type declaration for the global BlinkCompiler
declare global {
  interface Window {
    BlinkCompiler?: {
      compile: (sources: Array<{ path: string; content: string; language: string }>, options?: { moduleName?: string; includeSourceMap?: boolean }) => { ir: IRModule; errors: CompileError[] };
      compileString: (source: string, language?: string, options?: { moduleName?: string }) => { ir: IRModule; errors: CompileError[] };
    };
  }
}

interface IDEProps {
  className?: string;
}

// Default source files
const DEFAULT_BRL = `// Blink Rule Language (BRL) Editor
// Define components, rules, and game logic here

component Health {
    current: integer
    max: integer
}

component Position {
    x: float
    y: float
}

// Example rule: handle damage events
rule damage_handler on DamageReceived {
    entity.Health.current = entity.Health.current - event.amount
    
    if entity.Health.current <= 0 {
        schedule EntityDied {
            target: entity
        }
    }
}
`;

const DEFAULT_BCL = `// Blink Choice Language (BCL) Editor
// Define AI choice functions here

// Select target with lowest health
choice fn select_target(character: Character, enemies: list): id {
    let target = enemies[0]
    for enemy in enemies {
        if enemy.Health.current < target.Health.current {
            target = enemy
        }
    }
    return target
}
`;

const DEFAULT_BDL = `// Blink Data Language (BDL) Editor
// Define entity instances and initial game state here

// Example entity with components
entity {
    Health {
        current: 100
        max: 100
    }
    Position {
        x: 0.0
        y: 0.0
    }
}
`;

export function IDE({ className }: IDEProps) {
  const { engine } = useGame();
  // Source files state
  const [files, setFiles] = useState<Record<EditorTab, SourceFile>>({
    brl: { id: 'brl-main', name: 'main.brl', content: DEFAULT_BRL, language: 'brl', isDirty: false },
    bcl: { id: 'bcl-main', name: 'main.bcl', content: DEFAULT_BCL, language: 'bcl', isDirty: false },
    bdl: { id: 'bdl-main', name: 'main.bdl', content: DEFAULT_BDL, language: 'bdl', isDirty: false },
    snippet: { id: 'snippet', name: 'snippet.brl', content: '// Quick snippet for injection\n', language: 'brl', isDirty: false },
  });
  
  const [activeTab, setActiveTab] = useState<EditorTab>('brl');
  const [compileErrors, setCompileErrors] = useState<CompileError[]>([]);
  const [consoleMessages, setConsoleMessages] = useState<Array<{ type: 'info' | 'error' | 'success' | 'trace'; message: string; time?: number }>>([]);
  const [compiledIR, setCompiledIR] = useState<IRModule | null>(null);
  
  // Engine state
  const [simulationTime, setSimulationTime] = useState(0);
  const [isPaused, setIsPaused] = useState(true);
  const [traceEvents, setTraceEvents] = useState<TraceEvent[]>([]);
  
  // Refs for cleanup
  const traceUnsubscribeRef = useRef<(() => void) | null>(null);
  
  // Console logging helper
  const log = useCallback((type: 'info' | 'error' | 'success' | 'trace', message: string) => {
    const time = engine?.getTime() ?? 0;
    setConsoleMessages(prev => [...prev.slice(-100), { type, message, time }]);
  }, [engine]);
  
  // Update content handler
  const handleContentChange = useCallback((tab: EditorTab, content: string) => {
    setFiles(prev => ({
      ...prev,
      [tab]: { ...prev[tab], content, isDirty: true }
    }));
  }, []);
  
  // Compile handler
  const handleCompile = useCallback(() => {
    if (!window.BlinkCompiler) {
      log('error', 'Compiler not loaded. Make sure blink-compiler.bundle.js is included.');
      return;
    }
    
    const sources = [
      { path: files.brl.name, content: files.brl.content, language: 'brl' },
      { path: files.bcl.name, content: files.bcl.content, language: 'bcl' },
      { path: files.bdl.name, content: files.bdl.content, language: 'bdl' },
      { path: files.snippet.name || 'snippet.brl', content: files.snippet.content, language: files.snippet.language || 'brl' },
    ];
    
    try {
      log('info', 'Compiling BRL/BCL/BDL files...');
      const result = window.BlinkCompiler.compile(sources, { 
        moduleName: 'ide-module',
        includeSourceMap: true 
      });
      
      if (result.errors.length > 0) {
        setCompileErrors(result.errors);
        result.errors.forEach(err => {
          log('error', `${err.file}:${err.line}:${err.column} - ${err.message}`);
        });
        log('error', `Compilation failed with ${result.errors.length} error(s)`);
      } else {
        setCompileErrors([]);
        setCompiledIR(result.ir);
        log('success', `Compilation successful! Components: ${result.ir.components.length}, Rules: ${result.ir.rules.length}`);
        
        // Mark files as clean (include snippet)
        setFiles(prev => ({
          brl: { ...prev.brl, isDirty: false },
          bcl: { ...prev.bcl, isDirty: false },
          bdl: { ...prev.bdl, isDirty: false },
          snippet: { ...prev.snippet, isDirty: false },
        }));
      }
    } catch (err) {
      log('error', `Compilation error: ${err instanceof Error ? err.message : String(err)}`);
    }
  }, [files, log]);
  
  // Inject snippet without resetting state
  const handleInjectSnippet = useCallback(() => {
    if (!engine) {
      log('error', 'No engine running. Load IR first.');
      return;
    }
    
    if (!window.BlinkCompiler) {
      log('error', 'Compiler not loaded.');
      return;
    }
    
    const snippetContent = files.snippet.content;
    if (!snippetContent.trim()) {
      log('error', 'Snippet is empty.');
      return;
    }
    
    try {
      log('info', 'Compiling snippet together with current sources...');

      // Compile the snippet together with the current project files so
      // component definitions (e.g. Health) are available to the snippet.
      const sources = [
        { path: files.brl.name, content: files.brl.content, language: 'brl' },
        { path: files.bcl.name, content: files.bcl.content, language: 'bcl' },
        { path: files.bdl.name, content: files.bdl.content, language: 'bdl' },
        { path: files.snippet.name || 'snippet.brl', content: snippetContent, language: files.snippet.language || 'brl' },
      ];

      const result = window.BlinkCompiler.compile(sources, { moduleName: 'snippet-module', includeSourceMap: false });

      if (result.errors.length > 0) {
        result.errors.forEach(err => {
          log('error', `Snippet error: ${err.message}`);
        });
        return;
      }

      log('success', 'Snippet compiled with project sources.');

      if (engine && typeof engine.mergeRulesFromObject === 'function') {
        const isCurrentlyPaused = typeof engine.getIsPaused === 'function' ? engine.getIsPaused() : isPaused;
        if (!isCurrentlyPaused) {
          log('error', 'Engine must be paused to inject rules at runtime. Pause the engine and try again.');
          return;
        }

        try {
          (engine.mergeRulesFromObject as any)(result.ir, { mergeEntities: false, overrideOnConflict: true, reassignRuleIds: true });
          log('success', 'Snippet merged into running engine.');
          setCompiledIR(result.ir);
        } catch (err) {
          log('error', `Runtime merge failed: ${err instanceof Error ? err.message : String(err)}`);
        }
      } else {
        log('info', 'Rule injection not supported by this engine build. Use "Load into Engine" to replace IR.');
      }
    } catch (err) {
      log('error', `Snippet compilation error: ${err instanceof Error ? err.message : String(err)}`);
    }
  }, [engine, files.snippet.content, log]);
  
  // Schedule event handler
  const handleScheduleEvent = useCallback((eventType: string, delay: number, fields: Record<string, unknown>) => {
    if (!engine) {
      log('error', 'No engine running.');
      return;
    }
    
    try {
      engine.scheduleEvent(eventType, delay, { fields });
      log('success', `Scheduled event "${eventType}" with delay ${delay}s`);
    } catch (err) {
      log('error', `Failed to schedule event: ${err instanceof Error ? err.message : String(err)}`);
    }
  }, [engine, log]);
  
  // Reset engine state
  const handleResetEngine = useCallback(() => {
    if (!engine) {
      log('info', 'No engine to reset.');
      return;
    }
    
    try {
      engine.reset();
      setSimulationTime(0);
      setTraceEvents([]);
      log('success', 'Engine state reset to initial state.');
    } catch (err) {
      log('error', `Failed to reset engine: ${err instanceof Error ? err.message : String(err)}`);
    }
  }, [engine, log]);
  
  // Step handlers
  const handleStep = useCallback((count: number = 1) => {
    if (!engine) {
      log('error', 'No engine running.');
      return;
    }
    
    let stepsExecuted = 0;
    for (let i = 0; i < count; i++) {
      if (!engine.hasEvents()) {
        log('info', 'No more events to process.');
        break;
      }
      const result = engine.step();
      if (result) {
        stepsExecuted++;
      }
    }
    
    setSimulationTime(engine.getTime());
    if (stepsExecuted > 0) {
      log('info', `Executed ${stepsExecuted} step(s). Time: ${engine.getTime().toFixed(2)}s`);
    }
  }, [engine, log]);
  
  // Run until time
  const handleRunUntil = useCallback((targetTime: number) => {
    if (!engine) {
      log('error', 'No engine running.');
      return;
    }
    
    const currentTime = engine.getTime();
    const absoluteTarget = currentTime + targetTime;
    let stepsExecuted = 0;
    
    while (engine.getTime() < absoluteTarget && engine.hasEvents()) {
      engine.step();
      stepsExecuted++;
      
      // Safety limit
      if (stepsExecuted > 10000) {
        log('error', 'Safety limit reached (10000 steps).');
        break;
      }
    }
    
    setSimulationTime(engine.getTime());
    log('info', `Executed ${stepsExecuted} steps. Time: ${engine.getTime().toFixed(2)}s`);
  }, [engine, log]);
  
  // Save/Download handlers
  const handleDownload = useCallback((tab: EditorTab) => {
    const file = files[tab];
    const blob = new Blob([file.content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = file.name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    log('success', `Downloaded ${file.name}`);
  }, [files, log]);
  
  const handleDownloadAll = useCallback(() => {
    // Download all files as individual downloads
    ['brl', 'bcl', 'bdl'].forEach(tab => {
      handleDownload(tab as EditorTab);
    });
  }, [handleDownload]);
  
  // Load file handler
  const handleLoadFile = useCallback((tab: EditorTab, content: string, filename: string) => {
    setFiles(prev => ({
      ...prev,
      [tab]: { ...prev[tab], content, name: filename, isDirty: true }
    }));
    log('success', `Loaded ${filename}`);
  }, [log]);
  
  // Clear console
  const handleClearConsole = useCallback(() => {
    setConsoleMessages([]);
    setTraceEvents([]);
  }, []);
  
  // Get entities for inspector
  const getEntities = useCallback((): EntityData[] => {
    if (!engine) return [];
    
    const entities: EntityData[] = [];
    const allEntities = engine.getAllEntities();
    
    allEntities.forEach((components, id) => {
      const componentData: Record<string, Record<string, unknown>> = {};
      components.forEach((data, name) => {
        componentData[name] = data;
      });
      entities.push({ id, components: componentData });
    });
    
    return entities;
  }, [engine]);
  
  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (traceUnsubscribeRef.current) {
        traceUnsubscribeRef.current();
      }
    };
  }, [engine]);
  
  return (
    <div className={cn('flex flex-col h-screen bg-background', className)}>
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-2 border-b border-border bg-card">
        <div className="flex items-center gap-2">
          <span className="text-xl">🛠️</span>
          <h1 className="text-lg font-semibold text-foreground">Blink IDE</h1>
          <span className="text-sm text-muted-foreground">v1.0</span>
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span>Time: {simulationTime.toFixed(2)}s</span>
          <span className={cn(
            'px-2 py-0.5 rounded text-xs',
            engine ? 'bg-green-900/50 text-green-400' : 'bg-red-900/50 text-red-400'
          )}>
            {engine ? 'Engine Ready' : 'No Engine'}
          </span>
        </div>
      </header>
      
      {/* Toolbar */}
      <Toolbar
        onCompile={handleCompile}
        onLoadIntoEngine={() => log('info', 'Engine is loaded from the Game UI.')}
        onInjectSnippet={handleInjectSnippet}
        onResetEngine={handleResetEngine}
        onDownloadAll={handleDownloadAll}
        onScheduleEvent={handleScheduleEvent}
        hasCompiledIR={!!compiledIR}
        hasEngine={!!engine}
        compileErrorCount={compileErrors.length}
      />
      
      {/* Main content area */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left side - Editor */}
        <div className="flex flex-col w-1/2 border-r border-border">
          {/* Editor tabs */}
          <div className="flex border-b border-border bg-card/50">
            {(['brl', 'bcl', 'bdl', 'snippet'] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={cn(
                  'px-4 py-2 text-sm font-medium transition-colors',
                  activeTab === tab
                    ? 'bg-background text-foreground border-b-2 border-primary'
                    : 'text-muted-foreground hover:text-foreground hover:bg-background/50'
                )}
              >
                {tab.toUpperCase()}
                {files[tab].isDirty && <span className="ml-1 text-primary">•</span>}
              </button>
            ))}
          </div>
          
          {/* Editor area */}
          <div className="flex-1 overflow-hidden">
            <Editor
              file={files[activeTab]}
              errors={compileErrors.filter(e => 
                e.file?.endsWith(`.${activeTab}`) || 
                (activeTab === 'snippet' && e.file === 'input.brl')
              )}
              onChange={(content) => handleContentChange(activeTab, content)}
              onDownload={() => handleDownload(activeTab)}
              onLoad={(content, filename) => handleLoadFile(activeTab, content, filename)}
            />
          </div>
          
          {/* Step controls */}
          <StepControls
            onStep={() => handleStep(1)}
            onStep10={() => handleStep(10)}
            onStep100={() => handleStep(100)}
            onRunUntil={handleRunUntil}
            hasEngine={!!engine}
            hasEvents={engine?.hasEvents() ?? false}
            isPaused={isPaused}
            onPauseToggle={() => setIsPaused(!isPaused)}
          />
        </div>
        
        {/* Right side - Inspector and Console */}
        <div className="flex flex-col w-1/2">
          {/* Inspector */}
          <div className="flex-1 overflow-hidden border-b border-border">
            <Inspector
              entities={getEntities()}
              ir={compiledIR}
              traceEvents={traceEvents}
              engine={engine}
            />
          </div>
          
          {/* Console */}
          <div className="h-48 overflow-hidden">
            <Console
              messages={consoleMessages}
              onClear={handleClearConsole}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

