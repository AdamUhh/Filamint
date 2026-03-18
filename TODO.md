- [ ] 
- - [ ] 

> Spools
- [ ] Unsure: Allow selection of multiple spools across pages, where the user can then select "add a print with these spools" (cba)
- [ ] Unsure: Allow create and update to change spoolcode (eh... don't think it's necessary)

> Prints
- [ ] Unsure: Add another way to view all prints
- - [  ] Whenever you add a file, it should also save its screenshot via zip or go through each models/ and get their screenshot zip at request?
- - [  ] Then, in the 2nd view, it should show the print in a nice card view, makes it easier for users to see their prints
- - [  ] Will have to save view state (table vs grid/images)
- [ ] Unsure: When clicking Spools cell, should open a modal with spool info?
- [ ] Unsure: Should have Duplicate and Duplicate Clean. Duplicate will have sql col 'duplicate of <printId> (dId)', that way, you can easily track the first print? 

> QoL
- [ ] Add wailsv3 updater (as of 5/Mar/2026, still not implemented by wails)
- - [ ] Keep in mind, I changed taskfile.yml and project.nsi files for win/linux, so need to change those back once wails3 creates their updater
- [ ] Cleanup code
