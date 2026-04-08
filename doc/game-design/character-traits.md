# Character Traits — Game Design

Character progression is defined by **traits**. Traits are 12 signed integer values, each in the range **−16 to 15** (5-bit signed), stored in the hero QR payload and used throughout the simulation to determine stat growth, skill selection, and AI decision weights.

At the end of a run the player can inspect the **progression path** — the sequence of skills and stat gains chosen by the hero — to understand how their trait profile shaped the run.

---

## Trait Axes

Each trait is a continuous axis between two named poles. A value of **0** is neutral/balanced. **Negative values** lean toward the first-listed pole; **positive values** lean toward the second-listed pole.

| # | Field name   | First pole (−16) | Second pole (+15) |
|---|--------------|------------------|-------------------|
| 0 | `trait_pm`   | physical         | magical           |
| 1 | `trait_od`   | offensive        | defensive         |
| 2 | `trait_sa`   | supportive       | attacker          |
| 3 | `trait_rc`   | risky            | cautious          |
| 4 | `trait_fw`   | fire             | water             |
| 5 | `trait_we`   | wind             | earth             |
| 6 | `trait_ld`   | light            | darkness          |
| 7 | `trait_co`   | chaos            | order             |
| 8 | `trait_sh`   | sly              | honorable         |
| 9 | `trait_rm`   | range            | melee             |
| 10| `trait_ai`   | absorb           | inflict           |
| 11| `trait_af`   | area             | focus             |

### Encoding and normalisation

Each trait is stored as one signed byte (`int8`) in the QR payload — values outside [−16, 15] are clamped at decode time.

For any arithmetic use, normalise the raw value `t` to a weight `w` in [−1.0, 0.9375]:

```
w = clamp(t, −16, 15) / 16.0
```

Shorthand used in formulas below: `w_pm`, `w_od`, `w_sa`, `w_rc`, `w_fw`, `w_we`, `w_ld`, `w_co`, `w_sh`, `w_rm`, `w_ai`, `w_af` for the normalised weights of each trait axis.

---

## Stat Growth Formulas

At each character level-up, the hero distributes **stat points** across STR, DEX, INT, CON, and WIS. The split is driven by the hero's traits (via an affinity score) combined with a class base-growth vector, plus a small random jitter to prevent two identical-trait heroes from having exactly identical stat trajectories.

### Step 1 — Trait affinity scores

```
affinity_STR = −w_pm  + w_rm  − w_od + w_sa
affinity_DEX = −w_rm  − w_rc  − w_sh − w_we
affinity_INT =  w_pm  − w_fw  − w_co
affinity_CON =  w_od  − w_ai  + w_rc + w_we
affinity_WIS = −w_sa  + w_sh  + w_co − w_ld
```

Interpretation of sign conventions:
- **STR** is raised by physical (−pm), melee (+rm), offensive (−od), and attacker (+sa) leanings.
- **DEX** is raised by range (−rm), risky (−rc), sly (−sh), and wind (−we) leanings.
- **INT** is raised by magical (+pm), fire (−fw), and chaos (−co) leanings.
- **CON** is raised by defensive (+od), absorb (−ai), cautious (+rc), and earth (+we) leanings.
- **WIS** is raised by supportive (−sa), honorable (+sh), order (+co), and light (−ld) leanings.

### Step 2 — Combine with class base-growth vector

Each class supplies a base growth vector `G[S]` representing the class's natural stat priority (values sum to approximately 2.0):

| Class   | G_STR | G_DEX | G_INT | G_CON | G_WIS |
|---------|-------|-------|-------|-------|-------|
| Warrior | 0.60  | 0.25  | 0.05  | 0.55  | 0.15  |
| Mage    | 0.05  | 0.20  | 0.70  | 0.10  | 0.55  |
| Ranger  | 0.20  | 0.70  | 0.10  | 0.25  | 0.15  |
| Paladin | 0.40  | 0.15  | 0.10  | 0.40  | 0.55  |
| Rogue   | 0.35  | 0.65  | 0.05  | 0.25  | 0.10  |
| Cleric  | 0.10  | 0.15  | 0.35  | 0.30  | 0.70  |

