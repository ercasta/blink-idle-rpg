# Characters — Game Design

This document covers hero character design: classes, base stats, progression, and the components needed to represent heroes in the simulation.

## Design Goals

- Heroes are persistent entities that carry a party through multiple encounters.
- Each hero has a **class** that determines starting stats, available skills, and targeting behaviour.
- Heroes gain experience and level up across encounters, improving their stats.
- A party of 1–6 heroes is selected at game start and remains for the entire run.

---

## Hero Classes

| Class | Role | Stat Emphasis | Playstyle Summary |
|-------|------|---------------|-------------------|
| Warrior | Tank / Melee DPS | STR, CON | High HP; targets the most dangerous enemy |
| Mage | Burst Caster | INT, WIS | Glass cannon; powerful spells, low defence |
| Ranger | Ranged DPS | DEX | High attack speed; targets lowest-HP enemy |
| Paladin | Support / Tank | STR, WIS | Heals allies; high survivability |
| Rogue | Burst Melee | DEX | High crit; targets lowest-defence enemy |
| Cleric | Healer | WIS, INT | Prioritises healing; supports the party |

### Stat Definitions

| Stat | Abbreviation | Effect |
|------|-------------|--------|
| Strength | STR | Increases melee damage |
| Dexterity | DEX | Increases attack speed and crit chance |
| Intelligence | INT | Increases spell / magic damage |
| Constitution | CON | Increases max HP |
| Wisdom | WIS | Increases max Mana; improves healing |

---

## Progression

- Heroes start at **level 1** and gain experience from defeating enemies.
- On level-up, each stat increases by an amount determined by the hero's class growth table.
- Maximum level is **50** (soft cap for balance; enemies scale beyond this point).

- Heroes gain **1 skill point** at each character level. Skill points are used to learn or upgrade skills (see `skills.md`).

## Decision Values (Hero AI)

Each hero template includes a set of 12 signed integer "decision values" that parameterise AI behaviour and influence the simulation. Values range from **-32 to 31** and are encoded in the hero QR payload as named fields (see QR example below). In-simulation the raw integer is normalised by dividing by 32 to produce a signed weight in approximately [-1, 0.96875]. Use `clamp(v, -32, 31) / 32.0` when reading values.

Decision values (names and short intent):

- `decision_attack_support` : balance between dealing damage (positive) and supporting/healing allies (negative).
- `decision_fight_flight` : aggression/risk tolerance — positive = fight on, negative = fall back earlier.
- `decision_target_aggression` : prefer high-threat targets (positive) vs low-HP/soft targets (negative).
- `decision_focus_fire` : bias toward targets already attacked by allies (positive) vs spreading damage (negative).
- `decision_resource_conservation` : conserve mana/energy (positive) vs spend freely (negative).
- `decision_aoe_single` : preference for AOE effects (positive) vs single-target (negative).
- `decision_cc_priority` : priority to use crowd-control abilities (positive) vs ignore CC (negative).
- `decision_healing_priority` : how strongly to heal low-HP allies (positive) vs delaying/healing less (negative).
- `decision_skill_timing` : prefer early/immediate skill use (positive) vs hold for conditions (negative).
- `decision_positioning_aggression` : frontline positioning (positive) vs stay safe/backline (negative).
- `decision_target_preference` : numeric bias applied to target sorting (maps to closest/weakest/strongest choices).
- `decision_defensive_focus` : favour defensive actions (shields, blocks) when positive; offensive focus when negative.

How the simulation uses the values (implementation rules):

- Normalisation: for any decision field `d` use `w = clamp(d, -32, 31) / 32.0`.
- Action scoring: each candidate action `a` is scored by combining base heuristic scores with weighted decision modifiers. Example:

	score(a) = baseScore(a) + sum_i{ w_i * modifier_i(a) }

	where `w_i` is the normalised weight for decision `i` and `modifier_i(a)` returns an action-specific scalar (e.g., expected damage, expected healing, threat reduction).

- Target selection: compute targetScore(t) = baseTargetScore(t) + w_target_aggression * threat(t) + w_target_preference * preferenceBias(t) + w_focus_fire * allyEngagement(t).

- Attack vs Support: when deciding between an offensive action and a support action, compute both action scores with `decision_attack_support` applied positively to offensive action modifiers and negatively to support/heal modifiers.

- Fight or Flight: compute a retreatThreshold = baseRetreat + w_fight_flight * retreatDelta. If currentHPPercent < retreatThreshold then fallback behaviour is triggered.

- Resource conservation: when w_resource_conservation > 0.0, multiply the cost-sensitivity term by (1 + w_resource_conservation) to penalise high-cost skills; when negative reduce the penalty.

- AoE vs Single-target: when evaluating an AoE skill, multiply its score by (1 + w_aoe_single * crowdFactor) where crowdFactor estimates the number of valid targets.

- Skill timing and CC priority: `decision_skill_timing` and `decision_cc_priority` add to the urgency term when evaluating whether to cast immediately or hold.

- Positioning and defensive focus: `decision_positioning_aggression` biases movement and targeting toward ally or enemy positions; `decision_defensive_focus` increases the priority of defensive actions when positive.

Notes for designers:

- Keep decision values small in magnitude when authoring QR templates for predictable behaviour — values near zero mean neutral/default AI.
- The system is additive and deterministic; combine with small random noise for varied behaviour if desired.
```

## Design Notes

- Stat scaling on level-up uses class-specific **growth tables** (to be defined per class in BRL).
- Revival mechanics (Paladin passive, Cleric skill) are handled via skill components — see [skills.md](skills.md).
