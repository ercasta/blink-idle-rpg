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
  private componentFieldTypes: Map<string, Map<string, string>> = new Map();

  /**
   * Set default values for a component type
   */
  setComponentDefaults(componentName: string, defaults: ComponentData): void {
    this.componentDefaults.set(componentName, { ...defaults });
  }

  /**
   * Store field type metadata for a component (e.g. { level: 'integer' })
   */
  setComponentFieldTypes(componentName: string, types: Record<string, string>): void {
    const map = new Map<string, string>();
    for (const [k, v] of Object.entries(types)) {
      map.set(k, v);
    }
    this.componentFieldTypes.set(componentName, map);
  }

  /**
   * Get the declared field type for a component field, if any
   */
  getFieldType(componentName: string, fieldName: string): string | undefined {
    const map = this.componentFieldTypes.get(componentName);
    return map ? map.get(fieldName) : undefined;
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
   * Clone an entity (deep copy of all components)
   * @param sourceId - The entity to clone
   * @param targetId - Optional ID for the new entity
   * @returns The ID of the cloned entity
   */
  cloneEntity(sourceId: EntityId, targetId?: EntityId): EntityId {
    const sourceEntity = this.entities.get(sourceId);
    if (!sourceEntity) {
      throw new Error(`Source entity ${sourceId} not found`);
    }

    // Create new entity
    const newId = this.createEntity(targetId);

    // Deep copy all components
    for (const [componentName, componentData] of sourceEntity.components) {
      // Deep copy component data
      const clonedData: ComponentData = this.deepClone(componentData);
      this.addComponent(newId, componentName, clonedData);
    }

    return newId;
  }

  /**
   * Deep clone a value (handles nested objects and arrays)
   */
  private deepClone<T>(value: T): T {
    // Handle primitives and null
    if (value === null || typeof value !== 'object') {
      return value;
    }

    // Handle arrays
    if (Array.isArray(value)) {
      return value.map(item => this.deepClone(item)) as unknown as T;
    }

    // Handle objects
    const cloned: any = {};
    for (const key in value) {
      if (value.hasOwnProperty(key)) {
        cloned[key] = this.deepClone((value as any)[key]);
      }
    }
    return cloned as T;
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
    const merged: ComponentData = { ...defaults, ...data };

    // Coerce integer fields based on declared types
    const fieldTypes = this.componentFieldTypes.get(componentName);
    if (fieldTypes) {
      for (const [fieldName, value] of Object.entries(merged)) {
        const ftype = fieldTypes.get(fieldName);
        if (ftype === 'integer' && typeof value === 'number') {
          merged[fieldName] = Math.trunc(value as number);
        }
      }
    }

    entity.components.set(componentName, merged);
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
    
    // Coerce integers to integer representation (truncate fractional part)
    const fieldType = this.getFieldType(componentName, fieldName);
    if (fieldType === 'integer' && typeof value === 'number') {
      component[fieldName] = Math.trunc(value as number);
    } else {
      component[fieldName] = value;
    }
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
