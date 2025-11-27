# 🛠️ Setup & Development Guide

This guide provides detailed instructions for setting up the development environment and deploying the 3D Asset Manager.

## 📋 Prerequisites

Before you begin, ensure you have the following installed:
- **Node.js** 18.0.0 or higher
- **npm** 9.0.0 or higher
- **Git** latest version
- **Modern web browser** (Chrome, Firefox, Safari, Edge)

## 🏗️ Local Development Setup

### Step 1: Environment Setup

1. **Clone the repository**
```bash
git clone https://github.com/MarkKatsDesign/3d-asset-manager.git
cd 3d-asset-manager
```

2. **Download PocketBase**
    - Visit [PocketBase releases](https://github.com/pocketbase/pocketbase/releases)
    - Download the appropriate binary for your OS
    - Place it in the `backend/` directory
    - Make it executable (macOS/Linux): `chmod +x backend/pocketbase`

### Step 2: Backend Configuration

1. **Start PocketBase**

```bash
cd backend
./pocketbase serve
```

2. **Configure Admin Account**
    
    - Open `http://localhost:8090/_/`
    - Create your admin account
    - Note your credentials for later use
3. **Create Collections**
    
    Create an `assets` collection with these fields:
    
    - `title` (Text, Required)
    - `description` (Text, Optional)
    - `tags` (JSON, Optional)
    - `file` (File, Required, Max size: 50MB)
    - `owner` (Relation to users, Required)
    
    Create a `users` collection for authentication (PocketBase handles this automatically with auth).
    

### Step 3: Frontend Configuration

1. **Install dependencies**

```bash
cd frontend
npm install
```

2. **Environment configuration**

```bash
cp .env.example .env
```

Edit `.env`:

```env
VITE_PB_URL=http://localhost:8090
```

3. **Start development server**

```bash
npm run dev
```

Your application will be available at `http://localhost:5173`

## 🌐 Production Deployment

### Backend Deployment (Fly.io)

1. **Install Fly CLI**

```bash
curl -L https://fly.io/install.sh | sh
```

2. **Login to Fly**

```bash
fly auth login
```

3. **Deploy backend**

```bash
cd backend
fly launch --no-deploy
fly volumes create pb_data --size 1 --region syd
fly deploy
```

4. **Configure admin account on production**
    - Visit `https://<your-fly-app-name>.fly.dev/_/`  
      *(Replace `<your-fly-app-name>` with your actual Fly.io app name)*
    - Set up your production admin account

### Frontend Deployment (Vercel)

1. **Install Vercel CLI**

```bash
npm i -g vercel
```

2. **Deploy frontend**

```bash
cd frontend
vercel --prod
```

3. **Set environment variables** In Vercel dashboard, add:
    
    ```
    VITE_PB_URL=https://<your-fly-app-name>.fly.dev
    ```
    *(Replace `<your-fly-app-name>` with your actual Fly.io backend app name)*
    

### Automated Deployment (GitHub Actions)

1. **Set up GitHub Secrets**
    
    In your repository settings, add these secrets:
    
    - `FLY_API_TOKEN`: Get from `fly auth token`
    - `VERCEL_TOKEN`: From Vercel account settings
    - `VERCEL_ORG_ID`: From Vercel project settings
    - `VERCEL_PROJECT_ID`: From Vercel project settings
2. **Push to main branch**
    
    The GitHub Actions workflow will automatically:
    
    - Deploy backend to Fly.io
    - Deploy frontend to Vercel
    - Run database migrations

## 🔧 Development Workflow

### Adding New Features

1. **Create feature branch**

```bash
git checkout -b feature/new-feature-name
```

2. **Make changes**
    
    - Frontend changes go in `frontend/src/`
    - Backend schema changes go in `pb_migrations/`
3. **Test locally**
    

```bash
# Terminal 1: Backend
cd backend && ./pocketbase serve

# Terminal 2: Frontend
cd frontend && npm run dev
```

4. **Commit and push**

```bash
git add .
git commit -m "Add new feature description"
git push origin feature/new-feature-name
```

### Database Migrations

Create migration files in `pb_migrations/` following the naming convention:

```
001_initial.js
002_add_tags.js
003_add_metadata.js
```

### File Structure Best Practices

```
frontend/src/
├── lib/
│   ├── components/     # Reusable Svelte components
│   ├── stores/         # Svelte stores for state management
│   ├── utils/          # Utility functions
│   └── pocketbase.js   # PocketBase client setup
├── routes/             # SvelteKit routes
└── app.html           # HTML template
```

## 🐛 Troubleshooting

### Common Issues

1. **PocketBase not starting**
    
    - Ensure the binary has execute permissions
    - Check if port 8090 is available
    - Verify you're in the correct directory
2. **Frontend not connecting to backend**
    
    - Verify `VITE_PB_URL` in `.env`
    - Check CORS settings in PocketBase admin
    - Ensure backend is running
3. **File upload issues**
    
    - Check file size limits (default 50MB)
    - Verify supported file types (GLTF, GLB)
    - Ensure proper permissions on upload directory

### Performance Optimization

1. **3D Model Optimization**
    
    - Use compressed GLTF/GLB files
    - Optimize textures before upload
    - Consider model complexity for web viewing
2. **Frontend Optimization**
    
    - Enable Three.js renderer optimizations
    - Implement lazy loading for large model lists
    - Use proper caching strategies

## 📞 Getting Help

If you encounter issues:

1. Check the [Issues](https://github.com/MarkKatsDesign/3d-asset-manager/issues) page
2. Review PocketBase [documentation](https://pocketbase.io/docs/)
3. Check Svelte [documentation](https://svelte.dev/docs)
4. Open a new issue with detailed information

## 🔄 Updating Dependencies

Keep your project up to date:

```bash
# Frontend dependencies
cd frontend && npm update

# Check for security vulnerabilities
npm audit && npm audit fix
```

---

_Happy coding! 🚀_