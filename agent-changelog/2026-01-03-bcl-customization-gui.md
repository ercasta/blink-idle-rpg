# BCL Customization GUI Implementation

**Date**: 2026-01-03
**Type**: Feature Enhancement

## Summary

Implement a BCL customization GUI in the IDE, allowing players to customize "choice points" - explicitly declared decision points in the game rules.

## Changes to hielements.hie

No structural changes needed - the existing BRL/BCL language elements cover this feature as it extends the language specification without changing the project structure.

## Language Changes

### BRL Specification Updates

1. Added new section "13. Choice Points" defining:
   - Syntax for declaring choice points with `choice fn` and `///` docstrings
   - Semantics (pure functions, called by rules, overridable by BCL)
   - Integration with BCL and IDE/UI support

2. Updated keywords list to include `choice`

3. Updated EBNF grammar to include `choice_point_def`

### BCL Specification Updates

1. Enhanced section "5. Choice Functions" with:
   - Relationship to BRL choice points
   - Customization deltas concept
   - Example delta files

## Implementation Plan

### Game Data Changes

Add choice point declarations to characters.json with docstrings:
```json
{
  "choicePoints": [
    {
      "name": "select_attack_target",
      "signature": "fn select_attack_target(attacker: Character, enemies: list): id",
      "docstring": "Choose which enemy to attack. Affects combat focus strategy.",
      "category": "targeting"
    }
  ]
}
```

### UI Implementation (rpg-demo.html)

1. Add "Customize" button to hero selection screen
2. Create modal for editing choice points:
   - List available choices from hero's BCL
   - Show docstring for each choice
   - Provide text editor for customization
3. Save customizations to localStorage
4. Support downloading BCL deltas

### Storage Format

Customizations stored in localStorage:
```json
{
  "blink_bcl_customizations": {
    "warrior": {
      "select_attack_target": "choice fn select_attack_target(attacker: Character, enemies: list): id {\n    // custom logic\n}"
    }
  }
}
```

## Files Modified

- `doc/language/brl-specification.md` - Added choice points section
- `doc/language/bcl-specification.md` - Updated choice functions section
- `game/demos/rpg-demo.html` - Add customization UI (to be implemented)

## Testing

- Verify choice point declarations are parsed correctly
- Test customization UI workflow
- Verify localStorage persistence
- Test BCL delta download functionality
