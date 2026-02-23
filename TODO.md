- [ ] 
- - [ ] 

> Spools
- [ ] Check out filamenttracker online to see how they get spool code
- [ ] Allow create and update to change spoolcode
- [ ] When deleting, show prints that will also be deleted. 
- - [  ] Need another option to switch print spools to another, or simply delete spool and foreign key.
- [ ] Allow selection of multiple spools across pages, where the user can then select "add a print with these spools"

> Prints
- [ ] Need to remove spool templates from list of choices
- [ ] Need to update spools client side, or fetch again
- [ ] When choosing spools, open a new modal, that has pagination, that a user can select from a list of spools
- - [  ] Will have "Selected Spools" at the top
- [ ] Unsure: When clicking Spools cell, should open a modal with spool info?

> Search
- [ ] Currently, if you try spool:PLA-BL, it does not give exact. if you try vendor:Bambu Lab, only Bambu will work
- - [ ] perhaps spool:PLA-BL* (wildcard), and vendor:"Bambu Lab"?
- - [ ] Make a tooltip info, that explains how to use the search, simplify placeholder text

> DB
- [ ] Figure out where db.db is stored on build (AppData?)

> QoL
- [ ] Remove default context menus
- [ ] GetShortcuts should not show developer stuff in production
- [ ] Need to cleanup on window.OnDestroy(), look at example cleanup: https://v3alpha.wails.io/features/windows/events/#ondestroy