Combine trait affinity with class base growth:

```
weight_S = max(0.05, G[S] + affinity_S × 0.35)
```

The factor `0.35` limits trait influence to ±35% of the base growth, keeping classes recognisable even at extreme trait values.

### Step 3 — Random jitter

Add a small Gaussian perturbation and re-clamp:

```
weight_S += gaussian(mean=0, σ=0.08)
weight_S  = max(0.05, weight_S)
```

### Step 4 — Allocate points

Total points per level-up: `pool = 8 + floor(random() × 3)` — randomly 8, 9, or 10.

Normalise and distribute:

```
total_weight = sum_S( weight_S )
raw_S        = weight_S / total_weight × pool
points_S     = floor(raw_S)
```

Distribute any remaining points (due to flooring) to the stats with the largest fractional remainders. Every stat receives at least 0 points per level; no stat is forced negative.

### Example

A Warrior with traits mostly in the Berserker direction (`trait_pm = −12`, `trait_sa = +10`, `trait_od = −8`, `trait_rm = +6`) will produce:

```
w_pm = −0.75,  w_sa = +0.625,  w_od = −0.50,  w_rm = +0.375
affinity_STR = 0.75 + 0.375 + 0.50 + 0.625 = 2.25
weight_STR   = max(0.05, 0.60 + 2.25×0.35) = max(0.05, 1.39) = 1.39
```

Most level-up points flow to STR, with a smaller fraction to DEX and CON.

---

## Skill Selection Formula

At each level-up the hero gains **1 skill point**. The point is spent on the highest-scoring unlocked, affordable skill from the class DAG.

### Candidate filtering

A skill `s` is a valid candidate if:
- All of its prerequisite skills in the DAG have already been acquired, and
- At least 1 skill point is available.

### Scoring

Each skill carries a **trait affinity profile** `A[s]` — a sparse list of `(trait_field, coefficient)` pairs. Coefficients are signed floats in [−1.0, +1.0].

```
score(s) = sum_t( A[s][t] × w_t ) + gaussian(0, 0.15)
```

- `w_t` is the normalised weight for trait axis `t`.
- The Gaussian noise term (σ = 0.15) prevents fully deterministic builds while keeping trait influence dominant.

The hero acquires/upgrades the skill `s* = argmax score(s)` over all valid candidates.

### Affinity coefficient conventions

| Coefficient | Meaning |
|-------------|---------|
| +1.0  | Strongly drawn by the trait's positive (second) pole |
| +0.5  | Moderately drawn by the trait's positive pole |
| −0.5  | Moderately drawn by the trait's negative (first) pole |
| −1.0  | Strongly drawn by the trait's negative pole |

A **positive coefficient for trait_pm** (magical–physical axis) means the skill is strongly preferred by magical-leaning heroes; a **negative coefficient** means physical-leaning heroes prefer it.

---

## AI Decision Weight Derivation

The simulation AI uses a set of named decision weights to score candidate actions (see `characters.md`). These weights are **derived** from the 12 traits at entity-spawn time; the trait values are the single source of truth.

| AI decision weight              | Derived formula                        | Notes |
|---------------------------------|----------------------------------------|-------|
| `w_attack_support`              | `w_sa`                                 | attacker = positive |
| `w_fight_flight`                | `−w_rc`                                | risky (−rc) = fight on |
| `w_target_aggression`           | `(−w_od + w_sa) / 2`                   | offensive + attacker |
| `w_focus_fire`                  | `w_af`                                 | focus = positive |
| `w_resource_conservation`       | `(w_rc − w_od) / 2`                    | cautious + defensive |
| `w_aoe_single`                  | `−w_af`                                | area = prefer AoE |
| `w_cc_priority`                 | `(−w_co − w_sh) / 2`                   | chaos + sly |
| `w_healing_priority`            | `(−w_sa − w_ld) / 2`                   | supportive + light |
| `w_skill_timing`                | `−w_rc`                                | risky = cast early |
| `w_positioning_aggression`      | `(w_rm − w_od) / 2`                    | melee + offensive |
| `w_target_preference`           | `(−w_sh − w_od) / 2`                   | sly + offensive → soft targets |
| `w_defensive_focus`             | `(w_od − w_ai) / 2`                    | defensive + absorb |

