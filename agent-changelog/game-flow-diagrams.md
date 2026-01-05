# Game Flow Diagrams - Classic RPG

This document contains detailed Mermaid diagrams visualizing the game flow.

## 1. Complete Game State Machine

```mermaid
stateDiagram-v2
    [*] --> NotLoaded: Application Start
    
    NotLoaded --> Loading: User opens demo
    Loading --> PartySelection: IR & Heroes loaded
    
    state PartySelection {
        [*] --> SelectingHero1
        SelectingHero1 --> SelectingHero2: Hero 1 chosen
        SelectingHero2 --> SelectingHero3: Hero 2 chosen
        SelectingHero3 --> SelectingHero4: Hero 3 chosen
        SelectingHero4 --> ReadyToStart: Hero 4 chosen
    }
    
    PartySelection --> Initialized: Confirm Party
    
    Initialized --> Running: Start Battle
    
    state Running {
        [*] --> Combat
        
        Combat --> Attacking: Process DoAttack
        Attacking --> DamageCalculation
        DamageCalculation --> ApplyDamage
        ApplyDamage --> CheckHealth
        
        CheckHealth --> Attacking: Target alive
        CheckHealth --> Death: Target dead
        
        Death --> EnemyDied: Enemy death
        Death --> HeroDied: Hero death
        
        EnemyDied --> SpawnReplacement
        SpawnReplacement --> GrantXP
        GrantXP --> CheckLevelUp
        CheckLevelUp --> LevelUp: XP threshold reached
        CheckLevelUp --> UpdateStats: No level up
        LevelUp --> UpdateStats
        UpdateStats --> CheckVictory
        
        CheckVictory --> Victory: 5+ enemies killed
        CheckVictory --> Combat: Continue fighting
        
        HeroDied --> ApplyPenalty
        ApplyPenalty --> RetargetEnemies
        RetargetEnemies --> CheckTPK
        
        CheckTPK --> Defeat: All heroes dead
        CheckTPK --> Combat: Heroes remain
        
        Combat --> RetargetCheck: Every 2 seconds
        RetargetCheck --> FindNewTargets: Dead targets detected
        FindNewTargets --> Combat
        RetargetCheck --> Combat: No action needed
    }
    
    Running --> Paused: Pause Button
    Paused --> Running: Resume Button
    
    Running --> Victory: GameOver(victory=true)
    Running --> Defeat: GameOver(victory=false)
    
    Victory --> ShowResults
    Defeat --> ShowResults
    ShowResults --> SaveLeaderboard
    SaveLeaderboard --> [*]
    
    Initialized --> [*]: Reset
    Paused --> [*]: Reset
```

## 2. Event Flow Diagram

