# BCL Resolution rules

Blink Choice Language allows players to specify behaviour in correspondence of specific rules. Currently the resolution process of BCL is not clear: how do rule distinguish which BCL function has to be called for each player?
A clear approach is needed. Possible options (more to be considered):


1. Modify BRL / BCL / BDL  to allow associating a choice function to an entity (or to a component). Pro: resolution rules are clearly defined by the engine. Cons: not clear who and when links the function to the entity, this is important because there might be now way to create a "default BCL" for a character. Also, there could still be name clashes for BCL functions when their declaration is not bound to an entity. Might be solved with name mangling at loading.
1. Save BCL in separate files, named as the owning entity (or component for that entity). Pro: language is kept simpler. Cons: The burden falls on the engine; might require duplicate implementations in the engines (small issue). Also: entity id must be known in advance. So for example how can BCL be created for characters that do not yet exists? It would also lead to duplicate BCL for characters sharing same behaviour
1. Require BCL function names to be unique across different BCL files and bind them to the character. Pro: ???. Cons: will likely lead to name clashes when players manage their builds.


In general, choice functions must be called on an entity by BRL; either as a first parameter (so BCLs are regular function with a first parameter as entity) or implementing a sort of OOP where functions are tied to an entity.

Maybe we should allow BDL to bind BCLs to entities, so we can create default characters with their associated BCLs, and then if the players customizes the BCLs, the customized implementation is substituted. We could also say that BCL implementations can only be created already bound to an entity, to avoid name clashes. 

Also we should allow the player to customize the character name. This could be done with a "name choice" BCL. This means that in the character selection screen, the engine runtime is already used (without a timeline) to manipulate data and BCL bindings.

My current preference is that BCL live in dedicated files, and when they are loaded they get bound somehow to the right character.

