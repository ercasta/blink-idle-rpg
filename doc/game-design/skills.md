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
- **Acquisition rule:** To acquire or upgrade a skill, a hero must already have acquired all prerequisite skills (every incoming edge must be satisfied). Prerequisites and skill-level costs are defined per-skill in the class skill data (BRL templates).

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

Each entity has 4 skill slots. Skills are assigned at entity creation (BRL) or on level-up.

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

Enemies at higher tiers gain skills. Each enemy type specifies skills in its BRL entity definition via the `Skills` component.

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

---

## Class Skill Trees (DAGs)

Below are four class skill trees. Each class contains 48 skills organized into three groups: 16 Primary (core actives), 16 Secondary (situational/utility actives), and 16 Passive (always-on modifiers). Each skill lists a short description and prerequisite skill IDs (if any). The IDs are compact to make DAG wiring straightforward.

Notation: IDs use `<ClassLetter>_P#` for Primary, `<ClassLetter>_S#` for Secondary, `<ClassLetter>_A#` for Passive. Prereqs shown as `Prereqs: [IDs]`.

### Warrior
Archetypes: Defender (tank/party guardian), Berserker (high single-target damage), Warlord (party buffs and control).

Primary Skills (W_P1..W_P16)
- W_P1 — Power Strike: Strong single-target strike. Prereqs: []
- W_P2 — Shield Bash: Damage + Stun. Prereqs: [W_P1]
- W_P3 — Taunt: Force enemies to target you. Prereqs: [W_P1]
- W_P4 — Defensive Stance: Increase DEF for party lead. Prereqs: [W_P3]
- W_P5 — Cleaving Blow: Frontal AoE damage. Prereqs: [W_P1]
- W_P6 — Rampage: Chain strikes that scale with missing HP. Prereqs: [W_P5]
- W_P7 — Furious Charge: Gap-close + knockdown. Prereqs: [W_P1]
- W_P8 — Overwatch: Counterattack chance for a duration. Prereqs: [W_P4]
- W_P9 — Last Stand: Massive damage reduction at low HP. Prereqs: [W_P4]
- W_P10 — Execute: High-damage finisher on low-HP targets. Prereqs: [W_P6]
- W_P11 — War Cry: Party attack buff for short time. Prereqs: [W_P3]
- W_P12 — Shield Wall: Party-wide damage absorb. Prereqs: [W_P4,W_P11]
- W_P13 — Cleaving Mastery: Cleave hits twice and reduces enemy armor. Prereqs: [W_P5,W_P8]
- W_P14 — Berserker Momentum: Gain stacked damage on consecutive hits. Prereqs: [W_P6,W_P7]
- W_P15 — Ground Slam: Large AoE with slow. Prereqs: [W_P5,W_P12]
- W_P16 — Warlord's Command: Party-wide cooldown reduction for short window. Prereqs: [W_P11,W_P12]

Secondary Skills (W_S1..W_S16)
- W_S1 — Shield Throw: Ranged small-damage + taunt. Prereqs: [W_P1]
- W_S2 — Riposte: Instant counter on next hit. Prereqs: [W_P8]
- W_S3 — Body Slam: Interrupt enemy cast. Prereqs: [W_P7]
- W_S4 — Fortify Armor: Temporary massive armor buff. Prereqs: [W_P4]
- W_S5 — Rally: Small heal to nearby allies. Prereqs: [W_P11]
- W_S6 — Knockback Shield: Push enemies away on hit. Prereqs: [W_P2]
- W_S7 — Disarm: Reduce enemy weapon effectiveness. Prereqs: [W_P2,W_P3]
- W_S8 — Momentum Strike: Consumes momentum stacks for a burst. Prereqs: [W_P14]
- W_S9 — Focused Defense: Gain magic resistance for a short time. Prereqs: [W_P4]
- W_S10 — Shield Focus: Reduces skill cooldown when shield used. Prereqs: [W_P8]
- W_S11 — Marching Orders: Small party speed and initiative buff. Prereqs: [W_P11]
- W_S12 — Unstoppable: Ignore slows for short time. Prereqs: [W_P7]
- W_S13 — Crushing Blows: Small chance to ignore enemy armor on hit. Prereqs: [W_P13]
- W_S14 — Guarded Assault: Increase damage while shielded. Prereqs: [W_P4,W_P5]
- W_S15 — Intimidate: Lower enemy crit chance. Prereqs: [W_P3]
- W_S16 — Earthshaker: Stagger ground enemies (mini-stun). Prereqs: [W_P15]

