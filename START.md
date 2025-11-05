# Quick Start Guide

## 🚀 First Time Setup

### Step 1: Install Frontend Dependencies

```bash
cd frontend
npm install
```

### Step 2: Download PocketBase

**Linux:**
```bash
cd ../backend
wget https://github.com/pocketbase/pocketbase/releases/download/v0.22.0/pocketbase_0.22.0_linux_amd64.zip
unzip pocketbase_0.22.0_linux_amd64.zip
chmod +x pocketbase
```

**macOS:**
```bash
cd ../backend
wget https://github.com/pocketbase/pocketbase/releases/download/v0.22.0/pocketbase_0.22.0_darwin_amd64.zip
unzip pocketbase_0.22.0_darwin_amd64.zip
chmod +x pocketbase
```

**Windows:**
- Download: https://github.com/pocketbase/pocketbase/releases/download/v0.22.0/pocketbase_0.22.0_windows_amd64.zip
- Extract to `backend/` folder
- Make sure `pocketbase.exe` is in the `backend/` directory

## 🏃 Running the Application

### Terminal 1 - Backend (PocketBase)

```bash
cd backend
./pocketbase serve
```

**First time only:** Open http://localhost:8090/_/ and create an admin account

### Terminal 2 - Frontend (Svelte)

```bash
cd frontend
npm run dev
```

Open http://localhost:5173 in your browser

## ✅ What to Expect

1. **First Visit**: You'll see a beautiful glassmorphism login/signup screen
2. **Sign Up**: Create your account
3. **Main Dashboard**: Card-based grid layout (currently empty)
4. **Upload**: Click "Upload Asset" button to add your first 3D model
5. **View**: Click any asset card to preview the 3D model
6. **Interact**: Use mouse to rotate, pan, and zoom the 3D model

## 📦 Supported File Formats

- `.glb` - GL Transmission Format Binary
- `.gltf` - GL Transmission Format JSON

## 🎨 UI Features

- **Glassmorphism Design**: Modern frosted glass aesthetic
- **Responsive Grid**: 1-5 columns based on screen size
- **Real-time Search**: Filter assets by name or description
- **Tag Organization**: Add and filter by tags
- **Drag & Drop**: Easy file uploads
- **3D Preview**: Interactive model viewer with Three.js

## 🐛 Troubleshooting

**Backend not starting?**
- Make sure port 8090 is not in use
- Check that pocketbase binary has execute permissions

**Frontend not loading?**
- Make sure port 5173 is not in use
- Check that npm install completed successfully
- Try deleting `node_modules` and running `npm install` again

**3D models not loading?**
- Check that the file is a valid .glb or .gltf file
- Make sure the file size is under 100MB
- Check browser console for errors

**Connection errors?**
- Make sure backend is running on http://localhost:8090
- Check that `.env` file in frontend has correct VITE_POCKETBASE_URL

## 📖 More Information

- **Full Documentation**: See `PROJECT_GUIDE.md`
- **Deployment Guide**: See `SETUP.md`
- **Backend Setup**: See `backend/README.md`

Enjoy building with your modern 3D Asset Manager! 🎉
