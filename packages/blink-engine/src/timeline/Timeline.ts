/**
 * Timeline System
 * Manages event scheduling and timing
 */

import { EntityId } from '../ecs/Store';
import { IRFieldValue } from '../ir/types';

export interface ScheduledEvent {
  /** Unique event ID */
  id: number;
  /** Event type name */
  eventType: string;
  /** When the event should trigger (simulation time in seconds) */
  time: number;
  /** Source entity (if applicable) */
  source?: EntityId;
  /** Target entity (if applicable) */
  target?: EntityId;
  /** Additional event fields */
  fields?: Record<string, IRFieldValue>;
  /** Ordering for same-time events (lower = earlier) */
  sequence: number;
  /** If true, this event will automatically reschedule itself */
  recurring?: boolean;
  /** Interval for recurring events (in seconds) */
  interval?: number;
}

/**
 * Priority queue for scheduled events
 * Uses binary heap for O(log n) operations
 */
export class Timeline {
  private events: ScheduledEvent[] = [];
  private currentTime: number = 0;
  private nextEventId: number = 0;
  private nextSequence: number = 0;

  /**
   * Get the current simulation time
   */
  getTime(): number {
    return this.currentTime;
  }

  /**
   * Set the current simulation time
   */
  setTime(time: number): void {
    this.currentTime = time;
  }

  /**
   * Schedule an event at current time + delay
   */
  schedule(
    eventType: string,
    delay: number = 0,
    options: {
      source?: EntityId;
      target?: EntityId;
      fields?: Record<string, IRFieldValue>;
      recurring?: boolean;
      interval?: number;
    } = {}
  ): number {
    return this.scheduleAt(eventType, this.currentTime + delay, options);
  }

  /**
   * Schedule an event at an absolute time
   */
  scheduleAt(
    eventType: string,
    time: number,
    options: {
      source?: EntityId;
      target?: EntityId;
      fields?: Record<string, IRFieldValue>;
      recurring?: boolean;
      interval?: number;
    } = {}
  ): number {
    const event: ScheduledEvent = {
      id: this.nextEventId++,
      eventType,
      time: Math.max(time, this.currentTime), // Can't schedule in the past
      source: options.source,
      target: options.target,
      fields: options.fields,
      sequence: this.nextSequence++,
      recurring: options.recurring,
      interval: options.interval,
    };

    this.insert(event);
    return event.id;
  }

  /**
   * Schedule an immediate event (processed this tick)
   */
  scheduleImmediate(
    eventType: string,
    options: {
      source?: EntityId;
      target?: EntityId;
      fields?: Record<string, IRFieldValue>;
    } = {}
  ): number {
    return this.scheduleAt(eventType, this.currentTime, options);
  }

  /**
   * Schedule a recurring event
   * The event will automatically reschedule itself after each execution
   * Returns the event ID which can be used to cancel the recurring event
   */
  scheduleRecurring(
    eventType: string,
    interval: number,
    options: {
      delay?: number;
      source?: EntityId;
      target?: EntityId;
      fields?: Record<string, IRFieldValue>;
    } = {}
  ): number {
    const startTime = this.currentTime + (options.delay ?? 0);
    return this.scheduleAt(eventType, startTime, {
      source: options.source,
      target: options.target,
      fields: options.fields,
      recurring: true,
      interval,
    });
  }

  /**
   * Get the next event without removing it
   */
  peek(): ScheduledEvent | undefined {
    return this.events[0];
  }

  /**
   * Remove and return the next event
   */
  pop(): ScheduledEvent | undefined {
    if (this.events.length === 0) {
      return undefined;
    }

    const result = this.events[0];
    const last = this.events.pop()!;

    if (this.events.length > 0) {
      this.events[0] = last;
      this.siftDown(0);
    }

    // Advance time to this event
    this.currentTime = result.time;

    // If this is a recurring event, reschedule it with the SAME ID
    if (result.recurring && result.interval && result.interval > 0) {
      const nextEvent: ScheduledEvent = {
        id: result.id, // Reuse the same ID
        eventType: result.eventType,
        time: result.time + result.interval,
        source: result.source,
        target: result.target,
        fields: result.fields,
        sequence: this.nextSequence++,
        recurring: true,
        interval: result.interval,
      };
      this.insert(nextEvent);
    }

    return result;
  }

  /**
   * Check if there are any events scheduled
   */
  hasEvents(): boolean {
    return this.events.length > 0;
  }

  /**
   * Get the number of scheduled events
   */
  getEventCount(): number {
    return this.events.length;
  }

  /**
   * Cancel an event by ID
   * Returns true if the event was found and removed
   */
  cancel(eventId: number): boolean {
    const index = this.events.findIndex(e => e.id === eventId);
    if (index === -1) {
      return false;
    }

    // Remove by replacing with last element and re-heapifying
    const last = this.events.pop()!;
    if (index < this.events.length) {
      this.events[index] = last;
      this.siftDown(index);
      this.siftUp(index);
    }

    return true;
  }

  /**
   * Clear all scheduled events
   */
  clear(): void {
    this.events = [];
    this.currentTime = 0;
    this.nextSequence = 0;
  }

  /**
   * Get all events (for debugging)
   */
  getAllEvents(): ScheduledEvent[] {
    return [...this.events].sort((a, b) => {
      if (a.time !== b.time) return a.time - b.time;
      return a.sequence - b.sequence;
    });
  }

  // ===== Heap operations =====

  private insert(event: ScheduledEvent): void {
    this.events.push(event);
    this.siftUp(this.events.length - 1);
  }

  private siftUp(index: number): void {
    while (index > 0) {
      const parentIndex = Math.floor((index - 1) / 2);
      if (this.compare(this.events[index], this.events[parentIndex]) >= 0) {
        break;
      }
      this.swap(index, parentIndex);
      index = parentIndex;
    }
  }

  private siftDown(index: number): void {
    const length = this.events.length;
    while (true) {
      const leftChild = 2 * index + 1;
      const rightChild = 2 * index + 2;
      let smallest = index;

      if (leftChild < length && this.compare(this.events[leftChild], this.events[smallest]) < 0) {
        smallest = leftChild;
      }

      if (rightChild < length && this.compare(this.events[rightChild], this.events[smallest]) < 0) {
        smallest = rightChild;
      }

      if (smallest === index) {
        break;
      }

      this.swap(index, smallest);
      index = smallest;
    }
  }

  private compare(a: ScheduledEvent, b: ScheduledEvent): number {
    if (a.time !== b.time) {
      return a.time - b.time;
    }
    return a.sequence - b.sequence;
  }

  private swap(i: number, j: number): void {
    [this.events[i], this.events[j]] = [this.events[j], this.events[i]];
  }
}
