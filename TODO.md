- [ ] 
- - [ ] 

> Spools
- [ ] Allow create and update to change spoolcode
- [ ] When deleting, show prints that will also be deleted. 
- - [  ] Need another option to switch print spools to another, or simply delete spool and foreign key.
- [ ] Allow selection of multiple spools across pages, where the user can then select "add a print with these spools"

> Prints
- [ ] Add ability to upload 3MF/STL files, and view them (3d) in a window
- [ ] Add option to "print in *" e.g. OrcaSlicer
- [ ] Unsure: When clicking Spools cell, should open a modal with spool info?

> Search
- [ ] Currently, if you try spool:PLA-BL, it does not give exact. if you try vendor:Bambu Lab, only Bambu will work
- - [ ] perhaps spool:PLA-BL* (wildcard), and vendor:"Bambu Lab"?
- - [ ] Make a tooltip info, that explains how to use the search, simplify placeholder text

> DB
- [ ] Figure out where db.db is stored on build (AppData?)

> QoL
- [ ] Add updater
- [ ] Remove default context menus
- [ ] GetShortcuts should not show developer stuff in production
- [ ] Need to cleanup on window.OnDestroy(), look at example cleanup: https://v3alpha.wails.io/features/windows/events/#ondestroy

