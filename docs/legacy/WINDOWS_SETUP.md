# Windows Setup Guide for 3D Asset Manager

## Step 1: Download PocketBase

1. Download PocketBase for Windows:
   - Go to: https://github.com/pocketbase/pocketbase/releases/download/v0.22.0/pocketbase_0.22.0_windows_amd64.zip
   - Or use this direct link: https://github.com/pocketbase/pocketbase/releases/latest
   - Look for `pocketbase_X.XX.X_windows_amd64.zip`

2. Extract the ZIP file
3. Copy `pocketbase.exe` to the `backend` folder in your project
   ```
   D:\projects\3d-asset-manager\backend\pocketbase.exe
   ```

## Step 2: Start PocketBase

### Option A: Using the Batch Script
1. Double-click `backend\start.bat`
2. A terminal window will open

### Option B: Using Command Prompt
1. Open Command Prompt
2. Navigate to your project:
   ```cmd
   cd D:\projects\3d-asset-manager\backend
   ```
3. Start PocketBase:
   ```cmd
   pocketbase.exe serve
   ```

You should see output like:
```
Server started at http://127.0.0.1:8090
├─ REST API: http://127.0.0.1:8090/api/
└─ Admin UI: http://127.0.0.1:8090/_/
```

## Step 3: Create Admin Account

1. Open your browser to: **http://localhost:8090/_/**
2. You'll see a setup screen
3. Create your admin account:
   - Email: `admin@example.com` (or your preferred email)
   - Password: (create a secure password)
4. Click "Create and login"

## Step 4: Create the Assets Collection

Now we need to manually create the `assets` collection:

1. In the PocketBase Admin UI, click **"Collections"** in the left sidebar
2. Click **"+ New collection"**
3. Choose **"Base collection"**
4. Set the name to: `assets`

### Add Fields to the Assets Collection:

Click on the `assets` collection, then **"+ New field"** for each:

#### Field 1: Name
- **Type**: Text
- **Name**: `name`
- **Required**: ✓ Yes
- **Max length**: 200

#### Field 2: Description
- **Type**: Text
- **Name**: `description`
- **Required**: ✗ No
- **Max length**: 1000

#### Field 3: File
- **Type**: File
- **Name**: `file`
- **Required**: ✓ Yes
- **Max files**: 1
- **Max file size**: 100 MB (or 104857600 bytes)
- **Allowed types**: Leave empty or add: `model/gltf-binary`, `model/gltf+json`, `application/octet-stream`

#### Field 4: Thumbnail
- **Type**: File
- **Name**: `thumbnail`
- **Required**: ✗ No
- **Max files**: 1
- **Max file size**: 5 MB
- **Allowed types**: `image/jpeg`, `image/png`, `image/webp`

#### Field 5: Tags
- **Type**: JSON
- **Name**: `tags`
- **Required**: ✗ No

#### Field 6: User
- **Type**: Relation
- **Name**: `user`
- **Required**: ✓ Yes
- **Collection**: `users`
- **Max select**: 1

### Set Access Rules (API Rules):

Click on **"API Rules"** tab in the assets collection:

- **List/Search rule**: `@request.auth.id != ""`
- **View rule**: `@request.auth.id != ""`
- **Create rule**: `@request.auth.id != "" && @request.auth.id = user`
- **Update rule**: `@request.auth.id = user`
- **Delete rule**: `@request.auth.id = user`

Click **"Save changes"**

## Step 5: Test the Application

1. Make sure PocketBase is still running
2. In a new terminal, navigate to the frontend:
   ```cmd
   cd D:\projects\3d-asset-manager\frontend
   ```
3. If you haven't already, install dependencies:
   ```cmd
   npm install
   ```
4. Start the development server:
   ```cmd
   npm run dev
   ```
5. Open your browser to: **http://localhost:5173**

## Step 6: Create User Account and Upload

1. On the login screen, click **"Sign up"**
2. Create a user account (this is different from the admin account)
3. Sign in with your new user account
4. Click **"Upload Asset"**
5. Upload your GLB/GLTF file!

## Troubleshooting

### "The requested resource wasn't found" error
- **Cause**: PocketBase isn't running or collections aren't created
- **Solution**: Make sure you completed Steps 2-4 above

### PocketBase won't start
- **Cause**: Port 8090 is already in use
- **Solution**: Close any other applications using port 8090, or change the port:
  ```cmd
  pocketbase.exe serve --http=127.0.0.1:8091
  ```
  Then update `frontend\.env` to use the new port

### Can't upload files
- **Cause**: Assets collection not properly configured
- **Solution**: Double-check Step 4, especially:
  - The `file` field is type "File" (not Text)
  - The `user` relation is set up correctly
  - API rules are configured

### Frontend can't connect
- **Cause**: Wrong PocketBase URL
- **Solution**: Check `frontend\.env` file:
  ```
  VITE_POCKETBASE_URL=http://localhost:8090
  ```

## Running Both Servers

You'll need **TWO terminal windows**:

### Terminal 1 - Backend (PocketBase)
```cmd
cd D:\projects\3d-asset-manager\backend
pocketbase.exe serve
```
**Keep this running!**

### Terminal 2 - Frontend (Svelte)
```cmd
cd D:\projects\3d-asset-manager\frontend
npm run dev
```
**Keep this running too!**

## Quick Start (After Initial Setup)

Once you've completed the initial setup, you can quickly start both servers:

1. **Terminal 1**: `cd backend && pocketbase.exe serve`
2. **Terminal 2**: `cd frontend && npm run dev`
3. **Browser**: Open http://localhost:5173

## Need Help?

If you're still having issues:
1. Check that both PocketBase and the frontend server are running
2. Check the browser console for errors (F12)
3. Verify the assets collection exists in PocketBase admin UI
4. Try creating a fresh user account

Happy asset managing! 🚀
