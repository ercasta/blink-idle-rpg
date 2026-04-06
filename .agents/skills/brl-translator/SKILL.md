---
name: brl-translator
description: |
  Translate game design intents (components, events, rules) into Blink Rule Language (BRL).
  This skill guides authors through a repeatable workflow: extract components and events
  from design docs, derive BRL component declarations, author rules and triggers, and
  validate against BRL quality criteria.
---

# BRL Translator Skill

Purpose
- Provide a reproducible, step-by-step workflow to convert game design artifacts
  (components, events, formulas, AI decision values) into BRL source files.

When to use
- Use this skill when you have a design doc (e.g., [doc/game-design/README.md](doc/game-design/README.md))
  or a feature spec and need production-ready BRL: components, event definitions, rules, and example tests.

Prerequisites
- Read the BRL specification and user guide: [doc/brl/brl-specification.md](doc/brl/brl-specification.md) and
  [doc/brl/brl-user-guide.md](doc/brl/brl-user-guide.md).
- Have the relevant game-design docs open (examples: [doc/game-design/characters.md](doc/game-design/characters.md),
  [doc/game-design/combat.md](doc/game-design/combat.md)).

Inputs
- A target design fragment (component list, event description, formula, or a single paragraph describing intent).
- Optional: desired IR/engine constraints (performance, determinism, schedule timing requirements).

Outputs
- One or more BRL snippets or files containing:
  - `component` declarations
  - `event` component definitions
  - `rule` and `on` trigger skeletons implementing the described behavior
  - small unit-test style examples (BRL scenarios) where applicable

Workflow (step-by-step)
1. Ingest design text
   - Identify nouns → candidate `component` names.
   - Identify verbs/flows → candidate `events` and `rules`.
2. Normalize names and types
   - Apply PascalCase for components, snake_case for event fields.
   - Map design types to BRL types (integer, float, string, id, list<T>). Use `id` for entity refs.
3. Author components
   - For each candidate component, produce a `component` block with typed fields.
4. Author events
   - Define event components (e.g., `DamageEvent`) describing the payload carried by the event entity.
5. Author rule skeletons
   - Create `rule` definitions for each described reaction. Include `when` conditions and placeholders for priority.
6. Encode decision points
   - Where design specifies configurable AI or tuning values (e.g., decision vectors), encode them as integer fields
     on hero template components and document normalisation rules in comments.
7. Add examples & tests
   - Provide a minimal BRL example that fires the event and asserts the expected state mutation.
8. Review against quality criteria (see below)

Decision points and branching logic
- Event cancellation: decide whether rules should `cancel` the event or return after acting.
- Priority ordering: choose rule priorities for pre-emptive guards vs. late-stage adjustments.
- Determinism vs variety: deterministic rules produce reproducible simulations; add controlled noise only when required.

Quality criteria / completion checks
- Type-safety: All `let` declarations and component fields include explicit types.
- Minimal side-effects: Rules modify only the intended components; add comments when global state is touched.
- Test coverage: Every non-trivial rule includes a small example scenario demonstrating the core effect.
- Naming consistency: Components use PascalCase; event payloads and fields use clear, consistent names.

Example: Design → BRL (combat damage)

Design fragment (intent): "When a hero attacks, create a damage event with source, target, amount, and type. Apply damage to target's Health; if HP ≤ 0 schedule Death."

Translated BRL snippets

component Health {
  current: integer
  max: integer
}

component DamageEvent {
  source: id
  target: id
  amount: integer
  damage_type: string
}

rule ApplyDamage on DamageEvent(dmg: id) {
  let target: id = dmg.DamageEvent.target
  target.Health.current -= dmg.DamageEvent.amount
  if target.Health.current <= 0 {
    let deathEvt: id = schedule Death { target: target }
  }
}

Best practices and notes
- Keep BRL rules small and focused: prefer many small rules over one large monolithic rule.
- Use explicit priorities for interaction points (e.g., interceptors, modifiers).
- Annotate normalisation or tuning formulas in comments (e.g., decision value normalisation used by AI).

Ambiguities I commonly see (questions to ask)
- Should the rule cancel the triggering event after handling, or allow other rules to process it?
- Are there cross-entity atomicity requirements (i.e., must multiple updates be applied atomically)?
- Performance targets: should we avoid scheduling many future events per frame for large simulations?

Example prompts to use with this skill
- "Translate the `Health`, `Character`, and `Combat` sections from [doc/game-design/characters.md](doc/game-design/characters.md) into BRL components and a `GameStart` rule that spawns a party."
- "From this combat paragraph: <paste>, produce a BRL `DamageEvent` and rules to apply damage, including a test scenario."

Related customizations to create next
- Add a `*.prompt.md` that wraps this skill into a single-input prompt for copy-paste design fragments.
- Create an `examples/` folder with canonical BRL patterns (components, AI decision normalisation, scheduling patterns).

Revision history
- 2026-04-06: Initial draft (based on repository BRL spec and game-design docs).

--
If anything here should be tuned to team conventions (naming, priorities, or test style), say which areas to adapt and I'll update the template accordingly.
---
name: brl-translator
description: Translate game design intents into BRL rules
---

To translate game design into BRL rules

1. Read game design in `doc\game-design` and existing BRL in `brl\`
2. Draft BRL snippets in `brl\` following `rule_<feature>_<short>` naming
3. Add minimal IR test in `ir\` and run the BRL compile/test flow
4. Ask clarifying questions if behavior (timing, stacking, priority) is ambiguous

