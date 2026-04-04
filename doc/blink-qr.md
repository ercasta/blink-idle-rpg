# Blink-QR

I am going to create a streamlined version of the game. The players will not edit BCL rules, instead they will just configure their hero using:

- a name
- stats progression
- skill progression
- 3 behaviour sections:
    - one for early game
    - one for mid game
    - one for end game
    
Each behaviour section will contain:
- the level at which it triggers (only for mid game and end game)
- 24 "behaviour bytes": values ranging from -128 to 127, such as fight / flight, attack / defense, area and difficulty selection criteria
- primary, secondary, passive skill

The entire hero description will have to fit on a QR code that includes the link to the game e.g. www.allsoulsrun.net/g.html?h=<BASE64 encoded hero>

There will be at most 256 Skills in the game so 1 byte per skill. 

Also the player will be able to scan hero qr codes to add them to the roster. See also "digital figurines.md", but without google drive archiving.

The game will be played in a browser in mobile, so for efficiency we'll use webassembly.

But in the game interface we won't have brl / bcl / bdl compilation screens (they might fight in a "studio" version for game creators, which will not be initially published).

The user will have the opportunity to configure his/her hero direcly on mobile, so an extensive, mobile friendly character creation screen must be created. Also the game must allow creating the digital figurines to print, or share with friends on whatsapp / other channels. 

The game right now is in an unfinished / buggy state. 

First perform an analysis of the repository to identify which parts will need to be updated according to this new specification. Create a document to drive the repository cleanup. Propose different options and in general if you have doubts leave Open Issues in the document, for my review
