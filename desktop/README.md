# Forma - Desktop Application

A powerful desktop application for managing and previewing local 3D models on Windows.

## Features

### Core Features
- **Local File Indexing** - Automatically discovers 3D models in watched folders
- **Real-time Preview** - View models directly from your file system with interactive controls
- **Thumbnail Generation** - Automatic high-quality thumbnail creation with studio lighting
- **Folder Watching** - Auto-updates when files are added/removed/modified
- **Search & Tags** - Organize and find your models easily
- **Notes System** - Add descriptions with auto-save functionality
- **No Uploads Required** - Everything stays on your local machine

### Advanced 3D Viewer Features
- **Screenshot Export** - Capture at 1080p, 2K, or 4K resolution
- **HDRI Environment System**
  - Upload custom HDRI files (.hdr, .exr, .jpg, .png)
  - 360° rotation slider for perfect lighting angles
  - Precision intensity control (0.01 steps, number input field)
  - Auto-adjusts intensity for HDR/EXR (0.4 default vs 1.0 for gradient)
  - Show HDRI as visible background or lighting-only mode
- **Camera & Animation**
  - Auto-rotation with speed control (0.05-2.0°/frame)
  - Smooth orbit controls with damping
  - Smart camera auto-positioning
- **Visual Controls**
  - Transparent background for screenshots
  - Custom background colors (5 presets + color picker)
  - Grid helper toggle
  - Dynamic UI styling (adapts to background brightness)
- **Technical Analysis** - View polygon count, vertices, meshes, materials, texture count

## Supported Formats

### 3D Models
- **GLB** (`.glb`) - Binary GLTF - Full support with textures
- **GLTF** (`.gltf`) - Text GLTF - Limited support, external files required
- **OBJ** (`.obj`) - Wavefront - Geometry only, no textures
- **FBX** (`.fbx`) - Autodesk - Full support with textures
- **STL** (`.stl`) - Stereolithography - Geometry only, no textures

### Environment Maps
- **HDR** (`.hdr`) - RGBE High Dynamic Range - Full support with rotation
- **EXR** (`.exr`) - OpenEXR - Full support with rotation
- **JPG/PNG** (`.jpg`, `.png`) - Standard images - Can be used as environment maps

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

### Getting Started
1. **Add Folders** - Click "Manage Folders" to add directories containing 3D models
2. **Auto-Discovery** - The app will automatically scan and index all supported files
3. **Browse & Preview** - Click any asset card to view the 3D model with interactive controls
4. **Search & Filter** - Use the search bar to find specific models
5. **Manage Tags** - Add tags to organize your assets
6. **Add Notes** - Write descriptions that auto-save for each asset

### 3D Viewer Controls
- **Orbit** - Left click + drag to rotate camera
- **Pan** - Right click + drag to move view
- **Zoom** - Scroll wheel to zoom in/out
- **Auto-Rotate** - Click rotate icon to enable automatic spinning
- **Screenshot** - Capture at HD, 2K, or 4K resolution

### Environment Settings
1. **Upload Custom HDRI** - Click environment icon → Upload HDRI (.hdr, .exr, .jpg, .png)
2. **Adjust Intensity** - Use slider (0-3.0) or type exact value (e.g., 0.25)
3. **Rotate Environment** - Drag HDRI Rotation slider (0-360°) for perfect lighting
4. **Background Options**
   - Toggle "Show HDRI Background" to see environment
   - Toggle "Transparent Background" for clean screenshots
   - Choose from 5 color presets or use custom color picker
5. **Technical Details** - Click "Show Details" to view model statistics

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
