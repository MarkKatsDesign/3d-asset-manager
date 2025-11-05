<script>
  import { onMount, onDestroy } from 'svelte';
  import * as THREE from 'three';
  import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
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

  // Environment controls
  let useEnvironment = true;
  let environmentIntensity = 1.0;
  let showControls = false;

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
    scene.background = new THREE.Color(0x1a1a2e); // Lighter background for better visibility
    scene.fog = new THREE.Fog(0x1a1a2e, 10, 50);

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
    const gridHelper = new THREE.GridHelper(10, 10, 0x444444, 0x222222);
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

    // Generate PMREM for the environment
    const envMap = pmremGenerator.fromEquirectangular(texture).texture;

    // Apply to scene
    scene.environment = envMap;
    scene.environmentIntensity = environmentIntensity;

    texture.dispose();
  }

  function updateEnvironment() {
    if (useEnvironment) {
      setupEnvironment();
      scene.environmentIntensity = environmentIntensity;
    } else {
      scene.environment = null;
    }
  }

  // Reactive updates for environment controls
  $: if (scene) {
    updateEnvironment();
  }

  function loadModel() {
    const loader = new GLTFLoader();
    const modelUrl = pb.files.getUrl(asset, asset.file);

    loader.load(
      modelUrl,
      (gltf) => {
        const model = gltf.scene;

        // Center and scale model
        const box = new THREE.Box3().setFromObject(model);
        const center = box.getCenter(new THREE.Vector3());
        const size = box.getSize(new THREE.Vector3());
        const maxDim = Math.max(size.x, size.y, size.z);
        const scale = 2 / maxDim;

        model.position.sub(center);
        model.scale.setScalar(scale);

        // Enable shadows
        model.traverse((child) => {
          if (child.isMesh) {
            child.castShadow = true;
            child.receiveShadow = true;
          }
        });

        scene.add(model);

        // Adjust camera
        camera.position.set(3, 3, 3);
        camera.lookAt(0, 0, 0);
        controls.target.set(0, 0, 0);
        controls.update();

        loading = false;
      },
      (progress) => {
        // Progress callback
        const percentComplete = (progress.loaded / progress.total) * 100;
        console.log(`Loading: ${percentComplete.toFixed(2)}%`);
      },
      (err) => {
        console.error('Error loading model:', err);
        error = 'Failed to load 3D model. Please check the file format.';
        loading = false;
      }
    );
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
