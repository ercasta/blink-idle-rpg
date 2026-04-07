# Blink Idle RPG — Game Design Document

## Overview

Blink Idle RPG is an autonomous idle battle simulation where a party of heroes
fights through 3000 enemy encounters across 6 tiers of difficulty. The game
runs entirely automatically — the player selects heroes and watches the battle
unfold.

---

## Core Mechanics

### Combat System

- **Attack loop**: Each entity (hero or enemy) attacks at a rate determined by
  their `attackSpeed` stat. Attack interval = `1 / (attackSpeed + hasteBonus)`.
- **Damage calculation**: `damage = max(1, attackerDamage + damageBonus - targetDefense - targetDefenseBonus)`.
  Minimum 1 damage is always dealt.
- **Critical hits**: Each attack has a `critChance` probability of dealing
  `damage × critMultiplier` (default 1.5×).
- **Shield absorption**: Shields from skills absorb damage before HP. If shield
  amount ≥ damage, no HP is lost.
- **Target assignment**: Heroes target a random living enemy. Enemies target a
  random living hero. Retargeting occurs every 2 seconds and whenever a target dies.

### Health, Mana, and Regeneration

- **Health regen**: Heroes passively regenerate `2 + regenAmount` HP every 3 seconds.
- **Mana regen**: Heroes regenerate 5 mana every 2 seconds.
- **Death and respawn**: When a hero's HP reaches 0, they die and respawn after
  10 seconds with full HP and mana. All temporary buffs are cleared on death.
- **Enemy death**: Defeated enemies are removed and immediately replaced by a new
  enemy of the current tier.

### Leveling System

- **XP gain**: All living heroes share XP when an enemy is defeated.
  XP reward = `baseExpReward × enemyTier`.
- **Level-up**: When XP reaches the threshold, the hero levels up:
  - +20 max HP (and heals 20)
  - +4 damage
  - +2 defense
  - +10 max mana
  - XP threshold increases by 15% per level
- **Level cap**: Soft cap around level 60–65 (XP requirements become very high).

---

## Hero Classes

Each class has 4 unique skills used automatically every 3 seconds (priority
order: skill1 → skill4). Skills have cooldowns and some cost mana.

### Warrior (Tank / DPS)
| Stat Priority | STR, CON |
|---|---|
| Base HP | 160 | Base Damage | 22 | Base Defense | 8 |
| Attack Speed | 0.9 |

| Skill | Effect | Cooldown |
|-------|--------|----------|
| Power Strike | +50% base damage for 6s | 8s |
| Shield Bash | -3 defense on target for 5s | 10s |
| Defensive Stance | +5 defense for 8s | 12s |
| Execute | 2× damage to targets below 33% HP | 15s |

### Mage (Burst DPS)
| Stat Priority | INT, WIS |
|---|---|
| Base HP | 90 | Base Damage | 30 | Base Defense | 2 |
| Attack Speed | 0.6 |

| Skill | Effect | Mana | Cooldown |
|-------|--------|------|----------|
| Fireball | damage + INT×2 to target | 20 | 6s |
| Frost Bolt | damage + INT to target, slow | 15 | 8s |
| Arcane Blast | damage×2 + INT×3 to target | 25 | 10s |
| Mana Shield | Shield absorbing 40+INT×2 | 30 | 15s |

### Ranger (Control / DPS)
| Stat Priority | DEX |
|---|---|
| Base HP | 110 | Base Damage | 18 | Base Defense | 5 |
| Attack Speed | 1.1 |

| Skill | Effect | Cooldown |
|-------|--------|----------|
| Arrow Shot | damage + DEX to target | 5s |
| Multi Shot | half damage + DEX to 3 targets | 10s |
| Evade | +4 defense, +0.3 haste for 6s | 12s |
| Trap | damage + DEX×2 to target | 15s |

### Paladin (Support / Tank)
| Stat Priority | CON, WIS, STR |
|---|---|
| Base HP | 140 | Base Damage | 16 | Base Defense | 9 |
| Attack Speed | 0.7 |

| Skill | Effect | Cooldown |
|-------|--------|----------|
| Holy Strike | damage + WIS to target, self-heal 5+WIS | 6s |
| Divine Shield | Shield 30+WIS×3 | 12s |
| Consecrate | WIS×2 damage to up to 4 enemies | 10s |
| Lay on Hands | Heal 50+WIS×4 on most injured ally | 20s |

### Rogue (Finisher / DPS)
| Stat Priority | DEX, STR |
|---|---|
| Base HP | 105 | Base Damage | 20 | Base Defense | 4 |
| Attack Speed | 1.3 |

| Skill | Effect | Cooldown |
|-------|--------|----------|
| Backstab | damage×2 + DEX×2 to target | 5s |
| Smoke Bomb | +6 defense, +0.4 haste for 5s | 10s |
| Poison Blade | +3+DEX/2 damage bonus for 8s | 12s |
| Shadowstep | damage×3 to target | 15s |

### Cleric (Healer / Support)
| Stat Priority | WIS, CON, INT |
|---|---|
| Base HP | 120 | Base Damage | 13 | Base Defense | 6 |
| Attack Speed | 0.6 |

| Skill | Effect | Mana | Cooldown |
|-------|--------|------|----------|
| Heal | 20+WIS×3 to most injured ally | 15 | 4s |
| Smite | damage + WIS×2 to target | 10 | 6s |
| Divine Favor | +3 regen to all allies | 20 | 15s |
| Holy Word | 30+WIS×2 group heal | 35 | 20s |

