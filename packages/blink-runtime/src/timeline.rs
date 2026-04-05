/// Timeline: binary heap priority queue for event scheduling.
/// Events are ordered by (time, sequence) for deterministic ordering.

use crate::event::{Event, EventId};

/// A scheduled event in the timeline.
#[derive(Clone, Debug)]
pub struct ScheduledEvent {
    pub time: f64,
    pub sequence: u64,
    pub event: Event,
}

/// Binary heap timeline for deterministic event scheduling.
pub struct Timeline {
    events: Vec<ScheduledEvent>,
    current_time: f64,
    next_sequence: u64,
    next_event_id: EventId,
    cancelled: std::collections::HashSet<EventId>,
}

impl Timeline {
    pub fn new() -> Self {
        Timeline {
            events: Vec::new(),
            current_time: 0.0,
            next_sequence: 0,
            next_event_id: 1,
            cancelled: std::collections::HashSet::new(),
        }
    }

    /// Get the current simulation time.
    pub fn get_time(&self) -> f64 {
        self.current_time
    }

    /// Set the current simulation time.
    pub fn set_time(&mut self, time: f64) {
        self.current_time = time;
    }

    /// Schedule an event at current_time + delay.
    pub fn schedule_delay(&mut self, delay: f64, mut event: Event) -> EventId {
        let event_id = self.next_event_id;
        self.next_event_id += 1;
        event.event_id = event_id;

        let scheduled = ScheduledEvent {
            time: self.current_time + delay,
            sequence: self.next_sequence,
            event,
        };
        self.next_sequence += 1;
        self.push(scheduled);
        event_id
    }

    /// Schedule an event at the current time (immediate).
    pub fn schedule_immediate(&mut self, mut event: Event) -> EventId {
        let event_id = self.next_event_id;
        self.next_event_id += 1;
        event.event_id = event_id;

        let scheduled = ScheduledEvent {
            time: self.current_time,
            sequence: self.next_sequence,
            event,
        };
        self.next_sequence += 1;
        self.push(scheduled);
        event_id
    }

    /// Schedule an event at an absolute time.
    pub fn schedule_at(&mut self, time: f64, mut event: Event) -> EventId {
        let event_id = self.next_event_id;
        self.next_event_id += 1;
        event.event_id = event_id;

        let scheduled = ScheduledEvent {
            time,
            sequence: self.next_sequence,
            event,
        };
        self.next_sequence += 1;
        self.push(scheduled);
        event_id
    }

    /// Pop the next event from the timeline. Advances current_time.
    /// Skips cancelled events.
    pub fn pop(&mut self) -> Option<Event> {
        loop {
            if self.events.is_empty() {
                return None;
            }
            let scheduled = self.pop_min();
            self.current_time = scheduled.time;

            if self.cancelled.remove(&scheduled.event.event_id) {
                continue; // Skip cancelled events
            }

            return Some(scheduled.event);
        }
    }

    /// Peek at the next event without removing it.
    pub fn peek_time(&self) -> Option<f64> {
        self.events.first().map(|e| e.time)
    }

    /// Check if there are pending events.
    pub fn has_events(&self) -> bool {
        !self.events.is_empty()
    }

    /// Cancel an event by its ID.
    pub fn cancel(&mut self, event_id: EventId) {
        self.cancelled.insert(event_id);
    }

    /// Get the number of pending events (including cancelled ones).
    pub fn len(&self) -> usize {
        self.events.len()
    }

    /// Check if the timeline is empty.
    pub fn is_empty(&self) -> bool {
        self.events.is_empty()
    }

    /// Reset the timeline to initial state.
    pub fn reset(&mut self) {
        self.events.clear();
        self.current_time = 0.0;
        self.next_sequence = 0;
        self.next_event_id = 1;
        self.cancelled.clear();
    }

    // ── Binary heap operations ──

    fn push(&mut self, event: ScheduledEvent) {
        self.events.push(event);
        self.sift_up(self.events.len() - 1);
    }

    fn pop_min(&mut self) -> ScheduledEvent {
        let last = self.events.len() - 1;
        self.events.swap(0, last);
        let min = self.events.pop().unwrap();
        if !self.events.is_empty() {
            self.sift_down(0);
        }
        min
    }

    fn sift_up(&mut self, mut idx: usize) {
        while idx > 0 {
            let parent = (idx - 1) / 2;
            if self.compare(idx, parent) {
                self.events.swap(idx, parent);
                idx = parent;
            } else {
                break;
            }
        }
    }

