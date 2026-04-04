# Skills — Game Design

This document covers hero and enemy skills: categories, triggering, cooldown management, and the components needed to represent skills in the simulation.

## Design Goals

- Skills are the primary source of strategic depth in the otherwise automatic combat.
- Skills are **chosen** by the hero's/enemy's bound choice function (`select_combat_skill`), not randomly.
- A skill may be **active** (fired on demand), **passive** (always-on modifier), or **triggered** (fires automatically on a condition).
- Skills consume mana or require a cooldown; the simulation enforces these constraints.
- Each skill may apply one or more **status effects** (see [status-effects.md](status-effects.md)).

Additional progression rules:

- **Max skill level:** Each skill can be leveled up to a maximum of **50**.
- **Skill points per level:** Heroes gain **1 skill point** each time they gain a character level. Skill points are spent to increase individual skill levels or unlock/upgrade skill effects.

Skill tree structure:

- **Per-class DAG:** Each class has its own skill tree arranged as a directed acyclic graph (DAG). Nodes are individual skills; edges denote prerequisite relationships.
- **Acquisition rule:** To acquire or upgrade a skill, a hero must already have acquired all prerequisite skills (every incoming edge must be satisfied). Prerequisites and skill-level costs are defined per-skill in the class skill data (BDL/BDL templates).

---

## Skill Categories

### Active Skills
Manually triggered by the entity's AI decision function. Costs mana and has a cooldown.

| Trigger | Example |
|---------|---------|
| On the entity's own turn (replaces basic attack) | Power Strike, Frost Bolt |
| When an ally is below a HP threshold | Heal, Lay on Hands |
| When a specific enemy skill is detected | Dispel |

### Passive Skills
Always active; modify stats or rules without an event trigger.

