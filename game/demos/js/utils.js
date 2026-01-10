/**
 * Utility Functions for Blink Idle RPG
 * 
 * This module contains general-purpose utility functions used throughout the game.
 */

/**
 * Escapes HTML to prevent XSS attacks
 * @param {string} str - The string to escape
 * @returns {string} - The escaped string
 */
export function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

/**
 * Toggles an accordion section's visibility
 * @param {string} id - The ID of the accordion content element
 */
export function toggleAccordion(id) {
  const element = document.getElementById(id);
  const toggle = document.getElementById(id + '-toggle');
  if (element && toggle) {
    element.classList.toggle('expanded');
    toggle.classList.toggle('expanded');
  }
}

/**
 * Formats a timestamp as a localized date and time string
 * @param {number} timestamp - Unix timestamp in milliseconds
 * @returns {{date: string, time: string}} - Formatted date and time
 */
export function formatTimestamp(timestamp) {
  const date = new Date(timestamp).toLocaleDateString();
  const time = new Date(timestamp).toLocaleTimeString();
  return { date, time };
}

/**
 * Generates a unique run ID
 * @returns {string} - A unique identifier for a game run
 */
export function generateRunId() {
  return `run_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}
