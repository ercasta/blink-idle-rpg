# Learning Path: Content Creator

This guide is for people adding **new content** to the game — new locations,
NPCs, enemies, skills, or story elements — without modifying the engine or
core game rules.

---

## Prerequisites

- Basic text-editor proficiency (you'll edit `.brl` files)
- No programming experience required, but familiarity with JSON-like syntax
  helps

## Getting Started

1. **[INTRODUCTION.md](INTRODUCTION.md)** — What Blink Idle RPG is and how
   it works at a high level
2. **[brl/brl-user-guide.md](brl/brl-user-guide.md)** — BRL syntax basics
   (focus on **entity definitions** — you won't need rules or functions)
3. **[game-design/README.md](game-design/README.md)** — Overview of all game
   systems

## Content Areas

### Adding Enemies

| Resource | What You'll Learn |
|----------|-------------------|
| [game-design/enemies.md](game-design/enemies.md) | Enemy types, tiers, stat ranges |
| `game/brl/enemies.brl` | Existing enemy entity definitions (copy and modify) |

Each enemy is a BRL entity with `Enemy`, `EnemyTemplate`, `Health`, `Combat`,
and `Identity` components.  Add a new enemy by copying an existing template
and changing the values.

### Adding Locations and World Content

| Resource | What You'll Learn |
|----------|-------------------|
| [game-design/world-design.md](game-design/world-design.md) | Location types, paths, NPCs, arrival comments |
| `game/brl/story-world-data.brl` | All world entity definitions |
| `game/brl/story-world.brl` | World component definitions (reference) |

To add a new location:
1. Create a `WorldLocation` entity in `story-world-data.brl`
2. Create `WorldPath` entities connecting it to existing locations
3. Optionally add `HeroArrivalComment` entities for flavour text
4. Optionally add `WorldNpc` entities at the location

### Adding Skills

| Resource | What You'll Learn |
|----------|-------------------|
| [game-design/skills.md](game-design/skills.md) | Skill system, types, prerequisites, DAGs |
| `game/brl/skill-catalog.brl` | All skill entity definitions |

Each skill is a BRL entity with `SkillInfo` and effect components.

### Adding Adventure Content

| Resource | What You'll Learn |
|----------|-------------------|
| [game-design/adventure-design.md](game-design/adventure-design.md) | Quest system, milestones, events |
| `game/brl/adventure-expansion-set-1.brl` | Encounter templates and matching rules |

### Adding Story / Narrative Content

| Resource | What You'll Learn |
|----------|-------------------|
| [game-design/story-mode.md](game-design/story-mode.md) | Story mode, travel, map, narrative |
| `game/brl/story-mode.brl` | Story mode component definitions |

## Workflow

1. Edit or create BRL entity definitions in the appropriate `game/brl/*.brl` file
2. Recompile:
   ```bash
   npm run compile-brl       # Compile BRL to IR
   npm run build:wasm        # Rebuild WASM (if rules changed)
   npm run install:wasm      # Copy WASM to web app
   ```
3. Test locally:
   ```bash
   npm run dev:app           # Start local dev server
   ```

**Tip**: If you're only adding entity data (not changing rules), you may only
need `npm run compile-brl` followed by `npm run dev:app`.

## BRL Quick Reference for Content Creators

You'll mainly use **entity definitions** with **component initialization**:

```brl
// Define a new enemy
entity goblin_archer {
    Identity { name: "Goblin Archer" }
    Enemy { tier: 2 }
    EnemyTemplate { isTemplate: true }
    Health { current: 45, max: 45 }
    Combat { damage: 8, defense: 3, speed: 1.2d }
    // ... more components
}
```

See `game/brl/enemies.brl` for many more examples.

## Reference

- [brl/brl-specification.md](brl/brl-specification.md) — Full BRL language reference
- [game-design/](game-design/) — All game design documents
