# BCL Function Resolution Architecture

**Version**: 0.1.0-draft  
**Status**: Draft  
**Last Updated**: 2026-01-03

## Table of Contents

1. [Introduction](#1-introduction)
2. [Problem Statement](#2-problem-statement)
3. [Current Implementation Status](#3-current-implementation-status)
4. [Resolution Architecture](#4-resolution-architecture)
5. [Entity Binding Strategies](#5-entity-binding-strategies)
6. [Recommended Approach](#6-recommended-approach)
7. [Implementation Roadmap](#7-implementation-roadmap)
8. [Examples](#8-examples)

---

## 1. Introduction

BCL (Blink Choice Language) allows players to define decision-making logic for game entities. A critical architectural concern is **how the engine resolves which BCL function to call for a specific entity** at runtime.

This document expands on the initial notes in [bcl resolution rules.md](bcl%20resolution%20rules.md) and provides a comprehensive architecture for BCL function resolution.

### Terminology

| Term | Definition |
|------|------------|
| **Choice Point** | A decision declared in BRL that BCL can implement |
| **Choice Function** | A BCL function that implements a choice point |
| **Entity Binding** | Association between a choice function and an entity |
| **Resolution** | The process of finding the correct choice function for an entity |

---

## 2. Problem Statement

### The Core Question

When BRL executes:
```brl
rule on TurnStart {
    let target = call_choice("select_attack_target", entity, enemies)
    // ...
}
```

**How does the engine know which `select_attack_target` implementation to use?**

Consider:
- Multiple heroes may have different targeting strategies
- Player A's Warrior should attack weakest enemies
- Player A's Rogue should attack highest damage enemies
- Different players may have different strategies for the same class

### Complications

1. **Name Collisions**: Multiple BCL files may define `select_attack_target`
2. **Entity Identity**: How to associate functions with entities that don't exist at compile time
3. **Customization**: Players must be able to override default behaviors
4. **Sharing**: Strategies should be shareable between players
5. **Runtime Loading**: BCL may be loaded/modified at runtime in the browser

---

## 3. Current Implementation Status

### What Exists

**BCL Files** (in `game/bcl/`):
- Class-specific strategy files: `warrior-skills.bcl`, `mage-skills.bcl`, etc.
- Party configuration: `party-config.bcl`
- Flee strategies: `flee-aggressive.bcl`, `flee-conservative.bcl`

**Choice Point Metadata** (in `characters.json`):
```json
{
  "choicePoints": [
    {
      "id": "select_attack_target",
      "signature": "choice fn select_attack_target(character: Character, enemies: list): id",
      "category": "targeting"
    }
  ]
}
```

### What's NOT Implemented

1. **No Runtime Resolution**: The engine does NOT actually call BCL functions during gameplay
2. **No Entity Binding**: There's no mechanism to associate BCL with specific entities
3. **No Compilation**: BCL code is stored as text but not compiled to executable IR
4. **No Customization Execution**: Player customizations are cosmetic only

### Current Demo Behavior

The RPG demo uses **hardcoded JavaScript functions** that simulate BCL behavior:
- Targeting: Always attacks enemy with lowest health percentage
- Skills: Priority-based selection hardcoded per class
- Flee: Threshold-based decision using hardcoded percentages

---

## 4. Resolution Architecture

### 4.1 Resolution Hierarchy

When resolving a choice function for an entity, the engine should check (in order):

```
1. Entity-Specific Override
   └── Custom BCL bound directly to this entity ID
   
2. Instance Customization  
   └── Player customization for this hero instance
   
3. Character Template
   └── Default BCL from character definition
   
4. Class Default
   └── Default BCL for the character's class
   
5. Global Default
   └── Fallback implementation (engine-provided or from BRL)
```

### 4.2 Resolution Flow

```
┌─────────────────────────────────────────────────────────────────────┐
│                         BRL calls choice                            │
│    call_choice("select_attack_target", entity, enemies)             │
└─────────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    Get Entity's Choice Bindings                     │
│    entity.ChoiceBindings.select_attack_target                       │
└─────────────────────────────────────────────────────────────────────┘
                                  │
                    ┌─────────────┴─────────────┐
                    │                           │
                    ▼                           ▼
          ┌─────────────────┐       ┌─────────────────┐
          │  Has Binding?   │       │  No Binding     │
          │  (function_id)  │       │                 │
          └────────┬────────┘       └────────┬────────┘
                   │                         │
                   ▼                         ▼
          ┌─────────────────┐       ┌─────────────────┐
          │  Look Up in     │       │  Use Class      │
          │  IR.choices[]   │       │  Default        │
          └────────┬────────┘       └────────┬────────┘
                   │                         │
                   ▼                         ▼
┌─────────────────────────────────────────────────────────────────────┐
│                       Execute Choice Function                       │
│    Returns: target entity ID                                        │
└─────────────────────────────────────────────────────────────────────┘
```

### 4.3 Choice Binding Component

A new component to track which choice functions are bound to an entity:

```brl
component ChoiceBindings {
    // Map of choice_point_id -> choice_function_id
    // Stored as parallel arrays for IR compatibility
    choice_ids: list     // ["select_attack_target", "select_combat_skill", ...]
    function_ids: list   // ["warrior_aggressive_target", "warrior_skill_priority", ...]
}
```

---

## 5. Entity Binding Strategies

### 5.1 Option A: File-Based Binding (Current Direction)

BCL files are named to match entity templates:

```
game/bcl/
├── warrior-skills.bcl      # Binds to class: Warrior
├── mage-skills.bcl         # Binds to class: Mage
├── sir-braveheart.bcl      # Binds to entity: sir_braveheart (override)
└── party-config.bcl        # Party-level choices
```

**Resolution Rules**:
1. If `{entity_id}.bcl` exists → use its functions
2. Else if `{class_name}-skills.bcl` exists → use its functions
3. Else use default implementations

**Pros**:
- Simple file organization
- Clear ownership
- Easy to share (just share the file)

**Cons**:
- Entity IDs must be known at file creation time
- Duplicate code for entities with same behavior
- No dynamic entity support

### 5.2 Option B: Explicit Binding in BDL

BDL entity definitions specify which BCL to use:

```bdl
// heroes.bdl
entity sir_braveheart: Hero {
    HeroInfo {
        name: "Sir Braveheart"
        class: "Warrior"
    }
    ChoiceBindings {
        select_attack_target: "aggressive_targeting"
        select_combat_skill: "warrior_balanced"
    }
}
```

BCL defines named strategies:

```bcl
// targeting-strategies.bcl
module targeting_strategies

@binding("aggressive_targeting")
choice fn select_attack_target(character, enemies): id {
    return find_highest_threat(enemies)
}

@binding("defensive_targeting") 
choice fn select_attack_target(character, enemies): id {
    return find_weakest(enemies)
}
```

**Pros**:
- Explicit bindings visible in data files
- Reusable strategy definitions
- Supports any number of entities with same strategy

**Cons**:
- Requires new `@binding` decorator syntax
- More complex language specification
- Binding errors harder to catch

### 5.3 Option C: Module-Based Namespacing

BCL functions are namespaced by module, bindings use qualified names:

```bcl
// warrior-strategies.bcl
module warrior_strategies

choice fn select_attack_target(character, enemies): id {
    return find_weakest(enemies)
}
```

```bdl
entity sir_braveheart: Hero {
    ChoiceBindings {
        select_attack_target: "warrior_strategies::select_attack_target"
    }
}
```

**Pros**:
- Standard namespacing (familiar to programmers)
- Clear which module provides which function
- Supports multiple implementations with same name

**Cons**:
- More verbose binding syntax
- Module system adds complexity
- Player-facing language should be simpler

### 5.4 Option D: First-Class Entity Parameter (Recommended)

Choice functions always receive the entity as first parameter. The engine provides context for resolution:

```bcl
// This function applies to any entity that calls it
choice fn select_attack_target(
    self: Character,      // The entity making the choice
    enemies: list
): id {
    // `self` provides context about who is deciding
    if self.Character.class == "Warrior" {
        return find_weakest(enemies)
    }
    return find_highest_threat(enemies)
}
```

Resolution based on:
1. Entity's `ChoiceBindings` component (if present)
2. Module imports in entity's definition
3. Global choice function registry

**Pros**:
- Self-documenting: entity is always explicit
- Supports conditional logic within single function
- Simpler for players to understand

**Cons**:
- May encourage large switch statements
- Less modular than separate files per class

---

## 6. Recommended Approach

Based on the analysis, we recommend a **hybrid approach** combining Options A and D:

### 6.1 Design Principles

1. **File-based organization** for clarity and sharing
2. **Class-based defaults** as the primary binding mechanism
3. **Entity-specific overrides** via naming convention
4. **Explicit `self` parameter** for entity context

### 6.2 File Naming Convention

```
game/bcl/
├── {class}-skills.bcl         # Class defaults
├── {class}-{variant}.bcl      # Class variants
├── party-config.bcl           # Party-level choices
└── custom/
    └── {entity_id}.bcl        # Entity overrides
```

### 6.3 Resolution Algorithm

```typescript
function resolveChoiceFunction(
    choiceName: string,
    entity: Entity,
    registry: ChoiceRegistry
): ChoiceFunction {
    
    // 1. Check entity-specific override
    const entityOverride = registry.getEntityOverride(entity.id, choiceName);
    if (entityOverride) return entityOverride;
    
    // 2. Check entity's explicit binding
    if (entity.has(ChoiceBindings)) {
        const binding = entity.ChoiceBindings.get(choiceName);
        if (binding) return registry.getFunction(binding);
    }
    
    // 3. Check class default
    const className = entity.Character.class.toLowerCase();
    const classDefault = registry.getClassDefault(className, choiceName);
    if (classDefault) return classDefault;
    
    // 4. Return global default (from BRL)
    return registry.getGlobalDefault(choiceName);
}
```

### 6.4 IR Representation

```typescript
interface BlinkIR {
    // ... existing fields ...
    
    // Choice function definitions (compiled from BCL)
    choice_functions: ChoiceFunctionDef[];
    
    // Choice point metadata (for UI and validation)
    choice_points: ChoicePointMeta[];
    
    // Default bindings (class -> choice -> function)
    default_bindings: {
        [className: string]: {
            [choiceName: string]: string;  // function_id
        }
    };
}

interface ChoiceFunctionDef {
    id: string;                    // Unique identifier
    name: string;                  // Function name
    source_module: string;         // BCL module name
    signature: string;             // Type signature
    parameters: ParameterDef[];    // Parameter definitions
    return_type: string;           // Return type
    body: Statement[];             // Compiled function body
    source_location?: SourceLoc;   // Original BCL location
}

interface ChoicePointMeta {
    id: string;                    // Choice point identifier
    name: string;                  // Human-readable name
    signature: string;             // Expected signature
    docstring: string;             // Documentation
    category: string;              // UI category
    applicable_classes?: string[]; // Which classes can use this
    default_behavior: string;      // Description of default
}
```

---

## 7. Implementation Roadmap

### Phase 1: Foundation (Current Priority)

1. **Add `ChoiceBindings` component** to entity definitions
2. **Create `ChoiceRegistry`** in browser engine
3. **Implement resolution algorithm** with logging
4. **Wire up `call_choice`** in BRL rule execution

### Phase 2: Compiler Support

1. **Parse BCL to AST** (reuse BRL parser)
2. **Compile choice functions** to IR.choice_functions
3. **Extract choice point metadata** to IR.choice_points
4. **Generate default_bindings** from file names

### Phase 3: Runtime Loading

1. **Browser BCL editor** stores customizations
2. **Delta compilation** merges customizations with base IR
3. **Hot reload** updates registry without page refresh

### Phase 4: Advanced Features

1. **Conditional bindings** based on game state
2. **Inheritance** of choice functions
3. **Composition** of multiple strategies

---

## 8. Examples

### 8.1 Complete Flow Example

**BDL Definition** (`heroes.bdl`):
```bdl
entity sir_braveheart: Hero {
    HeroInfo {
        name: "Sir Braveheart"
        class: "Warrior"
        baseHealth: 150
    }
    // No explicit ChoiceBindings - uses class defaults
}
```

**Class Default BCL** (`warrior-skills.bcl`):
```bcl
module warrior_skills

choice fn select_attack_target(
    self: Character,
    enemies: list
): id {
    // Warrior default: attack weakest
    return find_weakest(enemies)
}

choice fn select_combat_skill(
    self: Character & Skills & Health,
    allies: list,
    enemies: list
): string {
    // Priority: defensive if low HP, then offensive
    if self.Health.current / self.Health.max < 0.25 {
        return "defensive_stance"
    }
    return "power_strike"
}
```

**Player Customization** (stored in localStorage):
```json
{
    "sir_braveheart": {
        "select_attack_target": "choice fn select_attack_target(self, enemies): id {\n    // Always attack bosses first\n    for enemy in enemies {\n        if enemy.Enemy.isBoss {\n            return enemy.id\n        }\n    }\n    return find_weakest(enemies)\n}"
    }
}
```

**Runtime Resolution**:
1. BRL calls `call_choice("select_attack_target", sir_braveheart, enemies)`
2. Engine checks: entity override for `sir_braveheart`? ✅ Found in localStorage
3. Execute customized function
4. Returns boss entity ID (or weakest if no boss)

### 8.2 Name Collision Handling

**Scenario**: Two BCL files define `select_attack_target`

```bcl
// warrior-skills.bcl
module warrior_skills
choice fn select_attack_target(...) { ... }

// rogue-skills.bcl  
module rogue_skills
choice fn select_attack_target(...) { ... }
```

**Resolution**:
- Internal function IDs: `warrior_skills::select_attack_target`, `rogue_skills::select_attack_target`
- Warrior entities default to `warrior_skills::` version
- Rogue entities default to `rogue_skills::` version
- No collision because of implicit class-based namespacing

### 8.3 Sharing Strategies

**Player A** creates aggressive warrior strategy:
```bcl
// Downloads as: aggressive-warrior.bcl
module custom_warrior

choice fn select_attack_target(self, enemies): id {
    return find_highest_damage(enemies)
}
```

**Player B** imports and uses:
1. Uploads `aggressive-warrior.bcl`
2. System detects module name `custom_warrior`
3. Binding UI shows: "Use 'Aggressive Warrior' targeting for Sir Braveheart?"
4. Player confirms
5. Entity gets `ChoiceBindings.select_attack_target = "custom_warrior::select_attack_target"`

---

## Related Documents

- [bcl-specification.md](../language/bcl-specification.md) - BCL language reference
- [bcl-user-guide.md](../language/bcl-user-guide.md) - Player guide for BCL
- [ir-specification.md](../ir-specification.md) - IR format including choice functions
- [architecture.md](../engine/architecture.md) - Engine architecture with BCL integration
