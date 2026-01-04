# BCL Resolution rules

Blink Choice Language allows players to specify behaviour in correspondence of specific rules. Currently the resolution process of BCL is not clear: how do rule distinguish which BCL function has to be called for each player?

To do so:

1. Modify BRL / BDL to make choice functions first class citizens in BRL / BDL.
1. Modify BRL / BDL to allow associating a choice function to an entity, even anonymously: ``` entity.function = choice (..params...) { function code } ```. In particular BDL is allowed to declare bound choice functions (but not unbounded ones). It's possible to assign the function from an entity to another. ```a.function = b.function ```
1. Pre-made, selected heros, are declared in a BDL, and have their choice functions anonymously declared and bound to their entities in the BDL
1. Pre-made heroes are stored in a ```Roster``` component associated to the entity representing the game 
1. The html engine exposes an interface to allow the client code to get entities and components (e.g. the game ui)
1. The html engine exposes a method to compile and execute BRL code
1. When the html ui starts, it creates a game entity, loads heroes from bdl files, creates a BRL snippet that creates the game engine, and concatenates all bdl files into it, creating the ```Roster``` component. It then executes this snippet using the engine
1. The html interface BCL editing ui gets bcl choice functions from the pre-made heroes. To do so the engine exposes an utility function to get these from the hero entity (so the ui can)
1. When BRL calls a choice functions, it calls it on the entity, so invoking the bound function e.g. ``` selectedenemy = hero.chooseEnemy(...params...)
