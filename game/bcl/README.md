# BCL Examples

This directory contains example BCL (Blink Choice Language) files for the Classic RPG game.

## Files

### Party Configuration
- **party-config.bcl** - Main party configuration file that defines the party composition and imports class-specific strategies

### Class Skill Trees
- **warrior-skills.bcl** - Warrior skill selection strategies
- **mage-skills.bcl** - Mage skill selection strategies
- **rogue-skills.bcl** - Rogue skill selection strategies  
- **cleric-skills.bcl** - Cleric skill selection strategies

## Skill Trees by Class

### Warrior (Tank/DPS)
| Tier | Level | Skill | Description |
|------|-------|-------|-------------|
| 1 | 2 | power_strike | Increased damage on next attack |
| 1 | 3 | shield_bash | Stuns enemy briefly |
| 1 | 4 | defensive_stance | Increases defense |
| 2 | 5 | cleave | Attack hits multiple enemies |
| 2 | 6 | battle_cry | Increases party damage |
| 3 | 7+ | execute | High damage to low HP enemies |

### Mage (Ranged DPS)
| Tier | Level | Skill | Description | Cost |
|------|-------|-------|-------------|------|
| 1 | 2 | fireball | High damage single target | 20 |
| 1 | 3 | ice_shard | Moderate damage with slow | 15 |
| 1 | 4 | arcane_missiles | Fast multi-hit | 10 |
| 2 | 5 | blizzard | AoE damage | 40 |
| 2 | 6 | mana_shield | Absorb damage with mana | 25 |
| 3 | 7+ | meteor | Massive AoE | 80 |

### Rogue (Melee DPS)
| Tier | Level | Skill | Description |
|------|-------|-------|-------------|
| 1 | 2 | backstab | High crit chance attack |
| 1 | 3 | poison_blade | DoT damage |
| 1 | 4 | quick_slash | Very fast attack |
| 2 | 5 | shadowstep | Guaranteed crit |
| 2 | 6 | evasion | Increase dodge chance |
| 3 | 7+ | assassinate | Execute low HP enemies |

### Cleric (Healer/Support)
| Tier | Level | Skill | Description | Cost |
|------|-------|-------|-------------|------|
| 1 | 2 | heal | Single target heal | 15 |
| 1 | 3 | bless | Increase ally damage | 12 |
| 1 | 4 | smite | Holy damage | 10 |
| 2 | 5 | group_heal | Heal all allies | 35 |
| 2 | 6 | holy_shield | Damage absorption | 25 |
| 3 | 7+ | resurrection | Revive fallen ally | 100 |

## Usage

These BCL files define player choices for the Classic RPG game. Upload them in the game demo along with the `classic-rpg.ir.json` game rules to customize your party's behavior.

### Choice Functions

Each class defines three types of choice functions:

1. **select_skill_on_levelup** - Called when character levels up to choose which skill to learn
2. **select_combat_skill** - Called each combat round to decide which skill to use
3. **select_attack_target** - Called to choose which enemy to attack

### Creating Your Own Strategies

Copy and modify these files to create your own custom strategies:

```bcl
// Example: Custom aggressive warrior
choice fn select_combat_skill(character, allies, enemies): string {
    // Always use offensive skills
    return "power_strike"
}
```
