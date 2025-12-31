/**
 * Entity-Component-System Store
 * Manages entities and their components
 */

import { IRFieldValue } from '../ir/types';

export type EntityId = number;

export interface ComponentData {
  [field: string]: IRFieldValue;
}

interface EntityData {
  id: EntityId;
  components: Map<string, ComponentData>;
}

/**
 * ECS Store for managing game entities and components
 */
export class Store {
  private entities: Map<EntityId, EntityData> = new Map();
  private nextId: number = 0;
  private componentDefaults: Map<string, ComponentData> = new Map();

  /**
   * Set default values for a component type
   */
  setComponentDefaults(componentName: string, defaults: ComponentData): void {
    this.componentDefaults.set(componentName, { ...defaults });
  }

  /**
   * Create a new entity
   */
  createEntity(id?: EntityId): EntityId {
    const entityId = id !== undefined ? id : this.nextId++;
    
    // Ensure nextId is always greater than any assigned id
    if (entityId >= this.nextId) {
      this.nextId = entityId + 1;
    }
    
    this.entities.set(entityId, {
      id: entityId,
      components: new Map(),
    });
    
    return entityId;
  }

  /**
   * Delete an entity and all its components
   */
  deleteEntity(id: EntityId): boolean {
    return this.entities.delete(id);
  }

  /**
   * Check if entity exists
   */
  hasEntity(id: EntityId): boolean {
    return this.entities.has(id);
  }

  /**
   * Get all entity IDs
   */
  getEntityIds(): EntityId[] {
    return Array.from(this.entities.keys());
  }

  /**
   * Add a component to an entity
   */
  addComponent(entityId: EntityId, componentName: string, data: ComponentData): void {
    const entity = this.entities.get(entityId);
    if (!entity) {
      throw new Error(`Entity ${entityId} not found`);
    }
    
    // Merge with defaults
    const defaults = this.componentDefaults.get(componentName) || {};
    entity.components.set(componentName, { ...defaults, ...data });
  }

  /**
   * Remove a component from an entity
   */
  removeComponent(entityId: EntityId, componentName: string): boolean {
    const entity = this.entities.get(entityId);
    if (!entity) {
      return false;
    }
    return entity.components.delete(componentName);
  }

  /**
   * Check if entity has a component
   */
  hasComponent(entityId: EntityId, componentName: string): boolean {
    const entity = this.entities.get(entityId);
    if (!entity) {
      return false;
    }
    return entity.components.has(componentName);
  }

  /**
   * Get a component from an entity
   */
  getComponent(entityId: EntityId, componentName: string): ComponentData | undefined {
    const entity = this.entities.get(entityId);
    if (!entity) {
      return undefined;
    }
    return entity.components.get(componentName);
  }

  /**
   * Get a field value from an entity's component
   */
  getField(entityId: EntityId, componentName: string, fieldName: string): IRFieldValue | undefined {
    const component = this.getComponent(entityId, componentName);
    if (!component) {
      return undefined;
    }
    return component[fieldName];
  }

  /**
   * Set a field value in an entity's component
   */
  setField(entityId: EntityId, componentName: string, fieldName: string, value: IRFieldValue): void {
    const entity = this.entities.get(entityId);
    if (!entity) {
      throw new Error(`Entity ${entityId} not found`);
    }
    
    let component = entity.components.get(componentName);
    if (!component) {
      // Create component with defaults if it doesn't exist
      const defaults = this.componentDefaults.get(componentName) || {};
      component = { ...defaults };
      entity.components.set(componentName, component);
    }
    
    component[fieldName] = value;
  }

  /**
   * Query entities that have all specified components
   */
  query(...componentNames: string[]): EntityId[] {
    const results: EntityId[] = [];
    
    for (const [id, entity] of this.entities) {
      let hasAll = true;
      for (const name of componentNames) {
        if (!entity.components.has(name)) {
          hasAll = false;
          break;
        }
      }
      if (hasAll) {
        results.push(id);
      }
    }
    
    return results;
  }

  /**
   * Get all components for an entity
   */
  getEntityComponents(entityId: EntityId): Map<string, ComponentData> | undefined {
    const entity = this.entities.get(entityId);
    return entity?.components;
  }

  /**
   * Create a snapshot of the current state
   */
  getSnapshot(): Map<EntityId, Map<string, ComponentData>> {
    const snapshot = new Map<EntityId, Map<string, ComponentData>>();
    
    for (const [id, entity] of this.entities) {
      const componentsCopy = new Map<string, ComponentData>();
      for (const [name, data] of entity.components) {
        componentsCopy.set(name, { ...data });
      }
      snapshot.set(id, componentsCopy);
    }
    
    return snapshot;
  }

  /**
   * Clear all entities
   */
  clear(): void {
    this.entities.clear();
    this.nextId = 0;
  }
}
