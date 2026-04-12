# Skills — Game Design

This document covers hero and enemy skills: categories, triggering, cooldown management, the components needed to represent skills in the simulation, and the full class skill tree definitions.

## Design Goals

- Skills are the primary source of strategic depth in the otherwise automatic combat.
- Skills are **chosen** by the hero's/enemy's bound choice function (`select_combat_skill`), not randomly.
- A skill may be **active** (fired on demand), **passive** (always-on modifier), or **triggered** (fires automatically on a condition).
- Skills consume mana or require a cooldown; the simulation enforces these constraints.
- Each skill may apply one or more **status effects** (see [status-effects.md](status-effects.md)).
- Trait-driven skill selection ensures that two heroes of the same class with different traits develop meaningfully different builds.

---

## System Overview

| Parameter | Value |
|-----------|-------|
| Trees per class | 3 (Primary, Secondary, Passive) |
| Skills per tree | 12 |
| Skills per class | 36 |
| Total skills (6 classes) | 216 |
| Max skill level | 5 |
| Skill points per character level | 1 |
| Character max level | 50 |
| Total skill points available | 50 |
| Total possible investment per class | 180 (36 × 5) |

With 50 skill points and 180 possible investment per class, heroes invest in roughly 28% of their class's full potential, creating strong specialisation driven by traits.

---

## Skill Categories

### Active Skills
Fired by the entity's AI decision function. Costs mana and has a cooldown.

| Trigger | Example |
|---------|---------|
| On the entity's own turn (replaces basic attack) | Power Strike, Frost Bolt |
| When an ally is below a HP threshold | Heal, Lay on Hands |
| When a specific enemy skill is detected | Dispel |

### Passive Skills
Always active; modify stats or rules without an event trigger.

| Effect type | Example |
|-------------|---------|
| Stat modifier | +10% critChance (Eagle Eye) |
| Damage type bonus | +20% elemental damage (Elemental Affinity) |
| On-hit proc | Chance to apply Bleeding on every basic attack |

### Triggered Skills
Fire automatically when a specific event occurs in combat.

| Trigger | Example |
|---------|---------|
| On near-death (HP < 25%) | Last Stand (damage buff) |
| On ally death | Resurrection (revive ally) |
| On crit received | Shadow Cloak (become untargetable) |

---

## Skill Level Scaling

Each skill can be leveled from 1 to 5 by spending 1 skill point per level. Higher levels improve the skill's effect:

| Level | Typical scaling |
|-------|----------------|
| L1 | Base effect — the skill is usable |
| L2 | +20% numeric scaling (damage, healing, duration, etc.) |
| L3 | +20% further scaling |
| L4 | +20% further scaling |
| L5 | +20% further scaling + **bonus effect** (additional proc, extended duration, secondary effect) |

**Examples:**
- An active dealing 150% damage at L1 deals 230% at L5 and gains a minor stun.
- A passive granting +5% crit at L1 grants +13% crit at L5 and adds +10% crit damage.
- A heal restoring 80 HP at L1 restores 160 HP at L5 and also cleanses 1 debuff.

The L5 bonus effect is unique to each skill and described in the skill tables below.

---

## Skill Point Economy & Selection

At each level-up the hero gains **1 skill point**. The point is spent on the highest-scoring unlocked, affordable skill from the class DAG.

### Candidate filtering

A skill `s` is a valid candidate if:
- All prerequisite skills in the DAG have been acquired (level ≥ 1), **and**
- The skill's current level is below 5, **and**
- At least 1 skill point is available.

### Scoring

Each skill carries a **trait affinity profile** `A[s]` — a sparse list of `(trait_field, coefficient)` pairs. Coefficients are signed floats in [−1.0, +1.0].

```
score(s) = sum_t( A[s][t] × w_t ) + gaussian(0, 0.15)
```

- `w_t` is the normalised weight for trait axis `t` (see [`character-traits.md`](character-traits.md)).
- The Gaussian noise term (σ = 0.15) prevents fully deterministic builds while keeping trait influence dominant.
- When a skill is already acquired, its score is multiplied by `0.8^current_level` to gently discourage over-investing in a single skill when other skills are available, while still allowing maxing out strongly preferred skills.

The hero acquires/upgrades the skill `s* = argmax score(s)` over all valid candidates.

### Affinity coefficient conventions

| Coefficient | Meaning |
|-------------|---------|
| +1.0  | Strongly drawn by the trait's positive (second) pole |
| +0.5  | Moderately drawn by the trait's positive pole |
| −0.5  | Moderately drawn by the trait's negative (first) pole |
| −1.0  | Strongly drawn by the trait's negative pole |

A **positive coefficient for trait_pm** (physical–magical axis) means the skill is strongly preferred by magical-leaning heroes; a **negative coefficient** means physical-leaning heroes prefer it.

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

## Class Skill Trees (DAGs)

Below are the six class skill trees. Each class contains 36 skills organized into three DAGs: 12 Primary (core actives), 12 Secondary (utility/situational), and 12 Passive (always-on modifiers). Each skill lists its type, prerequisites, effect at L1 and L5 bonus, and orienting trait poles.

Notation: IDs use `<ClassPrefix>_P#` for Primary, `<ClassPrefix>_S#` for Secondary, `<ClassPrefix>_A#` for Passive. Class prefixes: W (Warrior), M (Mage), RN (Ranger), PA (Paladin), R (Rogue), C (Cleric).

---

### Warrior

Archetypes: **Defender** (tank/party guardian), **Berserker** (high damage), **Warlord** (party buffs and control).

#### Primary Skills (W_P1–W_P12)

```
W_P1 ──┬── W_P3 ── W_P7
       ├── W_P4 ── W_P6 ── W_P9
       └── (via W_P3) W_P7
W_P2 ──┬── W_P5 ──┬── W_P10
       └── W_P8   └── W_P11 ── W_P12
                       ↑
W_P8 ──────────────────┘
```

| ID | Name | Type | Prereqs | Effect (L1 → L5 bonus) | Trait Orientation |
|----|------|------|---------|------------------------|-------------------|
| W_P1 | Power Strike | Active | — | Deal 150% weapon damage to one target → 230%; L5: +15% armor penetration | physical, attacker, offensive, melee |
| W_P2 | Taunt | Active | — | Force all enemies to target warrior for 3s, gain +10 DEF → 5s, +25 DEF; L5: taunted enemies deal −10% damage | defensive, melee, honorable |
| W_P3 | Shield Bash | Active | W_P1 | Deal 100% damage + Stun 1s → 140% + Stun 2s; L5: stunned target takes +15% damage from all sources | physical, melee, attacker, focus |
| W_P4 | Cleaving Blow | Active | W_P1 | Deal 80% damage to all enemies → 130%; L5: reduce hit targets' DEF by 5 for 3s | area, physical, offensive, attacker |
| W_P5 | Defensive Stance | Active | W_P2 | Gain +20 DEF for 5s → +40 DEF for 7s; L5: also grant +10 DEF to adjacent allies | defensive, absorb, cautious, melee |
| W_P6 | Rampage | Active | W_P4 | Deal 3 hits of 60% damage (180% total) → 3 hits of 90% (270%); L5: each hit has +10% crit chance | risky, attacker, offensive, physical |
| W_P7 | Furious Charge | Active | W_P3 | Gap-close + 120% damage + knockdown 1s → 180% + knockdown 2s; L5: +20% damage if target was stunned | risky, melee, attacker, offensive |
| W_P8 | War Cry | Active | W_P2 | +10% damage to all allies for 6s → +20% for 10s; L5: also grants +5% crit chance | supportive, area, honorable |
| W_P9 | Execute | Active | W_P6 | Deal 200% damage to targets below 20% HP → 300%; L5: threshold raised to 30% HP | attacker, offensive, focus, physical |
| W_P10 | Last Stand | Triggered | W_P5 | At <25% HP: gain +30 DEF and +20% damage for 4s → +60 DEF and +40% damage for 6s; L5: also heal 10% max HP | defensive, cautious, absorb |
| W_P11 | Shield Wall | Active | W_P5, W_P8 | Grant 30 absorb shield to all allies → 60 absorb; L5: shield reflects 15% damage back to attackers | defensive, absorb, supportive, cautious |
| W_P12 | Warlord's Command | Active | W_P8, W_P11 | Reduce all ally cooldowns by 2s + 15% attack speed for 6s → 4s reduction + 25% speed for 10s; L5: also restores 10% ally mana | supportive, order, honorable, area |

#### Secondary Skills (W_S1–W_S12)

```
W_S1 ──┬── W_S3 ── W_S7
       ├── W_S4 ── W_S6 ── W_S10
       └── W_S5 ────────────┐
W_S2 ── W_S9                │
        W_S5, W_S7 → W_S11  │
        W_S8, W_S10 → W_S12 │
W_S4 ── W_S8 ───────────────┘
```

| ID | Name | Type | Prereqs | Effect (L1 → L5 bonus) | Trait Orientation |
|----|------|------|---------|------------------------|-------------------|
| W_S1 | Shield Throw | Active | — | Ranged 60% damage + taunt 2s → 100% + taunt 4s; L5: bounces to a second target | defensive, range |
| W_S2 | Rally | Active | — | Heal all allies for 20 HP → 40 HP; L5: also removes 1 debuff per ally | supportive, honorable |
| W_S3 | Riposte | Active | W_S1 | Counter next attack for 120% damage → 180%; L5: counter window lasts 3 additional seconds | defensive, cautious, melee, absorb |
| W_S4 | Body Slam | Active | W_S1 | Interrupt + 80% damage → 130%; L5: interrupted skills go on +3s additional cooldown | melee, attacker, offensive |
| W_S5 | Fortify Armor | Active | W_S1 | +30 armor for 4s → +60 armor for 7s; L5: also grants +15 magic resistance | defensive, absorb, cautious, earth |
| W_S6 | Disarm | Active | W_S4 | Reduce enemy damage by 25% for 4s → 40% for 6s; L5: also reduce enemy attack speed by 15% | sly, chaos, offensive |
| W_S7 | Knockback Shield | Active | W_S3 | Push enemies back + 70% damage → 120%; L5: knocked enemies are slowed 20% for 3s | defensive, absorb |
| W_S8 | Intimidate | Active | W_S4 | Reduce enemy crit chance by 20% for 5s → 35% for 8s; L5: also reduce enemy damage by 10% | defensive, honorable |
| W_S9 | Marching Orders | Active | W_S2 | +10% attack speed for all allies for 5s → +20% for 8s; L5: also grants +5% dodge | supportive, order, area |
| W_S10 | Unstoppable | Active | W_S6 | Immune to CC for 3s → 5s; L5: also remove all current CC effects when activated | risky, melee, attacker |
| W_S11 | Guarded Assault | Active | W_S5, W_S7 | While shielded: +25% damage for 5s → +45% for 8s; L5: attacks while active restore 5 shield per hit | defensive, absorb, attacker |
| W_S12 | Earthshaker | Active | W_S8, W_S10 | AoE 100% damage + stagger 1s to all enemies → 160% + 2s; L5: creates a slow field for 4s | area, physical, earth |

#### Passive Skills (W_A1–W_A12)

```
W_A1 ──┬── W_A3 ──┬── W_A6 ── W_A10
       └── W_A4   └── W_A8
W_A2 ── W_A5 ── W_A7
W_A3, W_A4 → W_A9
W_A4, W_A9 → W_A11
W_A9, W_A10 → W_A12
```

