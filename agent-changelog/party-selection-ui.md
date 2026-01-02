# Party Selection UI Implementation

## Request
Add party selection screen before game start, with:
- Character selection from premade characters
- Display BCL and description for each character
- Mobile-friendly UI
- Simpler, brownish color palette (less saturated)

## Changes to hielements.hie
- Added `game_content` element to track game data structure
- Added `data` sub-element for character definitions
- Reorganized to better reflect actual game structure

## Changes to game/data/
- Created `characters.json` with 6 premade characters
  - Each has stats, BCL reference, description, role, and playstyle
  - Characters: Warrior, Mage, Rogue, Cleric, Ranger, Paladin

## Changes to game/demos/rpg-demo.html (planned)
- Add party selection screen before game initialization
- Character cards with detailed information
- Mobile-responsive card layout
- Update color palette to brownish tones
- Integrate selection with game start

## Implementation Status
- [x] Create character data file
- [x] Update hielements.hie
- [ ] Create party selection UI
- [ ] Update color palette
- [ ] Test on mobile
