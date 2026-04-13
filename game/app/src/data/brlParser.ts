/**
 * Generic BRL data parser — extracts entity and component data from BRL files.
 *
 * BRL files define entities with component blocks, e.g.:
 *
 *   goblin_scout = new entity {
 *       Character {
 *           name: "Goblin Scout"
 *           level: 1
 *       }
 *       Health {
 *           current: 45
 *           max: 45
 *       }
 *   }
 *
 * This parser uses regex-based extraction to read entity names, their component
 * blocks, and the field values within each component.  It is deliberately
 * lightweight and does not attempt full BRL compilation — just data extraction.
 *
 * The canonical sources remain the BRL files in `game/brl/`.  At build time,
 * `scripts/copy-game-files.js` copies them to `public/game-files/` so they
 * can be fetched at runtime.
 */

// ── Field extraction helpers ────────────────────────────────────────────────

/**
 * Extract a string field value from a BRL component block snippet.
 * e.g. `name: "Goblin Scout"` → "Goblin Scout"
 */
export function extractStringField(block: string, field: string): string {
  const re = new RegExp(`\\b${field}:\\s*"([^"]*)"`, 's');
  const m = block.match(re);
  return m ? m[1] : '';
}

/**
 * Extract a numeric field value from a BRL component block snippet.
 * Handles integers, floats, and BRL double-suffix (e.g. `0.8d`).
 * Returns undefined if not found.
 */
export function extractNumberField(block: string, field: string): number | undefined {
  const re = new RegExp(`\\b${field}:\\s*(-?[\\d.]+)d?\\b`);
  const m = block.match(re);
  return m ? parseFloat(m[1]) : undefined;
}

/**
 * Extract a boolean field value from a BRL component block snippet.
 * Returns undefined if not found.
 */
export function extractBoolField(block: string, field: string): boolean | undefined {
  const re = new RegExp(`\\b${field}:\\s*(true|false)\\b`);
  const m = block.match(re);
  return m ? m[1] === 'true' : undefined;
}

// ── Entity & component extraction ───────────────────────────────────────────

/** A parsed BRL component: name and raw text between braces. */
export interface BrlComponent {
  name: string;
  body: string;
}

/** A parsed BRL entity: its variable name and list of components. */
export interface BrlEntity {
  name: string;
  components: BrlComponent[];
}

/**
 * Extract a single named component block from a BRL entity body.
 * Returns the text between `ComponentName { ... }`.
 * Uses brace-counting to handle nested content correctly.
 */
export function extractComponent(entityBody: string, componentName: string): string | undefined {
  const re = new RegExp(`\\b${componentName}\\s*\\{`);
  const m = re.exec(entityBody);
  if (!m) return undefined;

  let depth = 1;
  let pos = m.index + m[0].length;
  const start = pos;
  while (pos < entityBody.length && depth > 0) {
    if (entityBody[pos] === '{') depth++;
    if (entityBody[pos] === '}') depth--;
    pos++;
  }
  return entityBody.slice(start, pos - 1);
}

/**
 * Parse all top-level entities from raw BRL text.
 *
 * Recognises two patterns:
 *   `name = new entity { ... }`
 *   `let name: id = new entity { ... }`
 *
 * Returns an array of BrlEntity objects with their component blocks.
 */
export function parseEntities(text: string): BrlEntity[] {
  const entities: BrlEntity[] = [];

  // Match entity declarations — handles both `x = new entity {` and `let x: id = new entity {`
  const entityDeclRe = /(?:let\s+)?(\w+)(?:\s*:\s*\w+)?\s*=\s*new\s+entity\s*\{/g;
  let m: RegExpExecArray | null;

  while ((m = entityDeclRe.exec(text)) !== null) {
    const name = m[1];
    const bodyStart = m.index + m[0].length;

    // Find matching closing brace using brace counting
    let depth = 1;
    let pos = bodyStart;
    while (pos < text.length && depth > 0) {
      if (text[pos] === '{') depth++;
      if (text[pos] === '}') depth--;
      pos++;
    }

    const entityBody = text.slice(bodyStart, pos - 1);

    // Extract component blocks within the entity body
    const components: BrlComponent[] = [];
    const componentRe = /\b([A-Z]\w*)\s*\{/g;
    let cm: RegExpExecArray | null;

    while ((cm = componentRe.exec(entityBody)) !== null) {
      const compName = cm[1];
      const compBodyStart = cm.index + cm[0].length;

      // Brace-count for component body
      let compDepth = 1;
      let compPos = compBodyStart;
      while (compPos < entityBody.length && compDepth > 0) {
        if (entityBody[compPos] === '{') compDepth++;
        if (entityBody[compPos] === '}') compDepth--;
        compPos++;
      }

      components.push({
        name: compName,
        body: entityBody.slice(compBodyStart, compPos - 1),
      });

      // Skip past the component block to avoid matching inner capitalized words
      componentRe.lastIndex = compPos;
    }

    entities.push({ name, components });
  }

  return entities;
}

/**
 * Get a component by name from a parsed entity.
 */
export function getComponent(entity: BrlEntity, componentName: string): BrlComponent | undefined {
  return entity.components.find(c => c.name === componentName);
}

// ── Fetch helper ────────────────────────────────────────────────────────────

/**
 * Fetch a BRL file from the game-files directory.
 * Uses the Vite BASE_URL for path resolution.
 */
export async function fetchBrlFile(filename: string): Promise<string> {
  const base = (typeof import.meta !== 'undefined' && import.meta.env?.BASE_URL) ?? '/';
  const url = `${base}game-files/${filename}`.replace('//', '/');
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch BRL file ${filename}: ${res.status}`);
  return res.text();
}
