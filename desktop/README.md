# Forma - Desktop Application

A powerful desktop application for managing and previewing local 3D models on Windows.

## Features

- **Local File Indexing** - Automatically discovers 3D models in watched folders
- **Real-time Preview** - View GLB/GLTF models directly from your file system
- **Thumbnail Generation** - Automatic thumbnail creation for quick browsing
- **Folder Watching** - Auto-updates when files are added/removed/modified
- **Search & Tags** - Organize and find your models easily
- **No Uploads Required** - Everything stays on your local machine

## Supported Formats

- **GLB** (GL Transmission Format Binary) - Full support with textures
- **GLTF** (GL Transmission Format) - Limited support, external files required
- **OBJ** (Wavefront) - Geometry only, no textures
- **FBX** (Autodesk) - Full support with textures
- **STL** (Stereolithography) - Geometry only, no textures

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
2. **Auto-Discovery** - The app will automatically scan and index all supported files (.glb, .gltf, .obj, .fbx, .stl)
3. **Browse & Preview** - Click any asset card to view the 3D model with interactive controls
4. **Search & Filter** - Use the search bar to find specific models
5. **Manage Tags** - Add tags to organize your assets
6. **Add Notes** - Write descriptions that auto-save for each asset
7. **Screenshot Export** - Capture high-resolution images (1080p, 2K, 4K)
8. **Show in Explorer** - Quickly locate files in Windows File Explorer

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

## Data Storage

- **Database Location**: `%APPDATA%/forma-desktop/assets.db`
  - Windows: `C:\Users\<YourName>\AppData\Roaming\forma-desktop\assets.db`
- **Thumbnails**: Stored as BLOB in SQLite database
- **Model Files**: Remain in their original locations (no copying)

## Building for Production

```bash
# Build renderer and main process
npm run build

# Package for Windows
npm run package:win
```

This creates installers in the `release/` directory.

## Roadmap

- [ ] macOS and Linux support
- [ ] Batch operations (rename, tag multiple assets)
- [ ] Model statistics and analysis (polygon count, texture info)
- [ ] Collection/project organization
- [ ] Advanced filtering and sorting
- [ ] Import/export asset catalogs
- [ ] Optional cloud backup feature

## License

MIT
