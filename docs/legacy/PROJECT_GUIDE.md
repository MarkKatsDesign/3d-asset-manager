# 3D Asset Manager - Project Guide

## 🎨 Overview

This is a modern, full-stack 3D asset management platform featuring:

- **Glassmorphism UI Design** - Beautiful Apple-inspired liquid glass interface
- **Sketchfab-like Layout** - Card-based grid with interactive 3D previews
- **Modern Tech Stack** - Svelte, Three.js, Tailwind CSS, PocketBase
- **Real-time 3D Viewing** - Pan, rotate, and zoom 3D models directly in browser
- **Drag & Drop Upload** - Intuitive asset upload interface
- **Smart Organization** - Tag-based filtering and search

## 📁 Project Structure

```
3d-asset-manager/
├── frontend/                          # Svelte frontend application
│   ├── src/
│   │   ├── lib/
│   │   │   ├── components/           # UI Components
│   │   │   │   ├── Navbar.svelte     # Navigation bar with glassmorphism
│   │   │   │   ├── SearchBar.svelte  # Search and filter interface
│   │   │   │   ├── AssetCard.svelte  # Individual asset card
│   │   │   │   ├── AssetGrid.svelte  # Responsive asset grid
│   │   │   │   ├── AssetViewer.svelte # 3D model viewer with Three.js
│   │   │   │   ├── UploadModal.svelte # Drag & drop upload modal
│   │   │   │   └── Auth.svelte       # Authentication UI
│   │   │   ├── stores/               # Svelte stores
│   │   │   │   ├── authStore.js      # Authentication state
│   │   │   │   └── assetStore.js     # Asset management state
│   │   │   └── pocketbase.js         # PocketBase client setup
│   │   ├── App.svelte                # Main app component
│   │   ├── main.js                   # App entry point
│   │   └── app.css                   # Global styles with glassmorphism
│   ├── index.html                    # HTML entry point
│   ├── package.json                  # Dependencies
│   ├── vite.config.js                # Vite configuration
│   ├── tailwind.config.js            # Tailwind with custom utilities
│   ├── postcss.config.js             # PostCSS configuration
│   └── .env                          # Environment variables
│
├── backend/                          # PocketBase backend
│   ├── pb_migrations/                # Database migrations
│   │   └── 1699900000_create_assets.js
│   ├── README.md                     # Backend setup guide
│   └── .gitignore
│
├── README.md                         # Main project README
├── SETUP.md                          # Deployment guide
└── PROJECT_GUIDE.md                  # This file
```

## 🚀 Quick Start

### Prerequisites

- Node.js 18 or higher
- Git

### 1. Backend Setup

```bash
cd backend

# Download PocketBase (Linux/macOS)
wget https://github.com/pocketbase/pocketbase/releases/download/v0.22.0/pocketbase_0.22.0_linux_amd64.zip
unzip pocketbase_0.22.0_linux_amd64.zip
chmod +x pocketbase

# Start PocketBase
./pocketbase serve
```

Open http://localhost:8090/_/ and create your admin account.

### 2. Frontend Setup

```bash
cd frontend

# Install dependencies
npm install

# Start development server
npm run dev
```

Open http://localhost:5173 in your browser.

## 🎨 Design Philosophy

### Glassmorphism UI

The interface uses modern glassmorphism design with:

- **Frosted glass effects** using backdrop-blur
- **Semi-transparent backgrounds** for depth
- **Subtle borders** with white/20 opacity
- **Smooth animations** for interactions
- **Gradient accents** for visual interest

### Color Palette

```css
Background: Gradient from slate-900 via purple-900 to slate-900
Primary: Indigo-500 (#6366f1)
Secondary: Purple-500 (#a855f7)
Accent: Pink-400 (#f472b6)
Glass: White with 10-20% opacity
```

### Typography

