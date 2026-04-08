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

## Character Traits (Hero Personality & AI)

Each hero is defined by **12 character traits** — signed integer values in the range **−16 to 15** — that collectively describe the hero's personality. Traits drive three things:

1. **Stat growth** — which stats increase most at each level-up.
2. **Skill selection** — which skills the hero gravitates toward in the class DAG.
3. **AI decision weights** — how the hero chooses actions and targets in combat.

The full specification (trait axes, normalisation, stat-growth formulas, skill-selection scoring, and QR encoding) is in [`character-traits.md`](character-traits.md).

### Trait axes summary

| # | Field      | Negative pole | Positive pole |
|---|------------|---------------|---------------|
| 0 | `trait_pm` | physical      | magical       |
| 1 | `trait_od` | offensive     | defensive     |
| 2 | `trait_sa` | supportive    | attacker      |
| 3 | `trait_rc` | risky         | cautious      |
| 4 | `trait_fw` | fire          | water         |
| 5 | `trait_we` | wind          | earth         |
| 6 | `trait_ld` | light         | darkness      |
| 7 | `trait_co` | chaos         | order         |
| 8 | `trait_sh` | sly           | honorable     |
| 9 | `trait_rm` | range         | melee         |
|10 | `trait_ai` | absorb        | inflict       |
|11 | `trait_af` | area          | focus         |

Normalise any raw trait value `t` before use: `w = clamp(t, −16, 15) / 16.0`.

### AI action scoring

Trait weights are derived into named AI decision weights at entity-spawn time (see [`character-traits.md`](character-traits.md) for the derivation table). These derived weights are then used in action scoring:

```
score(action) = baseScore(action) + sum_i{ w_i × modifier_i(action) }
```

where each `w_i` is a derived decision weight and `modifier_i(action)` is an action-specific scalar (expected damage, healing value, threat reduction, etc.).

Key derived weights and their use:

- **`w_attack_support`** (`= w_sa`): positive → prefer offensive actions; negative → prefer heals/buffs.
- **`w_fight_flight`** (`= −w_rc`): positive (risky) → fight on at low HP; negative (cautious) → retreat sooner.
- **`w_target_aggression`** (`= (−w_od + w_sa)/2`): positive → target highest-threat enemy; negative → target softest enemy.
- **`w_focus_fire`** (`= w_af`): positive (focus) → target already engaged by allies; negative (area) → spread attacks.
- **`w_resource_conservation`** (`= (w_rc − w_od)/2`): positive → penalise high-mana skills; negative → spend freely.
- **`w_aoe_single`** (`= −w_af`): positive (area) → prefer AoE; negative (focus) → prefer single-target.
- **`w_cc_priority`** (`= (−w_co − w_sh)/2`): positive (chaos+sly) → prioritise crowd-control abilities.
- **`w_healing_priority`** (`= (−w_sa − w_ld)/2`): positive (supportive+light) → heal low-HP allies urgently.
- **`w_skill_timing`** (`= −w_rc`): positive (risky) → use skills immediately; negative → hold for better conditions.
- **`w_positioning_aggression`** (`= (w_rm − w_od)/2`): positive (melee+offensive) → frontline positioning.
- **`w_target_preference`** (`= (−w_sh − w_od)/2`): positive (sly+offensive) → bias toward weakest/softest targets.
- **`w_defensive_focus`** (`= (w_od − w_ai)/2`): positive (defensive) → prioritise shields and blocks.

Target selection formula:
```
targetScore(t) = baseTargetScore(t)
              + w_target_aggression  × threat(t)
              + w_target_preference  × preferenceBias(t)
              + w_focus_fire         × allyEngagement(t)
```

Fight-or-flight threshold:
```
retreatThreshold = baseRetreat + w_fight_flight × retreatDelta
```
If `currentHPPercent < retreatThreshold`, fall-back behaviour is triggered.

AoE score multiplier:
```
aoeScore(skill) = baseScore(skill) × (1 + w_aoe_single × crowdFactor)
```

Notes for designers:
- Trait values near zero produce neutral/default AI — safe starting points for new templates.
- Trait influence is additive and bounded; extreme values shift behaviour but never fully override class heuristics.
- Use the archetype profiles in `character-traits.md` as starting points for pre-built heroes.

## Design Notes

- Stat scaling on level-up is trait-driven per the formulas in [`character-traits.md`](character-traits.md).
- Revival mechanics (Paladin passive, Cleric skill) are handled via skill components — see [skills.md](skills.md).
