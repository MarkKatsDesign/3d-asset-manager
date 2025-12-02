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
  import { EXRLoader } from 'three/examples/jsm/loaders/EXRLoader.js';
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
  let currentModelGroup = null; // Track the loaded model for proper disposal
  let isGeometryOnlyFormat = false; // Tracks if current format doesn't support textures

  // Environment controls
  let useEnvironment = true;
  let environmentIntensity = 1.0;
  let showControls = false;
  let showNotes = false;
  let customHDRI = null;
  let originalHDRITexture = null; // Store original texture for screenshot regeneration
  let isLoadingHDRI = false;
  let hdriError = null;
  let showGrid = false;
  let transparentBackground = false;
  let showHDRIBackground = false;
  let backgroundColor = '#2a2a3e'; // Default studio blue
  let isLightBackground = false; // Tracks if current background is light
  let isDarkCard = false; // Tracks if card should use dark styling (for light backgrounds)
  let hdriRotation = 0; // HDRI rotation in degrees (0-360)
  let environmentTexture = null; // Store the base texture for rotation

  // Screenshot settings
  let screenshotQuality = '1080p';
  let takingScreenshot = false;
  let showQualityMenu = false;

  // Notes section
  let description = asset.description || '';
  let saveTimeout;
  let savingNotes = false;
  let notesSaved = false;
  let currentAssetId = asset.id;

  // Reactively update description when viewing a different asset
  $: if (asset && asset.id !== currentAssetId) {
    currentAssetId = asset.id;
    description = asset.description || '';
  }

  // Technical details
  let showTechnicalDetails = false;
  let modelStats = null;
  let technicalDetailsSection;

  // Auto-rotation
  let autoRotate = false;
  let rotationSpeed = 0.3; // Degrees per frame (range: 0.05 to 2.0)
  let showRotationControls = false;

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

  // Custom thumbnail upload
  let uploadingThumbnail = false;
  let thumbnailUploadSuccess = false;
  let fallbackThumbnail = null; // Store thumbnail to show when model fails

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

  /**
   * Get file format/extension from asset
   */
  function getFileFormat() {
    if (!asset.filePath) return 'Unknown';
    const extension = asset.filePath.split('.').pop()?.toUpperCase();
    return extension || 'Unknown';
  }

  /**
   * Format number with comma separators
   */
  function formatNumber(num) {
    return num.toLocaleString('en-US');
  }

  /**
   * Calculate technical stats from loaded model
   */
  function calculateModelStats(model) {
    let triangles = 0;
    let vertices = 0;
    let meshCount = 0;
    const materials = new Set();
    const textures = new Set();
    let texturedMaterialCount = 0;

    model.traverse((child) => {
      if (child.isMesh) {
        meshCount++;

        // Count vertices
        if (child.geometry?.attributes?.position) {
          vertices += child.geometry.attributes.position.count;
        }

        // Count triangles
        if (child.geometry?.index) {
          triangles += child.geometry.index.count / 3;
        } else if (child.geometry?.attributes?.position) {
          triangles += child.geometry.attributes.position.count / 3;
        }

        // Count materials and textures
        const mats = Array.isArray(child.material) ? child.material : [child.material];
        mats.forEach(mat => {
          if (mat) {
            materials.add(mat.uuid);

            // Check for textures
            let hasTexture = false;
            if (mat.map) { textures.add(mat.map.uuid); hasTexture = true; }
            if (mat.normalMap) { textures.add(mat.normalMap.uuid); hasTexture = true; }
            if (mat.roughnessMap) { textures.add(mat.roughnessMap.uuid); hasTexture = true; }
            if (mat.metalnessMap) { textures.add(mat.metalnessMap.uuid); hasTexture = true; }
            if (mat.aoMap) { textures.add(mat.aoMap.uuid); hasTexture = true; }
            if (mat.emissiveMap) { textures.add(mat.emissiveMap.uuid); hasTexture = true; }

            if (hasTexture) texturedMaterialCount++;
          }
        });
      }
    });

    // Calculate texture memory estimate (rough approximation)
    let estimatedTextureMemory = 0;
    textures.forEach(() => {
      // Rough estimate: average 1MB per texture
      estimatedTextureMemory += 1;
    });

    return {
      triangles: Math.floor(triangles),
      vertices,
      meshCount,
      materialCount: materials.size,
      texturedMaterialCount,
      textureCount: textures.size,
      estimatedTextureMemoryMB: estimatedTextureMemory
    };
  }

  onMount(async () => {
    // Load existing thumbnail (useful when model fails to load)
    try {
      fallbackThumbnail = await window.electronAPI.getThumbnail(asset.id);
    } catch (error) {
      console.log('No existing thumbnail found');
    }

    initScene();
    loadModel();

    // Handle window resize
    window.addEventListener('resize', handleResize);
  });

  onDestroy(async () => {
    // Save any pending notes before component is destroyed
    if (saveTimeout) {
      clearTimeout(saveTimeout);
      // Note: await may not complete if component is destroyed rapidly
      // but we'll try our best
      try {
        await saveNotes();
      } catch (error) {
        console.error('Error saving notes on destroy:', error);
      }
    }

    // Cleanup Three.js resources and event listeners
    cleanup();
    window.removeEventListener('resize', handleResize);
  });

  function initScene() {
    // Scene
    scene = new THREE.Scene();
    updateSceneBackground();
    // Disable fog to allow free navigation inside models
    // scene.fog = new THREE.Fog(0x2a2a3e, 20, 100);

    // Camera
    camera = new THREE.PerspectiveCamera(
      50,
      container.clientWidth / container.clientHeight,
      0.001, // Very small near plane to avoid clipping when zoomed in close
      10000  // Large far plane for big scenes
    );
    camera.position.set(3, 3, 3);

    // Renderer
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });

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

    // PMREM Generator for environment maps
    pmremGenerator = new THREE.PMREMGenerator(renderer);
    pmremGenerator.compileEquirectangularShader();

    // Setup default environment
    setupEnvironment();

    // Controls
    controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.screenSpacePanning = true; // Allow free panning in screen space
    controls.panSpeed = 1.5; // Faster panning for easier navigation
    controls.rotateSpeed = 1.0;
    controls.minDistance = 0.01; // Allow very close zoom
    controls.maxDistance = Infinity; // No limit on zoom out
    controls.maxPolarAngle = Math.PI;

    // Auto-pause rotation when user interacts with controls
    controls.addEventListener('start', () => {
      if (autoRotate) {
        autoRotate = false;
      }
    });

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
    } else if (showHDRIBackground && scene.environment) {
      // Show HDRI as background
      scene.background = scene.environment;
      scene.fog = null; // Disable fog with HDRI background
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
      // Get selected quality preset
      const preset = qualityPresets.find(p => p.id === screenshotQuality);
      if (!preset) return;

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

      // Store original background and environment to restore after screenshot
      const originalBackground = scene.background;
      const originalEnvironment = scene.environment;

      // Set background to match current scene
      if (transparentBackground) {
        screenshotRenderer.setClearColor(0x000000, 0);
        scene.background = null;
      } else if (showHDRIBackground && scene.environment) {
        // Use HDRI as background for screenshot
        screenshotRenderer.setClearColor(0x000000, 0);
        // scene.background will be set to environment after regeneration
      } else {
        const bgColor = new THREE.Color(backgroundColor);
        screenshotRenderer.setClearColor(bgColor, 1);
        scene.background = bgColor;
      }

      // CRITICAL: Create a new PMREM generator for the screenshot renderer
      // The environment map must be regenerated for this renderer's WebGL context
      if (useEnvironment && originalHDRITexture) {
        const screenshotPMREM = new THREE.PMREMGenerator(screenshotRenderer);
        screenshotPMREM.compileEquirectangularShader();

        // Regenerate the environment from the original texture for this renderer
        const screenshotEnvMap = screenshotPMREM.fromEquirectangular(originalHDRITexture).texture;
        scene.environment = screenshotEnvMap;

        // If HDRI background is enabled, set it as the scene background too
        if (showHDRIBackground) {
          scene.background = screenshotEnvMap;
        }

        screenshotPMREM.dispose();
      } else if (useEnvironment && !originalHDRITexture) {
        // The default environment should already work since it's procedural
        // If HDRI background is enabled, set the default environment as background
        if (showHDRIBackground && scene.environment) {
          scene.background = scene.environment;
        }
      }

      // Clone camera to preserve aspect ratio
      const screenshotCamera = camera.clone();
      screenshotCamera.aspect = preset.width / preset.height;
      screenshotCamera.updateProjectionMatrix();

      // Force the renderer to compile the scene with the environment
      // This ensures all materials and environment maps are ready
      screenshotRenderer.compile(scene, screenshotCamera);

      // Render the scene (which already has all lights, environment, and models)
      screenshotRenderer.render(scene, screenshotCamera);

      // Restore original environment and background for the main viewer
      scene.environment = originalEnvironment;
      scene.background = originalBackground;

      // Get image data
      const imageData = screenshotCanvas.toDataURL('image/png');

      // Generate filename
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T');
      const dateStr = timestamp[0];
      const timeStr = timestamp[1].split('.')[0];
      const filename = `${asset.name}_${dateStr}_${timeStr}.png`;

      // Save screenshot using Electron dialog
      const result = await window.electronAPI.saveScreenshot(imageData, filename);

      if (result.error) {
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

  async function handleUploadThumbnail() {
    // Create file input element
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/jpeg,image/png,image/webp';
    input.style.display = 'none';

    input.onchange = async (e) => {
      const file = e.target.files[0];
      if (!file) return;

      try {
        uploadingThumbnail = true;
        thumbnailUploadSuccess = false;

        // Read file as data URL
        const reader = new FileReader();
        reader.onload = async (event) => {
          const img = new Image();
          img.onload = async () => {
            // Create canvas to resize image to 400x400
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            canvas.width = 400;
            canvas.height = 400;

            // Calculate scaling to cover the canvas (maintain aspect ratio)
            const scale = Math.max(400 / img.width, 400 / img.height);
            const scaledWidth = img.width * scale;
            const scaledHeight = img.height * scale;

            // Center the image
            const x = (400 - scaledWidth) / 2;
            const y = (400 - scaledHeight) / 2;

            // Draw image centered and scaled
            ctx.drawImage(img, x, y, scaledWidth, scaledHeight);

            // Convert to PNG data URL
            const thumbnailData = canvas.toDataURL('image/png');

            // Save to database
            await window.electronAPI.saveThumbnail(asset.id, thumbnailData);

            // Load the thumbnail for display (in case model failed to load)
            fallbackThumbnail = thumbnailData;

            // Trigger asset update to refresh thumbnail in grid
            localAssetStore.triggerAssetUpdate(asset.id);

            // Show success feedback
            uploadingThumbnail = false;
            thumbnailUploadSuccess = true;

            // Hide success message after 2 seconds
            setTimeout(() => {
              thumbnailUploadSuccess = false;
            }, 2000);

            console.log('Custom thumbnail uploaded successfully');
          };

          img.src = event.target.result;
        };

        reader.readAsDataURL(file);
      } catch (error) {
        console.error('Error uploading thumbnail:', error);
        uploadingThumbnail = false;
        alert('Failed to upload thumbnail. Please try again.');
      }
    };

    // Trigger file picker
    input.click();
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
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.ClampToEdgeWrapping;

    // Dispose of old environment map if it exists
    if (scene.environment && scene.environment.dispose) {
      scene.environment.dispose();
    }

    // Store texture for rotation
    environmentTexture = texture;

    // Generate PMREM for the environment (rotation will be applied later if needed)
    const envMap = pmremGenerator.fromEquirectangular(texture).texture;

    // Apply to scene
    scene.environment = envMap;

    // Set initial intensity
    updateEnvironmentIntensity();
  }

  function rotateDataTexturePixels(sourceTexture, rotationDegrees) {
    // For DataTextures (HDR/EXR), manually shift the pixel data
    const image = sourceTexture.image;
    if (!image || !image.data) return sourceTexture;

    const width = image.width;
    const height = image.height;
    const data = image.data;
    const bytesPerPixel = data.length / (width * height);

    // Calculate horizontal pixel shift for rotation
    const shiftPixels = Math.floor((rotationDegrees / 360) * width);
    if (shiftPixels === 0) return sourceTexture;

    // Create new data array for rotated texture
    const rotatedData = new data.constructor(data.length);

    // Copy pixels with horizontal shift (wrapping around)
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        // Calculate source x position (wrap around)
        const srcX = (x + shiftPixels) % width;
        const srcIndex = (y * width + srcX) * bytesPerPixel;
        const dstIndex = (y * width + x) * bytesPerPixel;

        // Copy all bytes for this pixel
        for (let b = 0; b < bytesPerPixel; b++) {
          rotatedData[dstIndex + b] = data[srcIndex + b];
        }
      }
    }

    // Create new DataTexture with rotated data
    const rotatedTexture = new THREE.DataTexture(
      rotatedData,
      width,
      height,
      sourceTexture.format,
      sourceTexture.type
    );
    rotatedTexture.mapping = THREE.EquirectangularReflectionMapping;
    rotatedTexture.colorSpace = sourceTexture.colorSpace;
    rotatedTexture.needsUpdate = true;

    return rotatedTexture;
  }

  function rotateImageTexture(sourceTexture, rotationDegrees) {
    // For standard image textures (JPG/PNG)
    const image = sourceTexture.image;

    // Check if image is a valid drawable element
    if (!(image instanceof HTMLImageElement ||
          image instanceof HTMLCanvasElement ||
          image instanceof ImageBitmap)) {
      return sourceTexture;
    }

    // Create a canvas to manually rotate the texture
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    canvas.width = image.width;
    canvas.height = image.height;

    // Calculate horizontal pixel shift for rotation
    const shiftPixels = Math.floor((rotationDegrees / 360) * canvas.width);

    // Draw the texture in two parts to create seamless rotation
    // Part 1: Draw the right portion on the left
    ctx.drawImage(
      image,
      canvas.width - shiftPixels, 0, shiftPixels, canvas.height,  // source
      0, 0, shiftPixels, canvas.height  // destination
    );

    // Part 2: Draw the left portion on the right
    ctx.drawImage(
      image,
      0, 0, canvas.width - shiftPixels, canvas.height,  // source
      shiftPixels, 0, canvas.width - shiftPixels, canvas.height  // destination
    );

    // Create new texture from rotated canvas
    const rotatedTexture = new THREE.CanvasTexture(canvas);
    rotatedTexture.mapping = THREE.EquirectangularReflectionMapping;
    rotatedTexture.colorSpace = sourceTexture.colorSpace || THREE.SRGBColorSpace;

    return rotatedTexture;
  }

  function rotateEquirectangularTexture(sourceTexture, rotationDegrees) {
    // Check texture type and use appropriate rotation method
    if (sourceTexture.isDataTexture || !sourceTexture.image?.width) {
      return rotateDataTexturePixels(sourceTexture, rotationDegrees);
    } else {
      return rotateImageTexture(sourceTexture, rotationDegrees);
    }
  }

  function applyEnvironmentRotation() {
    if (!environmentTexture || !scene || !pmremGenerator) return;

    // Create rotated version of the texture
    const rotatedTexture = rotateEquirectangularTexture(environmentTexture, hdriRotation);

    // If rotation wasn't possible, skip regenerating
    if (rotatedTexture === environmentTexture && hdriRotation !== 0) {
      return;
    }

    // Dispose of old environment map before creating new one
    if (scene.environment && scene.environment.dispose) {
      scene.environment.dispose();
    }

    // Generate PMREM from rotated texture
    const envMap = pmremGenerator.fromEquirectangular(rotatedTexture).texture;

    // Update scene environment
    scene.environment = envMap;
    if (customHDRI) {
      customHDRI = envMap;
    }

    // Update background if HDRI background is shown
    if (showHDRIBackground) {
      scene.background = envMap;
    }

    // Clean up the temporary rotated texture if it's different from source
    if (rotatedTexture !== environmentTexture) {
      rotatedTexture.dispose();
    }
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

    // Show warning for large files but still allow loading
    const fileSizeMB = file.size / 1024 / 1024;
    if (fileSizeMB > 50) {
      console.warn(`Large HDRI file detected: ${fileSizeMB.toFixed(1)}MB. Loading may take a moment...`);
    }

    hdriError = null;
    isLoadingHDRI = true;

    try {
      const fileURL = URL.createObjectURL(file);
      const fileName = file.name.toLowerCase();

      let texture;

      if (fileName.endsWith('.hdr')) {
        // Load HDR file (RGBE format)
        const rgbeLoader = new RGBELoader();
        texture = await new Promise((resolve, reject) => {
          rgbeLoader.load(
            fileURL,
            (loadedTexture) => resolve(loadedTexture),
            undefined,
            (err) => reject(err)
          );
        });
      } else if (fileName.endsWith('.exr')) {
        // Load EXR file (OpenEXR format)
        const exrLoader = new EXRLoader();
        texture = await new Promise((resolve, reject) => {
          exrLoader.load(
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
        throw new Error('Unsupported file format. Please use .hdr, .exr, .jpg, or .png files.');
      }

      // Set texture mapping and wrapping for rotation
      texture.mapping = THREE.EquirectangularReflectionMapping;
      texture.wrapS = THREE.RepeatWrapping;
      texture.wrapT = THREE.ClampToEdgeWrapping;

      // Dispose of old textures BEFORE creating new ones to prevent memory leaks
      if (originalHDRITexture && originalHDRITexture.dispose) {
        originalHDRITexture.dispose();
      }
      if (environmentTexture && environmentTexture.dispose) {
        environmentTexture.dispose();
      }
      if (scene.environment && scene.environment.dispose) {
        scene.environment.dispose();
      }
      if (customHDRI && customHDRI.dispose) {
        customHDRI.dispose();
      }

      // Store the original texture for screenshot regeneration
      originalHDRITexture = texture.clone();
      originalHDRITexture.wrapS = THREE.RepeatWrapping;
      originalHDRITexture.wrapT = THREE.ClampToEdgeWrapping;

      // Store texture for rotation
      environmentTexture = texture;

      // Generate PMREM with rotation applied
      const rotatedTexture = rotateEquirectangularTexture(texture, hdriRotation);
      const envMap = pmremGenerator.fromEquirectangular(rotatedTexture).texture;

      // Clean up rotated texture if different from original
      if (rotatedTexture !== texture) {
        rotatedTexture.dispose();
      }

      // Apply to scene
      customHDRI = envMap;
      scene.environment = envMap;

      // Auto-adjust intensity for HDR/EXR files (they're typically much brighter)
      // Set to 0.4 for better default appearance
      if (fileName.endsWith('.hdr') || fileName.endsWith('.exr')) {
        environmentIntensity = 0.4;
      }

      updateEnvironmentIntensity();

      // Don't dispose original texture - we need it for rotation
      URL.revokeObjectURL(fileURL);

      isLoadingHDRI = false;
    } catch (err) {
      console.error('Error loading HDRI:', err);
      hdriError = err.message || 'Failed to load HDRI file. Please try another file.';
      isLoadingHDRI = false;
    }
  }

  function resetToDefaultEnvironment() {
    // Dispose of custom HDRI resources
    if (customHDRI && customHDRI.dispose) {
      customHDRI.dispose();
    }
    if (environmentTexture && environmentTexture.dispose) {
      environmentTexture.dispose();
    }
    if (originalHDRITexture && originalHDRITexture.dispose) {
      originalHDRITexture.dispose();
    }

    customHDRI = null;
    environmentTexture = null;
    originalHDRITexture = null;
    hdriError = null;
    hdriRotation = 0;
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
    showHDRIBackground; // Reactive dependency
  }

  // Update isLightBackground when backgroundColor changes (for color picker)
  $: {
    if (backgroundColor && !transparentBackground) {
      const luminance = getColorLuminance(backgroundColor);
      isLightBackground = luminance > 0.5;
    } else {
      isLightBackground = false;
    }
  }

  // Derived reactive flag for card styling
  $: {
    // Use dark card when: light solid background OR HDRI background is shown
    isDarkCard = (isLightBackground && !transparentBackground) || showHDRIBackground;
  }

  // Update environment rotation
  $: if (scene && hdriRotation !== undefined) {
    applyEnvironmentRotation();

    // Force a render to show the change
    if (renderer) {
      renderer.render(scene, camera);
    }
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

      // Check file size (prevent crashes with huge files)
      const fileSizeMB = modelData.byteLength / (1024 * 1024);
      const MAX_VIEWER_SIZE_MB = 500; // 500MB limit for viewer

      if (fileSizeMB > MAX_VIEWER_SIZE_MB) {
        throw new Error(`FILE_TOO_LARGE:This model is too large to preview (${fileSizeMB.toFixed(0)}MB). Maximum supported size is ${MAX_VIEWER_SIZE_MB}MB.`);
      }

      // Create a blob from the buffer
      const blob = new Blob([modelData]);
      currentBlobUrl = URL.createObjectURL(blob);

      // Get file extension from filePath
      const fileName = asset.filePath ? asset.filePath.toLowerCase() : '';
      const extension = fileName.substring(fileName.lastIndexOf('.'));

      // Check if this format supports textures (GLTF not included - it requires scene.bin which won't load)
      isGeometryOnlyFormat = ['.obj', '.stl'].includes(extension);

      // Helper function to process and add model to scene
      const processModel = (model) => {
        // CRITICAL: Dispose of old model before loading new one to prevent memory leaks
        if (currentModelGroup) {
          // Remove from scene
          scene.remove(currentModelGroup);

          // Dispose of geometries and materials
          currentModelGroup.traverse((child) => {
            if (child.geometry) {
              child.geometry.dispose();
            }
            if (child.material) {
              if (Array.isArray(child.material)) {
                child.material.forEach(mat => mat.dispose());
              } else {
                child.material.dispose();
              }
            }
          });

          currentModelGroup = null;
        }

        // Center and scale model
        const box = new THREE.Box3().setFromObject(model);
        const center = box.getCenter(new THREE.Vector3());
        const size = box.getSize(new THREE.Vector3());
        const maxDim = Math.max(size.x, size.y, size.z);
        const scale = 2 / maxDim;

        // Create a parent group to ensure proper centering
        const modelGroup = new THREE.Group();
        modelGroup.add(model);

        // Center the model within the group
        model.position.set(-center.x, -center.y, -center.z);

        // Scale the group
        modelGroup.scale.setScalar(scale);

        // Enable shadows and enhance materials
        model.traverse((child) => {
          if (child.isMesh) {
            child.castShadow = true;
            child.receiveShadow = true;

            // Enhance materials that don't have textures
            if (child.material) {
              const materials = Array.isArray(child.material) ? child.material : [child.material];

              materials.forEach((mat, index) => {
                // Check if material lacks textures (no map, normalMap, or other texture maps)
                const hasTextures = mat.map || mat.normalMap || mat.roughnessMap || mat.metalnessMap || mat.aoMap;

                // If no textures, replace with a nice matte metal material
                if (!hasTextures) {
                  const color = mat.color || new THREE.Color(0x444444); // Preserve original color or use dark gray

                  const enhancedMaterial = new THREE.MeshStandardMaterial({
                    color: color,
                    metalness: 0.7,  // More metallic
                    roughness: 0.3,  // Smoother matte finish
                    envMapIntensity: 1.2,
                    flatShading: false
                  });

                  if (Array.isArray(child.material)) {
                    child.material[index] = enhancedMaterial;
                  } else {
                    child.material = enhancedMaterial;
                  }

                  // Dispose old material to free memory
                  mat.dispose();
                }
              });
            }
          }
        });

        scene.add(modelGroup);

        // Store reference to current model for future disposal
        currentModelGroup = modelGroup;

        // Calculate model statistics
        modelStats = calculateModelStats(model);
        console.log('Model stats:', modelStats);

        // Adjust camera to optimally frame the model
        // Calculate optimal distance based on FOV and model size
        const fov = camera.fov * (Math.PI / 180); // Convert to radians
        const paddingFactor = 1.3; // Add 30% padding around model
        const optimalDistance = paddingFactor * (maxDim * scale / 2) / Math.tan(fov / 2);

        // Position camera at optimal distance
        const normalizedDistance = optimalDistance / Math.sqrt(3); // Normalize for diagonal placement
        camera.position.set(normalizedDistance, normalizedDistance, normalizedDistance);
        camera.lookAt(0, 0, 0);
        controls.target.set(0, 0, 0);
        controls.update();

        loading = false;
        animate(); // Start animation loop
      };

      // Progress callback
      const onProgress = (progress) => {
        // Progress tracking (could be used for loading bars in future)
      };

      // Error callback
      const onError = (err) => {
        // Special error message for GLTF files with external dependencies
        if (extension === '.gltf' && err.message && err.message.includes('scene.bin')) {
          error = 'GLTF files with external .bin files are not supported. Please convert to GLB format (single file with everything embedded).';
        } else if (extension === '.gltf') {
          error = 'GLTF text format with external files is not supported. Please use GLB format instead.';
        } else if (err.message && err.message.includes('Invalid array length')) {
          error = 'This model is too complex or large to preview. Try using a professional 3D viewer like Blender or FBX Reviewer.';
        } else {
          console.log('Model loading error:', err.message || err);
          error = `Failed to load 3D model (${extension} format). The file might be corrupted or use unsupported features.`;
        }
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
              color: 0x444444,      // Dark gray
              metalness: 0.7,       // More metallic
              roughness: 0.3,       // Smoother matte finish
              envMapIntensity: 1.2
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
      // Handle file size error specially
      if (err.message && err.message.startsWith('FILE_TOO_LARGE:')) {
        error = err.message.replace('FILE_TOO_LARGE:', '');
      } else {
        console.error('Error loading model:', err);
        error = 'Failed to load model. The file might be corrupted or too complex.';
      }
      loading = false;
    }
  }

  function animate() {
    animationId = requestAnimationFrame(animate);

    // Auto-rotation: orbit camera around the model
    if (autoRotate && !loading) {
      const rotationAngle = rotationSpeed * (Math.PI / 180); // Convert to radians

      // Get current camera position
      const x = camera.position.x;
      const z = camera.position.z;

      // Rotate around Y-axis (vertical)
      camera.position.x = x * Math.cos(rotationAngle) - z * Math.sin(rotationAngle);
      camera.position.z = x * Math.sin(rotationAngle) + z * Math.cos(rotationAngle);

      // Keep camera looking at center
      camera.lookAt(0, 0, 0);
    }

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

    // Dispose of current model
    if (currentModelGroup) {
      scene.remove(currentModelGroup);
      currentModelGroup.traverse((child) => {
        if (child.geometry) {
          child.geometry.dispose();
        }
        if (child.material) {
          if (Array.isArray(child.material)) {
            child.material.forEach(mat => mat.dispose());
          } else {
            child.material.dispose();
          }
        }
      });
      currentModelGroup = null;
    }

    // Dispose of environment textures
    if (scene && scene.environment && scene.environment.dispose) {
      scene.environment.dispose();
    }
    if (customHDRI && customHDRI.dispose) {
      customHDRI.dispose();
    }
    if (environmentTexture && environmentTexture.dispose) {
      environmentTexture.dispose();
    }
    if (originalHDRITexture && originalHDRITexture.dispose) {
      originalHDRITexture.dispose();
    }

    // Dispose of PMREM generator
    if (pmremGenerator) {
      pmremGenerator.dispose();
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

  async function handleClose() {
    // Save notes immediately if there's a pending save
    if (saveTimeout) {
      clearTimeout(saveTimeout);
      await saveNotes();
    }
    onClose();
  }

  function handleOverlayKeydown(e) {
    if (e.key === 'Escape') {
      handleClose();
    }
  }

  // Auto-scroll to technical details when expanded
  $: if (showTechnicalDetails && technicalDetailsSection) {
    setTimeout(() => {
      technicalDetailsSection?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }, 100);
  }
</script>

<!-- Modal Overlay -->
<!-- svelte-ignore a11y-no-noninteractive-element-interactions -->
<div
  class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in"
  on:click={handleClose}
  on:keydown={handleOverlayKeydown}
  role="button"
  tabindex="0"
  aria-label="Close viewer modal"
>
  <!-- Modal Content -->
  <!-- svelte-ignore a11y-no-static-element-interactions -->
  <div
    class="glass-modal w-[95vw] h-[95vh] flex flex-col animate-slide-up overflow-hidden"
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
              <svg class="w-5 h-5 viewer-icon-outlined" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            {/if}
          </button>

          <!-- Quality Menu Dropdown -->
          {#if showQualityMenu && !takingScreenshot}
            <div class="absolute right-0 mt-2 w-56 p-2 z-50 animate-slide-down {isDarkCard ? 'glass-card-light' : 'glass-card'}">
              <div class="text-xs font-semibold px-3 py-2 {isDarkCard ? 'text-white/90' : 'opacity-60'}">QUALITY</div>
              {#each qualityPresets as preset}
                <button
                  on:click={() => { screenshotQuality = preset.id; takeScreenshot(); }}
                  class="w-full px-3 py-2.5 rounded-xl text-left transition-all duration-200 flex items-center justify-between gap-3
                    {screenshotQuality === preset.id ? (isDarkCard ? 'bg-white/20' : 'bg-white/10') : (isDarkCard ? 'hover:bg-white/10' : 'hover:bg-white/5')}"
                >
                  <div>
                    <div class="font-medium text-sm {isDarkCard ? 'text-white' : ''}">{preset.name}</div>
                    <div class="text-xs {isDarkCard ? 'text-white/80' : 'opacity-60'}">{preset.width} × {preset.height}</div>
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
          <svg class="w-5 h-5 viewer-icon-outlined" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
          </svg>
        </button>

        <!-- Upload Custom Thumbnail Button -->
        <button
          on:click={handleUploadThumbnail}
          disabled={uploadingThumbnail}
          class="glass-button p-3 {uploadingThumbnail ? 'opacity-50 cursor-not-allowed' : ''} {thumbnailUploadSuccess ? 'bg-green-500/20 border-green-400' : ''}"
          title={uploadingThumbnail ? 'Uploading...' : thumbnailUploadSuccess ? 'Thumbnail uploaded!' : 'Upload custom thumbnail'}
        >
          {#if uploadingThumbnail}
            <svg class="w-5 h-5 viewer-icon-outlined animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          {:else if thumbnailUploadSuccess}
            <svg class="w-5 h-5 viewer-icon-outlined text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
            </svg>
          {:else}
            <svg class="w-5 h-5 viewer-icon-outlined" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          {/if}
        </button>

        <button
          on:click={handleClose}
          class="glass-button p-3"
          title="Close"
        >
          <svg class="w-5 h-5 viewer-icon-outlined" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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

        <!-- Geometry Only Format Indicator -->
        {#if !loading && !error && isGeometryOnlyFormat}
          <div class="absolute top-4 left-4 z-10 glass-card px-4 py-2 flex items-center space-x-2 animate-fade-in">
            <svg class="w-4 h-4 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div>
              <p class="text-xs font-semibold text-blue-400">Geometry Only</p>
              <p class="text-[10px] text-white/50">Textures not supported for this format</p>
            </div>
          </div>
        {/if}

        {#if error}
          <div class="absolute inset-0 flex items-center justify-center">
            <div class="glass-card p-8 text-center max-w-md">
              <!-- Show thumbnail if available -->
              {#if fallbackThumbnail && !fallbackThumbnail.includes('svg+xml')}
                <div class="mb-6">
                  <img
                    src={fallbackThumbnail}
                    alt="Asset thumbnail"
                    class="w-64 h-64 object-contain mx-auto rounded-lg border border-white/10"
                  />
                  <p class="text-white/40 text-xs mt-2">Custom Thumbnail</p>
                </div>
              {:else}
                <svg class="w-16 h-16 text-red-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              {/if}
              <p class="text-red-400 font-semibold mb-2">Error Loading Model</p>
              <p class="text-white/60 text-sm mb-4">{error}</p>

              <!-- Tip for large files -->
              {#if error.includes('too large') || error.includes('too complex')}
                <div class="mt-6 p-4 bg-blue-500/10 border border-blue-500/30 rounded-lg text-left">
                  <div class="flex items-start gap-3">
                    <svg class="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <div>
                      <p class="text-blue-400 font-semibold text-sm mb-1">💡 Tip</p>
                      <p class="text-white/70 text-xs">Upload a custom thumbnail from your professional 3D software (Blender, Maya, etc.) using the <svg class="w-3.5 h-3.5 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg> icon above.</p>
                    </div>
                  </div>
                </div>
              {/if}
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

        <!-- Environment Controls and Notes -->
        <div class="absolute bottom-4 right-4 flex flex-col items-end gap-2">
          <!-- Auto-Rotate Button with Panel -->
          <div class="relative flex items-end">
            <button
              on:click={() => {
                autoRotate = !autoRotate;
                showRotationControls = !showRotationControls;
                if (showRotationControls) {
                  showControls = false;
                  showNotes = false;
                }
              }}
              class="p-3 transition-all duration-300 {autoRotate ? 'bg-indigo-500/30 border-indigo-400' : ''} {isLightBackground && !transparentBackground ? 'glass-button-light' : 'glass-button'}"
              title={autoRotate ? 'Stop auto-rotation' : 'Start auto-rotation'}
            >
              <svg class="w-5 h-5 viewer-icon-outlined {autoRotate ? 'animate-spin' : ''}" fill="none" stroke="currentColor" viewBox="0 0 24 24" style="animation-duration: 3s;">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </button>

            <!-- Rotation Controls Panel (Absolutely Positioned) -->
            {#if showRotationControls && autoRotate}
              <div class="absolute bottom-full right-0 mb-2 p-4 space-y-3 w-64 max-h-[calc(100vh-180px)] overflow-y-auto custom-scrollbar animate-slide-up transition-all duration-300 {isDarkCard ? 'glass-card-light' : 'glass-card'}">
                <h3 class="font-semibold text-sm gradient-text">Rotation Speed</h3>

                <!-- Speed Slider -->
                <div class="space-y-2">
                  <div class="flex items-center justify-between">
                    <label for="rotation-speed" class="text-sm {isDarkCard ? 'text-white' : 'text-white/80'}">Speed</label>
                    <span class="text-xs {isDarkCard ? 'text-white' : 'text-white/60'}">{rotationSpeed.toFixed(2)}°/frame</span>
                  </div>
                  <input
                    id="rotation-speed"
                    type="range"
                    min="0.05"
                    max="2.0"
                    step="0.05"
                    bind:value={rotationSpeed}
                    class="w-full h-2 rounded-lg appearance-none cursor-pointer slider {isDarkCard ? 'slider-dark bg-gray-400' : 'bg-white/20'}"
                  />
                  <div class="flex justify-between text-xs {isDarkCard ? 'text-white/70' : 'text-white/50'}">
                    <span>Slow</span>
                    <span>Fast</span>
                  </div>
                </div>

                <div class="pt-2 border-t {isDarkCard ? 'border-white/20' : 'border-white/10'}">
                  <p class="text-xs {isDarkCard ? 'text-white/90' : 'text-white/50'}">Adjust rotation speed for the perfect showcase</p>
                </div>
              </div>
            {/if}
          </div>

          <!-- Notes Button with Panel -->
          <div class="relative flex items-end">
            <button
              on:click={() => {
                showNotes = !showNotes;
                if (showNotes) {
                  showControls = false;
                  showRotationControls = false;
                }
              }}
              class="p-3 transition-all duration-300 {isLightBackground && !transparentBackground ? 'glass-button-light' : 'glass-button'}"
              title="Notes"
            >
              <svg class="w-5 h-5 viewer-icon-outlined" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
            </button>

            <!-- Notes Panel (Absolutely Positioned) -->
            {#if showNotes}
            <div class="absolute bottom-full right-0 mb-2 w-64 p-4 space-y-3 max-h-[calc(100vh-180px)] overflow-y-auto custom-scrollbar animate-slide-up transition-all duration-300 {isDarkCard ? 'glass-card-light' : 'glass-card'}">
              <!-- Header -->
              <div class="flex items-center justify-between">
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
                </div>
              </div>

              <!-- Notes Content -->
              <div class="space-y-2">
                <textarea
                  bind:value={description}
                  on:input={handleNotesInput}
                  placeholder="Add notes or description for this model..."
                  class="w-full h-48 px-3 py-2 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all bg-white/90 text-gray-900 placeholder-gray-500 border border-gray-300"
                ></textarea>
                <p class="text-xs {isDarkCard ? 'text-white/90' : 'text-white/40'}">Changes save automatically</p>
              </div>
            </div>
            {/if}
          </div>

          <!-- Environment Button with Panel -->
          <div class="relative flex items-end">
            <button
              on:click={() => {
                showControls = !showControls;
                if (showControls) {
                  showNotes = false;
                  showRotationControls = false;
                }
              }}
              class="p-3 transition-all duration-300 {isLightBackground && !transparentBackground ? 'glass-button-light' : 'glass-button'}"
              title="Environment settings"
            >
              <svg class="w-5 h-5 viewer-icon-outlined" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
            </button>

            {#if showControls}
              <!-- Environment Controls Card (Absolutely Positioned) -->
              <div class="absolute bottom-full right-0 mb-2 p-4 space-y-4 w-64 max-h-[calc(100vh-180px)] overflow-y-auto custom-scrollbar animate-slide-up transition-all duration-300 {isDarkCard ? 'glass-card-light' : 'glass-card'}">
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

              <!-- HDRI Background Toggle (only when environment is available and not transparent) -->
              {#if !transparentBackground && (useEnvironment && scene?.environment)}
                <div class="flex items-center justify-between">
                  <label for="hdri-bg-toggle" class="text-sm {isDarkCard ? 'text-white' : 'text-white/80'}">Show HDRI Background</label>
                  <button
                    id="hdri-bg-toggle"
                    on:click={() => showHDRIBackground = !showHDRIBackground}
                    class="relative inline-flex h-6 w-11 items-center rounded-full transition-colors {showHDRIBackground ? 'bg-indigo-500' : isDarkCard ? 'bg-white/30' : 'bg-white/20'}"
                  >
                    <span class="inline-block h-4 w-4 transform rounded-full bg-white transition-transform {showHDRIBackground ? 'translate-x-6' : 'translate-x-1'}"></span>
                  </button>
                </div>
              {/if}

              <!-- Background Color Selector (only when not transparent and not showing HDRI) -->
              {#if !transparentBackground && !showHDRIBackground}
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
                    <input
                      type="number"
                      bind:value={environmentIntensity}
                      min="0"
                      max="5"
                      step="0.01"
                      class="w-16 px-2 py-1 text-xs text-right rounded bg-white/10 border border-white/20 focus:outline-none focus:border-indigo-400 {isDarkCard ? 'text-white bg-black/20' : 'text-white'}"
                    />
                  </div>
                  <input
                    id="intensity"
                    type="range"
                    min="0"
                    max="3"
                    step="0.01"
                    bind:value={environmentIntensity}
                    class="w-full h-2 rounded-lg appearance-none cursor-pointer slider {isDarkCard ? 'slider-dark bg-gray-400' : 'bg-white/20'}"
                  />
                  <div class="flex justify-between text-xs {isDarkCard ? 'text-white/70' : 'text-white/50'}">
                    <span>0</span>
                    <span>3.0</span>
                  </div>
                </div>

                <!-- HDRI Rotation Slider -->
                <div class="space-y-2">
                  <div class="flex items-center justify-between">
                    <label for="hdri-rotation" class="text-sm {isDarkCard ? 'text-white' : 'text-white/80'}">HDRI Rotation</label>
                    <span class="text-xs {isDarkCard ? 'text-white' : 'text-white/60'}">{hdriRotation.toFixed(0)}°</span>
                  </div>
                  <input
                    id="hdri-rotation"
                    type="range"
                    min="0"
                    max="360"
                    step="1"
                    bind:value={hdriRotation}
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
                      accept=".hdr,.exr,.jpg,.jpeg,.png"
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
                        <span class="text-sm">Loading HDRI...</span>
                      {:else}
                        <svg class="w-4 h-4 viewer-icon-outlined" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 1 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                        </svg>
                        <span class="text-sm">Upload HDRI</span>
                      {/if}
                    </label>
                    <p class="text-xs {isDarkCard ? 'text-white/90' : 'text-white/40'}">Supports: .hdr, .exr, .jpg, .png</p>
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
            {/if}
          </div>
        </div>
      {/if}
    </div>

    <!-- Footer with metadata -->
    <div class="border-t border-white/10 overflow-y-auto flex-shrink-0 max-h-[40vh]">
      <div class="p-6">
        <div class="flex items-center justify-between">
          <div class="flex items-center space-x-4">
            <div class="flex items-center space-x-2">
              <div class="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-pink-600 flex items-center justify-center">
                <svg class="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                </svg>
              </div>
              <div>
                <p class="text-sm font-medium">{getFileFormat()} File</p>
                <p class="text-xs text-white/50">
                  {(asset.fileSize / 1024 / 1024).toFixed(2)} MB • Added {new Date(asset.createdAt).toLocaleDateString()}
                </p>
              </div>
            </div>
          </div>

          <div class="flex items-center gap-3">
            {#if asset.tags && asset.tags.length > 0}
              <div class="flex flex-wrap gap-2">
                {#each asset.tags as tag}
                  <span class="px-3 py-1 bg-white/10 rounded-full text-sm font-medium">
                    {tag}
                  </span>
                {/each}
              </div>
            {/if}

            <!-- Technical Details Button -->
            {#if modelStats}
              <button
                on:click={() => showTechnicalDetails = !showTechnicalDetails}
                class="glass-button px-4 py-2 flex items-center space-x-2 text-sm"
                title="Technical Details"
              >
                <svg class="w-4 h-4 viewer-icon-outlined" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>{showTechnicalDetails ? 'Hide' : 'Show'} Details</span>
                <svg
                  class="w-4 h-4 viewer-icon-outlined transition-transform {showTechnicalDetails ? 'rotate-180' : ''}"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
                </svg>
              </button>
            {/if}
          </div>
        </div>
      </div>

      <!-- Expandable Technical Details -->
      {#if showTechnicalDetails && modelStats}
        <div bind:this={technicalDetailsSection} class="px-6 pb-6 animate-slide-down">
          <div class="glass-card p-5">
            <h4 class="text-sm font-semibold gradient-text mb-4">Technical Information</h4>
            <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
              <!-- Geometry Stats -->
              <div class="space-y-1">
                <p class="text-xs text-white/50">Triangles</p>
                <p class="text-lg font-semibold">{formatNumber(modelStats.triangles)}</p>
              </div>
              <div class="space-y-1">
                <p class="text-xs text-white/50">Vertices</p>
                <p class="text-lg font-semibold">{formatNumber(modelStats.vertices)}</p>
              </div>
              <div class="space-y-1">
                <p class="text-xs text-white/50">Meshes</p>
                <p class="text-lg font-semibold">{modelStats.meshCount}</p>
              </div>

              <!-- Material Stats -->
              <div class="space-y-1">
                <p class="text-xs text-white/50">Materials</p>
                <p class="text-lg font-semibold">
                  {modelStats.materialCount}
                  {#if modelStats.texturedMaterialCount > 0}
                    <span class="text-xs text-white/50">({modelStats.texturedMaterialCount} textured)</span>
                  {/if}
                </p>
              </div>

              <!-- Texture Stats -->
              {#if modelStats.textureCount > 0}
                <div class="space-y-1">
                  <p class="text-xs text-white/50">Textures</p>
                  <p class="text-lg font-semibold">{modelStats.textureCount} maps</p>
                </div>
                <div class="space-y-1">
                  <p class="text-xs text-white/50">Est. Texture Memory</p>
                  <p class="text-lg font-semibold">~{modelStats.estimatedTextureMemoryMB} MB</p>
                </div>
              {/if}
            </div>
          </div>
        </div>
      {/if}
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
