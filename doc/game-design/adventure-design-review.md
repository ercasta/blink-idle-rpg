# Adventure System Design Review

Story mode currently generates stories that are sometimes inconsistent and have little appeal from a storytelling perspective.

I think we need to act on multiple levels:
- **Narrative content expansion**: dialogues, descriptions, must be extended
- **Narrative consistency and event ordering**: some things still happen out of order, e.g. enemy fights while heroes are solving hero encounters.

Some Ideas:
- **Pathos level management**: randomly generate a "pathos pattern" e.g. flat, up, peak, down, or going up / down multiple times. In the encounter/events library, assign a "pathos level" to each encounter, so when the story encounters are randomly selected, they are selected in a way that follows that story "pathos pattern" (there might be a library of pathos patterns that are randomly)
- **Structure**: the story might have a multilevel structure, e.g. a backbone made by a main quest, potentially made of a predetermined set of steps; on top of this, some minor events or side quests might happen. The steps of the main / side quests might involve travelling to a set of locations, e.g. the story might specify that the initial location is also the final location where the heroes must be, so even if the first location is drawn randomly, it will also be the last one to be visited. This might be managed by defining a set of locations (like the "pluggable slots" concept) that are referenced multiple times.
- **Characterization**: create dialogues with "pluggable characters" e.g. some parts of dialogues select the speaker, or the person addressed, based on hero traits. Each piece of dialogue has "affinity traits" that allow selecting a character
- **Consistency**: combined with the previous idea, once a character is selected, this information is tracked as subsequent piece of dialogue will select the same character
- **Inertia**: some things shift gradually. Hero mood. Hostility / friendship with NPCs, etc.
- **Localization**: some things might only happen in some location, or locations with some characteristics, like mountain, town.
- **Dynamicity**: some parts of the descriptions, or hero comments, might be based not only on hero traits but also on condition, e.g. mood, night / day, weather.


Everything must be designed in a way that content might be gradually expanded by game authors in terms of content.

Testing the system.
- We might generate a set of stories and see how well they could be represented by the adventure design system we are designing, reflecting on possible improvements / issues.