| ID | Name | Type | Prereqs | Effect (L1 → L5 bonus) | Trait Orientation |
|----|------|------|---------|------------------------|-------------------|
| W_A1 | Heavy Armor Training | Passive | — | +5% max HP → +13%; L5: also +3 flat DEF | defensive, absorb, earth |
| W_A2 | Brutal Strikes | Passive | — | +8% melee crit damage → +20%; L5: crits have 15% chance to apply Bleeding (1 stack) | physical, attacker, inflict |
| W_A3 | Shield Mastery | Passive | W_A1 | +5% block chance → +13%; L5: successful blocks restore 3% max HP | defensive, absorb, cautious |
| W_A4 | Toughness | Passive | W_A1 | +2 HP regen/s → +6; L5: regen doubles when below 40% HP | defensive, cautious, earth |
| W_A5 | Stamina | Passive | W_A2 | −8% skill mana cost → −20%; L5: skills that cost 0 mana deal +10% damage | risky, attacker |
| W_A6 | Fortitude | Passive | W_A3 | +10% CC resistance → +26%; L5: CC effects on warrior have −1s duration | defensive, cautious, order |
| W_A7 | Momentum | Passive | W_A5 | Consecutive hits grant +3% damage per stack (max 5) → +6% per stack; L5: stacks persist 2s longer | risky, attacker, physical |
| W_A8 | Hardened | Passive | W_A3 | Reduce incoming crit damage by 10% → 26%; L5: chance to negate crits entirely (8%) | defensive, cautious, absorb |
| W_A9 | Bulwark | Passive | W_A3, W_A4 | While taunting: +8 extra armor → +20; L5: taunted enemies have −10% attack speed | defensive, absorb, melee |
| W_A10 | Iron Will | Passive | W_A6 | +15% resistance to fear/petrify → +35%; L5: upon resisting, gain +10% damage for 3s | defensive, order, cautious |
| W_A11 | Second Wind | Passive | W_A4, W_A9 | At <30% HP once per encounter: heal 15% max HP → 30%; L5: also gain a 20 absorb shield | defensive, cautious, absorb |
| W_A12 | Battle Leader | Passive | W_A9, W_A10 | All allies gain +3% XP and +2% damage → +8% XP and +5% damage; L5: allies also gain +3% crit chance | supportive, honorable, order |

#### Warrior — Trait Affinity Coefficients

| Skill | pm | od | sa | rc | fw | we | ld | co | sh | rm | ai | af |
|-------|-----|-----|-----|-----|-----|-----|-----|-----|-----|-----|-----|-----|
| W_P1 | −0.8 | −0.6 | +0.7 | | | | | | | +0.5 | | |
| W_P2 | | +0.8 | | | | | | | +0.5 | +0.6 | | |
| W_P3 | −0.6 | | +0.5 | | | | | | | +0.7 | | +0.5 |
| W_P4 | −0.5 | −0.6 | +0.6 | | | | | | | | | −0.8 |
| W_P5 | | +0.8 | | +0.6 | | | | | | +0.4 | −0.7 | |
| W_P6 | −0.5 | −0.7 | +0.8 | −0.7 | | | | | | | | |
| W_P7 | | −0.6 | +0.6 | −0.7 | | | | | | +0.8 | | |
| W_P8 | | | −0.7 | | | | | | +0.5 | | | −0.6 |
| W_P9 | −0.5 | −0.8 | +0.8 | | | | | | | | | +0.6 |
| W_P10 | | +0.8 | | +0.7 | | | | | | | −0.8 | |
| W_P11 | | +0.7 | −0.6 | +0.6 | | | | | | | −0.7 | |
| W_P12 | | | −0.8 | | | | | +0.7 | +0.6 | | | −0.5 |
| W_S1 | | +0.6 | | | | | | | | −0.5 | | |
| W_S2 | | | −0.7 | | | | | | +0.6 | | | |
| W_S3 | | +0.6 | | +0.5 | | | | | | +0.5 | −0.6 | |
| W_S4 | | −0.5 | +0.6 | | | | | | | +0.7 | | |
| W_S5 | | +0.6 | | +0.5 | | +0.5 | | | | | −0.7 | |
| W_S6 | | −0.5 | | | | | | −0.5 | −0.6 | | | |
| W_S7 | | +0.5 | | | | | | | | | −0.6 | |
| W_S8 | | +0.5 | | | | | | | +0.6 | | | |
| W_S9 | | | −0.6 | | | | | +0.5 | | | | −0.5 |
| W_S10 | | | +0.5 | −0.7 | | | | | | +0.6 | | |
| W_S11 | | +0.5 | +0.5 | | | | | | | | −0.6 | |
| W_S12 | −0.5 | | | | | +0.6 | | | | | | −0.7 |
| W_A1 | | +0.6 | | | | +0.5 | | | | | −0.7 | |
| W_A2 | −0.6 | | +0.7 | | | | | | | | +0.5 | |
| W_A3 | | +0.7 | | +0.5 | | | | | | | −0.6 | |
| W_A4 | | +0.5 | | +0.6 | | +0.5 | | | | | | |
| W_A5 | | | +0.5 | −0.6 | | | | | | | | |
| W_A6 | | +0.6 | | +0.5 | | | | +0.5 | | | | |
| W_A7 | −0.5 | | +0.6 | −0.6 | | | | | | | | |
| W_A8 | | +0.6 | | +0.5 | | | | | | | −0.5 | |
| W_A9 | | +0.6 | | | | | | | | +0.5 | −0.7 | |
| W_A10 | | +0.5 | | +0.5 | | | | +0.6 | | | | |
| W_A11 | | +0.7 | | +0.6 | | | | | | | −0.5 | |
| W_A12 | | | −0.7 | | | | | +0.5 | +0.6 | | | |

---

### Mage

Archetypes: **Pyromancer** (burst AoE fire), **Cryomancer** (control/debuff), **Arcanist** (utility & scaling).

#### Primary Skills (M_P1–M_P12)

```
M_P1 ──┬── M_P3 ──┬── M_P6 ──┐
       │          └── M_P9    ├── M_P11
       └── M_P4 ── M_P7      │
                    ↓         │
M_P2 ── M_P5 ── M_P8        │
         ↓                    │
M_P4, M_P7 → M_P10          │
M_P6, M_P9 → M_P11          │
M_P6, M_P8 → M_P12          │
```

| ID | Name | Type | Prereqs | Effect (L1 → L5 bonus) | Trait Orientation |
|----|------|------|---------|------------------------|-------------------|
| M_P1 | Magic Missile | Active | — | Deal 110% magic damage to one target → 170%; L5: fires 2 missiles | magical, focus, attacker |
| M_P2 | Frost Bolt | Active | — | Deal 100% magic damage + apply Frozen 2s → 150% + 3s; L5: +25% damage vs Frozen targets | magical, water, focus, cautious |
| M_P3 | Fireball | Active | M_P1 | Deal 90% AoE fire damage + Burning 3s → 150%; L5: Burning spreads to adjacent enemies | magical, fire, area, attacker |
| M_P4 | Arcane Missiles | Active | M_P1 | Channel 4 hits of 35% magic damage (140% total) → 4×55% (220%); L5: each hit restores 2% mana | magical, attacker, focus |
| M_P5 | Blizzard | Active | M_P2 | Deal 60% per second for 4s to all enemies + slow → 100%/s; L5: 20% chance per tick to Freeze | magical, water, area, cautious |
| M_P6 | Meteor | Active | M_P3 | Deal 200% AoE fire damage (1s delay) → 320%; L5: impact zone burns for 4s (Burning) | magical, fire, area, risky |
| M_P7 | Mana Shield | Active | M_P4 | Absorb next 40 damage as mana drain → 80; L5: excess mana converts to a 20 HP heal | magical, absorb, defensive, cautious |
| M_P8 | Ice Prison | Active | M_P5 | Root single target for 3s → 5s; L5: rooted target takes +20% damage from all sources | magical, water, focus, order |
| M_P9 | Combustion | Active | M_P3 | +30% fire damage for 6s → +50% for 10s; L5: fire spells trigger 50% bonus explosion | magical, fire, attacker, chaos |
| M_P10 | Arcane Beam | Active | M_P4, M_P7 | Channel piercing beam 180% damage/s for 3s → 280%/s; L5: beam pierces through to a second target | magical, focus, attacker |
| M_P11 | Cataclysm | Active | M_P6, M_P9 | Deal 250% AoE to all enemies → 400%; L5: applies Burning 5s and reduces enemy magic resist by 20% | magical, fire, area, risky |
| M_P12 | Elemental Mastery | Active | M_P6, M_P8 | Toggle: enhance chosen element by +25% → +45%; L5: switching elements triggers a free elemental burst | magical, order, cautious |

#### Secondary Skills (M_S1–M_S12)

```
M_S1 ──┬── M_S3 ── M_S6
       ├── M_S4 ── M_S7
       └── M_S5 ── M_S9
M_S2 ── M_S8
M_S4 → M_S10
M_S6, M_S3 → M_S11
M_S7, M_S9 → M_S12
```

| ID | Name | Type | Prereqs | Effect (L1 → L5 bonus) | Trait Orientation |
|----|------|------|---------|------------------------|-------------------|
| M_S1 | Mana Bolt | Active | — | Deal 70% magic damage, low mana cost → 110%; L5: refunds mana cost if target dies | magical, focus, attacker |
| M_S2 | Spell Ward | Active | — | +15 magic resist for 5s → +30 for 8s; L5: ward reflects 10% spell damage | magical, absorb, cautious |
| M_S3 | Frost Nova | Active | M_S1 | Stun all enemies in small radius for 1s → 2s; L5: +30% damage to stunned targets | magical, water, area |
| M_S4 | Blink | Active | M_S1 | Teleport short distance + 80% damage on arrival → 130%; L5: leaves a decoy at origin for 2s | sly, risky, range, magical |
| M_S5 | Ignite | Active | M_S1 | Apply Burning (8 dmg/s for 3s) → 16 dmg/s for 5s; L5: Burning targets take +10% spell damage | magical, fire, inflict |
| M_S6 | Silence | Active | M_S3 | Prevent enemy casting for 2s → 4s; L5: silenced enemy takes 60% magic damage | magical, order, cautious, focus |
| M_S7 | Arcane Echo | Active | M_S4 | Repeat last spell at 50% power → 75%; L5: echo spell costs no mana | magical, chaos, attacker |
| M_S8 | Mana Beacon | Active | M_S2 | Restore 15 mana to all allies → 30; L5: also grants +10% spell power for 4s | supportive, magical, light |
| M_S9 | Heat Wave | Active | M_S5 | Push enemies + reduce accuracy 15% for 3s → 30% for 5s; L5: also applies Burning 2s | magical, fire, area, chaos |
| M_S10 | Precision Channel | Active | M_S4 | +20% cast speed for 5s → +40% for 8s; L5: next spell after buff is guaranteed crit | magical, focus, cautious |
| M_S11 | Slowfield | Active | M_S6, M_S3 | Create slow field: −25% enemy speed for 5s → −40% for 8s; L5: enemies in field take 30 frost damage/s | magical, water, area, cautious |
| M_S12 | Spark Chain | Active | M_S7, M_S9 | Lightning arc hits 3 enemies for 80% damage → 5 enemies for 130%; L5: chains stun each target 0.5s | magical, wind, area |

#### Passive Skills (M_A1–M_A12)

