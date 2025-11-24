<script>
  import { assetStore } from '../stores/assetStore';
  import * as THREE from 'three';
  import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
  import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';
  import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';
  import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js';

  export let onClose;

  let isDragging = false;
  let file = null;
  let name = '';
  let description = '';
  let tags = '';
  let uploading = false;
  let error = null;
  let thumbnailBlob = null;
  let thumbnailPreview = null;
  let generatingThumbnail = false;

  function handleDragOver(e) {
    e.preventDefault();
    isDragging = true;
  }

  function handleDragLeave() {
    isDragging = false;
  }

  function handleDrop(e) {
    e.preventDefault();
    isDragging = false;

    const droppedFiles = e.dataTransfer.files;
    if (droppedFiles.length > 0) {
      handleFileSelect(droppedFiles[0]);
    }
  }

  function handleFileInput(e) {
    const selectedFiles = e.target.files;
    if (selectedFiles.length > 0) {
      handleFileSelect(selectedFiles[0]);
    }
  }

  async function handleFileSelect(selectedFile) {
    // Validate file type
    const validExtensions = ['.glb', '.gltf', '.obj', '.fbx', '.stl'];
    const fileName = selectedFile.name.toLowerCase();
    const isValid = validExtensions.some(ext => fileName.endsWith(ext));

    if (!isValid) {
      error = 'Please select a valid 3D model file (.glb, .gltf, .obj, .fbx, or .stl)';
      return;
    }

    file = selectedFile;
    error = null;

    // Set default name from filename
    if (!name) {
      name = selectedFile.name.replace(/\.(glb|gltf|obj|fbx|stl)$/i, '');
    }

    // Generate thumbnail automatically
    await generateThumbnail(selectedFile);
  }

  async function generateThumbnail(modelFile) {
    generatingThumbnail = true;

    try {
      // Create a temporary URL for the file
      const fileURL = URL.createObjectURL(modelFile);

      // Create a hidden canvas
      const canvas = document.createElement('canvas');
      canvas.width = 512;
      canvas.height = 512;
      canvas.style.display = 'none';
      document.body.appendChild(canvas);

      // Setup Three.js scene
      const scene = new THREE.Scene();
      scene.background = new THREE.Color(0x1a1a2e);

      const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 1000);
      camera.position.set(3, 3, 3);

      const renderer = new THREE.WebGLRenderer({
        canvas,
        antialias: true,
        preserveDrawingBuffer: true // Important for capturing image
      });
      renderer.setSize(512, 512);
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.2;

      // Add lights
      const hemisphereLight = new THREE.HemisphereLight(0xffffff, 0x444444, 1.2);
      scene.add(hemisphereLight);

      const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
      scene.add(ambientLight);

      const directionalLight = new THREE.DirectionalLight(0xffffff, 2.0);
      directionalLight.position.set(5, 10, 7.5);
      scene.add(directionalLight);

      // Load the model based on file extension
      const fileName = modelFile.name.toLowerCase();
      const extension = fileName.substring(fileName.lastIndexOf('.'));

      let model;

      if (extension === '.glb' || extension === '.gltf') {
        const loader = new GLTFLoader();
        const gltf = await new Promise((resolve, reject) => {
          loader.load(fileURL, (loadedGltf) => resolve(loadedGltf), undefined, (err) => reject(err));
        });
        model = gltf.scene;
      } else if (extension === '.obj') {
        const loader = new OBJLoader();
        model = await new Promise((resolve, reject) => {
          loader.load(fileURL, (obj) => resolve(obj), undefined, (err) => reject(err));
        });
      } else if (extension === '.fbx') {
        const loader = new FBXLoader();
        model = await new Promise((resolve, reject) => {
          loader.load(fileURL, (fbx) => resolve(fbx), undefined, (err) => reject(err));
        });
      } else if (extension === '.stl') {
        const loader = new STLLoader();
        const geometry = await new Promise((resolve, reject) => {
          loader.load(fileURL, (geo) => resolve(geo), undefined, (err) => reject(err));
        });
        const material = new THREE.MeshStandardMaterial({
          color: 0xaaaaaa,
          roughness: 0.5,
          metalness: 0.5
        });
        model = new THREE.Mesh(geometry, material);
      } else {
        throw new Error(`Unsupported file format: ${extension}`);
      }

      // Calculate bounding box for the original model
      const box = new THREE.Box3().setFromObject(model);
      const center = box.getCenter(new THREE.Vector3());
      const size = box.getSize(new THREE.Vector3());

      // Create a parent group to ensure proper centering
      const modelGroup = new THREE.Group();
      modelGroup.add(model);

      // Center the model within the group
      model.position.set(-center.x, -center.y, -center.z);

      // Normalize the model to fit in a standard size (makes camera calculation easier)
      const maxDim = Math.max(size.x, size.y, size.z);
      const scale = 2 / maxDim; // Normalize to 2 units
      modelGroup.scale.setScalar(scale);

      scene.add(modelGroup);

      // Calculate optimal camera distance to fit entire model in view
      // After scaling, the model fits in a 2-unit cube, so bounding sphere radius is roughly sqrt(3)
      const boundingSphereRadius = Math.sqrt(3); // Diagonal of 2x2x2 cube / 2
      const fov = camera.fov * (Math.PI / 180); // Convert to radians
      const cameraDistance = boundingSphereRadius / Math.sin(fov / 2);

      // Add padding factor to ensure model isn't touching edges (1.3 = 30% padding)
      const paddingFactor = 1.3;
      const distance = cameraDistance * paddingFactor;

      // Position camera at 45-degree angle for nice thumbnail view
      const angle = Math.PI / 4; // 45 degrees
      camera.position.set(
        distance * Math.cos(angle),
        distance * 0.5, // Slightly elevated view
        distance * Math.sin(angle)
      );
      camera.lookAt(0, 0, 0);

      // Render
      renderer.render(scene, camera);

      // Capture image
      const dataURL = canvas.toDataURL('image/jpeg', 0.9);
      thumbnailPreview = dataURL;

      // Convert to blob
      const response = await fetch(dataURL);
      thumbnailBlob = await response.blob();

      // Cleanup
      URL.revokeObjectURL(fileURL);
      document.body.removeChild(canvas);
      renderer.dispose();

      generatingThumbnail = false;
    } catch (err) {
      console.error('Error generating thumbnail:', err);
      // Don't show error to user, just skip thumbnail
      generatingThumbnail = false;
      thumbnailBlob = null;
      thumbnailPreview = null;
    }
  }

  async function handleSubmit() {
    if (!file) {
      error = 'Please select a file to upload';
      return;
    }

    if (!name.trim()) {
      error = 'Please enter a name for the asset';
      return;
    }

    uploading = true;
    error = null;

    const metadata = {
      name: name.trim(),
      description: description.trim(),
      tags: tags.split(',').map(tag => tag.trim()).filter(tag => tag.length > 0),
      thumbnail: thumbnailBlob // Include generated thumbnail
    };

    const result = await assetStore.uploadAsset(file, metadata);

    if (result.success) {
      onClose();
    } else {
      error = result.error || 'Failed to upload asset';
      uploading = false;
    }
  }

  function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  }

  function handleDropZoneClick() {
    document.getElementById('file-input')?.click();
  }

  function handleDropZoneKeydown(e) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleDropZoneClick();
    }
  }

  function handleOverlayKeydown(e) {
    if (e.key === 'Escape') {
      onClose();
    }
  }
