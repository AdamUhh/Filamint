- [ ] 
- - [ ] 

> Spools
- [ ] Unsure: Allow selection of multiple spools across pages, where the user can then select "add a print with these spools"
- [ ] Unsure: Allow create and update to change spoolcode

> Prints
- [x] Add ability to upload 3MF/STL files
- [ ] View 3MF/STL in a new window
- [ ] Add option to "print in *" e.g. OrcaSlicer
- [ ] Unsure: Add another way to view prints
- - [  ] Whenever you add a file, it should also take a screenshot of the print
- - [  ] Then, in the 2nd view, it should show the print in a nice card view, makes it easier for users to see their prints
- - [  ] Will have to save view state (table vs grid/images)
- [ ] Unsure: When clicking Spools cell, should open a modal with spool info?
- [ ] Unsure: Should have Duplicate and Duplicate Clean. Duplicate will have sql col 'duplicate of <printId> (dId)', that way, you can easily track the first instance?

> QoL
- [ ] Cleanup all func and sql
- - [  ] After you clean up, you need to figure out how to optimize the code, there are too many db calls
- [ ] Add updater
- [ ] Single Instance: https://v3alpha.wails.io/guides/single-instance/