---

## Enemy System

### Enemy Tiers

| Tier | Enemies | Base HP | Base Damage | Defense |
|------|---------|---------|-------------|---------|
| 1 | Goblin Scout | 60 | 8 | 2 |
| 2 | Orc Raider, Dark Wolf | 75–90 | 12–14 | 3–4 |
| 3 | Skeleton Warrior, Dark Mage | 80–110 | 16–22 | 3–5 |
| 4 | Troll Berserker | 180 | 22 | 7 |
| 5 | Demon Knight | 250 | 30 | 10 |
| 6 | Ancient Dragon | 400 | 40 | 12 |
| 6 (Boss) | Dragon Lord Vexar | 500 | 40 | 15 |

### Tier Progression

Heroes advance through tiers based on total enemies defeated:
- Every `tierProgressionKills` (50 in normal mode), the tier increases by 1
- Maximum tier is 6
- New enemies spawn at the current tier

### Enemy Scaling

Enemy stats scale logarithmically with total kills to keep the game challenging
but not impossible:
- **HP scale**: `1 + log₂(1 + kills/1000)` → caps at ~3× by 3000 kills
- **Damage scale**: `1 + log₂(1 + kills/1500)` → caps at ~2.6× by 3000 kills

### Boss System

- **Mini-bosses**: Spawn every `bossEveryKills` (100) encounters. They are elite
  versions of tier-appropriate enemies with 2.5× HP and 1.5× damage.
- **Final boss**: Dragon Lord Vexar spawns once at tier 6 after 2500+ kills.
  Defeating Vexar is noted as "Victory" but the game continues until 3000.

---

## Game Flow

### End Criteria

The game runs for exactly **3000 encounters**:
- 30 checkpoints at 100-encounter intervals
- Each checkpoint produces a snapshot displayed for 1 second in the UI
- Total battle animation: ~30 seconds

### Scoring

| Event | Points |
|-------|--------|
| Kill (normal enemy) | +10 |
| Boss kill | +500 |
| Hero death | -100 |
| Speed bonus (base) | +1000 |

Score decays with deaths and time penalties. Final score is computed at game end.

### Difficulty Modes

| Setting | Easy | Normal | Hard |
|---------|------|--------|------|
| Initial enemies per wave | 3 | 5 | 7 |
| Boss every N kills | 150 | 100 | 75 |
| Tier progression kills | 75 | 50 | 40 |
| Points per kill | 5 | 10 | 15 |
| Death penalty | -50 | -100 | -200 |

---

## Party Composition

### Pre-built Heroes

Six pre-built heroes are available, one per class:
- **Aldric** (Warrior) — Tank/DPS, high CON/STR
- **Lyra** (Mage) — Burst DPS, high INT/WIS
- **Sasha** (Ranger) — Control/DPS, high DEX
- **Theron** (Paladin) — Support/Tank, balanced
- **Kira** (Rogue) — Finisher/DPS, high DEX/STR
- **Elara** (Cleric) — Healer/Support, high WIS

### Random Party Generation (Quick Play)

The Quick Play feature generates a random party of 4 heroes:
- Always includes at least 1 healer-type (Cleric or Paladin)
- Remaining 3 slots are filled from shuffled class pool
- Stats are randomly allocated with 40 total points, weighted by class priorities
- Each stat ranges from 4–16

### Stat Allocation

Heroes have 5 stats that affect combat:
- **Strength**: Bonus to damage (especially Warrior, Rogue)
- **Dexterity**: Bonus to attack speed and crit chance
- **Intelligence**: Bonus to spell damage (Mage, Cleric skills)
- **Constitution**: Bonus to max HP and defense
- **Wisdom**: Bonus to max mana and healing skills

---

## UI Flow

```
Home Screen
  ├── ▶ Start a Run → Mode Select → Party Select → Simulation → Battle → Results
  └── ⚡ Quick Play → [random party, normal mode] → Simulation → Battle → Results
```

### Battle Screen

- 30-second animated playback (1 checkpoint per second)
- Live-updating KPI cards: Score, Tier, Enemies Defeated, Bosses, Deaths, Sim Time
- Hero level display
- Skip button to jump to results

### Results Screen

- Final score with victory/defeat indicator
- KPI summary: deepest tier, enemies defeated, bosses killed, hero deaths, time
- Play Again / Home navigation

---

## Technical Architecture

### Simulation Engines

1. **WASM Engine** (primary): BRL rules compiled to Rust → WASM via `wasm-pack`.
   Runs 3000 encounters in ~300ms synchronously.
2. **JS Engine** (fallback): Pure TypeScript implementation of the same combat logic.
   Used when WASM binary is not available. Runs in ~130ms.

Both engines produce identical `GameSnapshot[]` output consumed by the React UI.

### BRL Rule Files

| File | Purpose |
|------|---------|
| `classic-rpg.brl` | All game rules, components, events |
| `heroes.brl` | Hero AI behavior functions |
| `enemies.brl` | Enemy template entities |
| `game-config.brl` | Default game state configuration |
| `scenario-*.brl` | Difficulty-specific overrides |

### Data Flow

```
BRL files → compile → WASM binary (or JS fallback)
                         ↓
React UI → select party → create entities → run simulation → snapshots
                                                                ↓
                                              Battle screen (1 update/sec)
                                                                ↓
                                              Results screen
```
