# 2026-01-04 — Add Enemy Compendium

Summary
- Added a new `EnemyCompendium` component to `game/brl/classic-rpg.brl` to centralize references to enemy templates.
- Created a global `EnemyCompendium` entity in `game/bdl/enemies.bdl`.
- Converted named enemy entities (e.g. `@goblin_scout`) into unnamed entities to comply with the latest language version.
- Added a rule `register_enemy_in_compendium` in `game/bdl/enemies.bdl` that registers spawned enemy entities into the compendium.

Changes after review:
- Removed the dynamic registration rule from `game/bdl/enemies.bdl` because BDL disallows rules.
- Switched `EnemyCompendium` to store string `entries` and added `templateId` (optional) to the `Enemy` component in `game/brl/classic-rpg.brl`.
- Manually populated the compendium `entries` array in `game/bdl/enemies.bdl` and set `templateId` for each enemy entity.
 - Switched `EnemyCompendium` to store references to entity variables in `game/bdl/enemies.bdl`.
 - Converted enemy definitions to `name = new entity { ... }` syntax and removed redundant `templateId` fields from the BDL definitions.

Files changed
- `game/brl/classic-rpg.brl` — added `EnemyCompendium` component.
- `game/bdl/enemies.bdl` — added compendium entity, removed named entities, added registration rule.
 - `game/bdl/enemies.bdl` — added compendium entity (statically populated), removed named entities, removed dynamic registration rule.
 - `game/brl/classic-rpg.brl` — added optional `templateId` to `Enemy` component and changed `EnemyCompendium` to `entries: string[]`.

Notes
- The registration rule appends enemy entity ids into the compendium when an `EnemySpawned` event occurs; ensure the game schedules that event for template registration or consider scheduling an initialization event if templates need to be registered at load time.
- If you want the compendium to be pre-populated at load time rather than on spawn, I can add an initialization rule/event to populate it immediately.
