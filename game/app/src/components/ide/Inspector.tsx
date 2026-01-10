/**
 * Inspector Component
 * 
 * Inspect engine state: entities, components, rules, and execution trace.
 */

import { useState, useMemo } from 'react';
import { cn } from '@/lib/utils';
import type { EntityData, IRModule, TraceEvent, InspectorTab } from '@/types/ide';

interface InspectorProps {
  entities: EntityData[];
  ir: IRModule | null;
  traceEvents: TraceEvent[];
  engine: unknown;
}

export function Inspector({ entities, ir, traceEvents }: InspectorProps) {
  const [activeTab, setActiveTab] = useState<InspectorTab>('entities');
  const [expandedEntities, setExpandedEntities] = useState<Set<string | number>>(new Set());
  const [searchTerm, setSearchTerm] = useState('');
  
  // Filter entities based on search
  const filteredEntities = useMemo(() => {
    if (!searchTerm) return entities;
    const term = searchTerm.toLowerCase();
    return entities.filter(entity => {
      // Search in entity ID
      if (String(entity.id).includes(term)) return true;
      // Search in component names
      if (Object.keys(entity.components).some(name => name.toLowerCase().includes(term))) return true;
      // Search in component values
      for (const [, data] of Object.entries(entity.components)) {
        for (const [, value] of Object.entries(data)) {
          if (String(value).toLowerCase().includes(term)) return true;
        }
      }
      return false;
    });
  }, [entities, searchTerm]);
  
  // Toggle entity expansion
  const toggleEntity = (id: string | number) => {
    setExpandedEntities(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };
  
  return (
    <div className="flex flex-col h-full">
      {/* Tabs */}
      <div className="flex border-b border-border bg-card/30">
        {(['entities', 'components', 'rules', 'trace'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={cn(
              'px-4 py-2 text-sm font-medium transition-colors capitalize',
              activeTab === tab
                ? 'bg-background text-foreground border-b-2 border-primary'
                : 'text-muted-foreground hover:text-foreground hover:bg-background/50'
            )}
          >
            {tab}
            {tab === 'entities' && (
              <span className="ml-1 text-xs text-muted-foreground">({entities.length})</span>
            )}
            {tab === 'rules' && ir && (
              <span className="ml-1 text-xs text-muted-foreground">({ir.rules.length})</span>
            )}
            {tab === 'trace' && (
              <span className="ml-1 text-xs text-muted-foreground">({traceEvents.length})</span>
            )}
          </button>
        ))}
      </div>
      
      {/* Search bar for entities */}
      {activeTab === 'entities' && (
        <div className="px-3 py-2 border-b border-border bg-card/20">
          <input
            type="text"
            placeholder="Search entities..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full px-3 py-1.5 bg-input border border-border rounded text-sm"
          />
        </div>
      )}
      
      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {activeTab === 'entities' && (
          <div className="p-2 space-y-1">
            {filteredEntities.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground text-sm">
                {entities.length === 0 ? 'No entities in engine' : 'No matching entities'}
              </div>
            ) : (
              filteredEntities.map(entity => (
                <EntityItem
                  key={entity.id}
                  entity={entity}
                  expanded={expandedEntities.has(entity.id)}
                  onToggle={() => toggleEntity(entity.id)}
                />
              ))
            )}
          </div>
        )}
        
        {activeTab === 'components' && (
          <div className="p-2 space-y-1">
            {!ir ? (
              <div className="text-center py-8 text-muted-foreground text-sm">
                No IR loaded. Compile first.
              </div>
            ) : (
              ir.components.map(comp => (
                <ComponentDefinitionItem key={comp.name} component={comp} />
              ))
            )}
          </div>
        )}
        
        {activeTab === 'rules' && (
          <div className="p-2 space-y-1">
            {!ir ? (
              <div className="text-center py-8 text-muted-foreground text-sm">
                No IR loaded. Compile first.
              </div>
            ) : (
              ir.rules.map((rule, index) => (
                <RuleItem key={rule.id ?? index} rule={rule} />
              ))
            )}
          </div>
        )}
        
        {activeTab === 'trace' && (
          <div className="p-2 font-mono text-xs">
            {traceEvents.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No trace events yet. Step through simulation to see events.
              </div>
            ) : (
              <div className="space-y-0.5">
                {traceEvents.slice(-100).map((event, index) => (
                  <TraceEventItem key={index} event={event} />
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// Sub-components

function EntityItem({ 
  entity, 
  expanded, 
  onToggle 
}: { 
  entity: EntityData; 
  expanded: boolean; 
  onToggle: () => void;
}) {
  const componentNames = Object.keys(entity.components);
  
  return (
    <div className="border border-border rounded bg-card/30">
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-background/50"
      >
        <span className={cn('transition-transform', expanded && 'rotate-90')}>▶</span>
        <span className="font-medium text-sm">Entity {entity.id}</span>
        <span className="text-xs text-muted-foreground ml-auto">
          {componentNames.length} component{componentNames.length !== 1 ? 's' : ''}
        </span>
      </button>
      
      {expanded && (
        <div className="px-3 pb-2 space-y-2 border-t border-border">
          {componentNames.map(compName => (
            <ComponentDataItem
              key={compName}
              name={compName}
              data={entity.components[compName]}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function ComponentDataItem({ 
  name, 
  data 
}: { 
  name: string; 
  data: Record<string, unknown>;
}) {
  const [expanded, setExpanded] = useState(true);
  
  return (
    <div className="pt-2">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-1 text-sm text-accent hover:text-accent/80"
      >
        <span className={cn('transition-transform text-xs', expanded && 'rotate-90')}>▶</span>
        <span className="font-medium">{name}</span>
      </button>
      
      {expanded && (
        <div className="ml-4 mt-1 text-xs font-mono space-y-0.5">
          {Object.entries(data).map(([key, value]) => (
            <div key={key} className="flex gap-2">
              <span className="text-muted-foreground">{key}:</span>
              <span className="text-foreground">
                {typeof value === 'object' ? JSON.stringify(value) : String(value)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ComponentDefinitionItem({ 
  component 
}: { 
  component: { name: string; fields: Array<{ name: string; type: string | { type: string }; default?: unknown }> };
}) {
  const [expanded, setExpanded] = useState(false);
  
  return (
    <div className="border border-border rounded bg-card/30">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-background/50"
      >
        <span className={cn('transition-transform', expanded && 'rotate-90')}>▶</span>
        <span className="font-medium text-sm text-primary">{component.name}</span>
        <span className="text-xs text-muted-foreground ml-auto">
          {component.fields.length} field{component.fields.length !== 1 ? 's' : ''}
        </span>
      </button>
      
      {expanded && (
        <div className="px-3 pb-2 border-t border-border">
          <div className="mt-2 text-xs font-mono space-y-1">
            {component.fields.map(field => (
              <div key={field.name} className="flex gap-2">
                <span className="text-foreground">{field.name}:</span>
                <span className="text-accent">
                  {typeof field.type === 'string' ? field.type : field.type.type}
                </span>
                {field.default !== undefined && (
                  <span className="text-muted-foreground">
                    = {JSON.stringify(field.default)}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function RuleItem({ 
  rule 
}: { 
  rule: { id?: number; name: string; trigger: { event: string }; source_location?: { file: string; line: number } };
}) {
  return (
    <div className="border border-border rounded bg-card/30 px-3 py-2">
      <div className="flex items-center gap-2">
        <span className="text-sm">📋</span>
        <span className="font-medium text-sm">{rule.name || 'unnamed'}</span>
        <span className="text-xs px-1.5 py-0.5 bg-blue-900/30 text-blue-400 rounded">
          on {rule.trigger.event}
        </span>
      </div>
      {rule.source_location && (
        <div className="mt-1 text-xs text-muted-foreground">
          {rule.source_location.file}:{rule.source_location.line}
        </div>
      )}
    </div>
  );
}

function TraceEventItem({ event }: { event: TraceEvent }) {
  const typeColors: Record<string, string> = {
    event_fired: 'text-blue-400',
    event_scheduled: 'text-cyan-400',
    rule_matched: 'text-yellow-400',
    rule_triggered: 'text-green-400',
  };
  
  const typeIcons: Record<string, string> = {
    event_fired: '📤',
    event_scheduled: '⏰',
    rule_matched: '🎯',
    rule_triggered: '⚡',
  };
  
  return (
    <div className="flex gap-2 py-0.5 hover:bg-background/50 px-2 rounded">
      <span className="text-muted-foreground w-16 flex-shrink-0">
        [{event.time.toFixed(2)}s]
      </span>
      <span>{typeIcons[event.type] || '•'}</span>
      <span className={cn('flex-shrink-0', typeColors[event.type] || 'text-foreground')}>
        {event.type.replace('_', ' ')}
      </span>
      {event.details && (
        <span className="text-muted-foreground truncate">{event.details}</span>
      )}
    </div>
  );
}
