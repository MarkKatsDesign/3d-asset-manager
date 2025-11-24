<script>
  import { onMount, onDestroy } from 'svelte';
  import * as THREE from 'three';
  import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
  import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';
  import { MTLLoader } from 'three/examples/jsm/loaders/MTLLoader.js';
  import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';
  import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js';
  import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
  import { RGBELoader } from 'three/examples/jsm/loaders/RGBELoader.js';
  import { localAssetStore } from '../stores/localAssetStore';

  export let asset;
  export let onClose;

  let container;
  let scene, camera, renderer, controls, pmremGenerator;
  let animationId;
  let loading = true;
  let error = null;
  let gridHelper;
  let currentBlobUrl = null;

  // Environment controls
  let useEnvironment = true;
  let environmentIntensity = 1.0;
  let showControls = false;
  let customHDRI = null;
  let originalHDRITexture = null; // Store original texture for screenshot regeneration
  let isLoadingHDRI = false;
  let hdriError = null;
  let showGrid = true;
  let transparentBackground = false;
  let backgroundColor = '#2a2a3e'; // Default studio blue
  let isLightBackground = false; // Tracks if current background is light
  let isDarkCard = false; // Tracks if card should use dark styling (for light backgrounds)

  // Screenshot settings
  let screenshotQuality = '1080p';
  let takingScreenshot = false;
  let showQualityMenu = false;

  // Notes section
  let notesExpanded = false;
  let description = asset.description || '';
  let saveTimeout;
  let savingNotes = false;
  let notesSaved = false;

  // Preset background colors
  const colorPresets = [
    { name: 'White', color: '#ffffff' },
    { name: 'Light Gray', color: '#cccccc' },
    { name: 'Gray', color: '#666666' },
    { name: 'Dark', color: '#1a1a1a' },
    { name: 'Studio', color: '#2a2a3e' },
  ];

  // Screenshot quality presets
  const qualityPresets = [
    { id: '1080p', name: 'HD (1920×1080)', width: 1920, height: 1080 },
    { id: '2k', name: '2K (2560×1440)', width: 2560, height: 1440 },
    { id: '4k', name: '4K (3840×2160)', width: 3840, height: 2160 }
  ];

  /**
   * Calculate relative luminance of a color (WCAG formula)
   * Returns value between 0 (black) and 1 (white)
   */
  function getColorLuminance(hexColor) {
    // Remove # if present
    const hex = hexColor.replace('#', '');

    // Convert to RGB
    const r = parseInt(hex.substr(0, 2), 16) / 255;
    const g = parseInt(hex.substr(2, 2), 16) / 255;
    const b = parseInt(hex.substr(4, 2), 16) / 255;

    // Apply gamma correction
    const [rs, gs, bs] = [r, g, b].map(c =>
      c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
    );

    // Calculate luminance
    return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
  }

  onMount(() => {
    initScene();
    loadModel();

    // Handle window resize
    window.addEventListener('resize', handleResize);
  });

  onDestroy(() => {
    cleanup();
    window.removeEventListener('resize', handleResize);
  });

  function initScene() {
    // Scene
    scene = new THREE.Scene();
    updateSceneBackground();
    // Reduce fog or remove it to ensure model visibility
    scene.fog = new THREE.Fog(0x2a2a3e, 20, 100);

    // Camera
    camera = new THREE.PerspectiveCamera(
      50,
      container.clientWidth / container.clientHeight,
      0.1,
      1000
    );
    camera.position.set(3, 3, 3);

    // Renderer
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });

    console.log('Container dimensions:', container.clientWidth, container.clientHeight);

    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
  // Use physically correct light intensities for more realistic PBR lighting
  renderer.physicallyCorrectLights = true;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.6; // Increase exposure to make models brighter by default
    container.appendChild(renderer.domElement);

    console.log('Renderer initialized with size:', renderer.getSize(new THREE.Vector2()));

    // PMREM Generator for environment maps
    pmremGenerator = new THREE.PMREMGenerator(renderer);
    pmremGenerator.compileEquirectangularShader();

    // Setup default environment
    setupEnvironment();

    // Controls
    controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.screenSpacePanning = false;
    controls.minDistance = 1;
    controls.maxDistance = 50;
    controls.maxPolarAngle = Math.PI;

    // Lights - Enhanced lighting setup for better model visibility

    // Hemisphere light for natural ambient lighting
  const hemisphereLight = new THREE.HemisphereLight(0xffffff, 0x444444, 1.2);
    scene.add(hemisphereLight);

  // Small ambient light to lift deep shadows (safe, low-risk)
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
  scene.add(ambientLight);

    // Main directional light (key light) - brighter and from the front-top
    const directionalLight = new THREE.DirectionalLight(0xffffff, 2.0);
    directionalLight.position.set(5, 10, 7.5);
    directionalLight.castShadow = true;
    directionalLight.shadow.camera.near = 0.1;
    directionalLight.shadow.camera.far = 50;
    directionalLight.shadow.mapSize.width = 2048;
    directionalLight.shadow.mapSize.height = 2048;
    scene.add(directionalLight);

    // Fill light from the opposite side
    const fillLight = new THREE.DirectionalLight(0xffffff, 1.0);
    fillLight.position.set(-5, 5, -5);
    scene.add(fillLight);

    // Back light (rim light) for edge definition
    const backLight = new THREE.DirectionalLight(0xffffff, 0.8);
    backLight.position.set(0, 5, -10);
    scene.add(backLight);

    // Accent point lights for visual interest (softer colors)
    const pointLight1 = new THREE.PointLight(0x6366f1, 0.3);
    pointLight1.position.set(-8, 3, -8);
    scene.add(pointLight1);

    const pointLight2 = new THREE.PointLight(0xa855f7, 0.3);
    pointLight2.position.set(8, 3, 8);
    scene.add(pointLight2);

    // Grid helper
    gridHelper = new THREE.GridHelper(10, 10, 0x444444, 0x222222);
    gridHelper.visible = showGrid;
    scene.add(gridHelper);

    // Start animation loop
    animate();
  }

  function updateSceneBackground() {
    if (transparentBackground) {
      scene.background = null;
      scene.fog = null;
    } else {
      const bgColor = new THREE.Color(backgroundColor);
      scene.background = bgColor;
      scene.fog = new THREE.Fog(backgroundColor, 20, 100);
    }
  }

  function setBackgroundColor(color) {
    backgroundColor = color;
    // Determine if background is light (luminance > 0.5)
    const luminance = getColorLuminance(color);
    isLightBackground = luminance > 0.5;
    updateSceneBackground();
  }

  async function takeScreenshot() {
    if (!scene || !camera || takingScreenshot) return;

    takingScreenshot = true;
    showQualityMenu = false;

    try {
      console.log('=== SCREENSHOT DEBUG INFO ===');
      console.log('Scene has environment:', !!scene.environment);
      console.log('Use environment enabled:', useEnvironment);
      console.log('Environment intensity:', environmentIntensity);
      console.log('Custom HDRI loaded:', !!customHDRI);
      console.log('Main renderer tone mapping exposure:', renderer.toneMappingExposure);
      console.log('Transparent background:', transparentBackground);
      console.log('Background color:', backgroundColor);

      // Get selected quality preset
      const preset = qualityPresets.find(p => p.id === screenshotQuality);
      if (!preset) return;

      console.log('Screenshot quality:', preset.name);

      // Create off-screen renderer at high quality
      const screenshotCanvas = document.createElement('canvas');
      screenshotCanvas.width = preset.width;
      screenshotCanvas.height = preset.height;

      const screenshotRenderer = new THREE.WebGLRenderer({
        canvas: screenshotCanvas,
        antialias: true,
        alpha: transparentBackground,
        preserveDrawingBuffer: true
      });

      screenshotRenderer.setSize(preset.width, preset.height);
      screenshotRenderer.setPixelRatio(1); // Use 1:1 for exact resolution
      screenshotRenderer.shadowMap.enabled = renderer.shadowMap.enabled;
      screenshotRenderer.shadowMap.type = renderer.shadowMap.type;
      screenshotRenderer.outputColorSpace = renderer.outputColorSpace;
      screenshotRenderer.physicallyCorrectLights = renderer.physicallyCorrectLights;
      screenshotRenderer.toneMapping = renderer.toneMapping;

      // Copy the exact tone mapping exposure from current renderer
      // This respects the environment intensity settings
      screenshotRenderer.toneMappingExposure = renderer.toneMappingExposure;

      console.log('Screenshot renderer tone mapping exposure:', screenshotRenderer.toneMappingExposure);
      console.log('Screenshot renderer tone mapping type:', screenshotRenderer.toneMapping);

      // Set background to match current scene
      if (transparentBackground) {
        screenshotRenderer.setClearColor(0x000000, 0);
      } else {
        const bgColor = new THREE.Color(backgroundColor);
        screenshotRenderer.setClearColor(bgColor, 1);
      }

      // Store original environment to restore after screenshot
      const originalEnvironment = scene.environment;

      // CRITICAL: Create a new PMREM generator for the screenshot renderer
      // The environment map must be regenerated for this renderer's WebGL context
      if (useEnvironment && originalHDRITexture) {
        console.log('Regenerating custom HDRI environment map for screenshot renderer...');
        const screenshotPMREM = new THREE.PMREMGenerator(screenshotRenderer);
        screenshotPMREM.compileEquirectangularShader();

        // Regenerate the environment from the original texture for this renderer
        const screenshotEnvMap = screenshotPMREM.fromEquirectangular(originalHDRITexture).texture;
        scene.environment = screenshotEnvMap;

        screenshotPMREM.dispose();
        console.log('Custom HDRI environment map regenerated for screenshot');
      } else if (useEnvironment && !originalHDRITexture) {
        console.log('Using default environment (no custom HDRI to regenerate)');
        // The default environment should already work since it's procedural
      }

      // Clone camera to preserve aspect ratio
      const screenshotCamera = camera.clone();
      screenshotCamera.aspect = preset.width / preset.height;
      screenshotCamera.updateProjectionMatrix();

      console.log('Camera position:', screenshotCamera.position);
      console.log('Number of lights in scene:', scene.children.filter(c => c.isLight).length);

      // Force the renderer to compile the scene with the environment
      // This ensures all materials and environment maps are ready
      console.log('Compiling scene for screenshot renderer...');
      screenshotRenderer.compile(scene, screenshotCamera);
      console.log('Scene compiled');

      // Render the scene (which already has all lights, environment, and models)
      console.log('Rendering screenshot...');
      screenshotRenderer.render(scene, screenshotCamera);
      console.log('Screenshot rendered');

      // Restore original environment for the main viewer
      scene.environment = originalEnvironment;

      // Get image data
      const imageData = screenshotCanvas.toDataURL('image/png');

      // Generate filename
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T');
      const dateStr = timestamp[0];
      const timeStr = timestamp[1].split('.')[0];
      const filename = `${asset.name}_${dateStr}_${timeStr}.png`;

      // Save screenshot using Electron dialog
      const result = await window.electronAPI.saveScreenshot(imageData, filename);

      if (result.success) {
        console.log('Screenshot saved to:', result.path);
      } else if (result.error) {
        console.error('Screenshot error:', result.error);
      }

      // Cleanup
      screenshotRenderer.dispose();
    } catch (error) {
      console.error('Error taking screenshot:', error);
    } finally {
      takingScreenshot = false;
    }
  }

  function setupEnvironment() {
    // Create a simple gradient environment (studio-like)
    const width = 512;
    const height = 512;
    const size = width * height;
    const data = new Uint8Array(4 * size);

    // Create a gradient from light to darker
    for (let i = 0; i < size; i++) {
      const stride = i * 4;
      const y = Math.floor(i / width) / height;

      // Top: light blue-white
      // Bottom: darker blue-grey
      const topColor = { r: 240, g: 245, b: 255 };
      const bottomColor = { r: 100, g: 120, b: 150 };

      const r = topColor.r + (bottomColor.r - topColor.r) * y;
      const g = topColor.g + (bottomColor.g - topColor.g) * y;
      const b = topColor.b + (bottomColor.b - topColor.b) * y;

      data[stride] = r;
      data[stride + 1] = g;
      data[stride + 2] = b;
      data[stride + 3] = 255;
    }

    // Create a DataTexture from the gradient
    const texture = new THREE.DataTexture(data, width, height);
    texture.needsUpdate = true;
    texture.mapping = THREE.EquirectangularReflectionMapping;

    // Generate PMREM for the environment
    const envMap = pmremGenerator.fromEquirectangular(texture).texture;

    // Apply to scene
    scene.environment = envMap;

    // Set initial intensity
    updateEnvironmentIntensity();

    texture.dispose();
  }

  function updateEnvironmentIntensity() {
    if (scene && scene.environment) {
      // Update renderer exposure based on environment intensity
      renderer.toneMappingExposure = 1.2 * environmentIntensity;
    }
  }

  function updateEnvironment() {
    if (useEnvironment) {
      if (customHDRI) {
        // Use custom HDRI if available
        scene.environment = customHDRI;
        updateEnvironmentIntensity();
        if (scene) {
          scene.environmentIntensity = environmentIntensity;
        }
      } else {
        setupEnvironment();
        if (scene) {
          scene.environment = scene.environment;  // Force environment update
          scene.environmentIntensity = environmentIntensity;
        }
      }
    } else {
      if (scene) {
        scene.environment = null;
        scene.environmentIntensity = 0;
      }
    }
  }

  async function handleHDRIUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    // Validate file size (max 15MB for HDRI)
    const maxSize = 15 * 1024 * 1024; // 15MB
    if (file.size > maxSize) {
      hdriError = `File too large (${(file.size / 1024 / 1024).toFixed(1)}MB). Please use a file smaller than 15MB.`;
      return;
    }

    hdriError = null;
    isLoadingHDRI = true;

    try {
      const fileURL = URL.createObjectURL(file);
      const fileName = file.name.toLowerCase();

      let texture;

      if (fileName.endsWith('.hdr')) {
        // Load HDR file
        const rgbeLoader = new RGBELoader();
        texture = await new Promise((resolve, reject) => {
          rgbeLoader.load(
            fileURL,
            (loadedTexture) => resolve(loadedTexture),
            undefined,
            (err) => reject(err)
          );
        });
      } else if (fileName.endsWith('.jpg') || fileName.endsWith('.jpeg') || fileName.endsWith('.png')) {
        // Load regular image as fallback
        const textureLoader = new THREE.TextureLoader();
        texture = await new Promise((resolve, reject) => {
          textureLoader.load(
            fileURL,
            (loadedTexture) => resolve(loadedTexture),
            undefined,
            (err) => reject(err)
          );
        });
      } else {
        throw new Error('Unsupported file format. Please use .hdr, .jpg, or .png files.');
      }

      // Set texture mapping
      texture.mapping = THREE.EquirectangularReflectionMapping;

      // Store the original texture for screenshot regeneration
      originalHDRITexture = texture.clone();

      // Generate PMREM
      const envMap = pmremGenerator.fromEquirectangular(texture).texture;

      // Apply to scene
      customHDRI = envMap;
      scene.environment = envMap;
      updateEnvironmentIntensity();

      // Cleanup original (we have a clone)
      texture.dispose();
      URL.revokeObjectURL(fileURL);

      isLoadingHDRI = false;
    } catch (err) {
      console.error('Error loading HDRI:', err);
      hdriError = err.message || 'Failed to load HDRI file. Please try another file.';
      isLoadingHDRI = false;
    }
  }

  function resetToDefaultEnvironment() {
    customHDRI = null;
    hdriError = null;
    setupEnvironment();
  }

  // Reactive updates for environment controls
  $: if (scene && (useEnvironment !== undefined || environmentIntensity !== undefined)) {
    updateEnvironment();
    // Force a render to update the scene
    if (renderer) {
      renderer.render(scene, camera);
    }
  }

  // Separate reactive statement for intensity changes
  $: if (scene && renderer && useEnvironment) {
    updateEnvironmentIntensity();
    // Force a re-render by updating a dummy property
    environmentIntensity;
  }

  // Toggle grid visibility
  $: if (gridHelper) {
    gridHelper.visible = showGrid;
  }

  // Toggle transparent background and update light detection
  $: if (scene) {
    updateSceneBackground();
    transparentBackground; // Reactive dependency
    backgroundColor; // Reactive dependency
  }

  // Update isLightBackground when backgroundColor changes (for color picker)
  $: {
    if (backgroundColor && !transparentBackground) {
      const luminance = getColorLuminance(backgroundColor);
      isLightBackground = luminance > 0.5;
      console.log('Background color:', backgroundColor, 'Luminance:', luminance, 'isLight:', isLightBackground);
    } else {
      isLightBackground = false;
      console.log('Transparent or no bg, isLightBackground:', false);
    }
  }

  // Derived reactive flag for card styling
  $: {
    isDarkCard = isLightBackground && !transparentBackground;
    console.log('isDarkCard:', isDarkCard, 'isLight:', isLightBackground, 'transparent:', transparentBackground);
  }

  async function loadModel() {
    try {
      // Revoke previous blob URL if exists
      if (currentBlobUrl) {
        URL.revokeObjectURL(currentBlobUrl);
        currentBlobUrl = null;
      }

      // Read the model file as a buffer from the main process
      const modelData = await window.electronAPI.readModelFile(asset.id);
      if (!modelData) {
        throw new Error('Failed to read model file');
      }

      console.log('Loading model, data size:', modelData.byteLength);

      // Create a blob from the buffer
      const blob = new Blob([modelData]);
      currentBlobUrl = URL.createObjectURL(blob);

      // Get file extension
      const fileName = asset.file.toLowerCase();
      const extension = fileName.substring(fileName.lastIndexOf('.'));

      console.log('Loading file with extension:', extension);

      // Helper function to process and add model to scene
      const processModel = (model) => {
        // Center and scale model
        const box = new THREE.Box3().setFromObject(model);
        const center = box.getCenter(new THREE.Vector3());
        const size = box.getSize(new THREE.Vector3());
        const maxDim = Math.max(size.x, size.y, size.z);
        const scale = 2 / maxDim;

        // Debug logging
        console.log('Model bounds:', { center, size, maxDim, scale });
        console.log('Model before centering:', model.position);

        // Create a parent group to ensure proper centering
        const modelGroup = new THREE.Group();
        modelGroup.add(model);

        // Center the model within the group
        model.position.set(-center.x, -center.y, -center.z);

        // Scale the group
        modelGroup.scale.setScalar(scale);

        console.log('Model after centering:', model.position);

        // Enable shadows
        model.traverse((child) => {
          if (child.isMesh) {
            child.castShadow = true;
            child.receiveShadow = true;
          }
        });

        scene.add(modelGroup);

        // Adjust camera to ensure model is visible
        const distance = 5;
        camera.position.set(distance, distance, distance);
        camera.lookAt(0, 0, 0);
        controls.target.set(0, 0, 0);
        controls.update();

        console.log('Camera position:', camera.position);
        console.log('Camera looking at:', controls.target);

        loading = false;
        animate(); // Start animation loop
      };

      // Progress callback
      const onProgress = (progress) => {
        if (progress.total > 0) {
          const percentComplete = (progress.loaded / progress.total) * 100;
          console.log(`Loading: ${percentComplete.toFixed(2)}%`);
        }
      };

      // Error callback
      const onError = (err) => {
        console.error('Error loading model:', err);
        error = `Failed to load 3D model (${extension} format).`;
        loading = false;
      };

      // Load based on file extension
      if (extension === '.glb' || extension === '.gltf') {
        const loader = new GLTFLoader();
        loader.load(
          currentBlobUrl,
          (gltf) => processModel(gltf.scene),
          onProgress,
          onError
        );
      } else if (extension === '.obj') {
        const loader = new OBJLoader();
        loader.load(
          currentBlobUrl,
          (obj) => processModel(obj),
          onProgress,
          onError
        );
      } else if (extension === '.fbx') {
        const loader = new FBXLoader();
        loader.load(
          currentBlobUrl,
          (fbx) => processModel(fbx),
          onProgress,
          onError
        );
      } else if (extension === '.stl') {
        const loader = new STLLoader();
        loader.load(
          currentBlobUrl,
          (geometry) => {
            // STL loader returns geometry, not a mesh, so we need to create a mesh
            const material = new THREE.MeshStandardMaterial({
              color: 0xaaaaaa,
              roughness: 0.5,
              metalness: 0.5
            });
            const mesh = new THREE.Mesh(geometry, material);
            processModel(mesh);
          },
          onProgress,
          onError
        );
      } else {
        error = `Unsupported file format: ${extension}`;
        loading = false;
      }
    } catch (err) {
      console.error('Error getting file path:', err);
      error = 'Failed to access local file.';
      loading = false;
    }
  }

  function animate() {
    animationId = requestAnimationFrame(animate);
    controls.update();
    renderer.render(scene, camera);
  }

  function handleResize() {
    if (!container || !camera || !renderer) return;

    camera.aspect = container.clientWidth / container.clientHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(container.clientWidth, container.clientHeight);
  }

  function cleanup() {
    if (animationId) {
      cancelAnimationFrame(animationId);
    }

    // Revoke blob URL to free memory
    if (currentBlobUrl) {
      URL.revokeObjectURL(currentBlobUrl);
      currentBlobUrl = null;
    }

    if (renderer) {
      renderer.dispose();
      if (container && renderer.domElement) {
        container.removeChild(renderer.domElement);
      }
    }

    if (scene) {
      scene.traverse((object) => {
        if (object.geometry) {
          object.geometry.dispose();
        }
        if (object.material) {
          if (Array.isArray(object.material)) {
            object.material.forEach(material => material.dispose());
          } else {
            object.material.dispose();
          }
        }
      });
    }
  }

  async function handleShowInExplorer() {
    await window.electronAPI.showInExplorer(asset.id);
  }

  // Auto-save notes with debouncing
  async function saveNotes() {
    savingNotes = true;
    notesSaved = false;

    try {
      await window.electronAPI.updateAsset(asset.id, { description });
      notesSaved = true;

      // Hide "saved" indicator after 2 seconds
      setTimeout(() => {
        notesSaved = false;
      }, 2000);
    } catch (error) {
      console.error('Error saving notes:', error);
    } finally {
      savingNotes = false;
    }
  }

  function handleNotesInput() {
    // Clear existing timeout
    if (saveTimeout) {
      clearTimeout(saveTimeout);
    }

    // Set new timeout to save after 1 second of no typing
    saveTimeout = setTimeout(() => {
      saveNotes();
    }, 1000);
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
  aria-label="Close viewer modal"
>
  <!-- Modal Content -->
  <!-- svelte-ignore a11y-no-static-element-interactions -->
  <div
    class="glass-modal w-full max-w-6xl h-[90vh] flex flex-col animate-slide-up"
    on:click|stopPropagation
    on:keydown|stopPropagation
    role="dialog"
    aria-modal="true"
    aria-labelledby="viewer-title"
  >
    <!-- Header -->
    <div class="flex items-center justify-between p-6 border-b border-white/10">
      <div class="flex-1">
        <h2 id="viewer-title" class="text-2xl font-bold gradient-text">{asset.name}</h2>
        {#if asset.description}
          <p class="text-white/60 mt-1">{asset.description}</p>
        {/if}
      </div>
      <div class="flex items-center space-x-2">
        <!-- Screenshot Button with Quality Menu -->
        <div class="relative">
          <button
            on:click={() => showQualityMenu = !showQualityMenu}
            disabled={takingScreenshot}
            class="glass-button p-3 {takingScreenshot ? 'opacity-50 cursor-not-allowed' : ''}"
            title="Take Screenshot"
          >
            {#if takingScreenshot}
              <svg class="w-5 h-5 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            {:else}
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            {/if}
          </button>

          <!-- Quality Menu Dropdown -->
          {#if showQualityMenu && !takingScreenshot}
            <div class="absolute right-0 mt-2 w-56 glass-card p-2 z-50 animate-slide-down">
              <div class="text-xs font-semibold opacity-60 px-3 py-2">QUALITY</div>
              {#each qualityPresets as preset}
                <button
                  on:click={() => { screenshotQuality = preset.id; takeScreenshot(); }}
                  class="w-full px-3 py-2.5 rounded-xl text-left transition-all duration-200 flex items-center justify-between gap-3
                    {screenshotQuality === preset.id ? 'bg-white/10' : 'hover:bg-white/5'}"
                >
                  <div>
                    <div class="font-medium text-sm">{preset.name}</div>
                    <div class="text-xs opacity-60">{preset.width} × {preset.height}</div>
                  </div>
                  {#if screenshotQuality === preset.id}
                    <svg class="w-5 h-5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
                    </svg>
                  {/if}
                </button>
              {/each}
            </div>
          {/if}
        </div>

        <button
          on:click={handleShowInExplorer}
          class="glass-button p-3"
          title="Show in Explorer"
        >
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
          </svg>
        </button>
        <button
          on:click={onClose}
          class="glass-button p-3"
          title="Close"
        >
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>

    <!-- 3D Viewer -->
    <div class="flex-1 relative">
      <div bind:this={container} class="w-full h-full">
        {#if loading}
          <div class="absolute inset-0 flex items-center justify-center">
            <div class="text-center">
              <div class="w-16 h-16 border-4 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin mx-auto mb-4"></div>
              <p class="text-white/60">Loading 3D model...</p>
            </div>
          </div>
        {/if}

        {#if error}
          <div class="absolute inset-0 flex items-center justify-center">
            <div class="glass-card p-8 text-center max-w-md">
              <svg class="w-16 h-16 text-red-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p class="text-red-400 font-semibold mb-2">Error Loading Model</p>
              <p class="text-white/60 text-sm">{error}</p>
            </div>
          </div>
        {/if}
      </div>

      <!-- Controls Info -->
      {#if !loading && !error}
        <div class="absolute bottom-4 left-4 px-4 py-2 text-sm transition-all duration-300 {isLightBackground && !transparentBackground ? 'glass-card-light' : 'glass-card text-white/70'}">
          <p>Left click + drag to rotate</p>
          <p>Right click + drag to pan</p>
          <p>Scroll to zoom</p>
        </div>

        <!-- Environment Controls -->
        <div class="absolute bottom-4 right-4">
          <button
            on:click={() => showControls = !showControls}
            class="p-3 mb-2 transition-all duration-300 {isLightBackground && !transparentBackground ? 'glass-button-light' : 'glass-button'}"
            title="Environment settings"
          >
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
            </svg>
          </button>

          {#if showControls}
            <!-- Environment Controls Card -->
            <div class="p-4 space-y-4 w-64 animate-slide-up transition-all duration-300 {isDarkCard ? 'glass-card-light' : 'glass-card'}">
              <h3 class="font-semibold text-sm gradient-text">Environment</h3>

              <!-- Environment Toggle -->
              <div class="flex items-center justify-between">
                <label for="env-toggle" class="text-sm {isDarkCard ? 'text-white' : 'text-white/80'}">Use Environment Map</label>
                <button
                  id="env-toggle"
                  on:click={() => useEnvironment = !useEnvironment}
                  class="relative inline-flex h-6 w-11 items-center rounded-full transition-colors {useEnvironment ? 'bg-indigo-500' : isDarkCard ? 'bg-white/30' : 'bg-white/20'}"
                >
                  <span class="inline-block h-4 w-4 transform rounded-full bg-white transition-transform {useEnvironment ? 'translate-x-6' : 'translate-x-1'}"></span>
                </button>
              </div>

              <!-- Grid Toggle -->
              <div class="flex items-center justify-between">
                <label for="grid-toggle" class="text-sm {isDarkCard ? 'text-white' : 'text-white/80'}">Show Grid</label>
                <button
                  id="grid-toggle"
                  on:click={() => showGrid = !showGrid}
                  class="relative inline-flex h-6 w-11 items-center rounded-full transition-colors {showGrid ? 'bg-indigo-500' : isDarkCard ? 'bg-white/30' : 'bg-white/20'}"
                >
                  <span class="inline-block h-4 w-4 transform rounded-full bg-white transition-transform {showGrid ? 'translate-x-6' : 'translate-x-1'}"></span>
                </button>
              </div>

              <!-- Transparent Background Toggle -->
              <div class="flex items-center justify-between">
                <label for="transparent-toggle" class="text-sm {isDarkCard ? 'text-white' : 'text-white/80'}">Transparent Background</label>
                <button
                  id="transparent-toggle"
                  on:click={() => transparentBackground = !transparentBackground}
                  class="relative inline-flex h-6 w-11 items-center rounded-full transition-colors {transparentBackground ? 'bg-indigo-500' : isDarkCard ? 'bg-white/30' : 'bg-white/20'}"
                >
                  <span class="inline-block h-4 w-4 transform rounded-full bg-white transition-transform {transparentBackground ? 'translate-x-6' : 'translate-x-1'}"></span>
                </button>
              </div>

              <!-- Background Color Selector (only when not transparent) -->
              {#if !transparentBackground}
                <div class="space-y-2 pt-2 border-t {isDarkCard ? 'border-white/20' : 'border-white/10'}">
                  <label for="bg-color-picker" class="text-sm font-medium {isDarkCard ? 'text-white' : 'text-white/80'}">Background Color</label>
                  <div class="flex flex-wrap gap-2">
                    {#each colorPresets as preset}
                      <button
                        on:click={() => setBackgroundColor(preset.color)}
                        class="group relative w-10 h-10 rounded-lg border-2 transition-all hover:scale-110 {backgroundColor === preset.color ? 'border-indigo-400 scale-105' : 'border-white/20 hover:border-white/40'}"
                        style="background-color: {preset.color}"
                        title={preset.name}
                      >
                        {#if backgroundColor === preset.color}
                          <svg class="w-5 h-5 absolute inset-0 m-auto text-white drop-shadow-lg" style="filter: {preset.color === '#ffffff' || preset.color === '#cccccc' ? 'invert(1)' : 'none'}" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7" />
                          </svg>
                        {/if}
                      </button>
                    {/each}

                    <!-- Custom Color Picker -->
                    <label class="relative w-10 h-10 rounded-lg border-2 border-white/20 hover:border-white/40 cursor-pointer transition-all hover:scale-110 flex items-center justify-center" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 50%, #f093fb 100%)">
                      <svg class="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
                      </svg>
                      <input
                        id="bg-color-picker"
                        type="color"
                        bind:value={backgroundColor}
                        on:change={() => updateSceneBackground()}
                        class="absolute inset-0 opacity-0 cursor-pointer"
                        title="Custom color"
                      />
                    </label>
                  </div>
                </div>
              {/if}

              <!-- Intensity Slider -->
              {#if useEnvironment}
                <div class="space-y-2">
                  <div class="flex items-center justify-between">
                    <label for="intensity" class="text-sm {isDarkCard ? 'text-white' : 'text-white/80'}">Intensity</label>
                    <span class="text-xs {isDarkCard ? 'text-white' : 'text-white/60'}">{environmentIntensity.toFixed(1)}</span>
                  </div>
                  <input
                    id="intensity"
                    type="range"
                    min="0"
                    max="2"
                    step="0.1"
                    bind:value={environmentIntensity}
                    class="w-full h-2 rounded-lg appearance-none cursor-pointer slider {isDarkCard ? 'slider-dark bg-gray-400' : 'bg-white/20'}"
                  />
                </div>

                <!-- Custom HDRI Upload -->
                <div class="space-y-3 pt-2 border-t {isDarkCard ? 'border-white/20' : 'border-white/10'}">
                  <label for="hdri-file" class="text-sm font-medium {isDarkCard ? 'text-white' : 'text-white/80'}">Custom HDRI</label>

                  {#if customHDRI}
                    <!-- Show when custom HDRI is loaded -->
                    <div class="flex items-center justify-between bg-green-500/10 border border-green-500/30 rounded-lg p-2">
                      <div class="flex items-center space-x-2">
                        <svg class="w-4 h-4 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
                        </svg>
                        <span class="text-xs text-green-400">Custom HDRI loaded</span>
                      </div>
                      <button
                        on:click={resetToDefaultEnvironment}
                        class="text-xs text-white/60 hover:text-white transition-colors underline"
                      >
                        Reset
                      </button>
                    </div>
                  {:else}
                    <!-- Upload button when no custom HDRI -->
                    <input
                      type="file"
                      accept=".hdr,.jpg,.jpeg,.png"
                      on:change={handleHDRIUpload}
                      class="hidden"
                      id="hdri-file"
                      disabled={isLoadingHDRI}
                    />
                    <label
                      for="hdri-file"
                      class="w-full py-2 px-4 text-center cursor-pointer flex items-center justify-center space-x-2 {isLoadingHDRI ? 'opacity-50 cursor-not-allowed' : ''} {isDarkCard ? 'glass-button-light' : 'glass-button'}"
                    >
                      {#if isLoadingHDRI}
                        <svg class="w-4 h-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        <span class="text-sm">Processing...</span>
                      {:else}
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                        </svg>
                        <span class="text-sm">Upload HDRI</span>
                      {/if}
                    </label>
                    <p class="text-xs {isDarkCard ? 'text-white/90' : 'text-white/40'}">Supports: .hdr, .jpg, .png (max 15MB)</p>
                  {/if}

                  <!-- Error message -->
                  {#if hdriError}
                    <div class="bg-red-500/10 border border-red-500/30 rounded-lg p-2">
                      <p class="text-xs text-red-400">{hdriError}</p>
                    </div>
                  {/if}
                </div>
              {/if}

              <div class="pt-2 border-t {isDarkCard ? 'border-white/20' : 'border-white/10'}">
                <p class="text-xs {isDarkCard ? 'text-white/90' : 'text-white/50'}">Environment map provides realistic lighting and reflections</p>
              </div>
            </div>
          <!-- Notes Section -->
          <div class="w-64 animate-slide-up transition-all duration-300 {isDarkCard ? 'glass-card-light' : 'glass-card'}">
            <!-- Header - Always visible -->
            <button
              on:click={() => notesExpanded = !notesExpanded}
              class="w-full p-4 flex items-center justify-between transition-colors {isDarkCard ? 'hover:bg-black/10' : 'hover:bg-indigo-500/10'}"
            >
              <div class="flex items-center space-x-2">
                <svg class="w-4 h-4 {isDarkCard ? 'text-white' : 'text-white/80'}" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
                <h3 class="font-semibold text-sm gradient-text">Notes</h3>
              </div>
              <div class="flex items-center space-x-2">
                {#if savingNotes}
                  <span class="text-xs {isDarkCard ? 'text-white' : 'text-white/50'}">Saving...</span>
                {:else if notesSaved}
                  <span class="text-xs text-green-400">Saved</span>
                {/if}
                <svg
                  class="w-4 h-4 transition-transform {notesExpanded ? 'rotate-180' : ''} {isDarkCard ? 'text-white' : 'text-white/40'}"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            </button>

            <!-- Expandable Content -->
            {#if notesExpanded}
              <div class="px-4 pb-4 space-y-2 animate-slide-up">
                <textarea
                  bind:value={description}
                  on:input={handleNotesInput}
                  placeholder="Add notes or description for this model..."
                  class="w-full h-32 px-3 py-2 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all bg-white/90 text-gray-900 placeholder-gray-500 border border-gray-300"
                ></textarea>
                <p class="text-xs {isDarkCard ? 'text-white/90' : 'text-white/40'}">Changes save automatically</p>
              </div>
            {/if}
          </div>
          {/if}
        </div>
      {/if}
    </div>

    <!-- Footer with metadata -->
    <div class="p-6 border-t border-white/10">
      <div class="flex items-center justify-between">
        <div class="flex items-center space-x-4">
          <div class="flex items-center space-x-2">
            <div class="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-pink-600 flex items-center justify-center">
              <svg class="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
              </svg>
            </div>
            <div>
              <p class="text-sm font-medium">Local File</p>
              <p class="text-xs text-white/50">
                {(asset.fileSize / 1024 / 1024).toFixed(2)} MB • Added {new Date(asset.createdAt).toLocaleDateString()}
              </p>
            </div>
          </div>
        </div>

        {#if asset.tags && asset.tags.length > 0}
          <div class="flex flex-wrap gap-2">
            {#each asset.tags as tag}
              <span class="px-3 py-1 bg-white/10 rounded-full text-sm font-medium">
                {tag}
              </span>
            {/each}
          </div>
        {/if}
      </div>
    </div>
  </div>
</div>

<style>
  /* Custom slider styles */
  input[type="range"].slider {
    -webkit-appearance: none;
    appearance: none;
  }

  input[type="range"].slider::-webkit-slider-thumb {
    -webkit-appearance: none;
    appearance: none;
    width: 16px;
    height: 16px;
    border-radius: 50%;
    background: linear-gradient(135deg, #6366f1, #a855f7);
    cursor: pointer;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
  }

  input[type="range"].slider::-moz-range-thumb {
    width: 16px;
    height: 16px;
    border-radius: 50%;
    background: linear-gradient(135deg, #6366f1, #a855f7);
    cursor: pointer;
    border: none;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
  }

  input[type="range"].slider::-webkit-slider-track {
    background: rgba(255, 255, 255, 0.2);
    border-radius: 4px;
    height: 8px;
  }

  input[type="range"].slider::-moz-range-track {
    background: rgba(255, 255, 255, 0.2);
    border-radius: 4px;
    height: 8px;
  }

  /* Dark slider variant for light backgrounds */
  input[type="range"].slider-dark::-webkit-slider-thumb {
    background: linear-gradient(135deg, #4f46e5, #7c3aed);
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.5);
  }

  input[type="range"].slider-dark::-moz-range-thumb {
    background: linear-gradient(135deg, #4f46e5, #7c3aed);
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.5);
  }

  input[type="range"].slider-dark::-webkit-slider-track {
    background: rgba(107, 114, 128, 0.4);
  }

  input[type="range"].slider-dark::-moz-range-track {
    background: rgba(107, 114, 128, 0.4);
  }

  /* Light background variants - for when viewer background is light */
  .glass-card-light {
    background: rgba(0, 0, 0, 0.6);
    backdrop-filter: blur(16px);
    -webkit-backdrop-filter: blur(16px);
    border: 1px solid rgba(0, 0, 0, 0.2);
    border-radius: 1rem;
    box-shadow: 0 8px 32px 0 rgba(0, 0, 0, 0.15);
    color: rgb(243, 244, 246); /* gray-100 */
  }

  .glass-button-light {
    background: rgba(0, 0, 0, 0.5);
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    border: 1px solid rgba(0, 0, 0, 0.2);
    border-radius: 0.75rem;
    padding: 0.75rem 1.5rem;
    transition: all 0.3s ease;
    color: rgb(243, 244, 246); /* gray-100 */
  }

  .glass-button-light:hover {
    background: rgba(0, 0, 0, 0.65);
    border-color: rgba(0, 0, 0, 0.3);
  }

  .glass-button-light:active {
    transform: scale(0.95);
  }
</style>