    fn sift_down(&mut self, mut idx: usize) {
        let len = self.events.len();
        loop {
            let left = 2 * idx + 1;
            let right = 2 * idx + 2;
            let mut smallest = idx;

            if left < len && self.compare(left, smallest) {
                smallest = left;
            }
            if right < len && self.compare(right, smallest) {
                smallest = right;
            }

            if smallest != idx {
                self.events.swap(idx, smallest);
                idx = smallest;
            } else {
                break;
            }
        }
    }

    /// Returns true if event at idx_a should come before event at idx_b.
    fn compare(&self, idx_a: usize, idx_b: usize) -> bool {
        let a = &self.events[idx_a];
        let b = &self.events[idx_b];
        if a.time != b.time {
            a.time < b.time
        } else {
            a.sequence < b.sequence
        }
    }
}

impl Default for Timeline {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::interning::StringInterner;

    fn make_event(interner: &mut StringInterner, name: &str) -> Event {
        Event::new(interner.intern(name))
    }

    #[test]
    fn test_schedule_and_pop() {
        let mut interner = StringInterner::new();
        let mut timeline = Timeline::new();

        timeline.schedule_delay(1.0, make_event(&mut interner, "A"));
        timeline.schedule_delay(0.5, make_event(&mut interner, "B"));
        timeline.schedule_delay(2.0, make_event(&mut interner, "C"));

        let e1 = timeline.pop().unwrap();
        assert_eq!(e1.event_type, interner.intern("B"));
        assert_eq!(timeline.get_time(), 0.5);

        let e2 = timeline.pop().unwrap();
        assert_eq!(e2.event_type, interner.intern("A"));
        assert_eq!(timeline.get_time(), 1.0);

        let e3 = timeline.pop().unwrap();
        assert_eq!(e3.event_type, interner.intern("C"));
        assert_eq!(timeline.get_time(), 2.0);

        assert!(timeline.pop().is_none());
    }

    #[test]
    fn test_deterministic_ordering() {
        let mut interner = StringInterner::new();
        let mut timeline = Timeline::new();

        // Schedule events at the same time - should come out in insertion order
        timeline.schedule_delay(1.0, make_event(&mut interner, "First"));
        timeline.schedule_delay(1.0, make_event(&mut interner, "Second"));
        timeline.schedule_delay(1.0, make_event(&mut interner, "Third"));

        let e1 = timeline.pop().unwrap();
        let e2 = timeline.pop().unwrap();
        let e3 = timeline.pop().unwrap();

        assert_eq!(e1.event_type, interner.intern("First"));
        assert_eq!(e2.event_type, interner.intern("Second"));
        assert_eq!(e3.event_type, interner.intern("Third"));
    }

    #[test]
    fn test_cancel_event() {
        let mut interner = StringInterner::new();
        let mut timeline = Timeline::new();

        let id1 = timeline.schedule_delay(1.0, make_event(&mut interner, "A"));
        timeline.schedule_delay(2.0, make_event(&mut interner, "B"));

        timeline.cancel(id1);

        let e = timeline.pop().unwrap();
        assert_eq!(e.event_type, interner.intern("B"));
        assert_eq!(timeline.get_time(), 2.0);
    }

    #[test]
    fn test_immediate_scheduling() {
        let mut interner = StringInterner::new();
        let mut timeline = Timeline::new();

        timeline.set_time(5.0);
        timeline.schedule_immediate(make_event(&mut interner, "Now"));

        let e = timeline.pop().unwrap();
        assert_eq!(e.event_type, interner.intern("Now"));
        assert_eq!(timeline.get_time(), 5.0);
    }

    #[test]
    fn test_has_events() {
        let mut interner = StringInterner::new();
        let mut timeline = Timeline::new();

        assert!(!timeline.has_events());
        timeline.schedule_delay(1.0, make_event(&mut interner, "A"));
        assert!(timeline.has_events());
        timeline.pop();
        assert!(!timeline.has_events());
    }

    #[test]
    fn test_reset() {
        let mut interner = StringInterner::new();
        let mut timeline = Timeline::new();

        timeline.schedule_delay(1.0, make_event(&mut interner, "A"));
        timeline.pop();
        assert_eq!(timeline.get_time(), 1.0);

        timeline.reset();
        assert_eq!(timeline.get_time(), 0.0);
        assert!(!timeline.has_events());
    }
}