Passive Skills (W_A1..W_A16)
- W_A1 — Heavy Armor Training: +Max HP. Prereqs: []
- W_A2 — Shield Mastery: +Block chance. Prereqs: [W_A1]
- W_A3 — Toughness: +HP regen out of combat. Prereqs: [W_A1]
- W_A4 — Fortitude: +Resistance to crowd control. Prereqs: [W_A2]
- W_A5 — Brutal Strikes: +crit damage for melee. Prereqs: []
- W_A6 — Stamina: Reduced skill mana cost. Prereqs: [W_A5]
- W_A7 — Hardened: Reduce incoming critical damage. Prereqs: [W_A4]
- W_A8 — Momentum: Passive stack generator for Berserker skills. Prereqs: [W_A6]
- W_A9 — Bulwark: When taunting, gain extra armor. Prereqs: [W_A2,W_P3]
- W_A10 — Veteran's Grit: Reduce cooldowns slightly. Prereqs: [W_A3]
- W_A11 — Crushing Weight: Melee hits ignore small portion of armor. Prereqs: [W_A5,W_P13]
- W_A12 — Iron Will: Chance to resist fear/petrify. Prereqs: [W_A4]
- W_A13 — War Drills: Small passive party buff to melee allies. Prereqs: [W_A10]
- W_A14 — Second Wind: Auto-heal when dropping below threshold (small). Prereqs: [W_A3,W_A9]
- W_A15 — Indomitable: Reduce duration of debuffs. Prereqs: [W_A12]
- W_A16 — Battle Leader: Increase party XP/skill gain slightly. Prereqs: [W_A13,W_P16]

---

### Mage
Archetypes: Pyromancer (burst AoE), Cryomancer (control/debuff), Arcanist (utility & scaling spells).

Primary Skills (M_P1..M_P16)
- M_P1 — Magic Missile: Reliable single-target magic damage. Prereqs: []
- M_P2 — Fireball: AoE fire damage + Burn. Prereqs: [M_P1]
- M_P3 — Frost Bolt: Single-target slow + chance to Freeze. Prereqs: [M_P1]
- M_P4 — Arcane Missiles: Multi-hit projectiles that scale with mana. Prereqs: [M_P1]
- M_P5 — Meteor: Large-delay AoE heavy damage. Prereqs: [M_P2]
- M_P6 — Blizzard: Area slow + damage over time. Prereqs: [M_P3]
- M_P7 — Mana Shield: Convert damage to mana drain before HP. Prereqs: [M_P4]
- M_P8 — Arcane Explosion: Instant nearby burst when casting. Prereqs: [M_P4]
- M_P9 — Flame Burst: Ignite a target for high DoT. Prereqs: [M_P2]
- M_P10 — Ice Prison: Crowd-control single target (root). Prereqs: [M_P3,M_P6]
- M_P11 — Combustion: Increase fire damage for short time. Prereqs: [M_P2]
- M_P12 — Temporal Shift: Slow time (enemy action delay) for short window. Prereqs: [M_P8]
- M_P13 — Arcane Beam: Channelled piercing damage. Prereqs: [M_P4,M_P8]
- M_P14 — Elemental Mastery: Toggle to enhance one element (fire/ice/arcane). Prereqs: [M_P5,M_P6,M_P7]
- M_P15 — Cataclysm: Very large AoE ultimate (long cooldown). Prereqs: [M_P5,M_P11]
- M_P16 — Mana Overflow: Burst restore and massive spell surge effect. Prereqs: [M_P7,M_P14]