```mermaid
flowchart TB
    subgraph Initialization
        Start([UI Loads Game]) --> LoadIR[Load IR JSON]
        LoadIR --> ExtractHeroes[Extract Hero Data]
        ExtractHeroes --> ShowSelection[Show Party Selection]
        ShowSelection --> SelectParty[Player Selects 4 Heroes]
        SelectParty --> CreateEntities[Create Hero Entities 0-3]
        CreateEntities --> CreateGameState[Create GameState Entity]
        CreateGameState --> ScheduleStart{Schedule GameStart?}
    end
    
    subgraph "Issue: Manual Init"
        ScheduleStart -->|Current| ManualInit[UI Manually:]
        ManualInit --> M1[Schedule DoAttack for heroes]
        ManualInit --> M2[Spawn 5 enemies]
        ManualInit --> M3[Assign targets]
        M1 --> M4[Start Simulation]
        M2 --> M4
        M3 --> M4
    end
    
    subgraph "Proposed: Auto Init"
        ScheduleStart -->|Proposed| AutoInit[Schedule GameStart Event]
        AutoInit --> StartSim[Start Simulation]
        StartSim --> GameStartRule[GameStart Rule Fires]
        GameStartRule --> A1[Start Hero Attacks]
        GameStartRule --> A2[Spawn Enemy Wave]
        GameStartRule --> A3[Emit EnemySpawned]
        A1 --> CombatLoop
        A2 --> CombatLoop
        A3 --> StartRetargeting[Start Retargeting System]
    end
    
    M4 --> CombatLoop[Combat Event Loop]
    StartRetargeting --> CombatLoop
    
    subgraph "Combat Loop"
        CombatLoop --> NextEvent{Get Next Event}
        
        NextEvent -->|DoAttack| Attack[attack_rule]
        Attack --> CalcDmg[Calculate Damage]
        CalcDmg --> Apply[Apply to Target]
        Apply --> EmitAfter[Emit AfterAttack]
        EmitAfter --> SchedNext[Schedule Next Attack]
        
        NextEvent -->|AfterAttack| DeathCheck[death_check]
        DeathCheck --> IsDead{HP <= 0?}
        IsDead -->|Yes| EmitDeath[Emit Death]
        IsDead -->|No| NextEvent
        
        NextEvent -->|Death| DetermineType{Entity Type?}
        DetermineType -->|Enemy| EnemyDeath[enemy_death_handler]
        DetermineType -->|Hero| PlayerDeath[player_death_handler]
        
        EnemyDeath --> EmitDefeated[Emit EnemyDefeated]
        EmitDefeated --> GrantXP[grant_experience]
        GrantXP --> CheckLevel[level_up_check]
        CheckLevel --> EmitVictory{Victory Check}
        
        PlayerDeath --> EmitPlayerDef[Emit PlayerDefeated]
        EmitPlayerDef --> ApplyPen[Apply Death Penalty]
        ApplyPen --> GameOverCheck{All Dead?}
        
        GameOverCheck -->|Yes| EmitGameOver[Emit GameOver]
        GameOverCheck -->|No| NextEvent
        
        EmitVictory -->|Victory| EmitGameOver
        EmitVictory -->|Continue| NextEvent
        
        NextEvent -->|CheckAllTargets| Retarget[Retargeting Logic]
        Retarget --> CheckTargets{Any Dead<br/>Targets?}
        CheckTargets -->|Yes| FindNew[Find New Targets]
        CheckTargets -->|No| ReschedRetarget[Reschedule in 2s]
        FindNew --> ReschedRetarget
        ReschedRetarget --> NextEvent
        
        SchedNext --> NextEvent
        EmitGameOver --> End([Game Over])
    end
    
    style ManualInit fill:#f88
    style M1 fill:#f88
    style M2 fill:#f88
    style M3 fill:#f88
    style M4 fill:#f88
    
    style AutoInit fill:#8f8
    style A1 fill:#8f8
    style A2 fill:#8f8
    style A3 fill:#8f8
    style GameStartRule fill:#8f8
```

## 3. Entity Lifecycle Diagram

```mermaid
flowchart TD
    subgraph "Hero Lifecycle"
        HeroCreate[Hero Created<br/>from Party Selection] --> HeroInit[Initialize Components:<br/>Character, Health, Mana<br/>Combat, Target, Team<br/>Skills, Buffs]
        HeroInit --> HeroIdle[Waiting for Combat]
        HeroIdle --> HeroAttack[Receives DoAttack Event]
        
        HeroAttack --> HeroLoop{While Alive &<br/>Has Target}
        HeroLoop -->|Attack| HeroDamage[Deal Damage]
        HeroDamage --> HeroSchedule[Schedule Next Attack]
        HeroSchedule --> HeroLoop
        
        HeroLoop -->|Damaged| HeroCheck{HP > 0?}
        HeroCheck -->|Yes| HeroLoop
        HeroCheck -->|No| HeroDeath[Hero Death]
        
        HeroDeath --> HeroPenalty[Apply 50s Penalty]
        HeroPenalty --> HeroRetarget[Retarget Enemies]
        HeroRetarget --> HeroRemain{Other Heroes<br/>Alive?}
        
        HeroRemain -->|Yes| HeroWait[Wait for Revival<br/>or Game End]
        HeroRemain -->|No| HeroGameOver[Trigger Game Over]
        
        HeroLoop -->|Gains XP| HeroXP{XP >= Threshold?}
        HeroXP -->|Yes| HeroLevelUp[Level Up]
        HeroLevelUp --> HeroStatsUp[Increase Stats]
        HeroStatsUp --> HeroSkillPt[Gain Skill Point]
        HeroSkillPt --> HeroLoop
        HeroXP -->|No| HeroLoop
    end
    
    subgraph "Enemy Lifecycle"
        EnemySpawn[Enemy Spawned<br/>by UI or Rule] --> EnemyInit[Initialize Components:<br/>Character, Health, Combat<br/>Target, Team, Enemy]
        EnemyInit --> EnemyTarget[Assign Random<br/>Hero Target]
        EnemyTarget --> EnemyAttack[Receive DoAttack Event]
        
        EnemyAttack --> EnemyLoop{While Alive &<br/>Has Target}
        EnemyLoop -->|Attack| EnemyDamage[Deal Damage]
        EnemyDamage --> EnemySchedule[Schedule Next Attack]
        EnemySchedule --> EnemyLoop
        
        EnemyLoop -->|Damaged| EnemyCheck{HP > 0?}
        EnemyCheck -->|Yes| EnemyLoop
        EnemyCheck -->|No| EnemyDeath[Enemy Death]
        
        EnemyDeath --> EnemyXP[Grant XP to Heroes]
        EnemyXP --> EnemyCount[Increment Kill Count]
        EnemyCount --> EnemyRemove[Remove Entity]
        EnemyRemove --> EnemySpawnNew{Spawn<br/>Replacement?}
        
        EnemySpawnNew -->|Yes| EnemySpawn
        EnemySpawnNew -->|No| EnemyVictory{Check Victory}
        
        EnemyVictory -->|5+ Kills| Victory[Victory!]
        EnemyVictory -->|Continue| EnemyEnd[Continue Game]
    end
    
    subgraph "GameState Lifecycle"
        GSCreate[GameState Created] --> GSInit[Initialize:<br/>currentWave=1<br/>enemiesDefeated=0<br/>retargetingActive=false]
        GSInit --> GSWait[Waiting for Events]
        
        GSWait --> GSEnemy[Enemy Defeated Event]
        GSEnemy --> GSIncKills[enemiesDefeated++]
        GSIncKills --> GSCheckV{enemiesDefeated >= 5?}
        GSCheckV -->|Yes| GSVictory[Set victory=true<br/>gameOver=true]
        GSCheckV -->|No| GSWait
        
        GSWait --> GSPlayer[Player Defeated Event]
        GSPlayer --> GSIncDeaths[playerDeaths++]
        GSIncDeaths --> GSCheckD{All Players Dead?}
        GSCheckD -->|Yes| GSDefeat[Set gameOver=true]
        GSCheckD -->|No| GSWait
        
        GSWait --> GSRetarget[CheckAllTargets Event]
        GSRetarget --> GSReschedule[Reschedule in 2s]
        GSReschedule --> GSWait
        
        GSVictory --> GSEnd[Game Over]
        GSDefeat --> GSEnd
    end
    
    style HeroCreate fill:#9cf
    style HeroGameOver fill:#f99
    style EnemySpawn fill:#fc9
    style Victory fill:#9f9
    style GSCreate fill:#c9f
    style GSVictory fill:#9f9
    style GSDefeat fill:#f99
```