```
M_A1 ──┬── M_A3 ──┬── M_A6
       │          └── M_A7
       └── M_A4 ──┬── M_A8
                   └── M_A9
M_A2 ── M_A5
M_A4, M_A5 → M_A11
M_A8 → M_A10
M_A10, M_A9 → M_A12
```

| ID | Name | Type | Prereqs | Effect (L1 → L5 bonus) | Trait Orientation |
|----|------|------|---------|------------------------|-------------------|
| M_A1 | Scholar | Passive | — | +5% max mana and +3% spell damage → +13% mana and +8% damage; L5: +2 mana regen/s | magical, cautious |
| M_A2 | Quick Cast | Passive | — | −5% cast time → −13%; L5: 10% chance to instant-cast spells | magical, risky, attacker |
| M_A3 | Elemental Affinity | Passive | M_A1 | +5% fire and frost spell damage → +13%; L5: elemental spells cost 10% less mana | magical, fire, water |
| M_A4 | Mana Regen | Passive | M_A1 | +2 mana/s → +6; L5: regen doubles when mana < 30% | magical, cautious |
| M_A5 | Spell Precision | Passive | M_A2 | +4% spell crit chance → +12%; L5: spell crits deal +20% bonus damage | magical, focus, attacker |
| M_A6 | Pyromania | Passive | M_A3 | +10% Burning damage and +1s duration → +26% and +3s; L5: kills on Burning targets trigger explosion | magical, fire, inflict, risky |
| M_A7 | Cryostasis | Passive | M_A3 | +10% freeze chance and +0.5s duration → +26% and +1.5s; L5: Frozen targets take +15% damage | magical, water, order, cautious |
| M_A8 | Arcane Reservoir | Passive | M_A4 | When mana > 80%: +5% spell damage → +13%; L5: overflow mana grants a 15 absorb shield | magical, cautious, order |
| M_A9 | Mana Efficiency | Passive | M_A4 | −5% mana cost for non-ultimate spells → −13%; L5: free spell proc chance (5%) | magical, cautious, order |
| M_A10 | Conduit | Passive | M_A8 | 8% chance spells refund 1s cooldown → 20%; L5: refunded spells deal +10% damage | magical, chaos, attacker |
| M_A11 | Arcane Armor | Passive | M_A4, M_A5 | Gain absorb shield equal to 3% max mana → 8%; L5: shield regenerates every 10s | magical, absorb, defensive |
| M_A12 | Spellweaver | Passive | M_A10, M_A9 | All allies gain +3% spell power → +8%; L5: party also gains +2 mana regen/s | supportive, magical, order, honorable |

#### Mage — Trait Affinity Coefficients

| Skill | pm | od | sa | rc | fw | we | ld | co | sh | rm | ai | af |
|-------|-----|-----|-----|-----|-----|-----|-----|-----|-----|-----|-----|-----|
| M_P1 | +0.7 | | +0.5 | | | | | | | | | +0.6 |
| M_P2 | +0.7 | | | +0.5 | +0.8 | | | | | | | +0.5 |
| M_P3 | +0.7 | | +0.6 | | −0.8 | | | | | | | −0.7 |
| M_P4 | +0.7 | | +0.6 | | | | | | | | | +0.5 |
| M_P5 | +0.7 | | | +0.5 | +0.8 | | | | | | | −0.6 |
| M_P6 | +0.7 | | | −0.6 | −0.8 | | | | | | | −0.7 |
| M_P7 | +0.6 | +0.5 | | +0.6 | | | | | | | −0.7 | |
| M_P8 | +0.7 | | | | +0.7 | | | +0.5 | | | | +0.6 |
| M_P9 | +0.7 | | +0.6 | | −0.8 | | | −0.6 | | | | |
| M_P10 | +0.7 | | +0.6 | | | | | | | | | +0.7 |
| M_P11 | +0.8 | | | −0.6 | −0.8 | | | | | | | −0.7 |
| M_P12 | +0.7 | | | +0.5 | | | | +0.6 | | | | |
| M_S1 | +0.5 | | +0.5 | | | | | | | | | +0.5 |
| M_S2 | +0.5 | | | +0.5 | | | | | | | −0.6 | |
| M_S3 | +0.6 | | | | +0.6 | | | | | | | −0.6 |
| M_S4 | +0.5 | | | −0.5 | | | | | −0.5 | −0.5 | | |
| M_S5 | +0.6 | | | | −0.7 | | | | | | +0.5 | |
| M_S6 | +0.6 | | | +0.5 | | | | +0.5 | | | | +0.5 |
| M_S7 | +0.6 | | +0.5 | | | | | −0.6 | | | | |
| M_S8 | +0.5 | | −0.6 | | | | −0.5 | | | | | |
| M_S9 | +0.6 | | | | −0.6 | | | −0.5 | | | | −0.5 |
| M_S10 | +0.6 | | | +0.5 | | | | | | | | +0.5 |
| M_S11 | +0.6 | | | +0.5 | +0.6 | | | | | | | −0.6 |
| M_S12 | +0.6 | | | | | −0.5 | | | | | | −0.5 |
| M_A1 | +0.6 | | | +0.5 | | | | | | | | |
| M_A2 | +0.5 | | +0.5 | −0.5 | | | | | | | | |
| M_A3 | +0.6 | | | | −0.5 | | | | | | | |
| M_A4 | +0.5 | | | +0.6 | | | | | | | | |
| M_A5 | +0.6 | | +0.5 | | | | | | | | | +0.5 |
| M_A6 | +0.6 | | | −0.5 | −0.8 | | | | | | +0.5 | |
| M_A7 | +0.6 | | | +0.6 | +0.8 | | | +0.5 | | | | |
| M_A8 | +0.5 | | | +0.6 | | | | +0.5 | | | | |
| M_A9 | +0.5 | | | +0.6 | | | | +0.5 | | | | |
| M_A10 | +0.6 | | +0.5 | | | | | −0.6 | | | | |
| M_A11 | +0.6 | +0.5 | | | | | | | | | −0.5 | |
| M_A12 | +0.6 | | −0.5 | | | | | +0.5 | +0.5 | | | |

---

### Ranger

Archetypes: **Sharpshooter** (precision single-target), **Skirmisher** (speed/mobility/AoE), **Beastmaster** (DoT/utility/support).

#### Primary Skills (RN_P1–RN_P12)

```
RN_P1 ──┬── RN_P3 ── RN_P6 ── RN_P9
         ├── RN_P4 ── RN_P8
         └── RN_P5 ── RN_P7 ── RN_P10
RN_P2 (root)
RN_P6, RN_P9 → RN_P11
RN_P7, RN_P5 → RN_P12
```

| ID | Name | Type | Prereqs | Effect (L1 → L5 bonus) | Trait Orientation |
|----|------|------|---------|------------------------|-------------------|
| RN_P1 | Aimed Shot | Active | — | Deal 200% damage to one target → 300%; L5: guaranteed crit if target is above 80% HP | range, attacker, focus |
| RN_P2 | Evade | Active | — | Gain 30% dodge for 3s → 50% for 5s; L5: next attack after Evade deals +30% damage | risky, range, wind |
| RN_P3 | Multi Shot | Active | RN_P1 | Hit 3 enemies for 60% damage each → 3 for 100%; L5: hits up to 5 enemies | range, area, attacker |
| RN_P4 | Poison Arrow | Active | RN_P1 | Deal 80% damage + apply 3 Poisoned stacks → 130% + 5 stacks; L5: poison ticks 20% faster | range, sly, inflict |
| RN_P5 | Rapid Fire | Active | RN_P1 | Fire 4 shots of 70% damage in 2s → 4×110%; L5: each shot has +5% crit chance | range, risky, attacker |
| RN_P6 | Volley | Active | RN_P3 | Rain arrows: 50% damage to all enemies → 90%; L5: arrows slow targets 15% for 2s | range, area, attacker, offensive |
| RN_P7 | Sniper Shot | Active | RN_P5 | Deal 300% single-target damage (long channel) → 450%; L5: ignores 30% armor | range, focus, cautious, attacker |
| RN_P8 | Ensnaring Shot | Active | RN_P4 | Root target for 2s + 80% damage → 4s + 130%; L5: rooted target takes +20% damage | range, cautious, order |
| RN_P9 | Barrage | Active | RN_P6 | 5 rapid AoE shots of 40% damage → 5×70%; L5: each hit reduces enemy DEF by 2 | range, area, offensive, risky |
| RN_P10 | Kill Shot | Active | RN_P7 | Deal 350% to one target → 530%; L5: instant kill if target below 10% HP | range, focus, attacker, offensive |
| RN_P11 | Arrow Storm | Active | RN_P6, RN_P9 | Ultimate AoE: 180% to all enemies → 300%; L5: applies Bleeding 3s to all targets | range, area, risky, attacker |
| RN_P12 | Hawk's Fury | Active | RN_P7, RN_P5 | +30% attack speed and +20% damage for 6s → +50% speed and +35% damage for 10s; L5: all attacks pierce armor by 15% | range, attacker, focus, risky |

#### Secondary Skills (RN_S1–RN_S12)

```
RN_S1 ──┬── RN_S3 ── RN_S8
         └── RN_S6
RN_S2 ──┬── RN_S4 ── RN_S7
         └── RN_S5 ── RN_S10 (standalone)
RN_S3, RN_S8 → RN_S9
RN_S7, RN_S9 → RN_S12
RN_S6 → RN_S11
```

| ID | Name | Type | Prereqs | Effect (L1 → L5 bonus) | Trait Orientation |
|----|------|------|---------|------------------------|-------------------|
| RN_S1 | Disengage | Active | — | Leap back + 15% speed for 3s → 25% speed for 5s; L5: also gain 20% dodge for 2s | range, cautious, wind |
| RN_S2 | Hunter's Mark | Active | — | Marked target takes +10% damage from all sources for 5s → +20% for 8s; L5: mark spreads to 1 adjacent enemy on kill | range, inflict, focus |
| RN_S3 | Caltrops | Active | RN_S1 | Slow enemies in area by 20% for 4s → 35% for 6s; L5: caltrops also deal 20 damage/s | range, cautious, sly |
| RN_S4 | Concussive Shot | Active | RN_S2 | Stun one target for 1s + 70% damage → 2s + 110%; L5: stun radiates to enemies near target | range, focus, attacker |
| RN_S5 | Flare | Active | RN_S2 | Reveal stealth enemies + reduce dodge 15% for 4s → 30% for 7s; L5: flared enemies take +10% crit damage | range, order, light |
| RN_S6 | Smoke Screen | Active | RN_S1 | All allies gain 15% dodge for 4s → 25% for 7s; L5: allies also gain +10% attack speed | cautious, area, sly |
| RN_S7 | Explosive Arrow | Active | RN_S4 | 100% damage + 60% AoE splash → 160% + 100% splash; L5: splash applies Burning 2s | range, area, fire, attacker |
| RN_S8 | Serpent Sting | Active | RN_S3 | Apply enhanced Poisoned: 5 dmg/s for 6s → 10/s for 10s; L5: poison reduces target healing received by 30% | range, inflict, sly |
| RN_S9 | Net Trap | Active | RN_S3, RN_S8 | Root 1 target 3s + Poisoned 3 stacks → 5s + 5 stacks; L5: trap rearms once after triggering | range, sly, cautious, order |
| RN_S10 | Piercing Shot | Active | RN_S5 | Deal 150% damage ignoring 30% armor → 230% ignoring 50%; L5: shot passes through to hit a second target | range, focus, attacker, physical |
| RN_S11 | Camouflage | Active | RN_S6 | Enter stealth for 3s + regen 3 HP/s → 5s + 6 HP/s; L5: first attack from stealth deals +50% damage | cautious, sly, range |
| RN_S12 | Rain of Thorns | Active | RN_S7, RN_S9 | AoE 120% damage + slow 25% for 4s → 200% + slow 40% for 7s; L5: also applies 3 stacks Poisoned | range, area, inflict |

