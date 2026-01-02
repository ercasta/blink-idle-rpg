/**
 * Constants used throughout the Blink engine
 */

/** Reserved event type for watchdog system */
export const WATCHDOG_EVENT_TYPE = '__WATCHDOG__';

/** Maximum watchdog events processed per step (prevents infinite loops) */
export const MAX_WATCHDOG_PER_STEP = 10;

/** Delay in seconds for recovery events (ensures proper event ordering) */
export const RECOVERY_EVENT_DELAY = 0.001;
