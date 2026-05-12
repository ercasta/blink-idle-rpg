# Story Mode Event Ordering Bugs — Analysis & Fix Proposals

**Status:** Analysis (2026-05-12)  
**Scope:** `game/brl/story-adventure-rules.brl`, `game/brl/story-rules.brl`  
**Symptoms reported:**
- Blocking encounters appear in the log but the party still travels and arrives on the same day.
- Several milestone events are shown together (multiple completions/activations on the same day).
- Milestone state in the quest panel is inconsistent with where the party is in the narrative.

---

## System Overview

Story mode uses two interlocked simulation loops that run inside a single `StoryGenerate` → `StoryProcessDay` × 30 → `StoryFinalize` event chain:

1. **Travel loop** (`story_process_day` in `story-rules.brl`): advances the party one day at a time. Decides whether to travel, handles hero encounters, emits travel/encounter/arrival/camp steps.
2. **Quest loop** (`processQuestDay` called at the top of each day in `story-adventure-rules.brl`): advances milestone/event state, marks hero encounters as completed, detects objective completion.

These two loops run sequentially inside the same day handler — quest first, travel second — and share mutable entity state. Narrative emission (`emitQuestNarrativeForDay`, `emitHeroEncounterDay`, etc.) happens after both loops have already mutated state.

---

## Bug 1: Multiple Milestones Can Complete on the Same Day (Cascade)

**File:** `game/brl/story-adventure-rules.brl`, lines ~702–856  
**Symptom:** Several milestone completion / activation lines appear clumped together in the narrative, all on the same day.

### Root cause

Inside `processQuestDay`, milestone completion and activation of the *next* milestone happen inside the **same `for ms in milestones` loop iteration**:

```
for ms in milestones {
    if ms.QuestMilestone.isActive && !ms.QuestMilestone.isCompleted {
        ...
        if keyEventCompleted {
            ms.QuestMilestone.isCompleted = true
            // Activate NEXT milestone immediately, still inside the loop
            for nextMs in milestones {
                if nextMs.QuestMilestone.milestoneIndex == nextIdx {
                    nextMs.QuestMilestone.isActive = true   // ← mutated mid-loop
                    nextMs.QuestMilestone.activationDay = day
                }
            }
        }
        // Bail-out path does the same thing (lines 813–852)
    }
}
```

BRL's `for … in entities having …` iterates over all entities that have the component at the start of the loop body execution. After milestone N is completed, milestone N+1 is set to `isActive = true`. When the outer loop reaches milestone N+1, it finds `isActive && !isCompleted` and immediately starts processing events for it — on the same day. If N+1 also completes quickly (or bail-outs), N+2 is activated, and so on: a full cascade can fire on day D.

### Proposed fix

**Option A — Guard flag**: Introduce a local `justActivated` boolean (or a separate component field `readyOnDay: integer`) and skip milestones that were activated on the current day in the same `processQuestDay` call. Change the activation block to set `nextMs.QuestMilestone.activationDay = day + 1` (i.e. defer to tomorrow), ensuring the new milestone is only eligible from the next call onward.

**Option B — Two-phase processing**: Split `processQuestDay` into two passes over the milestones:
1. Pass 1: check for completion/bail-out on all *already-active* milestones; collect "just completed" indices.
2. Pass 2: activate the successors of the just-completed milestones.

Both passes operate on the same day. Because activation only happens after Pass 1 is finished, newly activated milestones are not visible to Pass 1 and cannot cascade-complete within the same call.

Option A is the minimal change. Option B is cleaner but requires refactoring the inner logic into separate helper functions.

---

## Bug 2: Milestone Completion Day is Estimated, Not Recorded

**File:** `game/brl/story-adventure-rules.brl`, lines ~970–992  
**Symptom:** Milestone completion narratives appear on the wrong day or not at all; combined with Bug 1 they can show "already completed" in the quest panel before the relevant narrative is reached.

### Root cause

`QuestMilestone` has no `completedDay` field. `emitQuestNarrativeForDay` reconstructs the completion day from first principles:

```
let msCompDay = msCheck.QuestMilestone.activationDay + 1           // normal
if msCheck.QuestMilestone.completedViaBailout {
    msCompDay = msCheck.QuestMilestone.activationDay + msCheck.QuestMilestone.bailoutDay
}
if msCompDay == day { /* emit narrative */ }
```

This estimate is correct only when the milestone completes on *exactly* the first eligible day. In practice, completion depends on random event rolls inside `processQuestDay`, so the actual completion day can be any day after activation. The estimate therefore places the narrative on the wrong day (usually day `activationDay + 1`), while the real completion fires silently.