## 4. Rule Dependency Graph

```mermaid
graph TD
    subgraph "Initialization Rules (Missing!)"
        GameStart[GameStart Event<br/>❌ Not Defined]
        InitAttacks[Start Hero Attacks<br/>❌ Not Implemented]
        InitSpawn[Spawn Initial Enemies<br/>❌ Not Implemented]
        InitRetarget[Start Retargeting<br/>❌ Depends on EnemySpawned]
        
        GameStart --> InitAttacks
        GameStart --> InitSpawn
        InitSpawn --> InitRetarget
    end
    
    subgraph "Core Combat Rules (✓ Working)"
        DoAttack[DoAttack Event<br/>✓ Scheduled by UI]
        AttackRule[attack_rule<br/>✓ Implemented]
        AfterAttack[AfterAttack Event<br/>✓ Emitted]
        DeathCheck[death_check<br/>✓ Implemented]
        Death[Death Event<br/>✓ Emitted]
        
        DoAttack --> AttackRule
        AttackRule --> AfterAttack
        AfterAttack --> DeathCheck
        DeathCheck --> Death
        AttackRule --> DoAttack
    end
    
    subgraph "Death Handling Rules (✓ Working)"
        EnemyDeathHandler[enemy_death_handler<br/>✓ Implemented]
        PlayerDeathHandler[player_death_handler<br/>✓ Implemented]
        EnemyDefeated[EnemyDefeated Event<br/>✓ Emitted]
        PlayerDefeated[PlayerDefeated Event<br/>✓ Emitted]
        
        Death --> EnemyDeathHandler
        Death --> PlayerDeathHandler
        EnemyDeathHandler --> EnemyDefeated
        PlayerDeathHandler --> PlayerDefeated
    end
    
    subgraph "Progression Rules (✓ Working)"
        GrantXP[grant_experience<br/>✓ Implemented]
        CheckLevelUp[level_up_check<br/>✓ Implemented]
        LevelUp[LevelUp Event<br/>✓ Emitted]
        LevelUpStats[level_up_stats<br/>✓ Implemented]
        
        EnemyDefeated --> GrantXP
        GrantXP --> CheckLevelUp
        CheckLevelUp --> LevelUp
        LevelUp --> LevelUpStats
    end
    
    subgraph "Victory/Defeat Rules (✓ Working)"
        BossVictory[boss_defeated_victory<br/>✓ Implemented]
        VictoryCheck[victory_check<br/>✓ Implemented]
        GameOverCheck[game_over_check<br/>✓ Implemented]
        GameOver[GameOver Event<br/>✓ Emitted]
        
        EnemyDefeated --> BossVictory
        BossVictory --> VictoryCheck
        PlayerDefeated --> GameOverCheck
        VictoryCheck --> GameOver
        GameOverCheck --> GameOver
    end
    
    subgraph "Retargeting Rules (⚠️ Broken)"
        EnemySpawned[EnemySpawned Event<br/>⚠️ Never Emitted]
        StartRetargeting[start_global_retargeting<br/>⚠️ Never Fires]
        CheckAllTargets[CheckAllTargets Event<br/>⚠️ Never Scheduled]
        CheckEntityTarget[check_entity_target<br/>⚠️ Never Fires]
        RescheduleRetarget[reschedule_retargeting<br/>⚠️ Never Fires]
        
        EnemySpawned --> StartRetargeting
        StartRetargeting --> CheckAllTargets
        CheckAllTargets --> CheckEntityTarget
        CheckAllTargets --> RescheduleRetarget
        RescheduleRetarget --> CheckAllTargets
    end
    
    style GameStart fill:#f99
    style InitAttacks fill:#f99
    style InitSpawn fill:#f99
    style InitRetarget fill:#f99
    
    style DoAttack fill:#9f9
    style AttackRule fill:#9f9
    style AfterAttack fill:#9f9
    style DeathCheck fill:#9f9
    style Death fill:#9f9
    
    style EnemyDeathHandler fill:#9f9
    style PlayerDeathHandler fill:#9f9
    style EnemyDefeated fill:#9f9
    style PlayerDefeated fill:#9f9
    
    style GrantXP fill:#9f9
    style CheckLevelUp fill:#9f9
    style LevelUp fill:#9f9
    style LevelUpStats fill:#9f9
    
    style BossVictory fill:#9f9
    style VictoryCheck fill:#9f9
    style GameOverCheck fill:#9f9
    style GameOver fill:#9f9
    
    style EnemySpawned fill:#fc9
    style StartRetargeting fill:#fc9
    style CheckAllTargets fill:#fc9
    style CheckEntityTarget fill:#fc9
    style RescheduleRetarget fill:#fc9
```