#### Passive Skills (RN_A1–RN_A12)

```
RN_A1 ──┬── RN_A3 ──┬── RN_A6 ── RN_A9
         │          └── RN_A8
         └── RN_A4 ── RN_A7
RN_A2 ── RN_A5
RN_A6, RN_A7 → RN_A10
RN_A7, RN_A5 → RN_A11
RN_A9, RN_A10 → RN_A12
```

| ID | Name | Type | Prereqs | Effect (L1 → L5 bonus) | Trait Orientation |
|----|------|------|---------|------------------------|-------------------|
| RN_A1 | Eagle Eye | Passive | — | +4% crit chance → +12%; L5: crits deal +15% bonus damage | range, risky, focus |
| RN_A2 | Survival Training | Passive | — | +5% max HP + poison immunity → +13% HP; L5: also immune to Bleeding | defensive, earth, cautious |
| RN_A3 | Marksman | Passive | RN_A1 | Consecutive hits on same target: +4% damage per stack (max 5) → +10%; L5: at max stacks, guaranteed crit | range, focus, attacker |
| RN_A4 | Fleet Footed | Passive | RN_A1 | +5% attack speed → +13%; L5: dodging an attack grants +10% speed for 2s | range, wind, risky |
| RN_A5 | Nature's Resilience | Passive | RN_A2 | +2 HP regen/s + 15% DoT resistance → +6 regen + 35%; L5: immune to slow effects | defensive, earth, cautious |
| RN_A6 | Sharpshooter | Passive | RN_A3 | +5% ranged damage → +13%; L5: ranged attacks have +8% armor penetration | range, focus, attacker |
| RN_A7 | Wind Runner | Passive | RN_A4 | +4% dodge chance → +12%; L5: successful dodge grants a free instant attack | range, wind, risky |
| RN_A8 | Steady Aim | Passive | RN_A3 | Reduce attack speed penalty from moving by 15% → 35%; L5: standing still for 2s grants +15% damage | range, cautious, focus |
| RN_A9 | Lethal Momentum | Passive | RN_A6 | On kill: reset 1 random skill cooldown → guaranteed; L5: kills also grant +15% damage for 3s | range, attacker, risky, offensive |
| RN_A10 | Predator's Instinct | Passive | RN_A6, RN_A7 | +10% damage to targets below 40% HP → +26%; L5: below-threshold targets are highlighted (can't stealth) | range, attacker, focus, sly |
| RN_A11 | Ambush Mastery | Passive | RN_A7, RN_A5 | First attack each encounter deals +20% damage → +45%; L5: first attack is guaranteed crit | range, sly, risky |
| RN_A12 | Ranger Captain | Passive | RN_A9, RN_A10 | All allies gain +3% ranged/physical damage → +8%; L5: party also gains +3% crit chance | supportive, range, order |

#### Ranger — Trait Affinity Coefficients

| Skill | pm | od | sa | rc | fw | we | ld | co | sh | rm | ai | af |
|-------|-----|-----|-----|-----|-----|-----|-----|-----|-----|-----|-----|-----|
| RN_P1 | | | +0.7 | | | | | | | −0.7 | | +0.8 |
| RN_P2 | | | | −0.6 | | −0.6 | | | | −0.5 | | |
| RN_P3 | | | +0.6 | | | | | | | −0.6 | | −0.7 |
| RN_P4 | | | | | | | | | −0.6 | −0.5 | +0.6 | |
| RN_P5 | | | +0.6 | −0.6 | | | | | | −0.6 | | |
| RN_P6 | | −0.5 | +0.6 | | | | | | | −0.6 | | −0.8 |
| RN_P7 | | | +0.6 | +0.5 | | | | | | −0.7 | | +0.8 |
| RN_P8 | | | | +0.6 | | | | +0.5 | | −0.5 | | |
| RN_P9 | | −0.6 | | −0.5 | | | | | | −0.6 | | −0.7 |
| RN_P10 | | −0.7 | +0.7 | | | | | | | −0.7 | | +0.8 |
| RN_P11 | | | +0.6 | −0.6 | | | | | | −0.6 | | −0.8 |
| RN_P12 | | | +0.7 | −0.5 | | | | | | −0.7 | | +0.6 |
| RN_S1 | | | | +0.6 | | −0.5 | | | | −0.5 | | |
| RN_S2 | | | | | | | | | | −0.5 | +0.6 | +0.6 |
| RN_S3 | | | | +0.5 | | | | | −0.5 | −0.5 | | |
| RN_S4 | | | +0.5 | | | | | | | −0.5 | | +0.6 |
| RN_S5 | | | | | | | −0.5 | +0.5 | | −0.5 | | |
| RN_S6 | | | | +0.6 | | | | | −0.5 | | | −0.5 |
| RN_S7 | | | +0.6 | | −0.5 | | | | | −0.5 | | −0.5 |
| RN_S8 | | | | | | | | | −0.6 | −0.5 | +0.7 | |
| RN_S9 | | | | +0.5 | | | | +0.5 | −0.5 | −0.5 | | |
| RN_S10 | −0.5 | | +0.6 | | | | | | | −0.6 | | +0.7 |
| RN_S11 | | | | +0.7 | | | | | −0.6 | −0.5 | | |
| RN_S12 | | | | | | | | | | −0.6 | +0.6 | −0.6 |
| RN_A1 | | | | −0.5 | | | | | | −0.6 | | +0.6 |
| RN_A2 | | +0.5 | | +0.5 | | +0.5 | | | | | | |
| RN_A3 | | | +0.6 | | | | | | | −0.6 | | +0.7 |
| RN_A4 | | | | −0.5 | | −0.6 | | | | −0.5 | | |
| RN_A5 | | +0.5 | | +0.5 | | +0.6 | | | | | | |
| RN_A6 | | | +0.6 | | | | | | | −0.7 | | +0.6 |
| RN_A7 | | | | −0.5 | | −0.6 | | | | −0.5 | | |
| RN_A8 | | | | +0.5 | | | | | | −0.5 | | +0.6 |
| RN_A9 | | −0.5 | +0.5 | −0.5 | | | | | | −0.5 | | |
| RN_A10 | | | +0.6 | | | | | | −0.5 | −0.5 | | +0.6 |
| RN_A11 | | | | −0.5 | | | | | −0.6 | −0.5 | | |
| RN_A12 | | | −0.5 | | | | | +0.5 | | −0.5 | | |

---

### Paladin

Archetypes: **Holy Warrior** (damage + self-sustain), **Guardian** (party protection), **Crusader** (healing + auras).

#### Primary Skills (PA_P1–PA_P12)

```
PA_P1 ──┬── PA_P3
         └── PA_P4 ── PA_P6 ── PA_P9
PA_P2 ──┬── PA_P5 ──┬── PA_P7
                      └── PA_P8
PA_P5, PA_P7 → PA_P10
PA_P7, PA_P8 → PA_P11
PA_P9, PA_P11 → PA_P12
```

| ID | Name | Type | Prereqs | Effect (L1 → L5 bonus) | Trait Orientation |
|----|------|------|---------|------------------------|-------------------|
| PA_P1 | Holy Strike | Active | — | Deal 120% holy damage + 25% chance Blessed 5s → 180% + 50% chance; L5: Blessed also grants +10% attack speed | light, honorable, attacker, melee |
| PA_P2 | Lay on Hands | Active | — | Heal lowest-HP ally for 80 HP → 160; L5: also applies a 20 absorb shield | supportive, light, cautious |
| PA_P3 | Consecrate | Active | PA_P1 | Ground AoE: 40 holy damage/s for 5s → 70/s for 7s; L5: allies standing in area gain +5 HP regen/s | light, area, attacker, honorable |
| PA_P4 | Smite | Active | PA_P1 | Deal 140% focused holy damage → 220%; L5: marked target takes +15% holy damage for 5s | light, attacker, focus, offensive |
| PA_P5 | Divine Shield | Active | PA_P2 | Grant 20 absorb shield to all allies → 50; L5: shield explodes for 30 holy damage when broken | defensive, absorb, light, area |
| PA_P6 | Hammer of Wrath | Active | PA_P4 | Deal 160% + Stun 1s → 250% + 2s; L5: stunned target takes +20% damage from all sources | light, attacker, melee, honorable |
| PA_P7 | Aura of Protection | Passive | PA_P5 | All allies take −5% damage → −13%; L5: aura also grants +3 HP regen/s | defensive, absorb, light, supportive |
| PA_P8 | Resurrection | Triggered | PA_P2, PA_P5 | Revive 1 ally at 30% HP (once/encounter) → 60% HP; L5: revived ally gains +20% damage for 10s | supportive, light, honorable, cautious |
| PA_P9 | Judgement | Active | PA_P6 | Deal 200% holy + mark: +15% damage from all for 5s → 300% + +25% for 8s; L5: mark spreads on kill | light, attacker, honorable, offensive |
| PA_P10 | Guardian Angel | Triggered | PA_P5, PA_P7 | Auto-shield allies at <20% HP: 25 absorb (8s cd) → 50 absorb (5s cd); L5: also heals 15% max HP | absorb, defensive, cautious, light |
| PA_P11 | Sacred Beacon | Active | PA_P7, PA_P8 | Place beacon healing all allies for 4 HP/s for 10s → 8 HP/s for 15s; L5: beacon also cleanses 1 debuff every 3s | supportive, light, order, honorable |
| PA_P12 | Divine Reckoning | Active | PA_P9, PA_P11 | Deal 250% holy AoE + heal all allies for 60 → 400% + 120 heal; L5: enemies killed trigger holy explosion dealing 100 AoE | light, attacker, supportive, area |

#### Secondary Skills (PA_S1–PA_S12)

```
PA_S1 ──┬── PA_S3
         ├── PA_S5
         └── PA_S7
PA_S2 ──┬── PA_S4 ── PA_S10
         └── PA_S6
PA_S6, PA_S7 → PA_S9
PA_S5, PA_S9 → PA_S12
PA_S6 → PA_S11
PA_S4 → PA_S8
```