### Proposed fix

Add a `completedDay: integer` field to `QuestMilestone` (default 0). Set it in `processQuestDay` when the milestone completes:

```
ms.QuestMilestone.isCompleted = true
ms.QuestMilestone.completedDay = day     // ← record actual day
```

Update `emitQuestNarrativeForDay` to check `msCheck.QuestMilestone.completedDay == day` directly instead of recomputing.

---

## Bug 3: Blocking Encounters Do Not Actually Block Travel

**File:** `game/brl/story-rules.brl`, lines ~848–858  
**Symptom:** A "🚧 blocking encounter" step appears in the log, but the party continues to fight regular encounters, arrive at the destination, and rest — all on the same day.

### Root cause

When the blocking encounter triggers (inside the `if shouldTravel` branch), the code emits a `blocking_encounter` step and then **falls through** to the rest of the travel processing:

```
// ── Blocking encounter check ────────────────────────────────────
let blocker = findBlockingForPath(...)
if blocker.BlockingEncounter.pathId == ... || str_contains(...) {
    let triggerRoll = random()
    if triggerRoll < blocker.BlockingEncounter.triggerChance {
        // emit blocking_encounter step
        // ← NO early-exit here
    }
}

// ── Encounters ──────────────────────────────────────────────────
// continues regardless...
let encBase: integer = floor(random_range(0, 4))
...
// ── Arrival ─────────────────────────────────────────────────────
let arrN = emitNarrative(...)
...
// ── Town rest or camp ───────────────────────────────────────────
```

The "blocking" label is cosmetic only. BRL does not currently have a `return` or `break` inside loops to abort the outer travel block early, but the logic can be restructured.

### Proposed fix

Introduce a `wasBlocked: boolean` local variable that is set to `true` when the blocking encounter fires. Wrap all subsequent travel processing (encounters, arrival, camp/rest) in `if !wasBlocked { ... }`. When blocked, emit only a "the party makes camp and waits for the situation to be resolved" narrative and a `camp` step, without moving `newLocIdx` forward:

```
let wasBlocked = false
if blocker.BlockingEncounter.pathId == ... || str_contains(...) {
    let triggerRoll = random()
    if triggerRoll < blocker.BlockingEncounter.triggerChance {
        wasBlocked = true
        // emit blocking_encounter step
        // emit "party waits" narrative + camp step
        // do NOT advance newLocIdx — party stays put
    }
}

if !wasBlocked {
    // encounters
    // arrival
    // town rest or camp
} else {
    locationsLeft = locationsLeft + 1   // restore the location credit for tomorrow
}
```

This also keeps `newLocIdx` at the current location so the party retries travel the following day.

---

## Bug 4: Quest State Snapshotted Post-`processQuestDay` — All Steps Show End-of-Day State

**File:** `game/brl/story-rules.brl`, lines ~752–765  
**Symptom:** The quest panel (active/completed milestones) in the UI shows the end-of-day state on every step of the day, including `day_start` — so a new milestone appears "active" before its predecessor's completion narrative has been shown.

### Root cause

Inside `story_process_day`, the order is:

```
// 1. Run quest simulation (mutates milestone state)
let questComplete = processQuestDay(day, encounterIntensity, locationsPerDay)

// 2. Capture quest state snapshot (already reflects post-processQuestDay state)
let questObj = getQuestObjective()
let activeMil = getActiveMilestoneTitle()
let completedMil = getCompletedMilestonesCsv()

// 3. Emit all steps for this day (all use the same snapshot from step 2)
```

Every step emitted that day — `day_start`, `departure`, `travel`, `encounter`, `arrival`, `camp` — carries the same frozen milestone state. If milestone 3 completed and milestone 4 was activated on day 7, the `day_start` step for day 7 will show "milestone 4 active / milestone 3 completed" even though the completion narrative only appears mid-day.

### Proposed fix

Capture the quest state *before* `processQuestDay`, and use it for all steps up to and including the point where milestone completion events are emitted. Then capture a post-day state for the remaining steps.

Concretely:

```
// Snapshot BEFORE quest simulation
let questObjBefore = getQuestObjective()
let activeMilBefore = getActiveMilestoneTitle()
let completedMilBefore = getCompletedMilestonesCsv()

// Run quest simulation
let questComplete = processQuestDay(day, encounterIntensity, locationsPerDay)

// Snapshot AFTER quest simulation
let questObj = getQuestObjective()
let activeMil = getActiveMilestoneTitle()
let completedMil = getCompletedMilestonesCsv()

// Use *before* state for early-day steps (day_start, departure, travel)
// Use *after*  state for late-day steps (arrival, camp, day_end)
```

