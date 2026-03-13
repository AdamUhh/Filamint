# Filamint - 3D Print & Filament Tracker

Track your spools and prints, simply.

## Features

- Create, edit, and delete spools and prints
- Upload files to prints with duplicate-file prevention using hashing for storage optimization
- Hotkey support for faster navigation and actions
- Advanced search using qualifier-based queries
- Customizable themes including dark, light, and more
- Configurable autocomplete suggestions for fields such as vendors, materials, and more
- Cross-platform support: Windows, Linux, and macOS


## Development

#### File Location

The application stores its **database, window state, and models/** in platform-specific directories:

- **Windows:**  
  `C:\Users\<user>\AppData\Roaming\filamint\`

- **macOS (Darwin):**  
  `/Users/<user>/Library/Application Support/filamint/`

- **Linux / Other UNIX-like OS:**  
  `/home/<user>/.local/share/filamint/`  
  *(Respects `XDG_DATA_HOME` if set)*


#### Project Structure

```bash
Filamint/
├── backend/                        # Go backend source
│   ├── main.go                     # App entry point
│   ├── internal/                   # Internal logic & services
│   │   ├── logger.go               # Logging utilities
│   │   ├── utils.go                # General helper functions
│   │   ├── windowstate.go          # Track window state (size, position)
│   │   └── services/               # Domain-specific services
│   │       ├── databaseservice.go  # DB access
│   │       ├── printrepo.go        # Print data repository
│   │       ├── printservice.go     # Print-related business logic
│   │       ├── shortcutsservice.go # Hotkey management
│   │       ├── spoolrepo.go        # Spool data repository
│   │       └── spoolservice.go     # Spool-related business logic
│
├── frontend/                        # Wails frontend (TypeScript + React)
│   ├── src/                         # App source code (components, hooks, context, lib)
│   ├── bindings/                    # Wails Go ↔ TS bindings
│   ├── package.json                  # NPM dependencies
│   ├── tsconfig.json                 # TypeScript configuration
│   └── vite.config.ts                # Vite bundler configuration
│
├── build/                           # Platform-specific build assets (Windows/Linux/macOS)
├── bin/                             # Compiled binaries
└── README.md                        # This file
```

**Commit Message Convention**

- `feat:` - New features 
- `fix:` - Bug fixes 
- `docs:` - Documentation 
- `chore:` - Maintenance 
- `refactor:` - Code restructuring without behavior change
- `perf:` - Performance improvement

Examples:
```bash
git commit -m "feat(theme): add dark mode toggle and persist preference"
git commit -m "fix(router): prevent crash when route params are undefined"
git commit -m "docs(readme): add local development setup instructions"
git commit -m "chore(deps): upgrade React to 19.0.0"
git commit -m "refactor(db): simplify spool query logic"
git commit -m "perf(cache): memoize expensive layout calculations"
```
