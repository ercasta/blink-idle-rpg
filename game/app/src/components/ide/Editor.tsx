/**
 * Editor Component
 * 
 * A code editor for BRL/BCL/BDL files with error highlighting.
 * Currently uses a plain textarea. See IDE.tsx header comments for
 * future syntax highlighting implementation options.
 */

import { useCallback, useRef, useEffect } from 'react';
import { cn } from '@/lib/utils';
import type { SourceFile, CompileError } from '@/types/ide';

interface EditorProps {
  file: SourceFile;
  errors: CompileError[];
  onChange: (content: string) => void;
  onDownload: () => void;
  onLoad: (content: string, filename: string) => void;
}

export function Editor({ file, errors, onChange, onDownload, onLoad }: EditorProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const lineNumbersRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Sync scroll between textarea and line numbers
  const handleScroll = useCallback(() => {
    if (textareaRef.current && lineNumbersRef.current) {
      lineNumbersRef.current.scrollTop = textareaRef.current.scrollTop;
    }
  }, []);
  
  // Calculate line numbers
  const lines = file.content.split('\n');
  const lineCount = lines.length;
  
  // Get error lines for highlighting
  const errorLines = new Set(errors.map(e => e.line).filter((l): l is number => l !== undefined));
  
  // Handle file upload
  const handleFileUpload = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const uploadedFile = event.target.files?.[0];
    if (!uploadedFile) return;
    
    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      onLoad(content, uploadedFile.name);
    };
    reader.readAsText(uploadedFile);
    
    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, [onLoad]);
  
  // Handle tab key for indentation
  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Tab') {
      e.preventDefault();
      const textarea = e.currentTarget;
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      
      const newValue = file.content.substring(0, start) + '    ' + file.content.substring(end);
      onChange(newValue);
      
      // Restore cursor position
      requestAnimationFrame(() => {
        textarea.selectionStart = textarea.selectionEnd = start + 4;
      });
    }
  }, [file.content, onChange]);
  
  // Update line numbers scroll sync on content change
  useEffect(() => {
    handleScroll();
  }, [file.content, handleScroll]);
  
  return (
    <div className="flex flex-col h-full">
      {/* File actions bar */}
      <div className="flex items-center justify-between px-3 py-1 bg-card/30 border-b border-border">
        <span className="text-sm text-muted-foreground">
          {file.name}
          {file.isDirty && <span className="ml-1 text-primary">*</span>}
        </span>
        <div className="flex gap-2">
          <button
            onClick={() => fileInputRef.current?.click()}
            className="px-2 py-0.5 text-xs text-muted-foreground hover:text-foreground hover:bg-background/50 rounded"
          >
            📂 Load
          </button>
          <button
            onClick={onDownload}
            className="px-2 py-0.5 text-xs text-muted-foreground hover:text-foreground hover:bg-background/50 rounded"
          >
            💾 Save
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept={`.${file.language}`}
            onChange={handleFileUpload}
            className="hidden"
          />
        </div>
      </div>
      
      {/* Error summary */}
      {errors.length > 0 && (
        <div className="px-3 py-1 bg-red-900/20 border-b border-red-900/50 text-red-400 text-xs">
          {errors.length} error{errors.length > 1 ? 's' : ''} in this file
        </div>
      )}
      
      {/* Editor with line numbers */}
      <div className="flex flex-1 overflow-hidden">
        {/* Line numbers */}
        <div
          ref={lineNumbersRef}
          className="w-12 flex-shrink-0 overflow-hidden bg-card/30 border-r border-border select-none"
          style={{ fontFamily: 'monospace', fontSize: '14px', lineHeight: '21px' }}
        >
          <div className="p-2 text-right text-muted-foreground">
            {Array.from({ length: lineCount }, (_, i) => {
              const lineNum = i + 1;
              const hasError = errorLines.has(lineNum);
              return (
                <div
                  key={lineNum}
                  className={cn(
                    hasError && 'text-red-400 bg-red-900/20'
                  )}
                >
                  {lineNum}
                </div>
              );
            })}
          </div>
        </div>
        
        {/* Textarea */}
        <textarea
          ref={textareaRef}
          value={file.content}
          onChange={(e) => onChange(e.target.value)}
          onScroll={handleScroll}
          onKeyDown={handleKeyDown}
          className={cn(
            'flex-1 p-2 bg-background resize-none outline-none',
            'font-mono text-sm text-foreground leading-[21px]',
            'border-none focus:ring-0'
          )}
          spellCheck={false}
          placeholder={`// Enter your ${file.language.toUpperCase()} code here...`}
        />
      </div>
      
      {/* Error list */}
      {errors.length > 0 && (
        <div className="max-h-32 overflow-y-auto border-t border-red-900/50 bg-red-900/10">
          {errors.map((error, index) => (
            <div
              key={index}
              className="px-3 py-1 text-xs text-red-400 hover:bg-red-900/20 cursor-pointer"
              onClick={() => {
                // Scroll to error line in textarea
                if (textareaRef.current && error.line) {
                  const lines = file.content.split('\n');
                  let position = 0;
                  for (let i = 0; i < error.line - 1 && i < lines.length; i++) {
                    position += lines[i].length + 1;
                  }
                  textareaRef.current.focus();
                  textareaRef.current.setSelectionRange(position, position);
                  // Try to scroll to the line
                  textareaRef.current.scrollTop = (error.line - 5) * 21;
                }
              }}
            >
              <span className="text-red-500">Line {error.line}:{error.column}</span>
              <span className="ml-2">{error.message}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
