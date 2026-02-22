- [ ] 
- - [ ] 

> Spools
- [ ] In normal spool mode, 'create template from this spool', because i want to prevent them from duplicating in normal mode
- [ ] Check out filamenttracker online to see how they get spool code
- [ ] Allow create and update to change spoolcode
- [ ] When deleting, show prints that will also be deleted

> Prints
- [ ] Need to update spools client side, or fetch again
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