| ID | Name | Type | Prereqs | Effect (L1 → L5 bonus) | Trait Orientation |
|----|------|------|---------|------------------------|-------------------|
| PA_S1 | Blessing of Might | Active | — | +10% damage to one ally for 8s → +20% for 12s; L5: also grants +5% crit chance | supportive, attacker, light |
| PA_S2 | Shield of Faith | Active | — | Gain 20% damage reduction for 4s → 35% for 7s; L5: reflect 10% damage back to attackers | defensive, absorb, cautious |
| PA_S3 | Cleanse | Active | PA_S1 | Remove 1 debuff from ally → 2 debuffs; L5: cleansed ally gains +10% max HP for 5s | supportive, order, light |
| PA_S4 | Holy Warding | Active | PA_S2 | +15 magic resist for 5s → +30 for 8s; L5: ward absorbs first spell that hits for 0 damage | defensive, light, order |
| PA_S5 | Righteous Fury | Active | PA_S1 | On being hit: gain +5% damage (stacks 5×) for 5s → +10% per stack; L5: at max stacks, next attack stuns 1s | light, attacker, risky |
| PA_S6 | Sanctuary | Active | PA_S2 | All allies take −10% damage for 4s → −20% for 7s; L5: enemies in area are slowed 15% | defensive, supportive, cautious, area |
| PA_S7 | Blessing of Speed | Active | PA_S1 | +15% attack speed to one ally for 5s → +25% for 8s; L5: also grants +10% dodge | supportive, light, area |
| PA_S8 | Rebuke | Active | PA_S4 | Reflect 15% damage back for 5s → 30% for 8s; L5: reflected damage is holy and ignores resist | light, inflict, honorable |
| PA_S9 | Devotion Aura | Passive | PA_S6, PA_S7 | All allies gain +2 HP regen/s → +6; L5: aura also grants +5% damage reduction | supportive, light, honorable, area |
| PA_S10 | Turn Undead | Active | PA_S4 | Fear undead for 3s + 120% holy damage → 5s + 200%; L5: non-undead enemies take 50% of the damage | light, honorable, order, attacker |
| PA_S11 | Martyr's Sacrifice | Active | PA_S6 | Transfer 30% of target ally's incoming damage to self for 5s → 50% for 8s; L5: paladin heals 20% of damage transferred | supportive, defensive, honorable, cautious |
| PA_S12 | Crusader's Zeal | Active | PA_S5, PA_S9 | All allies gain +10% holy damage for 8s → +20% for 12s; L5: also heals 3 HP/s to all allies | supportive, attacker, light, honorable |

#### Passive Skills (PA_A1–PA_A12)

```
PA_A1 ──┬── PA_A3 ── PA_A6
         └── PA_A4 ── PA_A7
PA_A2 ──┬── PA_A5 ── PA_A8
PA_A6, PA_A4 → PA_A9
PA_A3, PA_A5 → PA_A10
PA_A7, PA_A8 → PA_A11
PA_A9, PA_A10 → PA_A12
```

| ID | Name | Type | Prereqs | Effect (L1 → L5 bonus) | Trait Orientation |
|----|------|------|---------|------------------------|-------------------|
| PA_A1 | Devotion | Passive | — | +5% healing power, −5% cooldowns → +13% healing, −13% cd; L5: heals apply a small 5 absorb shield | supportive, light, honorable |
| PA_A2 | Shield Mastery | Passive | — | +5% block chance, +3 DEF → +13% block, +8 DEF; L5: blocks restore 2% max HP | defensive, absorb, cautious |
| PA_A3 | Holy Radiance | Passive | PA_A1 | +5% holy damage → +13%; L5: holy attacks have 10% chance to Blind target 1s | light, attacker, honorable |
| PA_A4 | Blessed Resilience | Passive | PA_A1 | +2 HP regen/s → +6; L5: regen triples when below 30% HP | light, cautious, defensive |
| PA_A5 | Armor of Faith | Passive | PA_A2 | +3 flat damage reduction → +8; L5: also reduces magic damage by 5% | defensive, absorb, earth |
| PA_A6 | Sacred Power | Passive | PA_A3 | Heals also grant 5 absorb shield to target → 13; L5: shields last until broken (no timer) | supportive, light, absorb |
| PA_A7 | Righteous Vigor | Passive | PA_A4 | +5% max HP and +3% max mana → +13% HP and +8% mana; L5: on level-up, gain +2 to STR and WIS | defensive, cautious, light |
| PA_A8 | Stoic Defender | Passive | PA_A5 | Reduce CC duration by 10% → 26%; L5: upon CC break, gain +15% damage for 3s | defensive, order, cautious |
| PA_A9 | Light's Embrace | Passive | PA_A6, PA_A4 | +8% chance for critical heals (2× effect) → +20%; L5: crit heals also cleanse 1 debuff | supportive, light, focus |
| PA_A10 | Vengeful Spirit | Passive | PA_A3, PA_A5 | On taking damage: 8% chance for bonus 60% holy attack → 20% chance for 100%; L5: proc also heals self for 10% damage dealt | light, attacker, inflict |
| PA_A11 | Unyielding Faith | Passive | PA_A7, PA_A8 | Once per encounter: survive lethal blow at 1 HP → gain 10% HP; L5: also gain +30% damage and invulnerability for 2s | defensive, light, cautious, honorable |
| PA_A12 | Beacon of Valor | Passive | PA_A9, PA_A10 | All allies gain +3% to all stats → +8%; L5: party also gains +3% XP | supportive, light, honorable, order |

#### Paladin — Trait Affinity Coefficients

| Skill | pm | od | sa | rc | fw | we | ld | co | sh | rm | ai | af |
|-------|-----|-----|-----|-----|-----|-----|-----|-----|-----|-----|-----|-----|
| PA_P1 | | | +0.5 | | | | −0.7 | | +0.6 | +0.5 | | |
| PA_P2 | | | −0.7 | +0.5 | | | −0.6 | | | | | |
| PA_P3 | | | +0.5 | | | | −0.7 | | +0.5 | | | −0.6 |
| PA_P4 | | −0.5 | +0.6 | | | | −0.6 | | | | | +0.6 |
| PA_P5 | | +0.6 | | | | | −0.6 | | | | −0.7 | −0.5 |
| PA_P6 | | | +0.6 | | | | −0.7 | | +0.6 | +0.5 | | |
| PA_P7 | | +0.6 | −0.5 | | | | −0.7 | | | | −0.7 | |
| PA_P8 | | | −0.7 | +0.5 | | | −0.8 | | +0.6 | | | |
| PA_P9 | | −0.6 | +0.5 | | | | −0.8 | | +0.6 | | | |
| PA_P10 | | +0.7 | | +0.5 | | | −0.6 | | | | −0.7 | |
| PA_P11 | | | −0.6 | | | | −0.8 | +0.5 | +0.5 | | | |
| PA_P12 | | | | | | | −0.8 | | | | | −0.6 |
| PA_S1 | | | −0.5 | | | | −0.5 | | | | | |
| PA_S2 | | +0.6 | | +0.5 | | | | | | | −0.6 | |
| PA_S3 | | | −0.5 | | | | −0.5 | +0.6 | | | | |
| PA_S4 | | +0.5 | | | | | −0.5 | +0.6 | | | | |
| PA_S5 | | | +0.5 | −0.5 | | | −0.5 | | | | | |
| PA_S6 | | +0.5 | −0.5 | +0.5 | | | | | | | | −0.5 |
| PA_S7 | | | −0.5 | | | | −0.5 | | | | | −0.5 |
| PA_S8 | | | | | | | −0.6 | | +0.5 | | +0.5 | |
| PA_S9 | | | −0.6 | | | | −0.6 | | +0.5 | | | −0.5 |
| PA_S10 | | | +0.5 | | | | −0.8 | +0.5 | +0.5 | | | |
| PA_S11 | | +0.5 | −0.6 | +0.5 | | | | | +0.6 | | | |
| PA_S12 | | | −0.5 | | | | −0.7 | | +0.5 | | | |
| PA_A1 | | | −0.6 | | | | −0.6 | | +0.5 | | | |
| PA_A2 | | +0.6 | | +0.5 | | | | | | | −0.6 | |
| PA_A3 | | | +0.5 | | | | −0.7 | | +0.5 | | | |
| PA_A4 | | +0.5 | | +0.5 | | | −0.5 | | | | | |
| PA_A5 | | +0.6 | | | | +0.5 | | | | | −0.5 | |
| PA_A6 | | | −0.5 | | | | −0.6 | | | | −0.5 | |
| PA_A7 | | +0.5 | | +0.5 | | | −0.5 | | | | | |
| PA_A8 | | +0.5 | | +0.5 | | | | +0.6 | | | | |
| PA_A9 | | | −0.5 | | | | −0.6 | | | | | +0.5 |
| PA_A10 | | | +0.5 | | | | −0.6 | | | | +0.5 | |
| PA_A11 | | +0.6 | | +0.5 | | | −0.6 | | +0.5 | | | |
| PA_A12 | | | −0.6 | | | | −0.7 | +0.5 | +0.5 | | | |

---

### Rogue

Archetypes: **Assassin** (single-target burst), **Scout** (mobility/utility), **Trickster** (debuffs & disruption).

#### Primary Skills (R_P1–R_P12)

```
R_P1 ──┬── R_P3 ── R_P6 ── R_P9
        ├── R_P4
        └──(R_P3, R_P1 → R_P7 → R_P10)
R_P2 ── R_P5 ── R_P8
R_P3, R_P1 → R_P7
R_P7 → R_P10
R_P4, R_P6 → R_P11
R_P9, R_P10 → R_P12
```

| ID | Name | Type | Prereqs | Effect (L1 → L5 bonus) | Trait Orientation |
|----|------|------|---------|------------------------|-------------------|
| R_P1 | Backstab | Active | — | Deal 175% damage, priority to low-DEF targets → 260%; L5: ignores 20% armor | physical, sly, attacker, focus |
| R_P2 | Eviscerate | Active | — | Apply 3 Bleeding stacks (high damage/s) → 5 stacks; L5: bleeds tick 25% faster | physical, inflict, attacker |
| R_P3 | Shadowstep | Active | R_P1 | Teleport behind target + 130% damage + Blind 2s → 200% + 3s; L5: reduces target DEF by 15% | sly, range, risky, attacker |
| R_P4 | Fan of Knives | Active | R_P1 | Hit all enemies for 70% damage → 120%; L5: each hit has 15% chance to apply Poisoned | physical, area, attacker |
| R_P5 | Poisoned Blade | Passive | R_P2 | Basic attacks apply 1 Poisoned stack → 2 stacks; L5: poison ticks deal +20% damage | sly, inflict, physical |
| R_P6 | Shadow Cloak | Triggered | R_P3 | At <25% HP: become Untargetable 2s → 3s; L5: also gain 20% dodge for 3s after cloak ends | sly, cautious, defensive |
| R_P7 | Ambush | Active | R_P3, R_P1 | From stealth: 220% damage → 340%; L5: stuns target 1s and resets Shadowstep cooldown | sly, risky, focus, attacker |
| R_P8 | Garrote | Active | R_P2 | Silence 2s + 80% damage + Bleeding 2 stacks → 4s + 130% + 4 stacks; L5: silenced target takes +15% damage | sly, inflict, focus |
| R_P9 | Vanish | Active | R_P6 | Enter stealth instantly (3s) → 5s; L5: vanishing removes all debuffs | sly, cautious |
| R_P10 | Critical Focus | Passive | R_P7 | +10% crit chance, +25% crit multiplier → +20% and +50%; L5: crits have 15% chance to reset ability cooldowns | physical, attacker, focus, risky |
| R_P11 | Chain of Shadows | Active | R_P4, R_P6 | Teleport to 3 enemies dealing 100% each → 5 enemies for 150%; L5: each hit applies Bleeding 1 stack | sly, area, attacker, risky |
| R_P12 | Shadow Master | Passive | R_P9, R_P10 | +15% dodge, +20% crit from stealth → +30% dodge, +40% crit; L5: stealth lasts 2s longer and grants 3 HP regen/s | sly, darkness, cautious |

#### Secondary Skills (R_S1–R_S12)

```
R_S1 ──┬── R_S3 ── R_S6
        └── R_S5 ── R_S7
R_S2 ──┬── R_S4
        └── (standalone)
R_S3 → R_S8
R_S5, R_S7 → R_S10 (standalone)
R_S7 → R_S9
R_S8, R_S9 → R_S11
R_S4, R_S7 → R_S12
```

