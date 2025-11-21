# 3D Asset Manager - Desktop Application

A desktop application for managing and previewing local 3D assets on Windows.

## Features

- **Local File Indexing** - Automatically discovers 3D models in watched folders
- **Real-time Preview** - View GLB/GLTF models directly from your file system
- **Thumbnail Generation** - Automatic thumbnail creation for quick browsing
- **Folder Watching** - Auto-updates when files are added/removed/modified
- **Search & Tags** - Organize and find your models easily
- **No Uploads Required** - Everything stays on your local machine

## Supported Formats

- GLB (GL Transmission Format Binary)
- GLTF (GL Transmission Format)

## Installation

### Prerequisites

- Node.js 18 or higher
- Windows 10/11

### Setup

```bash
# Install dependencies
npm install

# Run in development mode
npm run dev

# Build for production
npm run build

# Package as Windows installer
npm run package:win
```

## Usage

1. **Add Folders** - Click "Manage Folders" to add directories containing 3D models
2. **Auto-Discovery** - The app will automatically scan and index all GLB/GLTF files
3. **Browse & Preview** - Click any asset card to view the 3D model
4. **Search & Filter** - Use the search bar to find specific models
5. **Manage Tags** - Add tags to organize your assets

## Architecture

### Main Process (`src/main/`)
- **main.ts** - Electron entry point
- **services/database.ts** - SQLite database for metadata
- **services/fileWatcher.ts** - Folder watching and auto-indexing
- **services/thumbnail.ts** - Thumbnail generation coordination

### Renderer Process (`src/`)
- **Svelte Components** - UI built with Svelte
- **Three.js** - 3D model rendering
- **Local Stores** - State management for local-first data

### Data Storage
- **SQLite Database** - Asset metadata and thumbnails
- **Local Files** - Models remain in their original locations

## Development

```bash
# Start dev server
npm run dev

# TypeScript type checking
tsc --noEmit
```

The app runs Vite dev server on port 5173 and Electron connects to it in development mode.

## Building for Production

```bash
# Build renderer and main process
npm run build

# Package for Windows
npm run package:win
```

This creates installers in the `release/` directory.

## Roadmap

- [ ] Real thumbnail generation (currently placeholders)
- [ ] macOS and Linux support
- [ ] Optional cloud sync with original web app
- [ ] File format support (FBX, OBJ, etc.)
- [ ] Batch operations
- [ ] Model statistics and analysis

## License

MIT
