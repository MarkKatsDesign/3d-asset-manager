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
  import { pb } from '../pocketbase';

  export let asset;
  export let onClose;

  let container;
  let scene, camera, renderer, controls, pmremGenerator;
  let animationId;
  let loading = true;
  let error = null;
  let gridHelper;
  let isGeometryOnlyFormat = false; // Tracks if current format doesn't support textures

  // Environment controls
  let useEnvironment = true;
  let environmentIntensity = 1.0;
  let showControls = false;
  let customHDRI = null;
  let isLoadingHDRI = false;
  let hdriError = null;
  let showGrid = true;
  let hdriRotation = 0; // Rotation in degrees (0-360)
  let environmentTexture = null; // Store the texture for rotation

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
    scene.background = new THREE.Color(0x2a2a3e); // Lighter background for better visibility
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

    // Store texture for rotation
    environmentTexture = texture;

    // Apply rotation
    applyEnvironmentRotation();

    // Generate PMREM for the environment
    const envMap = pmremGenerator.fromEquirectangular(texture).texture;

    // Apply to scene
    scene.environment = envMap;

    // Set initial intensity
    updateEnvironmentIntensity();
  }

  function applyEnvironmentRotation() {
    if (environmentTexture) {
      // Convert rotation from degrees to a 0-1 offset value
      // Offset.x shifts the texture horizontally, rotating the environment
      environmentTexture.offset.x = hdriRotation / 360;
      environmentTexture.needsUpdate = true;
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

      // Store texture for rotation
      environmentTexture = texture;

      // Apply rotation
      applyEnvironmentRotation();

      // Generate PMREM
      const envMap = pmremGenerator.fromEquirectangular(texture).texture;

      // Apply to scene
      customHDRI = envMap;
      scene.environment = envMap;
      updateEnvironmentIntensity();

      // Don't dispose texture - we need it for rotation
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

  function loadModel() {
    const modelUrl = pb.files.getUrl(asset, asset.file);

    // Get file extension
    const fileName = asset.file.toLowerCase();
    const extension = fileName.substring(fileName.lastIndexOf('.'));

    // Check if this format supports textures (GLTF not included - it requires scene.bin which won't load)
    isGeometryOnlyFormat = ['.obj', '.stl'].includes(extension);

    console.log('Loading file with extension:', extension, 'Geometry only:', isGeometryOnlyFormat);

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

      // Adjust camera to ensure model is visible
      const distance = 5;
      camera.position.set(distance, distance, distance);
      camera.lookAt(0, 0, 0);
      controls.target.set(0, 0, 0);
      controls.update();

      console.log('Camera position:', camera.position);
      console.log('Camera looking at:', controls.target);

      loading = false;
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

      // Special error message for GLTF files with external dependencies
      if (extension === '.gltf' && err.message && err.message.includes('scene.bin')) {
        error = 'GLTF files with external .bin files are not supported. Please convert to GLB format (single file with everything embedded).';
      } else if (extension === '.gltf') {
        error = 'GLTF text format with external files is not supported. Please use GLB format instead.';
      } else {
        error = `Failed to load 3D model (${extension} format).`;
      }
      loading = false;
    };

    // Load based on file extension
    if (extension === '.glb' || extension === '.gltf') {
      const loader = new GLTFLoader();
      loader.load(modelUrl, (gltf) => processModel(gltf.scene), onProgress, onError);
    } else if (extension === '.obj') {
      const loader = new OBJLoader();
      loader.load(modelUrl, (obj) => processModel(obj), onProgress, onError);
    } else if (extension === '.fbx') {
      const loader = new FBXLoader();
      loader.load(modelUrl, (fbx) => processModel(fbx), onProgress, onError);
    } else if (extension === '.stl') {
      const loader = new STLLoader();
      loader.load(
        modelUrl,
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

  function handleDownload() {
    const url = pb.files.getUrl(asset, asset.file);
    window.open(url, '_blank');
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
        <button
          on:click={handleDownload}
          class="glass-button p-3"
          title="Download"
        >
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
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
        <div class="absolute bottom-4 left-4 glass-card px-4 py-2 text-sm text-white/70">
          <p>Left click + drag to rotate</p>
          <p>Right click + drag to pan</p>
          <p>Scroll to zoom</p>
        </div>

        <!-- Environment Controls -->
        <div class="absolute bottom-4 right-4">
          <button
            on:click={() => showControls = !showControls}
            class="glass-button p-3 mb-2"
            title="Environment settings"
          >
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
            </svg>
          </button>

          {#if showControls}
            <div class="glass-card p-4 space-y-4 w-64 animate-slide-up">
              <h3 class="font-semibold text-sm gradient-text">Environment</h3>

              <!-- Environment Toggle -->
              <div class="flex items-center justify-between">
                <label for="env-toggle" class="text-sm text-white/80">Use Environment Map</label>
                <button
                  id="env-toggle"
                  on:click={() => useEnvironment = !useEnvironment}
                  class="relative inline-flex h-6 w-11 items-center rounded-full transition-colors {useEnvironment ? 'bg-indigo-500' : 'bg-white/20'}"
                >
                  <span class="inline-block h-4 w-4 transform rounded-full bg-white transition-transform {useEnvironment ? 'translate-x-6' : 'translate-x-1'}"></span>
                </button>
              </div>

              <!-- Grid Toggle -->
              <div class="flex items-center justify-between">
                <label for="grid-toggle" class="text-sm text-white/80">Show Grid</label>
                <button
                  id="grid-toggle"
                  on:click={() => showGrid = !showGrid}
                  class="relative inline-flex h-6 w-11 items-center rounded-full transition-colors {showGrid ? 'bg-indigo-500' : 'bg-white/20'}"
                >
                  <span class="inline-block h-4 w-4 transform rounded-full bg-white transition-transform {showGrid ? 'translate-x-6' : 'translate-x-1'}"></span>
                </button>
              </div>

              <!-- Intensity Slider -->
              {#if useEnvironment}
                <div class="space-y-2">
                  <div class="flex items-center justify-between">
                    <label for="intensity" class="text-sm text-white/80">Intensity</label>
                    <span class="text-xs text-white/60">{environmentIntensity.toFixed(1)}</span>
                  </div>
                  <input
                    id="intensity"
                    type="range"
                    min="0"
                    max="2"
                    step="0.1"
                    bind:value={environmentIntensity}
                    class="w-full h-2 bg-white/20 rounded-lg appearance-none cursor-pointer slider"
                  />
                </div>

                <!-- Custom HDRI Upload -->
                <div class="space-y-3 pt-2 border-t border-white/10">
                  <label for="hdri-file" class="text-sm text-white/80 font-medium">Custom HDRI</label>

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
                      for="hdri-upload"
                      class="glass-button w-full py-2 px-4 text-center cursor-pointer flex items-center justify-center space-x-2 {isLoadingHDRI ? 'opacity-50 cursor-not-allowed' : ''}"
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
                    <p class="text-xs text-white/40">Supports: .hdr, .jpg, .png (max 15MB)</p>
                  {/if}

                  <!-- Error message -->
                  {#if hdriError}
                    <div class="bg-red-500/10 border border-red-500/30 rounded-lg p-2">
                      <p class="text-xs text-red-400">{hdriError}</p>
                    </div>
                  {/if}
                </div>
              {/if}

              <div class="pt-2 border-t border-white/10">
                <p class="text-xs text-white/50">Environment map provides realistic lighting and reflections</p>
              </div>
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
            <div class="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-pink-600 flex items-center justify-center text-sm font-bold">
              {asset.expand?.user?.name?.charAt(0).toUpperCase() || 'U'}
            </div>
            <div>
              <p class="text-sm font-medium">{asset.expand?.user?.name || 'Unknown'}</p>
              <p class="text-xs text-white/50">{new Date(asset.created).toLocaleDateString()}</p>
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
</style>