This ensures that a player stepping through the narrative sees the "old" quest state until they reach the milestone completion event, then the "new" state for later steps.

---

## Bug 5: `findBlockingForPath` Fallback Returns a Mismatched Blocker

**File:** `game/brl/story-rules.brl`, lines ~447–462  
**Symptom:** Blocking encounters can trigger on paths they were not designed for, creating spurious blockages.

### Root cause

When no matching blocker is found, the function returns `blockers[0]` as a sentinel:

```
fn findBlockingForPath(pathType: string, pathId: string, locationId: string): id {
    let blockers = entities having BlockingEncounter
    for blocker in blockers {
        if blocker.BlockingEncounter.pathId == pathId { return blocker }
        if str_contains(blocker.BlockingEncounter.matchPathType, pathType) { return blocker }
        if str_contains(blocker.BlockingEncounter.locationId, locationId) { return blocker }
    }
    return blockers[0]   // ← always returns something
}
```

The comment says "caller checks blockingId" but the caller re-checks `pathId` and `matchPathType`:

```
if blocker.BlockingEncounter.pathId == path.SelectedPath.pathId ||
   str_contains(blocker.BlockingEncounter.matchPathType, path.SelectedPath.pathType) {
```

If `blockers[0].matchPathType` happens to contain the current `pathType` (e.g. `"imperial_road,forest_trail"` and we're on `"forest_trail"`), the guard passes and the wrong blocker triggers. This is a coincidental match from whatever the first entity in the list happens to be.

### Proposed fix

BRL lacks a `null` / `none` return type, but the pattern can be fixed with a `found` boolean:

```
fn findBlockingForPath(pathType: string, pathId: string, locationId: string): id {
    let blockers = entities having BlockingEncounter
    let found = false
    let result = blockers[0]
    for blocker in blockers {
        if !found {
            if blocker.BlockingEncounter.pathId == pathId {
                result = blocker
                found = true
            }
            if !found && str_contains(blocker.BlockingEncounter.matchPathType, pathType) {
                result = blocker
                found = true
            }
            if !found && str_contains(blocker.BlockingEncounter.locationId, locationId) {
                result = blocker
                found = true
            }
        }
    }
    return result  // caller must re-validate using `found` logic
}
```

Because BRL cannot return a sentinel "no result" for an `id` type, the caller must still re-validate the returned entity (which it already does). The key change is that `result` is only updated when an actual match is found — if the loop exits without a match, `result` stays as `blockers[0]` but the caller's guard will correctly reject it (assuming `blockers[0]` was not a coincidental match). A more robust approach would add a `BlockingEncounterResult` wrapper component, or add a `blockingId: "none"` sentinel entity to the world data.

---

## Interaction Between Bugs

Bugs 1 and 2 compound each other: when multiple milestones complete in one cascade (Bug 1), the estimated completion days (Bug 2) pile up, causing a wall of completion/activation lines that all land on the same day or adjacent days. Bug 4 then makes the quest panel jump several milestones ahead at once, with no gradual progression visible to the player.

Bug 3 is independent but creates its own confusion: a step marked `blocking_encounter` with a 🚧 badge is followed immediately by normal `encounter`, `arrival`, and `camp` steps, suggesting the blockage was instantly resolved off-screen.

---

## Fix Priority

| Bug | Impact | Difficulty | Suggested priority |
|-----|--------|------------|-------------------|
| Bug 1 — milestone cascade | High (core experience) | Low (add `activationDay = day + 1` or two-phase pass) | **1** |
| Bug 2 — completion day not recorded | High (narrative wrong day) | Low (add `completedDay` field) | **2** |
| Bug 4 — quest state stale on early steps | Medium (UI out of sync) | Low (capture before/after snapshots) | **3** |
| Bug 3 — blocking doesn't block | Medium (travel logic broken) | Medium (needs `wasBlocked` guard) | **4** |
| Bug 5 — wrong blocker returned | Low (rare edge case) | Low (guard in helper) | **5** |

Fixing Bug 1 first (and Bug 2 alongside it) will most visibly reduce the "clumped milestones" symptom. Bug 3 can follow as an independent change to `story_process_day`. Bug 4 is a polish fix for after the core ordering is stable.