Secondary Skills (M_S1..M_S16)
- M_S1 — Mana Bolt: Cheap single-target nuke. Prereqs: [M_P1]
- M_S2 — Frost Nova: Small ring stun around caster. Prereqs: [M_P3]
- M_S3 — Ignite: Small insta-burn on hit. Prereqs: [M_P2]
- M_S4 — Blink: Teleport short distance. Prereqs: [M_P4]
- M_S5 — Silence: Prevent enemy casting briefly. Prereqs: [M_P12]
- M_S6 — Spell Ward: Temporary magic resist shield. Prereqs: [M_P7]
- M_S7 — Arcane Echo: Repeat last spell at reduced power. Prereqs: [M_P8]
- M_S8 — Frostbite: On-hit chance to apply chill stacks. Prereqs: [M_P3]
- M_S9 — Heat Wave: Push enemies and reduce accuracy. Prereqs: [M_P2]
- M_S10 — Mana Beacon: Grants mana to allies nearby. Prereqs: [M_P7]
- M_S11 — Glyph of Binding: Place a trap that roots enemies. Prereqs: [M_P10]
- M_S12 — Precision Channel: Increase cast speed briefly. Prereqs: [M_P4]
- M_S13 — Arcane Sight: Reveals stealth enemies and reduces their resist. Prereqs: [M_P8]
- M_S14 — Elemental Swap: Switch active element instantly. Prereqs: [M_P14]
- M_S15 — Spark Chain: Small lightning arc between enemies. Prereqs: [M_P4]
- M_S16 — Slowfield: Area-of-effect slow field. Prereqs: [M_P6]

Passive Skills (M_A1..M_A16)
- M_A1 — Scholar: +Max mana. Prereqs: []
- M_A2 — Quick Cast: Reduced base cast time. Prereqs: [M_A1]
- M_A3 — Elemental Affinity: +damage for chosen element. Prereqs: [M_A1]
- M_A4 — Mana Regen: Increased mana regen out of combat. Prereqs: [M_A1]
- M_A5 — Pyromania: Increased Burn damage and duration. Prereqs: [M_A3,M_P2]
- M_A6 — Cryostasis: Improved freeze chance and duration. Prereqs: [M_A3,M_P3]
- M_A7 — Arcane Reservoir: Small mana pool overflow bonus. Prereqs: [M_A4]
- M_A8 — Spell Precision: Increased spell crit chance. Prereqs: [M_A2]
- M_A9 — Runic Inscription: Passive on-hit rune effects (minor). Prereqs: [M_A8]
- M_A10 — Mana Efficiency: Lower mana cost for non-ultimate spells. Prereqs: [M_A4]
- M_A11 — Conduit: Spells sometimes refund a portion of cooldown. Prereqs: [M_A7]
- M_A12 — Elemental Surge: Chance for spells to trigger small elemental explosion. Prereqs: [M_A3,M_P8]
- M_A13 — Arcane Armor: Minor damage absorption scaling with max mana. Prereqs: [M_A1,M_P7]
- M_A14 — Temporal Focus: Slightly lengthen effect durations of control spells. Prereqs: [M_A2,M_P12]
- M_A15 — Leyline Mastery: Increased effect radius for AoE spells. Prereqs: [M_A3,M_P5]
- M_A16 — Spellweaver: Small party-wide spell power buff while alive. Prereqs: [M_A11,M_P16]

---

### Rogue
Archetypes: Assassin (single-target burst), Scout (high mobility/utility), Trickster (debuffs & disruption).

Primary Skills (R_P1..R_P16)
- R_P1 — Backstab: High damage if attacking from behind. Prereqs: []
- R_P2 — Shadowstep: Teleport behind target + strike. Prereqs: [R_P1]
- R_P3 — Eviscerate: Bleed stacking high DPS. Prereqs: [R_P1]
- R_P4 — Poisoned Blade: Apply poison on hit. Prereqs: [R_P3]
- R_P5 — Fan of Knives: Narrow cone multi-hit. Prereqs: [R_P1]
- R_P6 — Shadow Cloak: Become untargetable briefly. Prereqs: [R_P2]
- R_P7 — Ambush: Massive opening strike from stealth. Prereqs: [R_P6,R_P1]
- R_P8 — Throwing Dagger: Ranged single-target with slow. Prereqs: [R_P5]
- R_P9 — Garrote: Silence and damage-over-time. Prereqs: [R_P3]
- R_P10 — Vanish: Enter stealth immediately. Prereqs: [R_P6]
- R_P11 — Critical Focus: Next attack is guaranteed crit. Prereqs: [R_P1]
- R_P12 — Chain of Shadows: Teleport to multiple enemies in sequence. Prereqs: [R_P2,R_P5]
- R_P13 — Weakening Strike: Reduce target damage output. Prereqs: [R_P5,R_P9]
- R_P14 — Lethal Precision: Increase crit multiplier. Prereqs: [R_P11]
- R_P15 — Smoke Bomb: Large area blind. Prereqs: [R_P6,R_P10]
- R_P16 — Shadow Master: Enhances stealth abilities and grants passive regen in stealth. Prereqs: [R_P10,R_P6]