| ID | Name | Type | Prereqs | Effect (L1 → L5 bonus) | Trait Orientation |
|----|------|------|---------|------------------------|-------------------|
| R_S1 | Pickpocket | Active | — | Steal small resources + 60% damage → 100%; L5: stolen resources grant +10% damage for 5s | sly, chaos |
| R_S2 | Trap | Active | — | Place trap: 80% damage + slow 20% for 3s → 130% + 35% for 5s; L5: trap stuns 1s on trigger | sly, cautious, focus |
| R_S3 | Quickstep | Active | R_S1 | Burst dodge: 30% dodge for 2s → 50% for 4s; L5: next attack after Quickstep deals +30% damage | range, risky, wind |
| R_S4 | Poison Cloud | Active | R_S2 | AoE 3 Poisoned stacks to all enemies in area → 5 stacks; L5: cloud persists 3s, ticking damage | sly, inflict, area |
| R_S5 | Mark for Death | Active | R_S1 | Target takes +10% damage from all for 5s → +20% for 8s; L5: mark transfers to nearby enemy on kill | sly, inflict, area |
| R_S6 | Shadow Mirror | Active | R_S3 | Create decoy (50% HP) to draw aggro 4s → 5s with 80% HP; L5: decoy explodes for 80% AoE on death | sly, chaos, cautious |
| R_S7 | Disable | Active | R_S5 | Break 1 enemy buff + disarm 2s → 2 buffs + 4s; L5: disabled target deals −15% damage | sly, chaos, order |
| R_S8 | Blade Dance | Active | R_S3 | Rapid 5 strikes of 50% damage on single target → 5×80%; L5: each hit has +5% crit chance | physical, attacker, focus |
| R_S9 | Pressure Point | Active | R_S7 | 100% damage + 20% stun chance → 160% + 40% chance; L5: guaranteed stun on targets below 30% HP | physical, attacker, offensive |
| R_S10 | Focused Strike | Active | R_S5, R_S7 | 120% damage + reduce target armor by 10 for 5s → 180% − 20 armor for 8s; L5: armor reduction is permanent until combat end | physical, focus, attacker |
| R_S11 | Silent Takedown | Active | R_S8, R_S9 | Instant kill attempt on targets below 8% HP (100% chance) → below 15%; L5: successful kill resets all cooldowns | sly, focus, attacker, risky |
| R_S12 | Poison Mastery | Passive | R_S4, R_S7 | +15% poison damage and +1s duration → +35% and +3s; L5: poisoned targets take +10% damage from all sources | sly, inflict, physical |

#### Passive Skills (R_A1–R_A12)

```
R_A1 ──┬── R_A3 ── R_A9 (via R_A4)
        └── R_A4 ── R_A7
R_A2 ──┬── R_A5 ── R_A8
        └── R_A6
R_A3, R_A4 → R_A9
R_A5 → R_A10
R_A9 → R_A11
R_A9, R_A10 → R_A12
```

| ID | Name | Type | Prereqs | Effect (L1 → L5 bonus) | Trait Orientation |
|----|------|------|---------|------------------------|-------------------|
| R_A1 | Nimble | Passive | — | +4% dodge → +12%; L5: +5% movement speed | risky, range, wind |
| R_A2 | Lethality | Passive | — | +4% crit chance, +5% physical damage → +12% crit, +13% damage; L5: crits apply 1 Bleeding stack | physical, attacker, risky |
| R_A3 | Venom Training | Passive | R_A1 | +10% poison effect damage → +26%; L5: poisoned targets have −10% attack speed | sly, inflict, physical |
| R_A4 | Shadow's Grace | Passive | R_A1 | −10% detection radius → −26%; L5: first attack from stealth deals +20% damage | sly, cautious |
| R_A5 | Cold Blooded | Passive | R_A2 | After stealth attack: +15% damage for 3s → +35% for 5s; L5: buff also grants +15% crit chance | sly, attacker, risky, focus |
| R_A6 | Opportunist | Passive | R_A2 | +8% damage vs debuffed targets → +20%; L5: debuffed targets have −5% dodge against rogue | sly, offensive, attacker |
| R_A7 | Silent Steps | Passive | R_A4 | Act 0.5s earlier in combat initiative → 1.5s; L5: first 2 actions in combat are uninterruptible | sly, wind, cautious |
| R_A8 | Backstabber's Focus | Passive | R_A5 | +8% damage to rear-facing/flanked targets → +20%; L5: flanked targets cannot dodge | physical, focus, sly, attacker |
| R_A9 | Evasion | Passive | R_A3, R_A4 | 5% chance to fully negate an incoming hit → 13%; L5: on successful evasion, gain +10% damage for 2s | risky, cautious |
| R_A10 | Assassinate Edge | Passive | R_A5 | Targets below 20% HP: +15% crit chance → +35%; L5: crits on low-HP targets deal 3× damage | physical, focus, attacker, risky |
| R_A11 | Agile Fury | Passive | R_A9 | After dodge: +8% attack speed for 3s → +20% for 5s; L5: also gain +10% crit chance | risky, wind, attacker |
| R_A12 | Shadow Network | Passive | R_A9, R_A10 | In stealth: −15% cooldowns; allies gain +2% crit → −35% cd, +5% crit; L5: stealth generates 2 mana/s | sly, cautious, order |

#### Rogue — Trait Affinity Coefficients

| Skill | pm | od | sa | rc | fw | we | ld | co | sh | rm | ai | af |
|-------|-----|-----|-----|-----|-----|-----|-----|-----|-----|-----|-----|-----|
| R_P1 | −0.6 | | +0.6 | | | | | | −0.7 | | | +0.5 |
| R_P2 | −0.5 | | +0.6 | | | | | | | | +0.7 | |
| R_P3 | | | +0.5 | −0.6 | | | | | −0.7 | −0.5 | | |
| R_P4 | −0.5 | | +0.6 | | | | | | | | | −0.7 |
| R_P5 | −0.5 | | | | | | | | −0.6 | | +0.7 | |
| R_P6 | | +0.5 | | +0.5 | | | | | −0.7 | | | |
| R_P7 | | | +0.7 | −0.7 | | | | | −0.6 | | | +0.5 |
| R_P8 | | | | | | | | | −0.6 | | +0.7 | +0.5 |
| R_P9 | | | | +0.6 | | | | | −0.7 | | | |
| R_P10 | −0.5 | | +0.6 | −0.5 | | | | | | | | +0.6 |
| R_P11 | | | +0.5 | −0.5 | | | | | −0.6 | | | −0.6 |
| R_P12 | | | | +0.6 | | | +0.5 | | −0.8 | | | |
| R_S1 | | | | | | | | −0.6 | −0.5 | | | |
| R_S2 | | | | +0.5 | | | | | −0.5 | | | +0.5 |
| R_S3 | | | | −0.5 | | −0.5 | | | | −0.5 | | |
| R_S4 | | | | | | | | | −0.5 | | +0.6 | −0.6 |
| R_S5 | | | | | | | | | −0.6 | | +0.5 | −0.5 |
| R_S6 | | | | +0.5 | | | | −0.6 | −0.5 | | | |
| R_S7 | | | | | | | | −0.5 | −0.6 | | | |
| R_S8 | −0.5 | | +0.6 | | | | | | | | | +0.6 |
| R_S9 | −0.5 | −0.5 | +0.5 | | | | | | | | | |
| R_S10 | −0.5 | | +0.5 | | | | | | | | | +0.6 |
| R_S11 | | | +0.6 | −0.6 | | | | | −0.6 | | | +0.5 |
| R_S12 | −0.5 | | | | | | | | −0.6 | | +0.7 | |
| R_A1 | | | | −0.5 | | −0.5 | | | | −0.5 | | |
| R_A2 | −0.5 | | +0.5 | −0.5 | | | | | | | | |
| R_A3 | | | | | | | | | −0.5 | | +0.6 | |
| R_A4 | | | | +0.5 | | | | | −0.6 | | | |
| R_A5 | | | +0.6 | −0.5 | | | | | −0.6 | | | +0.5 |
| R_A6 | | −0.5 | +0.5 | | | | | | −0.6 | | | |
| R_A7 | | | | +0.5 | | −0.5 | | | −0.5 | | | |
| R_A8 | −0.5 | | +0.5 | | | | | | −0.6 | | | +0.5 |
| R_A9 | | | | −0.5 | | | | | | | | |
| R_A10 | −0.5 | | +0.5 | −0.5 | | | | | | | | +0.6 |
| R_A11 | | | +0.5 | −0.5 | | −0.5 | | | | | | |
| R_A12 | | | | +0.5 | | | | | −0.7 | | | |

---

### Cleric

Archetypes: **Battle Priest** (combat heals + holy damage), **Lightwarden** (strong heals & cleanses), **Templar** (auras & anti-undead).

#### Primary Skills (C_P1–C_P12)

```
C_P1 ──┬── C_P3 ──┬── C_P6
        │          └── C_P7
        └── C_P4
C_P2 ── C_P5 ── C_P8
C_P3, C_P6 → C_P9
C_P3, C_P5 → C_P10
C_P7, C_P4 → C_P11
C_P7, C_P9 → C_P12
```

| ID | Name | Type | Prereqs | Effect (L1 → L5 bonus) | Trait Orientation |
|----|------|------|---------|------------------------|-------------------|
| C_P1 | Heal | Active | — | Restore 80 HP to lowest-HP ally → 160; L5: also grants 10 absorb shield | supportive, light, honorable |
| C_P2 | Smite | Active | — | Deal 110% holy damage → 170%; L5: marked target takes +10% holy damage for 5s | magical, light, honorable, attacker |
| C_P3 | Mass Heal | Active | C_P1 | Heal all allies for 40 HP → 80; L5: also cleanses 1 debuff per ally | supportive, area, light |
| C_P4 | Purify | Active | C_P1 | Remove 2 negative effects from one ally → 4; L5: purified ally gains +10% damage for 4s | supportive, light, order, honorable |
| C_P5 | Judgement | Active | C_P2 | Deal 150% holy + reduce target attack 20% for 3s → 230% + 35% for 5s; L5: judgement chains to 1 adjacent enemy | light, attacker, honorable, offensive |
| C_P6 | Divine Shield | Active | C_P3 | Grant 30 absorb shield to one ally → 60; L5: shield heals ally for 20 when it expires | absorb, defensive, light, cautious |
| C_P7 | Beacon of Hope | Passive | C_P3 | Allies in range regenerate +3 HP/s → +8; L5: beacon also grants +5% damage reduction | supportive, light, order, honorable |
| C_P8 | Turn Undead | Active | C_P2 | Fear undead 3s + 100% holy damage → 5s + 160%; L5: non-undead take 60% damage | light, honorable, order, attacker |
| C_P9 | Resurrection | Triggered | C_P3, C_P6 | Revive 1 ally at 30% HP (once/encounter) → 60%; L5: revived ally gains +20% all stats for 10s | supportive, light, honorable, cautious |
| C_P10 | Holy Nova | Active | C_P3, C_P5 | Heal allies 30 HP + deal 80% holy to enemies → 60 HP + 130%; L5: each enemy hit restores 5 mana | light, area, supportive, attacker |
| C_P11 | Channel Divinity | Active | C_P7, C_P4 | Full-party heal: restore 100 HP over 4s → 200 HP over 6s; L5: also purges all debuffs | supportive, light, order, cautious |
| C_P12 | Sacred Beacon | Passive | C_P7, C_P9 | Auto-heal most injured ally every 3s for 25 HP (no mana) → 50 HP; L5: beacon pulses AoE heal every 10s (20 HP to all) | supportive, light, order, honorable |

