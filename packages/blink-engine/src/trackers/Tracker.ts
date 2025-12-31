/**
 * Tracker System
 * Captures component state changes for UI feedback
 */

import { Store, EntityId, ComponentData } from '../ecs/Store';
import { ScheduledEvent } from '../timeline/Timeline';
import { IRTracker, IRFieldValue } from '../ir/types';

export interface TrackerOutput {
  /** Tracker ID */
  trackerId: number;
  /** Event that triggered this tracker */
  eventType: string;
  /** Simulation time when the tracker fired */
  time: number;
  /** Component being tracked */
  component: string;
  /** All entities with this component and their data */
  entities: EntityComponentData[];
}

export interface EntityComponentData {
  entityId: EntityId;
  fields: Record<string, IRFieldValue>;
}

/**
 * Manages tracker definitions and output collection
 */
export class TrackerSystem {
  private trackers: IRTracker[] = [];
  private trackersByEvent: Map<string, IRTracker[]> = new Map();

  /**
   * Load tracker definitions from IR
   */
  loadTrackers(trackers: IRTracker[]): void {
    this.trackers = trackers;
    this.trackersByEvent.clear();

    // Index trackers by event type
    for (const tracker of trackers) {
      const existing = this.trackersByEvent.get(tracker.event) || [];
      existing.push(tracker);
      this.trackersByEvent.set(tracker.event, existing);
    }
  }

  /**
   * Get all trackers for an event type
   */
  getTrackersForEvent(eventType: string): IRTracker[] {
    return this.trackersByEvent.get(eventType) || [];
  }

  /**
   * Capture tracker output for an event
   */
  capture(
    event: ScheduledEvent,
    store: Store,
    time: number
  ): TrackerOutput[] {
    const outputs: TrackerOutput[] = [];
    const trackers = this.getTrackersForEvent(event.eventType);

    for (const tracker of trackers) {
      const entityData: EntityComponentData[] = [];

      // Query all entities with this component
      const entityIds = store.query(tracker.component);

      for (const entityId of entityIds) {
        const component = store.getComponent(entityId, tracker.component);
        if (component) {
          entityData.push({
            entityId,
            fields: { ...component },
          });
        }
      }

      outputs.push({
        trackerId: tracker.id,
        eventType: event.eventType,
        time,
        component: tracker.component,
        entities: entityData,
      });
    }

    return outputs;
  }

  /**
   * Clear all tracker definitions
   */
  clear(): void {
    this.trackers = [];
    this.trackersByEvent.clear();
  }
}
