# Legacy Web Application Documentation

This folder contains documentation for the original **web-based** version of the 3D Asset Manager.

## Project Status

The project has **shifted focus to the desktop application** (located in `/desktop/`). The web application files are preserved for reference but are no longer actively maintained.

## Contents

- **PROJECT_GUIDE.md** - Comprehensive guide for the web application architecture
- **SETUP.md** - Deployment guide for Vercel and Fly.io
- **START.md** - Quick start guide for the web application
- **WINDOWS_SETUP.md** - Windows setup instructions for PocketBase web app
- **DESKTOP_SETUP.md** - Historical desktop setup documentation

## Web Application Architecture

The web version was built with:
- **Frontend**: Svelte + Vite + Tailwind CSS (in `/frontend/`)
- **Backend**: PocketBase (in `/backend/`)
- **3D Engine**: Three.js
- **Deployment**: Vercel (frontend) + Fly.io (backend)

## Why the Shift to Desktop?

The desktop application offers several advantages:
1. **No uploads required** - Direct file system access
2. **Better performance** - Local database and file reading
3. **Privacy** - Everything stays on your machine
4. **Offline operation** - No internet required
5. **Automatic discovery** - Folder watching and indexing

## Current Development

For current documentation and development, see:
- **Main README**: `/README.md` - Desktop application overview
- **Desktop README**: `/desktop/README.md` - Desktop-specific documentation
- **Desktop Source**: `/desktop/src/` - Active codebase

---

_These documents are preserved for historical reference and potential future web integration._