</script>

<!-- Modal Overlay -->
<!-- svelte-ignore a11y-no-noninteractive-element-interactions -->
<div
  class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in"
  on:click={onClose}
  on:keydown={handleOverlayKeydown}
  role="button"
  tabindex="0"
  aria-label="Close modal"
>
  <!-- Modal Content -->
  <!-- svelte-ignore a11y-no-static-element-interactions -->
  <div
    class="glass-modal w-full max-w-2xl animate-slide-up"
    on:click|stopPropagation
    on:keydown|stopPropagation
    role="dialog"
    aria-modal="true"
    aria-labelledby="modal-title"
  >
    <!-- Header -->
    <div class="flex items-center justify-between p-6 border-b border-white/10">
      <h2 id="modal-title" class="text-2xl font-bold gradient-text">Upload 3D Asset</h2>
      <button
        on:click={onClose}
        class="p-2 rounded-lg hover:bg-white/10 transition-colors"
        disabled={uploading}
      >
        <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>

    <!-- Form -->
    <form on:submit|preventDefault={handleSubmit} class="p-6 space-y-6">
      <!-- File Drop Zone -->
      <!-- svelte-ignore a11y-no-static-element-interactions -->
      <div
        class="border-2 border-dashed rounded-2xl p-8 text-center transition-all cursor-pointer {isDragging ? 'border-indigo-400 bg-indigo-500/10' : 'border-white/20'}"
        on:dragover={handleDragOver}
        on:dragleave={handleDragLeave}
        on:drop={handleDrop}
        on:click={handleDropZoneClick}
        on:keydown={handleDropZoneKeydown}
        role="button"
        tabindex="0"
        aria-label="Upload file drop zone. Click or press Enter to browse files, or drag and drop a file here."
      >
        {#if file}
          <!-- File Selected -->
          <div class="space-y-4">
            <div class="w-20 h-20 mx-auto rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
              <svg class="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <div>
              <p class="font-semibold text-lg">{file.name}</p>
              <p class="text-white/60 text-sm">{formatFileSize(file.size)}</p>
            </div>
            <button
              type="button"
              on:click={() => file = null}
              class="text-sm text-indigo-400 hover:text-indigo-300 transition-colors"
            >
              Change file
            </button>
          </div>
        {:else}
          <!-- Drop Zone -->
          <div class="space-y-4">
            <div class="w-20 h-20 mx-auto rounded-2xl bg-white/5 flex items-center justify-center">
              <svg class="w-10 h-10 text-white/50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
            </div>
            <div>
              <p class="text-lg font-semibold mb-1">Drop your 3D model here</p>
              <p class="text-white/60 text-sm">or click to browse</p>
              <p class="text-white/40 text-xs mt-2">Supports: .glb, .gltf, .obj, .fbx, .stl</p>
            </div>
            <input
              type="file"
              accept=".glb,.gltf,.obj,.fbx,.stl"
              on:change={handleFileInput}
              class="hidden"
              id="file-input"
            />
            <label for="file-input" class="glass-button inline-block cursor-pointer">
              Choose File
            </label>
          </div>
        {/if}
      </div>

      <!-- Asset Name -->
      <div>
        <label for="name" class="block text-sm font-medium mb-2">
          Asset Name <span class="text-red-400">*</span>
        </label>
        <input
          type="text"
          id="name"
          bind:value={name}
          placeholder="e.g., Spaceship Model"
          class="glass-input w-full"
          required
          disabled={uploading}
        />
      </div>

      <!-- Description -->
      <div>
        <label for="description" class="block text-sm font-medium mb-2">
          Description
        </label>
        <textarea
          id="description"
          bind:value={description}
          placeholder="Describe your 3D asset..."
          rows="3"
          class="glass-input w-full resize-none"
          disabled={uploading}
        ></textarea>
      </div>

      <!-- Tags -->
      <div>
        <label for="tags" class="block text-sm font-medium mb-2">
          Tags
        </label>
        <input
          type="text"
          id="tags"
          bind:value={tags}
          placeholder="e.g., scifi, vehicle, lowpoly (comma separated)"
          class="glass-input w-full"
          disabled={uploading}
        />
        <p class="text-xs text-white/50 mt-1">Separate tags with commas</p>
      </div>

      <!-- Error Message -->
      {#if error}
        <div class="bg-red-500/10 border border-red-500/30 rounded-xl p-4">
          <div class="flex items-center space-x-2">
            <svg class="w-5 h-5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p class="text-red-400 text-sm">{error}</p>
          </div>
        </div>
      {/if}

      <!-- Actions -->
      <div class="flex items-center justify-end space-x-3 pt-4">
        <button
          type="button"
          on:click={onClose}
          class="px-6 py-3 rounded-xl hover:bg-white/10 transition-colors font-medium"
          disabled={uploading}
        >
          Cancel
        </button>
        <button
          type="submit"
          class="glass-button font-medium flex items-center space-x-2"
          disabled={uploading || !file}
        >
          {#if uploading}
            <svg class="w-5 h-5 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <span>Uploading...</span>
          {:else}
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
            </svg>
            <span>Upload Asset</span>
          {/if}
        </button>
      </div>
    </form>
  </div>
</div>