Secondary Skills (R_S1..R_S16)
- R_S1 — Pickpocket: Steal small resources from target. Prereqs: [R_P1]
- R_S2 — Trap: Place a hidden trap that triggers slow/damage. Prereqs: [R_P5]
- R_S3 — Quickstep: Short burst dodge and reposition. Prereqs: [R_P2]
- R_S4 — Poison Cloud: AoE poison field. Prereqs: [R_P4]
- R_S5 — Shadow Mirror: Create a decoy to draw aggro. Prereqs: [R_P6]
- R_S6 — Blade Dance: Rapid attacks on single target for short time. Prereqs: [R_P3]
- R_S7 — Disable: Chance to disarm or break enemy buff. Prereqs: [R_P13]
- R_S8 — Mark for Death: Increase damage taken by target from all sources. Prereqs: [R_P11]
- R_S9 — Silent Takedown: Instant-kill attempt on very low HP targets. Prereqs: [R_P7]
- R_S10 — Shadowy Escape: On near-death, teleport away. Prereqs: [R_P10]
- R_S11 — Bleeder's Legacy: Bleeds spread to nearby enemies on death. Prereqs: [R_P3]
- R_S12 — Poison Mastery: Increase poison potency and duration. Prereqs: [R_P4]
- R_S13 — Focused Strike: Reduce target armor for subsequent attacks. Prereqs: [R_P13]
- R_S14 — Pressure Point: Stun chance on heavy hits. Prereqs: [R_P5]
- R_S15 — Gang Up: Deal bonus damage when multiple rogues present (synergy). Prereqs: []
- R_S16 — Infiltrate: Gain bonus rewards from stealth encounters. Prereqs: [R_P6]

Passive Skills (R_A1..R_A16)
- R_A1 — Nimble: +Dodge. Prereqs: []
- R_A2 — Lethality: +Crit chance. Prereqs: [R_A1]
- R_A3 — Venom Training: Increase poison effect. Prereqs: [R_A1]
- R_A4 — Shadow's Grace: Reduced detection radius. Prereqs: [R_A1]
- R_A5 — Cold Blooded: Gain burst damage after successful stealth attack. Prereqs: [R_A2]
- R_A6 — Opportunist: Increased damage vs slowed targets. Prereqs: [R_A2,R_S13]
- R_A7 — Silent Steps: Reduce initiative when entering combat (act earlier). Prereqs: [R_A4]
- R_A8 — Backstabber's Focus: Bonus damage to rear-facing enemies. Prereqs: [R_A2,R_P1]
- R_A9 — Assassinate Edge: Chance to execute very low HP targets. Prereqs: [R_A5]
- R_A10 — Trap Specialist: Traps gain improved effects. Prereqs: [R_A3,R_S2]
- R_A11 — Evasion: Small chance to nullify an incoming hit. Prereqs: [R_A1]
- R_A12 — Toxic Residue: Poison lingers longer on struck enemies. Prereqs: [R_A3]
- R_A13 — Shadow Networking: Reduce skill cooldowns while in stealth. Prereqs: [R_A4,R_P10]
- R_A14 — Pressure Tactics: Increase debuff durations applied by rogue. Prereqs: [R_A6]
- R_A15 — Agile Fury: Increase attack speed after dodge. Prereqs: [R_A11]
- R_A16 — Rogue's Bounty: Slight increase to loot find and gold. Prereqs: [R_A10,R_S15]

