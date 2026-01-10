/**
 * Toolbar Component
 * 
 * Main toolbar with compile, load, inject, reset, and download actions.
 */

import { useState } from 'react';
import { cn } from '@/lib/utils';

interface ToolbarProps {
  onCompile: () => void;
  onLoadIntoEngine: () => void;
  onInjectSnippet: () => void;
  onResetEngine: () => void;
  onDownloadAll: () => void;
  onScheduleEvent: (eventType: string, delay: number, fields: Record<string, unknown>) => void;
  hasCompiledIR: boolean;
  hasEngine: boolean;
  compileErrorCount: number;
}

export function Toolbar({
  onCompile,
  onLoadIntoEngine,
  onInjectSnippet,
  onResetEngine,
  onDownloadAll,
  onScheduleEvent,
  hasCompiledIR,
  hasEngine,
  compileErrorCount,
}: ToolbarProps) {
  const [showEventDialog, setShowEventDialog] = useState(false);
  const [eventType, setEventType] = useState('');
  const [eventDelay, setEventDelay] = useState('0');
  const [eventFields, setEventFields] = useState('{}');
  
  const handleScheduleEvent = () => {
    try {
      const fields = JSON.parse(eventFields);
      onScheduleEvent(eventType, parseFloat(eventDelay), fields);
      setShowEventDialog(false);
      setEventType('');
      setEventDelay('0');
      setEventFields('{}');
    } catch {
      // Fields parse error - show in console
    }
  };
  
  return (
    <div className="flex items-center gap-2 px-4 py-2 border-b border-border bg-card/50">
      {/* Compile section */}
      <div className="flex items-center gap-2">
        <button
          onClick={onCompile}
          className={cn(
            'flex items-center gap-1 px-3 py-1.5 rounded text-sm font-medium transition-colors',
            'bg-primary/20 text-primary hover:bg-primary/30'
          )}
        >
          <span>🔨</span>
          <span>Compile</span>
          {compileErrorCount > 0 && (
            <span className="ml-1 px-1.5 py-0.5 bg-red-900/50 text-red-400 text-xs rounded">
              {compileErrorCount}
            </span>
          )}
        </button>
        
        <button
          onClick={onLoadIntoEngine}
          disabled={!hasCompiledIR}
          className={cn(
            'flex items-center gap-1 px-3 py-1.5 rounded text-sm font-medium transition-colors',
            hasCompiledIR
              ? 'bg-green-900/20 text-green-400 hover:bg-green-900/30'
              : 'bg-muted/20 text-muted-foreground cursor-not-allowed'
          )}
        >
          <span>▶️</span>
          <span>Load into Engine</span>
        </button>
      </div>
      
      <div className="w-px h-6 bg-border" />
      
      {/* Runtime section */}
      <div className="flex items-center gap-2">
        <button
          onClick={onInjectSnippet}
          disabled={!hasEngine}
          className={cn(
            'flex items-center gap-1 px-3 py-1.5 rounded text-sm font-medium transition-colors',
            hasEngine
              ? 'bg-accent/20 text-accent hover:bg-accent/30'
              : 'bg-muted/20 text-muted-foreground cursor-not-allowed'
          )}
        >
          <span>💉</span>
          <span>Inject Snippet</span>
        </button>
        
        <button
          onClick={() => setShowEventDialog(true)}
          disabled={!hasEngine}
          className={cn(
            'flex items-center gap-1 px-3 py-1.5 rounded text-sm font-medium transition-colors',
            hasEngine
              ? 'bg-blue-900/20 text-blue-400 hover:bg-blue-900/30'
              : 'bg-muted/20 text-muted-foreground cursor-not-allowed'
          )}
        >
          <span>📤</span>
          <span>Schedule Event</span>
        </button>
        
        <button
          onClick={onResetEngine}
          disabled={!hasEngine}
          className={cn(
            'flex items-center gap-1 px-3 py-1.5 rounded text-sm font-medium transition-colors',
            hasEngine
              ? 'bg-orange-900/20 text-orange-400 hover:bg-orange-900/30'
              : 'bg-muted/20 text-muted-foreground cursor-not-allowed'
          )}
        >
          <span>🔄</span>
          <span>Reset Engine</span>
        </button>
      </div>
      
      <div className="flex-1" />
      
      {/* Download section */}
      <button
        onClick={onDownloadAll}
        className={cn(
          'flex items-center gap-1 px-3 py-1.5 rounded text-sm font-medium transition-colors',
          'bg-secondary/20 text-secondary hover:bg-secondary/30'
        )}
      >
        <span>💾</span>
        <span>Download All</span>
      </button>
      
      {/* Event scheduling dialog */}
      {showEventDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-card border border-border rounded-lg p-4 w-96 shadow-xl">
            <h3 className="text-lg font-medium mb-4">Schedule Event</h3>
            
            <div className="space-y-3">
              <div>
                <label className="block text-sm text-muted-foreground mb-1">Event Type</label>
                <input
                  type="text"
                  value={eventType}
                  onChange={(e) => setEventType(e.target.value)}
                  placeholder="e.g., GameStart, DamageReceived"
                  className="w-full px-3 py-2 bg-input border border-border rounded text-sm"
                />
              </div>
              
              <div>
                <label className="block text-sm text-muted-foreground mb-1">Delay (seconds)</label>
                <input
                  type="number"
                  value={eventDelay}
                  onChange={(e) => setEventDelay(e.target.value)}
                  step="0.1"
                  min="0"
                  className="w-full px-3 py-2 bg-input border border-border rounded text-sm"
                />
              </div>
              
              <div>
                <label className="block text-sm text-muted-foreground mb-1">Fields (JSON)</label>
                <textarea
                  value={eventFields}
                  onChange={(e) => setEventFields(e.target.value)}
                  placeholder='{"amount": 10, "source": 1}'
                  rows={3}
                  className="w-full px-3 py-2 bg-input border border-border rounded text-sm font-mono"
                />
              </div>
            </div>
            
            <div className="flex justify-end gap-2 mt-4">
              <button
                onClick={() => setShowEventDialog(false)}
                className="px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground"
              >
                Cancel
              </button>
              <button
                onClick={handleScheduleEvent}
                disabled={!eventType.trim()}
                className={cn(
                  'px-3 py-1.5 text-sm rounded',
                  eventType.trim()
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-muted-foreground cursor-not-allowed'
                )}
              >
                Schedule
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