- **Font**: Inter (modern, futuristic)
- **Sizes**: Responsive from text-sm to text-6xl
- **Weights**: 300 to 900 for hierarchy

## 🧩 Component Architecture

### Core Components

**Navbar.svelte**
- Fixed top navigation with glassmorphism
- User profile menu
- Upload button
- Responsive design

**AssetCard.svelte**
- Thumbnail display with placeholder
- Hover effects with scale transform
- Metadata display (tags, date, owner)
- Delete functionality
- Click to preview

**AssetGrid.svelte**
- Responsive grid (1-5 columns based on screen size)
- Loading skeleton states
- Empty state with call-to-action
- Search/filter integration

**AssetViewer.svelte**
- Full-screen modal with Three.js renderer
- Orbit controls (pan, rotate, zoom)
- Dynamic lighting setup
- Model auto-centering and scaling
- Download functionality

**UploadModal.svelte**
- Drag and drop file zone
- File validation (.glb, .gltf)
- Metadata input (name, description, tags)
- Upload progress indication
- Error handling

**Auth.svelte**
- Login/Register toggle
- Form validation
- Error messages
- Animated transitions

### State Management

**authStore.js**
- User authentication state
- Login/logout methods
- Auto-sync with PocketBase auth

**assetStore.js**
- Asset collection state
- CRUD operations
- Search and filter logic
- Real-time updates

## 🎯 Key Features

### 1. 3D Model Preview
- Powered by Three.js
- Supports GLB and GLTF formats
- Interactive orbit controls
- Professional lighting setup
- Automatic model centering

### 2. Asset Management
- Upload with drag & drop
- Tag-based organization
- Real-time search
- Filter by tags
- Delete assets

### 3. Authentication
- Secure user registration
- Email/password login
- Session persistence
- Protected routes

### 4. Responsive Design
- Desktop-optimized (up to 1920px)
- Grid adapts: 1/2/3/4/5 columns
- Mobile-friendly
- Touch-friendly controls

## 🔧 Customization

### Changing Colors

Edit `tailwind.config.js`:

```js
colors: {
  glass: {
    light: 'rgba(255, 255, 255, 0.1)',
    medium: 'rgba(255, 255, 255, 0.15)',
    dark: 'rgba(0, 0, 0, 0.2)',
  }
}
```

### Modifying Grid Layout

Edit `AssetGrid.svelte`:

```svelte
<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-6">
```

### Adding New Fields

1. Update PocketBase schema in `pb_migrations/`
2. Update `assetStore.js` upload method
3. Update `UploadModal.svelte` form
4. Update `AssetCard.svelte` display

## 🚀 Performance Optimization

### Current Optimizations

- Vite for fast HMR and builds
- Lazy loading of 3D models
- Optimized Three.js renderer settings
- Efficient Svelte reactivity
- Tailwind CSS purging

### Future Improvements

- Virtual scrolling for large grids
- Progressive image loading
- Asset compression
- CDN integration
- Service worker caching

## 🎓 Learning Resources

- [Svelte Tutorial](https://svelte.dev/tutorial)
- [Three.js Documentation](https://threejs.org/docs/)
- [Tailwind CSS Docs](https://tailwindcss.com/docs)
- [PocketBase Guide](https://pocketbase.io/docs/)
- [Glassmorphism Design](https://uxdesign.cc/glassmorphism-in-user-interfaces-1f39bb1308c9)

## 📝 Next Steps

1. **Install dependencies**: `cd frontend && npm install`
2. **Start backend**: Download and run PocketBase
3. **Start frontend**: `npm run dev`
4. **Create an account**: Sign up through the UI
5. **Upload assets**: Drag & drop your first 3D model!

## 🤝 Contributing

Feel free to customize and extend this base:

- Add more 3D file format support
- Implement team collaboration
- Add asset version control
- Create export/import functionality
- Implement advanced filtering

## 📄 License

MIT License - Feel free to use this as a base for your projects!
