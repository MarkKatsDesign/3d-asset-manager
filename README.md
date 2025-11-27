# Forma

> **A powerful desktop application for managing and previewing 3D models locally.**

Built with Electron, Svelte, and Three.js for Windows 10/11.

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Platform](https://img.shields.io/badge/platform-Windows-blue.svg)
![Electron](https://img.shields.io/badge/Electron-28.1.0-47848F.svg)
![Svelte](https://img.shields.io/badge/Svelte-4.2.8-FF3E00.svg)
![Three.js](https://img.shields.io/badge/Three.js-0.160.0-000000.svg)

## Overview

**Forma** is a local-first desktop application designed for game developers, VFX artists, 3D designers, and anyone working with 3D models. It solves a simple but critical problem: **Windows doesn't show 3D model previews in File Explorer**.

Instead of uploading files to the cloud or opening each model in heavy 3D software, Forma automatically discovers, indexes, and previews your local 3D models with beautiful thumbnails and an interactive 3D viewer.

## Screenshots

![Forma Application](docs/images/screenshot-placeholder.png)
*Main interface showing asset grid with thumbnails and 3D preview (screenshots coming soon)*

> **Note**: This is an early version. Professional screenshots and demo GIFs will be added soon.

## Features

### Core Features
- **Local File Indexing** - Automatically discovers 3D models in watched folders
- **Real-time 3D Preview** - Interactive viewer with orbit controls, lighting, and materials
- **Thumbnail Generation** - Automatic high-quality thumbnail creation with studio lighting
- **Folder Watching** - Auto-updates when files are added, modified, or removed
- **Multi-Format Support** - GLB, GLTF, OBJ, FBX, and STL files
- **Search & Organization** - Tag-based categorization and powerful search
- **Notes & Metadata** - Add descriptions with auto-save functionality
- **100% Offline** - Everything stays on your local machine, no uploads required
- **Fast Performance** - Direct file system access with SQLite database

### Advanced Features
- **Screenshot Export** - Capture 3D viewport at multiple resolutions (1080p, 2K, 4K)
- **Environment Mapping** - HDRI support for realistic lighting
- **Theme System** - Light/dark themes with customizable backgrounds
- **File Explorer Integration** - "Show in Explorer" to quickly locate files
- **Material Support** - Full PBR material rendering with textures
- **Geometry-Only Formats** - Special handling for formats without textures (OBJ, STL)

## Supported Formats

| Format | Extension | Type | Textures |
|--------|-----------|------|----------|
| **GLB** | `.glb` | Binary GLTF | ✅ Full support |
| **GLTF** | `.gltf` | Text GLTF (limited) | ⚠️ External files required |
| **OBJ** | `.obj` | Wavefront | ⚠️ Geometry only |
| **FBX** | `.fbx` | Autodesk | ✅ Full support |
| **STL** | `.stl` | Stereolithography | ⚠️ Geometry only |

## Installation

### Prerequisites

- **Windows 10/11** (64-bit)
- **Node.js 18+** (for development only)

### For End Users

**Releases**: Coming soon - watch this repository for the first stable release

**Early Access**: Build from source using the instructions below

### For Developers

**Build from source:**

```bash
# Clone the repository
git clone https://github.com/MarkKatsDesign/3d-asset-manager.git
cd 3d-asset-manager/desktop

# Install dependencies
npm install

# Run in development mode
npm run dev
```

The application will launch automatically. On first run:
1. Click "Manage Folders" in the top-right
2. Select a directory containing 3D models (.glb, .obj, .fbx, .stl)
3. Forma will automatically scan and generate thumbnails
4. Click any asset to preview in 3D!

## Development

### Build for Production

```bash
# Build renderer and main process
npm run build

# Package as Windows installer
npm run package:win
```

Output files will be in `release/` directory:
- `Forma Setup.exe` - NSIS installer
- `Forma.exe` - Portable executable

> **Note**: Icon files are currently placeholders. Custom icons will be added before the first release.

## Architecture

### Technology Stack

| Component | Technology | Purpose |
|-----------|------------|---------|
| **Desktop Framework** | Electron 28.1.0 | Cross-platform desktop apps |
| **Frontend** | Svelte 4.2.8 | Reactive UI framework |
| **3D Engine** | Three.js 0.160.0 | WebGL-based 3D rendering |
| **Database** | better-sqlite3 9.2.2 | Fast local storage |
| **File Watching** | chokidar 3.5.3 | File system monitoring |
| **Build Tool** | Vite 5.0.11 | Fast builds and HMR |
| **Styling** | Tailwind CSS 3.4.1 | Utility-first CSS |

### Project Structure

```
desktop/
├── src/
│   ├── main/                   # Electron main process
│   │   ├── main.ts             # Application entry point
│   │   └── services/
│   │       ├── database.ts     # SQLite database service
│   │       ├── fileWatcher.ts  # Folder watching and auto-indexing
│   │       └── thumbnail.ts    # Thumbnail generation coordination
│   ├── preload/                # Secure IPC bridge
│   │   └── preload.ts          # Exposes safe APIs to renderer
│   └── lib/                    # Svelte UI components
│       ├── components/
│       │   ├── AssetViewer.svelte    # 3D viewer with Three.js
│       │   ├── AssetCard.svelte      # Thumbnail cards
│       │   ├── AssetGrid.svelte      # Grid layout
│       │   ├── FolderManager.svelte  # Folder management
│       │   └── ...
│       ├── stores/
│       │   ├── localAssetStore.js    # Asset state management
│       │   └── folderStore.js        # Folder state management
│       └── utils/
│           └── thumbnailGenerator.js # Client-side thumbnail generation
├── package.json
├── vite.config.ts
└── README.md
```

### Data Storage

- **Database Location**: `%APPDATA%/forma-desktop/assets.db`
  - Windows: `C:\Users\<YourName>\AppData\Roaming\forma-desktop\assets.db`
- **Schema**:
  - `assets` - Model metadata (name, path, tags, description)
  - `thumbnails` - Generated preview images (BLOB)
  - `watched_folders` - Monitored directories

## Use Cases

- **Game Development** - Manage game assets and character models
- **VFX & Animation** - Organize production assets
- **3D Printing** - Preview and catalog STL files
- **Architecture** - Browse architectural models
- **Education** - Create 3D model libraries for courses
- **Product Design** - Manage product prototypes and variants

## Roadmap

- [ ] macOS and Linux support
- [ ] Batch operations (rename, tag multiple assets)
- [ ] Model statistics (polygon count, texture information)
- [ ] Collection/project organization
- [ ] Advanced filtering and sorting
- [ ] Import/export asset catalogs
- [ ] Optional cloud sync (as backup feature)

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## License

This project is licensed under the [MIT License](./LICENSE).

## Author

**Mark Kats**

- GitHub: [@MarkKatsDesign](https://github.com/MarkKatsDesign)
- LinkedIn: [linkedin.com/in/mark-kats](https://www.linkedin.com/in/mark-kats/)

---

## Legacy Web Application

This repository originally contained a web-based version of this 3D asset management tool. The web application files are preserved in:
- `frontend/` - Svelte web application
- `backend/` - PocketBase backend
- `docs/legacy/` - Web app documentation

The project has shifted focus to **Forma**, the desktop application, for better performance, privacy, and offline capabilities.

---

⭐ **Star this repo** if you find it useful!

_Built with Electron, Svelte, and Three.js_
