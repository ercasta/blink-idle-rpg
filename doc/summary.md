# Blink Idle RPG

An idle RPG where you complete the entire game in a blink... more or less!

# The Game

In Blink you define your Rpg party and some decision rules, then the entire game runs without interaction.

# Technical Characteristics

## Engine and Rules
- The game is based on a timeline / events engine
- Events are placed in the timeline (immediate or future, usually seconds or tenth of seconds); when an event resolves, corresponding rules are triggered
- The timeline supports precision up to hudrendths of seconds
- The simulation engine manages entities (ids) and components attached to the entity. 
- A component is a structure, made of fields. 
- The field types can be: string, boolean, integer, float, decimal(fixed-size precision), or id (i.e. a reference to another entity)
- An entity can have multiple components of the same type: in this case the semantics is the one of a list (the entity has a list of components of the same type)
- The simulation is based on events
- Events are entities too, so they have components
- Triggers activate specific rules in correspondence of events
- Trackers were removed from the language; use rule-emitted events or logging events to deliver UI feedback instead
- There is no explicit language for actual game content: it is represented by entities and components, whose initial state can be loaded by the engine; from that point on, rules are used to make the game progress

## (BRL) Blink Rule Language
- The game rules are written in BRL (Blink Rule Language), a language based on entity and components from Entity-Component-Systems Pattern
- The syntax of the language allows:
    - Defining components
    - Defining rules that trigger in correspondence of specific events
    - Changing component values, components associated to the entity
    - Creating new entity
    - Scheduling or stacking new events
    - Scheduling recurring events and cancelling them
- Functions and modules are supported, for modularization
- The syntax uses curly brackets to define code blocks (e.g. functions)
- The typing system is based on base types (string, boolean, integer, float, decimal(fixed-size precision), or id (i.e. a reference to another entity)) and components; when a rule / function works on a component, it means it can work on an entity having that component (as entities can have multiple components)

## (BCL) Blink Choice Language
- The player can define "choice rules" that are used by game rules to run the game
- The Choice rules are written in "Blink Choice Language"
- The syntax of the language allows:
    - READ (not write) components and entities
    - Return values (the choice)
    - Functions and modules are supported, for modularization
- The player express everything in BCL (even the choice of the party and their characteristics)

The Blink Choice Language is actually a subset of the Blink Rule Language (some expressions are disallowed, such as creating new entities, or modifying components / component values)

## Engine and toolchain implementation

- Multiple engine implementation can exist, for example a browser-only, javascript engine, a client-server engine, batch engines to run lots of games for checking rule balance, dev engines which allow fast reloading.
- The BRL (Blink Rule Language) can be compiled to various engines
- The BCL (Blink Choice Language) is usually interpreted, as it is usually written by players. Nevertheless, it could also be compiled before the game runs, for performance reasons (e.g. for batch engines)
- The BRL compiler is written in Rust: consider using an intermediate representation
- A Language Server Protocol, and VSCode Extension, is needed to support game development
- The system is documented using the Hielements Language from ercasta/hielements Github repository