---

### Cleric
Archetypes: Battle Priest (in-combat heals & supports), Lightwarden (strong single-target heals and cleanses), Templar (defensive auras & anti-undead).

Primary Skills (C_P1..C_P16)
- C_P1 — Heal: Restore moderate HP to an ally. Prereqs: []
- C_P2 — Smite: Holy damage to enemy with minor stun. Prereqs: []
- C_P3 — Mass Heal: Heal all allies for small amount. Prereqs: [C_P1]
- C_P4 — Purify: Remove negative effects from ally. Prereqs: [C_P1]
- C_P5 — Divine Shield: Absorb damage for one ally. Prereqs: [C_P3]
- C_P6 — Judgement: Damage + mark target for extra holy damage. Prereqs: [C_P2]
- C_P7 — Beacon of Hope: Buff healing received by allies. Prereqs: [C_P3]
- C_P8 — Turn Undead: Fear / disable undead-type enemies. Prereqs: [C_P2]
- C_P9 — Resurrection: Revive one ally with partial HP (long cooldown). Prereqs: [C_P3,C_P5]
- C_P10 — Holy Nova: Small heal to allies + small holy damage to enemies around caster. Prereqs: [C_P3]
- C_P11 — Aegis Ward: Place a persistent heal-over-time on an ally. Prereqs: [C_P1]
- C_P12 — Consecration: Ground AoE that heals allies and damages enemies over time. Prereqs: [C_P10]
- C_P13 — Hammer of Light: Single-target heavy holy damage. Prereqs: [C_P6]
- C_P14 — Guardian Angel: Target cannot be reduced below 1 HP for short time. Prereqs: [C_P5]
- C_P15 — Channel Divinity: Powerful single-target heal or purge. Prereqs: [C_P7,C_P4]
- C_P16 — Sacred Beacon: Marked ally receives periodic heals and damage transfer. Prereqs: [C_P7,C_P11]

Secondary Skills (C_S1..C_S16)
- C_S1 — Minor Blessing: Small, long-duration buff to one ally. Prereqs: [C_P1]
- C_S2 — Antidote: Apply poison cure and small cleanse. Prereqs: [C_P4]
- C_S3 — Sanctify Weapon: Temporarily convert ally damage to holy. Prereqs: [C_P7]
- C_S4 — Steady Hands: Remove stun from ally immediately. Prereqs: [C_P4]
- C_S5 — Light's Beacon: Reveal stealthed enemies in small radius. Prereqs: [C_P10]
- C_S6 — Protective Chant: Small party-wide defense buff. Prereqs: [C_P5]
- C_S7 — Mend Wounds: Apply heal-over-time to multiple allies. Prereqs: [C_P3]
- C_S8 — Blessing of Speed: Increase movement/turn speed for one ally. Prereqs: [C_P1]
- C_S9 — Retribution: Reflect small portion of damage back to attackers. Prereqs: [C_P6]
- C_S10 — Divine Intervention: Reduce cooldowns of target ally's skills slightly. Prereqs: [C_P7]
- C_S11 — Sacred Ground: Temporarily decrease enemy damage inside area. Prereqs: [C_P12]
- C_S12 — Beacon Swap: Swap positions with marked ally. Prereqs: [C_P16]
- C_S13 — Anti-Magic Zone: Suppress enemy buffs in area. Prereqs: [C_P12]
- C_S14 — Blessing of Clarity: Increase ally mana regen. Prereqs: [C_P7]
- C_S15 — Spirit Ward: Small chance to negate status effects. Prereqs: [C_P4]
- C_S16 — Serenity: On-kill small heal to party. Prereqs: []