All derived weights are in approximately [−1.0, +1.0] and are used in the existing action-scoring formulas documented in `characters.md`.

---

## QR Encoding

The 12 traits replace the older 24-byte "behaviour bytes" block in the hero binary payload. Each trait is stored as **one signed byte** (`int8`), giving a compact 12-byte trait block per game phase.

```
Offset  Size  Field
──────  ────  ──────────────────────────────────────────────────────
?       12B   traits[0..11]   (int8 each, stored in [−16, 15])
               [0]=pm  [1]=od  [2]=sa  [3]=rc
               [4]=fw  [5]=we  [6]=ld  [7]=co
               [8]=sh  [9]=rm  [10]=ai [11]=af
```

The three game-phase sections (early / mid / end) each carry their own 12-byte trait block, allowing a hero's personality to shift as the run progresses (e.g., transitioning from a risky, aggressive early game to a cautious, supportive late game).

---

## Archetype Profiles (Design Reference)

The following archetypes are illustrative starting points for hero authoring. Real heroes can be any combination.

| Archetype        | Class   | pm  | od  | sa  | rc  | fw  | we  | ld  | co  | sh  | rm  | ai  | af  |
|------------------|---------|-----|-----|-----|-----|-----|-----|-----|-----|-----|-----|-----|-----|
| Berserker        | Warrior | −12 | −10 | +10 | −8  |  0  |  0  |  0  | −6  |  0  | +10 | +8  | +8  |
| Defender         | Warrior | −8  | +12 | −6  | +10 |  0  | +6  |  0  | +8  | +8  | +8  | −12 | −6  |
| Warlord          | Warrior | −6  | +4  | −10 | +4  |  0  | +4  |  0  | +10 | +10 | +6  | −6  | −8  |
| Pyromancer       | Mage    | +12 | −10 | +6  | −8  | −14 |  0  |  0  | −8  | −4  | −10 | +8  | −8  |
| Cryomancer       | Mage    | +12 | +4  | −2  | +8  | +12 |  0  | −4  | +8  | −4  | −10 | −4  | +6  |
| Arcanist         | Mage    | +14 | −4  | +4  | +4  |  0  |  0  | −8  | −4  | −6  | −8  |  0  | +10 |
| Assassin         | Rogue   | −10 | −12 | +8  | −10 |  0  |  0  | +8  | −4  | −14 | −4  | +10 | +10 |
| Scout            | Rogue   | −4  | −4  | +4  | −6  |  0  | −8  |  0  |  0  | −12 | −14 | +4  | −4  |
| Trickster        | Rogue   |  0  | −6  | +4  | −4  |  0  |  0  | +6  | −10 | −14 | −6  | +6  | −6  |
| Battle Priest    | Cleric  | +6  | −4  | −10 | −4  |  0  |  0  | −12 | +4  | +8  | +4  | −6  | −6  |
| Lightwarden      | Cleric  | +8  | +8  | −12 | +8  |  0  |  0  | −14 | +8  | +10 | +4  | −10 | +8  |
| Templar          | Cleric  | +4  | +10 | −8  | +10 |  0  | +8  | −10 | +12 | +12 | +6  | −8  | −4  |

---

## Progression Path Display

At the end of a run the client reconstructs the skill acquisition log from the per-level snapshots and displays it as an annotated timeline:

```
Lv 1  → W_P1  Power Strike       (physical, attacker, offensive, melee)
Lv 2  → W_A1  Heavy Armor        (defensive, absorb, earth)
Lv 5  → W_P5  Cleaving Blow      (area, physical, offensive)
Lv 6  → W_A5  Brutal Strikes     (physical, attacker, inflict)
Lv 10 → W_P6  Rampage            (risky, attacker, offensive, physical)
…
```

Each skill entry shows the trait poles that orient toward it, giving the player insight into their hero's personality-driven development path.
