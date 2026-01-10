/**
 * StepControls Component
 * 
 * Controls for stepping through the simulation.
 */

import { useState } from 'react';
import { cn } from '@/lib/utils';

interface StepControlsProps {
  onStep: () => void;
  onStep10: () => void;
  onStep100: () => void;
  onRunUntil: (seconds: number) => void;
  hasEngine: boolean;
  hasEvents: boolean;
  isPaused: boolean;
  onPauseToggle: () => void;
}

export function StepControls({
  onStep,
  onStep10,
  onStep100,
  onRunUntil,
  hasEngine,
  hasEvents,
}: StepControlsProps) {
  const [runDuration, setRunDuration] = useState('1');
  
  const buttonDisabled = !hasEngine || !hasEvents;
  
  return (
    <div className="flex items-center gap-2 px-3 py-2 border-t border-border bg-card/30">
      <span className="text-sm text-muted-foreground">Step:</span>
      
      <button
        onClick={onStep}
        disabled={buttonDisabled}
        className={cn(
          'px-3 py-1 text-sm rounded transition-colors',
          !buttonDisabled
            ? 'bg-primary/20 text-primary hover:bg-primary/30'
            : 'bg-muted/20 text-muted-foreground cursor-not-allowed'
        )}
        title="Step forward by 1 event"
      >
        ⏭️ 1
      </button>
      
      <button
        onClick={onStep10}
        disabled={buttonDisabled}
        className={cn(
          'px-3 py-1 text-sm rounded transition-colors',
          !buttonDisabled
            ? 'bg-primary/20 text-primary hover:bg-primary/30'
            : 'bg-muted/20 text-muted-foreground cursor-not-allowed'
        )}
        title="Step forward by 10 events"
      >
        ⏭️ 10
      </button>
      
      <button
        onClick={onStep100}
        disabled={buttonDisabled}
        className={cn(
          'px-3 py-1 text-sm rounded transition-colors',
          !buttonDisabled
            ? 'bg-primary/20 text-primary hover:bg-primary/30'
            : 'bg-muted/20 text-muted-foreground cursor-not-allowed'
        )}
        title="Step forward by 100 events"
      >
        ⏭️ 100
      </button>
      
      <div className="w-px h-5 bg-border mx-2" />
      
      <span className="text-sm text-muted-foreground">Run for:</span>
      
      <input
        type="number"
        value={runDuration}
        onChange={(e) => setRunDuration(e.target.value)}
        min="0.1"
        step="0.1"
        className="w-16 px-2 py-1 text-sm bg-input border border-border rounded"
        disabled={!hasEngine}
      />
      
      <span className="text-sm text-muted-foreground">sec</span>
      
      <button
        onClick={() => onRunUntil(parseFloat(runDuration) || 1)}
        disabled={buttonDisabled}
        className={cn(
          'px-3 py-1 text-sm rounded transition-colors',
          !buttonDisabled
            ? 'bg-green-900/20 text-green-400 hover:bg-green-900/30'
            : 'bg-muted/20 text-muted-foreground cursor-not-allowed'
        )}
        title={`Run simulation for ${runDuration} seconds`}
      >
        ▶️ Run
      </button>
      
      {!hasEngine && (
        <span className="text-xs text-muted-foreground ml-2">
          Load IR into engine to enable stepping
        </span>
      )}
      
      {hasEngine && !hasEvents && (
        <span className="text-xs text-yellow-400 ml-2">
          No events in queue
        </span>
      )}
    </div>
  );
}
