# Game Analysis Summary - Classic RPG

## Overview

This analysis investigates the issue: "Heroes load, but the game is not running."

## Key Findings

### Root Cause
The game lacks proper initialization rules in BRL. Critical game startup logic exists only in UI code, making the game dependent on manual initialization steps that are easy to forget or implement incorrectly.

### What Works ✅
1. **Core Combat System** - DoAttack → damage → death cycle works perfectly
2. **Death Handling** - Enemy and player deaths are processed correctly
3. **Experience & Leveling** - XP grants and level ups function as designed
4. **Victory/Defeat Conditions** - Game over logic works when triggered
5. **Component System** - All components are well-defined and functional

### What's Broken ❌
1. **No Automatic Initialization** - UI must manually schedule all initial DoAttack events
2. **Retargeting Never Activates** - EnemySpawned event never emitted, so retargeting system never starts
3. **No GameStart Event** - No centralized initialization point in BRL rules

### What Could Be Better ⚠️
1. **Target Assignment** - Currently in UI, should be in BRL rules
2. **Enemy Spawning** - Hardcoded in UI with 900+ lines of spawn logic
3. **Game Phases** - Implicit phases (init, combat, game over) not explicitly managed

## Deliverables

### 1. Game Flow Analysis (`game-flow-analysis.md`)
- Complete documentation of game initialization, combat loop, and completion
- Detailed analysis of each game system (attack, death, retargeting, victory/defeat)
- Identification of 5 major issues with the current implementation
- Sequence diagrams showing how the game should start and run

### 2. Game Flow Diagrams (`game-flow-diagrams.md`)
- 6 comprehensive Mermaid diagrams visualizing the game flow:
  1. Complete Game State Machine
  2. Event Flow Diagram (current vs proposed)
  3. Entity Lifecycle Diagrams (heroes, enemies, gamestate)
  4. Rule Dependency Graph
  5. Data Flow Through Components
  6. Proposed Fixed Architecture
- Color-coded to show working (green), broken (yellow), and missing (red) components

### 3. Fix Proposals (`game-fix-proposals.md`)
- 5 detailed proposals for corrections and improvements:
  1. **HIGH Priority:** Add GameStart Event and Initialization Rules
  2. **HIGH Priority:** Fix Retargeting System Activation
  3. **MEDIUM Priority:** Add Automatic Target Assignment
  4. **LOW Priority:** Move Enemy Spawning to BRL
  5. **LOW Priority:** Add Explicit Game Phases
- Each proposal includes:
  - Problem description
  - Proposed solution with code examples
  - Benefits and challenges
  - Risk assessment
  - Testing strategy

## Quick Reference: Issues & Solutions

| Issue | Priority | Effort | Risk | Solution |
|-------|----------|--------|------|----------|
| No automatic initialization | HIGH | Medium | Low | Add GameStart event + initialization rules |
| Retargeting never starts | HIGH | Low | Low | Emit EnemySpawned or start retargeting on GameStart |
| Manual target assignment | MEDIUM | Medium | Medium | Implement FindNewTarget rule |
| Enemy spawning in UI | LOW | High | High | Move to BRL (requires language features) |
| No explicit phases | LOW | Medium | Low | Add GamePhase component (optional) |

## Implementation Roadmap

### Phase 1: Critical Fixes (Immediate)
**Goal:** Make the game work automatically without manual UI initialization

**Changes:**
1. Add GameStart event handling to BRL
2. Add initialization rules for hero attacks
3. Fix retargeting system activation
4. Update UI to schedule GameStart event

**Timeline:** 1-2 days
**Files to modify:**
- `game/brl/classic-rpg.brl` - Add initialization rules
- `game/demos/rpg-demo.html` - Update to use GameStart event

### Phase 2: Robustness (Next)
**Goal:** Move more game logic into BRL rules

**Changes:**
1. Implement automatic target assignment
2. Add comprehensive testing
3. Performance optimization

**Timeline:** 3-5 days
**Files to modify:**
- `game/brl/classic-rpg.brl` - Add FindNewTarget rule
- `game/tests/` - Add integration tests

### Phase 3: Full BRL Migration (Future)
**Goal:** All game logic in BRL, UI is just a view

**Changes:**
1. Move enemy spawning to BRL
2. Implement game phases
3. Remove all game logic from UI code

**Timeline:** 1-2 weeks
**Blockers:** May require new BRL language features (entity cloning, advanced queries)

## Recommended Next Steps

### For Immediate Fix (This Week)
1. Review the proposals in `game-fix-proposals.md`
2. Implement Proposal #1 (GameStart initialization)
3. Implement Proposal #2 (Fix retargeting)
4. Test thoroughly with existing demos
5. Create PR with changes

### For Long-term Improvement (Next Sprint)
1. Add integration tests for full game flow
2. Implement Proposal #3 (Auto target assignment)
3. Consider language features needed for Proposal #4
4. Document BRL patterns and best practices

## Testing Checklist

Before considering the game "fixed", verify:

- [ ] Game starts automatically after party selection
- [ ] Heroes begin attacking without manual event scheduling
- [ ] Initial enemies spawn and join combat
- [ ] Retargeting system activates automatically
- [ ] Dead targets are replaced with new targets
- [ ] Combat continues smoothly without interruption
- [ ] Heroes level up and gain experience
- [ ] Player deaths apply penalties correctly
- [ ] Victory triggers at 5 enemy kills
- [ ] Defeat triggers when all heroes die
- [ ] Leaderboard saves completed runs
- [ ] Multiple demos work consistently

## Files Created

All analysis documents are in the `agent-changelog/` directory:

1. `game-flow-analysis.md` - Detailed analysis and documentation
2. `game-flow-diagrams.md` - Visual Mermaid diagrams
3. `game-fix-proposals.md` - Detailed proposals with code examples
4. `game-analysis-summary.md` - This summary document

## Conclusion

The Classic RPG system is well-designed with a solid foundation in the BRL rules. The core combat mechanics work perfectly. The main issue is **lack of automatic initialization** - the game depends on UI code to start everything manually.

The solution is straightforward: **Add a GameStart event and initialization rules** to BRL. This is a low-risk, high-impact change that will make the game robust and self-contained.

All necessary analysis, diagrams, and proposals have been completed. The next step is implementation.

---

**Analysis Completed:** January 5, 2026
**Analyst:** GitHub Copilot Agent
**Repository:** ercasta/blink-idle-rpg
**Branch:** copilot/analyze-game-start-and-rules
