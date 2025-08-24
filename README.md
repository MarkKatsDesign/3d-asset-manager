# 🎨 3D Asset Manager

A modern, full-stack web application for uploading, managing, and previewing 3D assets directly in the browser. Built with cutting-edge technologies and designed for scalability and ease of use.

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Svelte](https://img.shields.io/badge/Svelte-4.0+-orange.svg)
![Three.js](https://img.shields.io/badge/Three.js-Latest-green.svg)
![PocketBase](https://img.shields.io/badge/PocketBase-0.22+-purple.svg)

## ✨ Features

- **🔐 Secure Authentication** - User registration and login system
- **📤 Asset Upload & Management** - Support for GLTF/GLB 3D models with metadata
- **🖼️ Interactive 3D Preview** - Real-time 3D model viewing with orbit controls
- **⚡ Real-Time Updates** - Live synchronization across all connected clients
- **🏷️ Smart Organization** - Tag-based categorization and search functionality
- **🌐 Cloud Deployment** - Production-ready with automated CI/CD pipeline
- **📱 Responsive Design** - Works seamlessly on desktop and mobile devices

## 🛠️ Tech Stack

| Component | Technology | Purpose |
|-----------|------------|---------|
| **Frontend** | [Svelte](https://svelte.dev/) + [Vite](https://vitejs.dev/) | Modern reactive UI framework |
| **Styling** | [Tailwind CSS](https://tailwindcss.com/) | Utility-first CSS framework |
| **3D Engine** | [Three.js](https://threejs.org/) | WebGL-based 3D graphics |
| **Backend** | [PocketBase](https://pocketbase.io/) | Real-time database & file storage |
| **Deployment** | [Vercel](https://vercel.com/) + [Fly.io](https://fly.io/) | Frontend & backend hosting |
| **CI/CD** | GitHub Actions | Automated testing and deployment |

## 🚀 Quick Start

### Prerequisites

- Node.js 18+ 
- Git

### 1. Clone & Install
```bash
git clone https://github.com/MarkKatsDesign/3d-asset-manager.git
cd 3d-asset-manager
```

### 2. Backend Setup

```bash
cd backend
./pocketbase serve
```

Open `http://localhost:8090/_/` and create your admin account.

### 3. Frontend Setup

```bash
cd frontend
npm install
cp .env.example .env
npm run dev
```

Visit `http://localhost:5173` to see your application running!

## 📂 Project Structure

```
3d-asset-manager/
├── frontend/                 # Svelte application
│   ├── src/
│   │   ├── lib/
│   │   │   ├── pocketbase.js
│   │   │   └── components/
│   │   └── routes/
│   ├── static/
│   └── package.json
├── backend/                 # PocketBase backend
│   ├── pocketbase           # PocketBase binary
│   ├── pb_data/             # Database & file storage
│   ├── pb_migrations/       # Database schema
│   └── Dockerfile
└── .github/workflows/       # CI/CD automation
```

## 🌐 Deployment

This project is configured for one-click deployment:

- **Frontend**: Automatically deploys to Vercel on push to main
- **Backend**: Automatically deploys to Fly.io with persistent storage
- **Database**: Migrations run automatically on deployment

See SETUP.md for detailed deployment instructions.

## 🎯 Use Cases

- **Design Teams** - Share and review 3D assets across team members
- **Game Development** - Manage game assets and prototypes
- **Architecture** - Preview and organize architectural models
- **Education** - Create 3D model libraries for courses
- **E-commerce** - Product visualization and management

## 🤝 Contributing

We welcome contributions!

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📋 Roadmap

- [ ] Drag & drop upload interface
- [ ] Automatic thumbnail generation
- [ ] Blender plugin integration
- [ ] Advanced search and filtering
- [ ] Team collaboration features
- [ ] API rate limiting
- [ ] Asset compression optimization

## 📄 License

This project is licensed under the [MIT License](./LICENSE).


## 👨‍💻 Author

**Mark Kats**

- GitHub: [@MarkKatsDesign](https://github.com/MarkKatsDesign)
- LinkedIn: [linkedin.com/in/mark-kats](https://www.linkedin.com/in/mark-kats/)

## ⭐ Show Your Support

Give a ⭐️ if this project helped you!

---

_Built with ❤️ using modern web technologies_