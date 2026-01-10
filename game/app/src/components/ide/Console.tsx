/**
 * Console Component
 * 
 * Display log messages from compilation and engine operations.
 */

import { useRef, useEffect } from 'react';
import { cn } from '@/lib/utils';

interface ConsoleMessage {
  type: 'info' | 'error' | 'success' | 'trace';
  message: string;
  time?: number;
}

interface ConsoleProps {
  messages: ConsoleMessage[];
  onClear: () => void;
}

export function Console({ messages, onClear }: ConsoleProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  
  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [messages]);
  
  const typeStyles: Record<string, string> = {
    info: 'text-foreground',
    error: 'text-red-400',
    success: 'text-green-400',
    trace: 'text-muted-foreground',
  };
  
  const typeIcons: Record<string, string> = {
    info: 'ℹ️',
    error: '❌',
    success: '✅',
    trace: '🔍',
  };
  
  return (
    <div className="flex flex-col h-full bg-card/20">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-border bg-card/30">
        <span className="text-sm font-medium text-muted-foreground">Console</span>
        <button
          onClick={onClear}
          className="px-2 py-0.5 text-xs text-muted-foreground hover:text-foreground hover:bg-background/50 rounded"
        >
          Clear
        </button>
      </div>
      
      {/* Messages */}
      <div
        ref={containerRef}
        className="flex-1 overflow-y-auto p-2 font-mono text-xs"
      >
        {messages.length === 0 ? (
          <div className="text-muted-foreground text-center py-4">
            Console output will appear here
          </div>
        ) : (
          messages.map((msg, index) => (
            <div key={index} className={cn('py-0.5', typeStyles[msg.type])}>
              <span className="mr-2">{typeIcons[msg.type]}</span>
              {msg.time !== undefined && (
                <span className="text-muted-foreground mr-2">[{msg.time.toFixed(2)}s]</span>
              )}
              <span>{msg.message}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