| Effect type | Example |
|-------------|---------|
| Stat modifier | +10% critChance (Assassin's Focus) |
| Damage type immunity | Undead resistance to poison |
| On-hit proc | Chance to apply Bleeding on every basic attack |

### Triggered Skills
Fire automatically when a specific event occurs in combat.

| Trigger | Example |
|---------|---------|
| On near-death (HP < 25%) | Last Stand (damage buff) |
| On ally death | Avenge (attack speed surge) |
| On crit received | Retaliation (reflect damage) |
| On boss phase change | Rally (party-wide heal) |

---

## Skill Slot System

Each entity has 4 skill slots. Skills are assigned at entity creation (BDL) or on level-up.

| Slot | Unlock Level |
|------|-------------|
| Skill 1 | Level 1 (class default) |
| Skill 2 | Level 5 |
| Skill 3 | Level 10 |
| Skill 4 | Level 15 |

---

## Hero Skills (by Class)

### Warrior
| Skill | Type | Effect |
|-------|------|--------|
| Power Strike | Active | Deal 150% damage to one target |
| Shield Bash | Active | Deal damage + apply Stunned (1 turn) |
| Defensive Stance | Active | Gain +20 defence for 5s |
| Execute | Active | Deal 200% damage to target below 20% HP |

### Mage
| Skill | Type | Effect |
|-------|------|--------|
| Frost Bolt | Active | Deal magic damage + apply Frozen (2s) |
| Fireball | Active | Deal AoE damage to all enemies (Burning) |
| Arcane Shield | Active | Absorb-shield for 30 damage |
| Mana Surge | Passive | +20% spell damage when Mana > 80% |

### Ranger
| Skill | Type | Effect |
|-------|------|--------|
| Aimed Shot | Active | 2× damage to single target |
| Multishot | Active | Hits all enemies for 60% damage |
| Poison Arrow | Active | Deal damage + apply Poisoned (3 stacks) |
| Eagle Eye | Passive | +15% crit chance |

### Paladin
| Skill | Type | Effect |
|-------|------|--------|
| Holy Strike | Active | Deal damage + apply Blessed to self |
| Lay on Hands | Active | Fully heal one ally |
| Divine Shield | Active | Party-wide absorb shield for 20 damage |
| Resurrection | Triggered | Revives one dead ally at 50% HP (once per encounter) |

### Rogue
| Skill | Type | Effect |
|-------|------|--------|
| Backstab | Active | 175% damage, priority to low-defence targets |
| Shadowstep | Active | Deal damage + apply Blinded to target |
| Eviscerate | Active | Apply Bleeding (5 stacks, high damage) |
| Shadow Cloak | Triggered | On near-death: become Untargetable for 2s |

### Cleric
| Skill | Type | Effect |
|-------|------|--------|
| Heal | Active | Restore HP to lowest-HP ally |
| Mass Heal | Active | Restore HP to all allies |
| Smite | Active | Deal magic damage to one enemy |
| Purify | Active | Remove all negative status effects from one ally |

---

### Enemy Skills (by Tier)

Enemies at higher tiers gain skills. Each enemy type specifies skills in its BDL template via the `Skills` component.

| Skill | Applied By | Type | Effect |
|-------|-----------|------|--------|
| Bone Shield | Skeleton Warrior | Passive | Absorbs the first 15 damage of each incoming hit |
| Frost Bolt | Dark Mage | Active | Apply Frozen (2s) |
| Poison Spit | Venomspitter | Active | Apply Poisoned (3 stacks) to all heroes |
| Enrage | Troll Berserker | Triggered | +50% damage when HP < 50% |
| Petrify Aura | Stone Golem | Passive | Chance to apply Petrified on every hit |
| Dragon Breath | Ancient Dragon | Active | AoE, applies Burning (3s) |
| Hellfire | Demon Knight | Active | AoE, fire damage |
| Vexar's Curse | Dragon Lord Vexar | Active | Reduces all hero max HP by 25% for 10s |
| Phase Shift | Dragon Lord Vexar | Triggered | At 50% HP: +30% damage, summon two minions |

---

## Components

### `Skills`
Attached to: all combatants.

| Field | Type | Description |
|-------|------|-------------|
| `skill1` | string | Skill ID in slot 1 |
| `skill2` | string | Skill ID in slot 2 (empty string = locked) |
| `skill3` | string | Skill ID in slot 3 |
| `skill4` | string | Skill ID in slot 4 |
| `skillPoints` | integer | Unspent skill points available |

### `SkillCooldown`
Attached to: any entity that has used a skill with a cooldown. One component instance per active cooldown.

| Field | Type | Description |
|-------|------|-------------|
| `skillId` | string | The skill on cooldown |
| `remainingTime` | float | Seconds until the skill can be used again |

### `SkillEffect`
Attached to: a transient effect entity created when a skill is cast.

| Field | Type | Description |
|-------|------|-------------|
| `skillId` | string | Which skill produced this effect |
| `casterId` | id | The entity that cast the skill |
| `targetId` | id? | Single-target (null for AoE) |
| `magnitude` | integer | Numeric strength of the effect |
| `duration` | float | Seconds the effect lasts |

### `PassiveSkill`
Attached to: entities that have one or more passive skills active.

| Field | Type | Description |
|-------|------|-------------|
| `skillId` | string | Passive skill identifier |
| `statTarget` | string | Which stat field is modified (e.g., `"critChance"`) |
| `modifier` | float | Additive or multiplicative modifier value |
| `isMultiplier` | boolean | If `true`, modifier is multiplicative |

---

## Events (Skill-related)

| Event | Fields | Description |
|-------|--------|-------------|
| `UseSkill` | `caster`, `skillId`, `target?` | An entity activates a skill |
| `SkillEffect` | `skillId`, `caster`, `targets`, `magnitude` | Skill effect resolves (damage/heal/buff) |
| `SkillCooldownExpired` | `entity`, `skillId` | A cooldown has elapsed |
| `PassiveProc` | `entity`, `skillId`, `trigger` | A passive skill fires on a matching event |
| `ApplyStatusEffect` | `target`, `effectType`, `magnitude`, `duration` | Attaches a status effect to an entity |

---

## Design Notes

- Skill selection is AI-driven via the `select_combat_skill` bound choice function; the AI considers HP thresholds, ally state, and enemy state.
- AoE skills hit all valid targets simultaneously via `SkillEffect` with multiple target IDs.
- Mana cost for skills is deducted at `UseSkill` time; if not enough mana is available the skill is skipped and a basic attack is used instead.
- Passive skills are registered at entity spawn and modify the relevant stat fields once; they do not fire as events.