## 5. Data Flow Through Components

```mermaid
flowchart LR
    subgraph "Input Events"
        GameStartEv[GameStart<br/>❌ Not Used]
        DoAttackEv[DoAttack<br/>✓ Scheduled]
        EnemySpawnedEv[EnemySpawned<br/>⚠️ Never Emitted]
    end
    
    subgraph "Entity Components"
        Character[Character<br/>name, class, level, xp]
        Health[Health<br/>current, max]
        Mana[Mana<br/>current, max]
        Combat[Combat<br/>damage, defense, speed]
        Target[Target<br/>entity reference]
        Team[Team<br/>id, isPlayer]
        Skills[Skills<br/>skill1-4, points]
        Buffs[Buffs<br/>damage, defense, haste]
        Enemy[Enemy<br/>tier, isBoss, expReward]
        GameState[GameState<br/>wave, kills, deaths]
    end
    
    subgraph "Rules Processing"
        AttackR[attack_rule<br/>✓ Works]
        DeathR[death_check<br/>✓ Works]
        EnemyDeathR[enemy_death_handler<br/>✓ Works]
        PlayerDeathR[player_death_handler<br/>✓ Works]
        GrantXPR[grant_experience<br/>✓ Works]
        LevelUpR[level_up_check<br/>✓ Works]
        RetargetR[start_global_retargeting<br/>⚠️ Broken]
    end
    
    subgraph "Output Events"
        AfterAttackEv[AfterAttack<br/>✓ Emitted]
        DeathEv[Death<br/>✓ Emitted]
        EnemyDefEv[EnemyDefeated<br/>✓ Emitted]
        PlayerDefEv[PlayerDefeated<br/>✓ Emitted]
        LevelUpEv[LevelUp<br/>✓ Emitted]
        CheckAllEv[CheckAllTargets<br/>⚠️ Never Scheduled]
        GameOverEv[GameOver<br/>✓ Emitted]
    end
    
    DoAttackEv --> AttackR
    AttackR --> Combat
    AttackR --> Target
    AttackR --> Health
    AttackR --> AfterAttackEv
    AttackR --> DoAttackEv
    
    AfterAttackEv --> DeathR
    DeathR --> Health
    DeathR --> DeathEv
    
    DeathEv --> EnemyDeathR
    DeathEv --> PlayerDeathR
    EnemyDeathR --> Enemy
    EnemyDeathR --> EnemyDefEv
    PlayerDeathR --> Team
    PlayerDeathR --> PlayerDefEv
    
    EnemyDefEv --> GrantXPR
    GrantXPR --> Character
    GrantXPR --> LevelUpR
    LevelUpR --> Character
    LevelUpR --> Health
    LevelUpR --> Combat
    LevelUpR --> Skills
    LevelUpR --> LevelUpEv
    
    EnemyDefEv --> GameState
    PlayerDefEv --> GameState
    
    EnemySpawnedEv --> RetargetR
    RetargetR --> GameState
    RetargetR --> CheckAllEv
    
    PlayerDefEv --> GameOverEv
    EnemyDefEv --> GameOverEv
    
    style GameStartEv fill:#f99
    style EnemySpawnedEv fill:#fc9
    style RetargetR fill:#fc9
    style CheckAllEv fill:#fc9
    
    style DoAttackEv fill:#9f9
    style AttackR fill:#9f9
    style DeathR fill:#9f9
    style EnemyDeathR fill:#9f9
    style PlayerDeathR fill:#9f9
    style GrantXPR fill:#9f9
    style LevelUpR fill:#9f9
```

