# Damage Types & Resistances — Game Design

This document covers the damage type system: how damage is classified, how resistances work, and how adventures customise the encounter environment.

## Design Goals

- Damage has **two independent axes**: physical/magical (source category) and element (fire, water, wind, earth, light, darkness, or neutral).
- Heroes derive their damage type and element from their **traits** (the `pm`, `fw`, `we`, `ld` axes).
- Heroes derive their **resistances** from the same trait axes.
- Enemies receive damage types and resistances based on the **adventure environment settings** — probability sliders that control the chance of encountering enemies with each damage type and resistance.
- Adventure environment sliders are **independent**: high fire *and* high water chances can coexist, forcing players to make trade-offs when building their party.

---

## Damage Classification

Every attack carries two independent labels:

| Axis | Values | Default |
|------|--------|---------|
| **Category** | `physical`, `magical` | `physical` |
| **Element** | `fire`, `water`, `wind`, `earth`, `light`, `darkness`, `neutral` | `neutral` |

A purely physical sword swing is `physical + neutral`. A fire spell is `magical + fire`. A paladin's holy strike is `physical + light`.

---

## Hero Damage Type Derivation

A hero's damage category and element are derived from traits at entity-setup time:

### Category (from `pm` trait)

```
if pm <= -5   → physical
if pm >= 5    → magical
otherwise     → physical   (default; slight magical leaning isn't enough)
```

### Element (from `fw`, `we`, `ld` traits)

Pick the trait axis with the largest absolute value. If that value's magnitude is ≥ 5, assign the corresponding element:

| Axis | Negative pole (≤ −5) | Positive pole (≥ 5) |
|------|---------------------|---------------------|
| `fw` | fire | water |
| `we` | wind | earth |
| `ld` | light | darkness |

If no axis reaches magnitude 5, the element is `neutral`.

### Hero Resistance Derivation

Each hero has a **resistance value** (percentage, 0–50%) for each of the 7 elements plus physical and magical categories:

```
resistPhysical  = max(0, min(50, (-pm - 5) * 5))    // physical-leaning heroes resist physical
resistMagical   = max(0, min(50, ( pm - 5) * 5))    // magical-leaning heroes resist magical
resistFire      = max(0, min(50, (-fw - 5) * 5))    // fire-leaning heroes resist fire
resistWater     = max(0, min(50, ( fw - 5) * 5))    // water-leaning heroes resist water
resistWind      = max(0, min(50, (-we - 5) * 5))    // wind-leaning heroes resist wind
resistEarth     = max(0, min(50, ( we - 5) * 5))    // earth-leaning heroes resist earth
resistLight     = max(0, min(50, (-ld - 5) * 5))    // light-leaning heroes resist light
resistDarkness  = max(0, min(50, ( ld - 5) * 5))    // darkness-leaning heroes resist darkness
```

Maximum resistance is 50% (at trait extreme of ±16). These reduce incoming damage of the matching type by the resistance percentage.

---

## Enemy Damage Types and Resistances

Enemies receive damage types and resistances at spawn time based on the **adventure environment settings**. Each environment slider is a percentage (0–100%) representing the chance that a spawned enemy has that property.

### Enemy Damage Assignment

When an enemy spawns:
1. Roll for category: `random() < environment.magicalChancePct / 100` → magical, else physical.
2. Roll for each element independently: if `random() < environment.<element>ChancePct / 100`, add that element to a candidate pool.
3. If the candidate pool is non-empty, pick one at random. Otherwise the element is neutral.

### Enemy Resistance Assignment

When an enemy spawns:
1. For each resistance type (physical, magical, fire, water, wind, earth, light, darkness):
   - Roll: if `random() < environment.<type>ResistChancePct / 100`, the enemy gains 30% resistance to that type.
2. Enemies can have multiple resistances simultaneously.

---

## Modified Damage Formula

The existing damage formula is extended with a resistance step:

```
rawDamage     = attacker.Combat.damage + attacker.Buffs.damageBonus
netDamage     = max(1, rawDamage - defender.Combat.defense - defender.Buffs.defenseBonus)
isCrit        = random() < attacker.Combat.critChance
critDamage    = isCrit ? floor(netDamage * attacker.Combat.critMultiplier) : netDamage

// NEW: Resistance reduction
categoryResist = defender resistance matching attacker's category (physical or magical)
elementResist  = defender resistance matching attacker's element (or 0 if neutral)
totalResist    = min(75, categoryResist + elementResist)   // cap at 75%
finalDamage    = max(1, critDamage - floor(critDamage * totalResist / 100))

shieldAbsorb  = min(finalDamage, defender.Buffs.shieldAmount)
appliedDamage = finalDamage - shieldAbsorb
```

- Minimum damage remains **1** (resistances cannot fully negate damage).
- Total resistance is capped at **75%** to prevent near-immunity.

---

## Adventure Environment Settings

Adventures include an `environmentSettings` object with sliders controlling the encounter environment:

### Enemy Damage Type Chances (0–100%)

| Field | Description | Default |
|-------|-------------|---------|
| `magicalChancePct` | Chance enemies deal magical (vs physical) damage | 30 |
| `fireChancePct` | Chance enemies deal fire-element damage | 15 |
| `waterChancePct` | Chance enemies deal water-element damage | 15 |
| `windChancePct` | Chance enemies deal wind-element damage | 10 |
| `earthChancePct` | Chance enemies deal earth-element damage | 10 |
| `lightChancePct` | Chance enemies deal light-element damage | 10 |
| `darknessChancePct` | Chance enemies deal darkness-element damage | 10 |

### Enemy Resistance Chances (0–100%)

| Field | Description | Default |
|-------|-------------|---------|
| `resistPhysicalChancePct` | Chance enemies resist physical damage | 20 |
| `resistMagicalChancePct` | Chance enemies resist magical damage | 20 |
| `resistFireChancePct` | Chance enemies resist fire damage | 10 |
| `resistWaterChancePct` | Chance enemies resist water damage | 10 |
| `resistWindChancePct` | Chance enemies resist wind damage | 10 |
| `resistEarthChancePct` | Chance enemies resist earth damage | 10 |
| `resistLightChancePct` | Chance enemies resist light damage | 10 |
| `resistDarknessChancePct` | Chance enemies resist darkness damage | 10 |

**Key design note**: Unlike hero traits where fire/water are opposite ends of a single axis, adventure environment sliders are **independent**. An adventure can have both high fire and high water enemy chances, forcing players to diversify their party composition.

---

## Design Notes

- The damage type system adds strategic depth without changing the core combat loop — it's a multiplier on the existing damage formula.
- Hero specialisation (via traits) creates natural trade-offs: a fire mage excels against ice enemies but struggles against fire-resistant foes.
- Adventure environment sliders give content creators fine-grained control over the tactical landscape without needing new enemy templates.
- The 75% resistance cap ensures no enemy is immune — even a poorly matched hero always deals at least 25% of their base damage through resistances.
- Neutral element has no resistance interaction, making it a safe default for generalist builds.