#### Secondary Skills (C_S1–C_S12)

```
C_S1 ──┬── C_S3 ── C_S6
        ├── C_S4
        ├── C_S5
        └── C_S7 ── C_S10
C_S2 ── C_S8
C_S6, C_S7 → C_S9
C_S4, C_S6 → C_S11
C_S8, C_S9 → C_S12
```

| ID | Name | Type | Prereqs | Effect (L1 → L5 bonus) | Trait Orientation |
|----|------|------|---------|------------------------|-------------------|
| C_S1 | Minor Blessing | Active | — | +5% all stats to one ally for 10s → +13% for 15s; L5: blessing spreads to adjacent ally at 50% power | supportive, light, honorable |
| C_S2 | Serenity | Passive | — | On ally kill: heal party 8 HP → 18; L5: kills also restore 3 mana to party | supportive, honorable, light |
| C_S3 | Antidote | Active | C_S1 | Cure Poisoned + cleanse 1 debuff → cure all DoTs + 2 debuffs; L5: target becomes immune to poison for 5s | supportive, order, light |
| C_S4 | Steady Hands | Active | C_S1 | Remove Stun/Freeze from ally immediately → also remove Petrified; L5: target gains 2s CC immunity | supportive, order, light |
| C_S5 | Sanctify Weapon | Active | C_S1 | Convert ally damage to holy for 5s (+10% bonus) → 8s (+20%); L5: holy attacks heal the attacker for 5% damage dealt | light, honorable, order |
| C_S6 | Protective Chant | Active | C_S3 | +8 DEF to all allies for 5s → +18 for 8s; L5: also grants +10 magic resist | defensive, absorb, area, honorable |
| C_S7 | Blessing of Speed | Active | C_S1 | +15% attack speed to one ally for 5s → +25% for 8s; L5: target's skills cost 15% less mana during buff | supportive, light, cautious |
| C_S8 | Retribution | Active | C_S2 | Reflect 10% damage back for 5s → 22% for 8s; L5: reflected damage is holy and heals cleric for 50% of reflected | light, honorable, inflict |
| C_S9 | Mend Wounds | Active | C_S6, C_S7 | Apply HoT: 6 HP/s for 5s to 2 allies → 12 HP/s for 8s to 3 allies; L5: HoT targets also gain +5% damage | supportive, light, area |
| C_S10 | Divine Intervention | Active | C_S7 | Reduce target ally's cooldowns by 2s → 4s; L5: next skill target ally casts costs no mana | supportive, order, light |
| C_S11 | Spirit Ward | Passive | C_S4, C_S6 | 8% chance to negate incoming status effects → 20%; L5: negating a status heals the ally for 15 HP | absorb, defensive, light, order |
| C_S12 | Sacred Ground | Active | C_S8, C_S9 | Area: enemies deal −10% damage for 5s → −22% for 8s; L5: allies in area also gain +5 HP regen/s | light, area, order, defensive |

#### Passive Skills (C_A1–C_A12)

```
C_A1 ──┬── C_A3 ──┬── C_A7
        │          └── C_A8
        └── C_A4
C_A2 ──┬── C_A5
C_A4 → C_A6
C_A6 → C_A9
C_A7, C_A8 → C_A11
C_A5 → C_A10
C_A10, C_A9 → C_A12
```

| ID | Name | Type | Prereqs | Effect (L1 → L5 bonus) | Trait Orientation |
|----|------|------|---------|------------------------|-------------------|
| C_A1 | Devotion | Passive | — | +5% healing power, −5% heal mana cost → +13% power, −13% cost; L5: heals have 10% chance to double | supportive, light, honorable |
| C_A2 | Calm Mind | Passive | — | +5% max mana → +13%; L5: +2 mana regen/s | supportive, light, cautious |
| C_A3 | Efficient Healer | Passive | C_A1 | Heals refund 8% mana cost → 20%; L5: free heal proc (5% chance) | supportive, order, cautious |
| C_A4 | Blessing Aura | Passive | C_A1 | Allies gain +1 HP regen/s → +3; L5: aura range increased by 50% | supportive, light, honorable, area |
| C_A5 | Light's Embrace | Passive | C_A2 | +5% critical heal chance → +13%; L5: crit heals grant 15 absorb shield | supportive, light, attacker |
| C_A6 | Guardian's Resolve | Passive | C_A4 | Buffed allies gain +5 all resist → +13; L5: resist bonus doubles for allies below 50% HP | defensive, absorb, order |
| C_A7 | Martyr's Grace | Passive | C_A3 | When cleric heals: gain 5 absorb shield → 13; L5: shield stacks up to 3× | absorb, supportive, light |
| C_A8 | Purist | Passive | C_A3 | Heals auto-remove 1 minor debuff → 2; L5: purged debuffs heal target for 10 HP each | supportive, order, light |
| C_A9 | Sanctuary | Passive | C_A6 | While casting: −8% incoming damage → −20%; L5: casting also grants 5 absorb shield | absorb, defensive, cautious, light |
| C_A10 | Blessed Bonds | Passive | C_A5 | Heals scale +5% with target's missing HP → +13%; L5: below 20% HP targets receive double healing | supportive, light, focus |
| C_A11 | Divine Focus | Passive | C_A7, C_A8 | −5% skill cooldowns → −13%; L5: 10% chance to instantly reset a cooldown on cast | supportive, light, order, cautious |
| C_A12 | Shepherd | Passive | C_A10, C_A9 | All allies gain +3% XP and +2% resource find → +8% XP and +5% resources; L5: party also gains +3% healing received | supportive, honorable, order, light |

#### Cleric — Trait Affinity Coefficients

| Skill | pm | od | sa | rc | fw | we | ld | co | sh | rm | ai | af |
|-------|-----|-----|-----|-----|-----|-----|-----|-----|-----|-----|-----|-----|
| C_P1 | | | −0.7 | | | | −0.6 | | +0.5 | | | |
| C_P2 | +0.5 | | +0.5 | | | | −0.6 | | +0.5 | | | |
| C_P3 | | | −0.6 | | | | −0.5 | | | | | −0.6 |
| C_P4 | | | −0.6 | | | | −0.5 | +0.6 | +0.5 | | | |
| C_P5 | | −0.5 | +0.6 | | | | −0.6 | | +0.5 | | | |
| C_P6 | | +0.5 | | +0.5 | | | −0.5 | | | | −0.7 | |
| C_P7 | | | −0.6 | | | | −0.6 | +0.5 | +0.5 | | | |
| C_P8 | | | +0.5 | | | | −0.8 | +0.5 | +0.5 | | | |
| C_P9 | | | −0.7 | +0.5 | | | −0.6 | | +0.5 | | | |
| C_P10 | | | | | | | −0.6 | | | | | −0.6 |
| C_P11 | | | −0.7 | +0.5 | | | −0.6 | +0.6 | | | | |
| C_P12 | | | −0.7 | | | | −0.7 | +0.5 | +0.5 | | | |
| C_S1 | | | −0.5 | | | | −0.5 | | +0.5 | | | |
| C_S2 | | | −0.5 | | | | | | +0.5 | | | |
| C_S3 | | | −0.5 | | | | −0.5 | +0.6 | | | | |
| C_S4 | | | −0.5 | | | | −0.5 | +0.6 | | | | |
| C_S5 | | | | | | | −0.6 | +0.5 | +0.5 | | | |
| C_S6 | | +0.5 | | | | | | | +0.5 | | −0.5 | −0.5 |
| C_S7 | | | −0.5 | +0.5 | | | −0.5 | | | | | |
| C_S8 | | | | | | | −0.5 | | +0.5 | | +0.5 | |
| C_S9 | | | −0.5 | | | | −0.5 | | | | | −0.5 |
| C_S10 | | | −0.5 | | | | | +0.6 | | | | |
| C_S11 | | +0.5 | | | | | −0.5 | +0.5 | | | −0.5 | |
| C_S12 | | +0.5 | | | | | −0.5 | +0.5 | | | | −0.5 |
| C_A1 | | | −0.6 | | | | −0.5 | | +0.5 | | | |
| C_A2 | | | −0.5 | +0.5 | | | −0.5 | | | | | |
| C_A3 | | | −0.5 | +0.5 | | | | +0.5 | | | | |
| C_A4 | | | −0.6 | | | | −0.5 | | +0.5 | | | −0.5 |
| C_A5 | | | −0.5 | | | | −0.5 | | | | | |
| C_A6 | | +0.5 | | | | | | +0.5 | | | −0.5 | |
| C_A7 | | | −0.5 | | | | −0.5 | | | | −0.5 | |
| C_A8 | | | −0.5 | | | | −0.5 | +0.6 | | | | |
| C_A9 | | +0.5 | | +0.5 | | | −0.5 | | | | −0.5 | |
| C_A10 | | | −0.5 | | | | −0.5 | | | | | +0.5 |
| C_A11 | | | −0.5 | +0.5 | | | −0.5 | +0.5 | | | | |
| C_A12 | | | −0.5 | | | | | +0.5 | +0.5 | | | |

---

## Hero Skills (Summary by Class)

Quick-reference table showing each class's 4 base skills (as seen in the original summary tables for backward compatibility). These represent the skills heroes commonly start with or gravitate toward earliest.

### Warrior
| Skill | Type | Effect | Orienting traits |
|-------|------|--------|-----------------|
| Power Strike | Active | Deal 150% damage to one target | physical, attacker, offensive, melee |
| Shield Bash | Active | Deal damage + apply Stunned (1 turn) | physical, melee, attacker, focus |
| Defensive Stance | Active | Gain +20 defence for 5s | defensive, absorb, cautious |
| Execute | Active | Deal 200% damage to target below 20% HP | attacker, offensive, focus |

### Mage
| Skill | Type | Effect | Orienting traits |
|-------|------|--------|-----------------|
| Magic Missile | Active | Deal magic damage to single target | magical, focus, attacker |
| Fireball | Active | Deal AoE damage to all enemies (Burning) | magical, fire, area, attacker |
| Frost Bolt | Active | Deal magic damage + apply Frozen (2s) | magical, water, focus, cautious |
| Mana Shield | Active | Absorb-shield converting damage to mana drain | magical, absorb, defensive |

### Ranger
| Skill | Type | Effect | Orienting traits |
|-------|------|--------|-----------------|
| Aimed Shot | Active | 2× damage to single target | range, attacker, focus |
| Multi Shot | Active | Hits multiple enemies for 60% damage | range, area, attacker |
| Poison Arrow | Active | Deal damage + apply Poisoned (3 stacks) | range, sly, inflict |
| Eagle Eye | Passive | +crit chance | range, risky, focus |

### Paladin
| Skill | Type | Effect | Orienting traits |
|-------|------|--------|-----------------|
| Holy Strike | Active | Deal damage + apply Blessed to self | light, honorable, attacker |
| Lay on Hands | Active | Fully heal one ally | supportive, light, cautious |
| Divine Shield | Active | Party-wide absorb shield | defensive, absorb, light, area |
| Resurrection | Triggered | Revives one dead ally (once per encounter) | supportive, light, honorable, cautious |

