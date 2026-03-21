<h1>
  <img src="https://github.com/AdamUhh/Filamint/blob/19f5344a0a1132d18196c773dfeb4983d64c95cc/build/appicon-sm.png" width="32" />
  Filamint - A 3D Print & Filament Tracker
</h1>

https://github.com/user-attachments/assets/ba3d763d-f333-4219-9c79-fe037de2bebd

**Keep track of your spools, and prints**

## Features

- Create, edit, and delete spools and prints
- Upload files to prints - if you've added the same file before, it won't be stored twice
- Keyboard shortcuts for faster navigation and actions
- Advanced search with qualifiers, like material:PLA or vendor:"Bambu Labs"
- Preview models directly in the app
- Open prints directly in OrcaSlicer (or whatever slicer you use) (configurable)
- Autocomplete suggestions for fields like vendor, material, etc. (configurable)
- Light and dark themes, plus a few extras
- Cross-platform support: Windows and Linux - macOS should work but hasn't been tested

## Installation

### From Source

Requires Go 1.25+ and Wails v3 - see the [Wails installation guide](https://v3alpha.wails.io/quick-start/installation/) to get set up.
```bash
git clone https://github.com/AdamUhh/Filamint.git
cd Filamint
wails3 build
```
Built files will be located in the project's `/bin` directory.

## Development

Requires Go 1.25+ and [Wails v3](https://v3alpha.wails.io/quick-start/installation/)
```bash
git clone https://github.com/AdamUhh/Filamint.git
cd Filamint
wails3 dev
```

### Testing

Basic unit tests for spool and print services (generated with Claude)
```bash
go test ./internal/services/... -v | awk '/^--- (PASS|FAIL)/{print; print ""; next} 1'
go test ./internal/updater/... -v | awk '/^--- (PASS|FAIL)/{print; print ""; next} 1'
go test ./internal/shortcuts/... -v | awk '/^--- (PASS|FAIL)/{print; print ""; next} 1'
```
If on windows, remove `| awk '/^--- (PASS|FAIL)/{print; print ""; next} 1'`

### File Locations

Filamint keeps its **database, window state, and models** in the following directories:

- **Windows:**  
  `C:\Users\<user>\AppData\Roaming\filamint\`

- **macOS (Darwin):**  
  `/Users/<user>/Library/Application Support/filamint/`

- **Linux / UNIX-like systems:**  
  `/home/<user>/.local/share/filamint/`  
  *(Will respect `XDG_DATA_HOME` if you have it set.)*


### Project Structure

```bash
Filamint/
├── backend/                          # Go backend source
│   ├── main.go                       # App entry point
│   ├── internal/                     # Internal logic & services
│   │   ├── logger.go                 # Logging utilities
│   │   ├── utils.go                  # General helper functions
│   │   ├── windowstate.go            # Track window state (size, position)
│   │   └── services/                 # Domain-specific services
│   │       ├── databaseservice.go    # DB access
│   │       ├── printrepo.go          # Print data repository
│   │       ├── printservice.go       # Print-related business logic
│   │       ├── shortcutsservice.go   # Hotkey management
│   │       ├── spoolrepo.go          # Spool data repository
│   │       └── spoolservice.go       # Spool-related business logic
│
├── frontend/                         # Wails frontend (TypeScript + React)
│   ├── src/                          # App source code (components, hooks, context, lib)
│   │   └── main.tsx                  # Frontend app entry point
│   ├── bindings/                     # Wails Go ↔ TS bindings
│   ├── package.json                  # NPM dependencies
│   ├── tsconfig.json                 # TypeScript configuration
│   └── vite.config.ts                # Vite bundler configuration
│
├── build/                            # Platform-specific build assets (Windows/Linux/macOS)
│   └── config.yml                    # Central app metadata (app name, desc, version, etc.)
├── bin/                              # Compiled binaries
└── README.md                         # This file
```

### Commit Message Convention

- `feat:` - New features 
- `fix:` - Bug fixes 
- `docs:` - Documentation 
- `chore:` - Maintenance 
- `refactor:` - Code restructuring without behavior change
- `perf:` - Performance improvements

Examples:
```bash
git commit -m "feat(theme): add dark mode toggle and persist preference"
git commit -m "fix(router): prevent crash when route params are undefined"
git commit -m "docs(readme): add local development setup instructions"
git commit -m "chore(deps): upgrade React to 19.0.0"
git commit -m "refactor(db): simplify spool query logic"
git commit -m "perf(cache): memoize expensive layout calculations"
```

## License

MIT - see [LICENSE](https://github.com/AdamUhh/Filamint/blob/main/LICENSE)
