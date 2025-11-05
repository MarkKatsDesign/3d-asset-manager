# Backend Setup - PocketBase

This directory contains the PocketBase backend for the 3D Asset Manager.

## Quick Start

### 1. Download PocketBase

Download the appropriate PocketBase binary for your system:

**Linux:**
```bash
cd backend
wget https://github.com/pocketbase/pocketbase/releases/download/v0.22.0/pocketbase_0.22.0_linux_amd64.zip
unzip pocketbase_0.22.0_linux_amd64.zip
chmod +x pocketbase
```

**macOS:**
```bash
cd backend
wget https://github.com/pocketbase/pocketbase/releases/download/v0.22.0/pocketbase_0.22.0_darwin_amd64.zip
unzip pocketbase_0.22.0_darwin_amd64.zip
chmod +x pocketbase
```

**Windows:**
Download from: https://github.com/pocketbase/pocketbase/releases/download/v0.22.0/pocketbase_0.22.0_windows_amd64.zip

### 2. Run PocketBase

```bash
./pocketbase serve
```

### 3. Access Admin UI

Open your browser to: http://localhost:8090/_/

Create your admin account when prompted.

### 4. Database Schema

The `assets` collection will be automatically created from the migration file with the following fields:

- **name** (text, required) - Asset name
- **description** (text, optional) - Asset description
- **file** (file, required) - The 3D model file (.glb/.gltf)
- **thumbnail** (file, optional) - Preview thumbnail image
- **tags** (json, optional) - Array of tags for categorization
- **user** (relation, required) - User who uploaded the asset

### Access Rules

- **List/View**: Authenticated users only
- **Create**: Authenticated users can create assets
- **Update/Delete**: Only the asset owner

## Production Deployment

For production deployment to Fly.io or other platforms, see the main SETUP.md file.