## 6. Proposed Fixed Architecture

```mermaid
flowchart TB
    subgraph "UI Layer"
        UI[UI Code] --> LoadIR[Load IR]
        LoadIR --> CreateHeroes[Create Hero Entities]
        CreateHeroes --> ScheduleGS[Schedule GameStart]
        ScheduleGS --> StartEngine[Start Engine]
    end
    
    subgraph "BRL Game Rules"
        StartEngine --> GSRule[Rule: on GameStart]
        
        GSRule --> InitHeroes[Initialize Hero Attacks]
        GSRule --> InitEnemies[Spawn Initial Enemies]
        GSRule --> InitRetarget[Start Retargeting]
        
        InitHeroes --> HeroAttack1[Schedule DoAttack<br/>for Hero 0]
        InitHeroes --> HeroAttack2[Schedule DoAttack<br/>for Hero 1]
        InitHeroes --> HeroAttack3[Schedule DoAttack<br/>for Hero 2]
        InitHeroes --> HeroAttack4[Schedule DoAttack<br/>for Hero 3]
        
        InitEnemies --> SpawnEnemy1[Spawn Enemy]
        InitEnemies --> SpawnEnemy2[Spawn Enemy]
        InitEnemies --> SpawnEnemy3[Spawn Enemy]
        InitEnemies --> SpawnEnemy4[Spawn Enemy]
        InitEnemies --> SpawnEnemy5[Spawn Enemy]
        
        SpawnEnemy1 --> EmitSpawned[Emit EnemySpawned]
        SpawnEnemy2 --> EmitSpawned
        SpawnEnemy3 --> EmitSpawned
        SpawnEnemy4 --> EmitSpawned
        SpawnEnemy5 --> EmitSpawned
        
        EmitSpawned --> InitRetarget
        InitRetarget --> ScheduleRetarget[Schedule CheckAllTargets<br/>in 2 seconds]
        
        HeroAttack1 --> Combat[Combat Loop]
        HeroAttack2 --> Combat
        HeroAttack3 --> Combat
        HeroAttack4 --> Combat
        SpawnEnemy1 --> Combat
        SpawnEnemy2 --> Combat
        SpawnEnemy3 --> Combat
        SpawnEnemy4 --> Combat
        SpawnEnemy5 --> Combat
        
        Combat --> AttackRules[Attack Rules]
        Combat --> DeathRules[Death Rules]
        Combat --> ProgressionRules[Progression Rules]
        Combat --> RetargetRules[Retargeting Rules]
        
        AttackRules --> Continue{Game Over?}
        DeathRules --> Continue
        ProgressionRules --> Continue
        RetargetRules --> Continue
        
        Continue -->|No| Combat
        Continue -->|Yes| GameOver[Game Over]
    end
    
    subgraph "Results"
        GameOver --> SaveLeaderboard[Save to Leaderboard]
        SaveLeaderboard --> ShowResults[Display Results]
    end
    
    style UI fill:#9cf
    style GSRule fill:#9f9
    style InitHeroes fill:#9f9
    style InitEnemies fill:#9f9
    style InitRetarget fill:#9f9
    style Combat fill:#9f9
    style GameOver fill:#f9f
```

## Legend

- 🟢 **Green (✓)**: Currently working correctly
- 🟡 **Yellow (⚠️)**: Broken or partially working
- 🔴 **Red (❌)**: Not implemented or critical issue