Passive Skills (C_A1..C_A16)
- C_A1 — Devotion: +Healing power. Prereqs: []
- C_A2 — Calm Mind: +Mana pool for clerics. Prereqs: [C_A1]
- C_A3 — Efficient Healer: Reduced mana cost for heals. Prereqs: [C_A1]
- C_A4 — Blessing Aura: Small passive regen aura to nearby allies. Prereqs: [C_A1]
- C_A5 — Light's Embrace: Increased crit heal strength and chance. Prereqs: [C_A3]
- C_A6 — Guardian's Resolve: Increase ally resistances while buffed. Prereqs: [C_A4]
- C_A7 — Martyr's Grace: When cleric heals, gain a small shield. Prereqs: [C_A3]
- C_A8 — Purist: Heals remove minor debuffs automatically. Prereqs: [C_A3,C_P4]
- C_A9 — Sanctuary: Small reduction to incoming damage while casting. Prereqs: [C_A6]
- C_A10 — Blessed Bonds: Heals slightly scale with target's missing HP. Prereqs: [C_A5]
- C_A11 — Reverent: Increased effectiveness of resurrection and revive. Prereqs: [C_A2]
- C_A12 — Channeler: Small mana transfer to allies on spellcast. Prereqs: [C_A2]
- C_A13 — Anti-Undead Training: Against undead, increase damage and healing. Prereqs: [C_A1,C_P8]
- C_A14 — Purging Light: Passive small periodic purge to allies. Prereqs: [C_A8]
- C_A15 — Divine Focus: Slight reduction to skill cooldowns. Prereqs: [C_A3]
- C_A16 — Shepherd: Slightly increase ally XP gain and resource find. Prereqs: [C_A10]

---

Notes on DAG wiring and archetype maps
- Many primary skills form multiple small chains that converge into high-impact ultimates (e.g., W_P15 and W_P16). This encourages players to pick paths and combine nodes.
- Secondary skills branch off primary nodes and sometimes require two primaries to unlock, creating build crossroads and offering multi-path synergy.
- Passives support archetypes: tanks get more survivability nodes near W_A1..W_A4; berserker-style damage passives cluster at W_A5..W_A8; warlord/support passives sit at W_A10..W_A16.
- Some skills have multiple prerequisites (e.g., `M_P14` requires fire and ice mastery inputs), forming true DAG merges rather than simple trees.

If you'd like, I can next:
- Convert this DAG into a visual graph (Mermaid) and embed it into `doc/game-design/skills.md`.
- Produce BRL/IR-friendly skill metadata stubs for each skill ID to ease implementation.

## Metrics & Leaderboard

Beyond a single numeric score, the client should display additional persistent metrics to help players understand performance and progression. These metrics are recorded in the browser `localStorage` leaderboard alongside the existing `score` value.

- **Kills:** Total number of enemy kills during a run/encounter/session.
- **Party Deaths / Retreats:** Number of times party members died and number of manual or automatic retreats/flees (separate counters).
- **Average DPS (last 10 encounters):** Rolling average DPS computed from the most recent up to 10 completed encounters. DPS for an encounter = total damage dealt by the party / encounter duration (seconds). The average is the mean of the last N encounter DPS values where N <= 10.

Suggested `localStorage` schema (single leaderboard key storing an array of entries):

{
	"leaderboard": [
		{
			"timestamp": 1670000000000,
			"playerId": "player123",
			"score": 12345,
			"kills": 42,
			"partyDeaths": 3,
			"retreats": 1,
			"avgDPS": 256.7,
			"encounters": 37
		}
	]
}

Implementation notes:
- Emit a high-level `EncounterEnd` event from the simulation containing `{ damageDone, durationSeconds, kills, partyDeaths, retreats }` for each encounter.
- On the client, maintain a sliding array of the last 10 `damageDone/durationSeconds` values per player; compute `avgDPS = sum(values)/values.length` and store that value in the leaderboard entry.
- Update the leaderboard entry after each encounter/run save. Include both the raw counters (`kills`, `partyDeaths`, `retreats`) and the computed `avgDPS` for display and sorting.

UI notes:
- Show the new metrics in the leaderboard row: `Score | Kills | Deaths / Retreats | Avg DPS`.
- Allow sorting by `score` (default) and optionally by `avgDPS` or `kills`.
- Provide a tooltip or small help icon explaining that `Avg DPS` is computed over the last up to 10 encounters.

If you want, I can also:
- Add a short client-side code snippet showing how to maintain the last-10 sliding window and persist the leaderboard to `localStorage`.
- Create a leaderboard UI mockup (simple HTML/CSS) and a tiny script to demo saving/loading these metrics.