### Rogue
| Skill | Type | Effect | Orienting traits |
|-------|------|--------|-----------------|
| Backstab | Active | 175% damage, priority to low-defence targets | physical, sly, attacker, focus |
| Shadowstep | Active | Deal damage + apply Blinded to target | sly, range, risky, attacker |
| Eviscerate | Active | Apply Bleeding (high damage) | physical, inflict, attacker |
| Shadow Cloak | Triggered | On near-death: become Untargetable for 2s | sly, cautious, defensive |

### Cleric
| Skill | Type | Effect | Orienting traits |
|-------|------|--------|-----------------|
| Heal | Active | Restore HP to lowest-HP ally | supportive, light, honorable |
| Mass Heal | Active | Restore HP to all allies | supportive, area, light |
| Smite | Active | Deal magic damage to one enemy | magical, light, attacker |
| Purify | Active | Remove all negative status effects from one ally | supportive, order, light |

---

## Enemy Skills (by Tier)

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

### `SkillLevel`
Attached to: heroes. Tracks the current level of each acquired skill. One instance per acquired skill.

| Field | Type | Description |
|-------|------|-------------|
| `skillId` | string | The skill identifier (e.g., "W_P1") |
| `level` | integer | Current level of this skill (1–5) |

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
| `skillLevel` | integer | Level of the skill when cast (1–5) — determines effect magnitude |
| `casterId` | id | The entity that cast the skill |
| `targetId` | id? | Single-target (null for AoE) |
| `magnitude` | integer | Final scaled strength of the effect: `baseMagnitude × (1 + (skillLevel − 1) × 0.20)`. This is the post-scaling value computed at cast time. |
| `duration` | float | Final scaled duration in seconds: `baseDuration × (1 + (skillLevel − 1) × 0.15)`. Computed at cast time. |

### `PassiveSkill`
Attached to: entities that have one or more passive skills active.

| Field | Type | Description |
|-------|------|-------------|
| `skillId` | string | Passive skill identifier |
| `skillLevel` | integer | Current level of this passive (1–5) |
| `statTarget` | string | Which stat field is modified (e.g., `"critChance"`) |
| `modifier` | float | Additive or multiplicative modifier value (scaled by level) |
| `isMultiplier` | boolean | If `true`, modifier is multiplicative |

---

## Events (Skill-related)

| Event | Fields | Description |
|-------|--------|-------------|
| `UseSkill` | `caster`, `skillId`, `skillLevel`, `target?` | An entity activates a skill |
| `SkillEffect` | `skillId`, `skillLevel`, `caster`, `targets`, `magnitude` | Skill effect resolves (damage/heal/buff) |
| `SkillCooldownExpired` | `entity`, `skillId` | A cooldown has elapsed |
| `PassiveProc` | `entity`, `skillId`, `skillLevel`, `trigger` | A passive skill fires on a matching event |
| `ApplyStatusEffect` | `target`, `effectType`, `magnitude`, `duration` | Attaches a status effect to an entity |
| `SkillLevelUp` | `entity`, `skillId`, `newLevel` | A skill's level has been increased |

---

## Design Notes

- Skill selection is AI-driven via the `select_combat_skill` bound choice function; the AI considers HP thresholds, ally state, and enemy state.
- AoE skills hit all valid targets simultaneously via `SkillEffect` with multiple target IDs.
- Mana cost for skills is deducted at `UseSkill` time; if not enough mana is available the skill is skipped and a basic attack is used instead.
- Passive skills are registered at entity spawn and modify the relevant stat fields once; they do not fire as events. When a passive is leveled up, its modifier values are recalculated.
- Skill effect magnitude is computed at cast time based on the skill's current level: `effectiveMagnitude = baseMagnitude + (level - 1) × scalingPerLevel`.
- The L5 bonus effect is a qualitative enhancement checked via a boolean flag `level >= 5` in the rule that implements the skill.
- Many primary skills form multiple small chains that converge into high-impact capstones (e.g., W_P12, M_P11). This encourages trait-driven path specialisation.
- Secondary skills branch off early nodes and offer utility, creating build crossroads.
- Passives support archetypes: tanks get survivability nodes, damage dealers get crit/damage nodes, support classes get healing/aura nodes.
- Some skills have multiple prerequisites (e.g., M_P12 requires both fire and ice mastery), forming true DAG merges rather than simple trees.

---

## Metrics & Leaderboard

Beyond a single numeric score, the client should display additional persistent metrics to help players understand performance and progression. These metrics are recorded in the browser `localStorage` leaderboard alongside the existing `score` value.

- **Kills:** Total number of enemy kills during a run/encounter/session.
- **Party Deaths / Retreats:** Number of times party members died and number of manual or automatic retreats/flees (separate counters).
- **Average DPS (last 10 encounters):** Rolling average DPS computed from the most recent up to 10 completed encounters. DPS for an encounter = total damage dealt by the party / encounter duration (seconds). The average is the mean of the last N encounter DPS values where N <= 10.

Suggested `localStorage` schema (single leaderboard key storing an array of entries):

```json
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
```

Implementation notes:
- Emit a high-level `EncounterEnd` event from the simulation containing `{ damageDone, durationSeconds, kills, partyDeaths, retreats }` for each encounter.
- On the client, maintain a sliding array of the last 10 `damageDone/durationSeconds` values per player; compute `avgDPS = sum(values)/values.length` and store that value in the leaderboard entry.
- Update the leaderboard entry after each encounter/run save. Include both the raw counters (`kills`, `partyDeaths`, `retreats`) and the computed `avgDPS` for display and sorting.

UI notes:
- Show the new metrics in the leaderboard row: `Score | Kills | Deaths / Retreats | Avg DPS`.
- Allow sorting by `score` (default) and optionally by `avgDPS` or `kills`.
- Provide a tooltip or small help icon explaining that `Avg DPS` is computed over the last up to 10 encounters.

---

## Implementation Changes Required

This section documents the specific changes needed to implement the new skill system.

### 1. Data Model Changes

#### 1a. Reduce max skill level from 50 to 5
- **`doc/game-design/skills.md`**: ✅ Updated in this document.
- **BRL skill definitions**: Update all skill level caps and scaling formulas.
- **`game/app/src/data/skillCatalog.ts`**: The `SkillEntry` interface needs a `maxLevel: number` field (value: 5).
- **Engine level-up rules**: Any rule that checks `skillLevel < 50` must change to `skillLevel < 5`.

#### 1b. New `SkillLevel` component
- Add a new `SkillLevel` component (defined above) to track per-skill levels on heroes.
- Existing `Skills` component (4 skill slots) remains for combat slot assignment.
- `SkillLevel` instances are created when a hero acquires a skill and updated when leveled.

#### 1c. Update `SkillEffect` and `PassiveSkill` components
- Add `skillLevel` field to both components (as defined above).
- All skill effect calculations must incorporate `skillLevel` to scale magnitude/duration.

#### 1d. New `SkillLevelUp` event
- Add this event to the event system for UI notifications and rule triggers.

### 2. Skill Tree Reduction (16 → 12 per tree)

#### 2a. Remove 4 skills per tree for existing classes
For each of the 4 classes that currently have 16-skill trees (Warrior, Mage, Rogue, Cleric):
- **Removed Warrior Primary**: W_P7 (Furious Charge is renumbered/kept — actually the new trees redefine all skills). The new 12-skill trees are defined in this document and **fully replace** the old 16-skill trees.
- All old skill IDs (W_P1..W_P16, W_S1..W_S16, W_A1..W_A16, etc.) are replaced with the new 12-skill-per-tree IDs.
- The mapping from old to new is not 1:1; some skills are removed, some merged, some renamed.

#### 2b. Define full trees for Ranger and Paladin
- Ranger and Paladin previously had only 4-skill summary tables.
- This document defines complete 36-skill trees (12 per Primary/Secondary/Passive) for both classes.

### 3. BRL Implementation Changes

#### 3a. Skill catalog BRL file (`game/brl/skill-catalog.brl`)
- **Rewrite entirely** to match the 216 skills defined in this document.
- Each skill entity needs `SkillInfo` with: `id`, `name`, `description`, `skillType`, `prerequisites`, `maxLevel` (always 5).
- Add new fields: `traitAffinity` (serialized coefficient map), `tree` (primary/secondary/passive).

#### 3b. Skill selection rules
- Update the skill selection algorithm to:
  - Check `SkillLevel.level < 5` instead of `< 50`.
  - Apply the `0.8^current_level` diminishing return factor to already-acquired skills.
  - Use the new trait affinity coefficient tables for scoring.

#### 3c. Skill effect rules
- Each skill's combat rule must incorporate `skillLevel` in its damage/heal/duration calculation:
  ```
  effectiveMagnitude = baseMagnitude × (1 + (level - 1) × 0.20)
  ```
- L5 bonus effects need a conditional check: `if skillLevel >= 5 then applyBonusEffect`.

#### 3d. Passive skill rules
- Passive recalculation on level-up: when a passive skill gains a level, recalculate its modifier on the hero entity.
- The `PassiveSkill` component's `modifier` field must be updated to reflect the new level.

### 4. UI Changes

#### 4a. Skill tree display
- The hero creation/editing screen must display 3 DAGs per class (12 nodes each) instead of the current layout.
- DAG connections (prerequisites) should be visually rendered.
- Each skill node shows: name, current level (1–5), and a visual level indicator (e.g., 5 pips).

#### 4b. Skill catalog parser (`game/app/src/data/skillCatalog.ts`)
- Update `SkillEntry` to include: `maxLevel`, `tree` (primary/secondary/passive), `traitAffinity`.
- Update `parseBrl()` to extract the new fields from the BRL file.

#### 4c. Progression path display
- Update the end-of-run skill acquisition log to show skill level increases:
  ```
  Lv 1  → W_P1 Power Strike [1/5]    (physical, attacker, offensive, melee)
  Lv 2  → W_A1 Heavy Armor  [1/5]    (defensive, absorb, earth)
  Lv 3  → W_P1 Power Strike [2/5]    (level up)
  Lv 5  → W_P4 Cleaving Blow [1/5]   (area, physical, offensive)
  ```

### 5. Balance Considerations

- With 50 skill points and max level 5 per skill, a hero can fully max 10 skills out of 36. This creates meaningful specialisation.
- The `0.8^level` diminishing return on skill score ensures moderate diversification — heroes won't dump all 50 points into 10 skills without strong trait alignment.
- Trait noise (σ = 0.15) ensures variation between heroes with identical traits, but the reduced tree size makes each skill choice more impactful.
- L5 bonus effects are designed as "capstone rewards" that justify the final point investment over broader diversification.

### 6. Files to Modify (Summary)

| File | Change |
|------|--------|
| `doc/game-design/skills.md` | ✅ This document (full rewrite) |
| `doc/game-design/characters.md` | Update skill point and max level references |
| `doc/game-design/character-traits.md` | No changes needed (scoring formula is generic) |
| `game/brl/skill-catalog.brl` | Full rewrite with 216 skills |
| `game/app/public/game-files/skill-catalog.brl` | Auto-copied from above by `npm run copy-game-files` |
| `game/app/src/data/skillCatalog.ts` | Update parser and `SkillEntry` interface |
| BRL rule files (skill selection, combat skills) | Update level cap, add level scaling, add L5 bonus checks |
| BRL component definitions | Add `SkillLevel` component; update `SkillEffect`, `PassiveSkill` |
| UI components for skill display | Render 3×12 DAGs, show level pips |
